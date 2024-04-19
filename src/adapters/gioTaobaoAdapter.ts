/**
 * 名称：淘宝小程序单发插件
 * 用途：用于提供淘宝小程序云函数和云应用的请求方法。
 */
import { EVENT, EXTEND_EVENT } from '@@/types/base';
import { GrowingIOType } from '@@/types/growingIO';
import { head, unset } from '@@/utils/glodash';
import EMIT_MSG from '@@/constants/emitMsg';

let ut;
class GioTaobaoAdapter {
  constructor(public growingIO: GrowingIOType) {
    const { utils, emitter } = this.growingIO;
    ut = utils;
    emitter.on(EMIT_MSG.OPTION_INITIALIZED, (growingIO: GrowingIOType) => {
      const { inPlugin, dataStore } = growingIO;
      if (inPlugin) {
        ut.getGlobal().Component = function (...args: any[]) {
          return dataStore.eventHooks.componentOverriding(args[0]);
        };
      }
    });
    emitter.on(EMIT_MSG.MINIP_LIFECYCLE, ({ event }) => {
      const { dataStore, vdsConfig } = this.growingIO;
      const widgetName = `小部件${vdsConfig.appId}`;
      switch (event) {
        case 'Page onInit':
          {
            const sendVisit = (relationAppInfo: any, sceneInfo: any) => {
              const query = ut
                .keys(relationAppInfo)
                .map((k) => `${k}=${relationAppInfo[k]}`)
                .join('&');
              dataStore.scene = sceneInfo.sceneId ?? '';
              dataStore.trackersExecute((trackingId: string) => {
                dataStore.sendVisit(trackingId, {
                  path: widgetName,
                  query,
                  title: widgetName
                });
              });
            };
            this.getRelationAppInfo((relationAppInfo: any) =>
              this.getSceneInfo(relationAppInfo, sendVisit)
            );
          }
          break;
        case 'Page didMount':
          dataStore.trackersExecute((trackingId: string) => {
            const { trackPage } = dataStore.getTrackerVds(trackingId);
            if (trackPage) {
              dataStore.sendPage(trackingId, {
                path: widgetName,
                title: widgetName
              });
            }
          });
          break;
        default:
          break;
      }
    });
  }

  // 小部件获取场景值信息
  getSceneInfo = (relationAppInfo: any, callback: any) => {
    this.growingIO.minipInstance.minip?.getRelationAppInfo({
      success: (res) => callback(relationAppInfo, res),
      fail: () => callback(relationAppInfo, {})
    });
  };

  // 小部件获取关联小程序的信息
  getRelationAppInfo = (callback: any) => {
    this.growingIO.minipInstance.minip?.getRelationAppInfo({
      success: callback,
      fail: () => callback({})
    });
  };

  // 单条发送无延迟
  singleInvoke = (trackingId: string) => {
    const { vdsConfig, emitter, uploader } = this.growingIO;
    const hoardingQueue = uploader.getHoardingQueue(trackingId);
    const requestQueue = uploader.getRequestQueue(trackingId);
    // 过滤掉重试超过3次的请求(直接丢弃)
    uploader.requestQueue[trackingId] = [...requestQueue].filter(
      (o) => (uploader.retryIds[o.requestId] || 0) < uploader.retryLimit
    );
    if (ut.isEmpty([...hoardingQueue, ...requestQueue])) {
      return;
    }
    const eventData: EXTEND_EVENT =
      hoardingQueue.shift() ?? requestQueue.shift();
    let requestData = { ...eventData };
    unset(requestData, ['requestId', 'trackingId']);
    // 开启debug模式时，打印事件日志
    if (vdsConfig.debug) {
      console.log('[GrowingIO Debug]:', JSON.stringify(requestData, null, 2));
    }
    emitter.emit(EMIT_MSG.ON_SEND_BEFORE, { requestData });
    this.cloudFuncInvoke(eventData, requestData);
  };

  // 云函数调用
  cloudFuncInvoke = (eventData: EXTEND_EVENT, requestData: EVENT) => {
    const { vdsConfig, emitter, uploader } = this.growingIO;
    const { serverUrl, projectId, tbConfig } = vdsConfig;
    const app = ut.niceTry(() => getApp() ?? $global);
    const cloud = tbConfig.cloud ?? app.cloud;
    if (cloud?.function?.invoke) {
      uploader.requestingNum += 1;
      cloud.function
        .invoke(
          tbConfig.cloudFuncName,
          {
            domain: serverUrl,
            path: `/v3/projects/${projectId}/collect`,
            params: { stm: Date.now() },
            body: requestData
          },
          tbConfig.cloudFuncHandler
        )
        .then((res) => {
          uploader.requestingNum -= 1;
          // 这里的返回值只是调用了api是否成功，真正是否上报成功不知道，要去淘宝控制台看
          if (res.success) {
            emitter.emit(EMIT_MSG.ON_SEND_AFTER, { result: res, requestData });
          } else {
            uploader.requestFailFn(eventData);
            ut.consoleText(`请求失败! ${JSON.stringify(res)}`, 'error');
          }
          uploader.initiateRequest(eventData.trackingId);
        })
        .catch((e) => {
          uploader.requestingNum -= 1;
          uploader.requestFailFn(eventData);
          ut.consoleText(`请求失败! ${JSON.stringify(e)}`, 'error');
          uploader.initiateRequest(eventData.trackingId);
        });
    } else {
      ut.consoleText(
        '请求失败！无法获取 cloud 对象，请检查 tbConfig 配置项！',
        'error'
      );
    }
  };

  // 云应用调用
  tbCloudAppInvoke(eventsQueue: EXTEND_EVENT[], requestData: EVENT) {
    const { vdsConfig, emitter, uploader } = this.growingIO;
    const { serverUrl, projectId, tbConfig } = vdsConfig;
    const app = ut.niceTry(() => getApp() ?? $global);
    const cloud = tbConfig.cloud ?? app.cloud;
    if (cloud?.application?.httpRequest) {
      const trackingId = head(eventsQueue).trackingId;
      uploader.requestingNum += 1;
      cloud.application
        .httpRequest({
          //不需要完整域名，只需要接口访问路径即可
          path: tbConfig.path,
          method: 'POST',
          headers: { 'Content-Type': 'application/json;charset=UTF-8' },
          params: { serverUrl, projectId, stm: Date.now() },
          body: requestData,
          exts: { cloudAppId: tbConfig.cloudAppId }
        })
        .then((res) => {
          uploader.requestingNum -= 1;
          // 这里的返回值只是调用了api是否成功，真正是否上报成功不知道，要看云应用的服务端是不是真的转发成功
          if (res.success) {
            emitter.emit(EMIT_MSG.ON_SEND_AFTER, { result: res, requestData });
          } else {
            eventsQueue.forEach((o: any) => {
              uploader.requestFailFn(o);
            });
            ut.consoleText(`请求失败! ${JSON.stringify(res)}`, 'error');
          }
          uploader.initiateRequest(trackingId);
        })
        .catch((e) => {
          uploader.requestingNum -= 1;
          eventsQueue.forEach((o: any) => {
            uploader.requestFailFn(o);
          });
          ut.consoleText(`请求失败! ${JSON.stringify(e)}`, 'error');
          uploader.initiateRequest(trackingId);
        });
    } else {
      ut.consoleText(
        '请求失败！无法获取 cloud 对象，请检查 tbConfig 配置项！',
        'error'
      );
    }
  }
}

export default { name: 'gioTaobaoAdapter', method: GioTaobaoAdapter };
