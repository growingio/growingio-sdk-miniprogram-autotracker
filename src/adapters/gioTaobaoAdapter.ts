/**
 * 名称：淘宝小程序单发插件
 * 用途：用于提供淘宝小程序云函数和云应用的请求方法。
 */
import { EVENT, EXTEND_EVENT } from '@@/types/base';
import { GrowingIOType } from '@@/types/growingIO';
import { unset } from '@@/utils/glodash';
import EMIT_MSG from '@@/constants/emitMsg';

let ut;
class GioTaobaoAdapter {
  public pluginVersion: string;
  constructor(public growingIO: GrowingIOType) {
    this.pluginVersion = '__PLUGIN_VERSION__';
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
    const { vdsConfig, uploader } = this.growingIO;
    let hoardingQueue = uploader.getHoardingQueue(trackingId);
    let requestQueue = uploader.getRequestQueue(trackingId);
    if (ut.isEmpty([...hoardingQueue, ...requestQueue])) {
      return;
    }
    const eventData: EXTEND_EVENT =
      hoardingQueue.shift() ?? requestQueue.shift();
    // 淘宝云函数是单条直发，不经过 Uploader.batchInvoke；事件从队列取出的这一刻
    // 就已经冻结，必须在这里与标准批量链路保持一致地消费 originalSource。
    uploader.prepareBatch(trackingId, [eventData]);
    let requestData = { ...eventData };
    unset(requestData, ['requestId', 'trackingId', 'originalSourceId']);
    // 开启debug模式时，打印事件日志
    if (vdsConfig.debug) {
      console.log('[GrowingIO Debug]:', JSON.stringify(requestData, null, 2));
    }
    this.cloudFuncInvoke(eventData, requestData);
  };

  // 云函数调用
  cloudFuncInvoke = (eventData: EXTEND_EVENT, requestData: EVENT) => {
    const { uploader } = this.growingIO;
    uploader.sendExternalEvent(
      [eventData],
      requestData,
      () => {
        const { serverUrl, projectId, tbConfig } = this.growingIO.vdsConfig;
        const app = ut.niceTry(() => getApp() ?? $global);
        const cloud = tbConfig.cloud ?? app?.cloud;
        if (!cloud?.function?.invoke) {
          // 事件已进入本次发送尝试，但不能在此处直接丢弃；抛出后由上传器
          // 统一回队、有限重试并释放请求槽位。
          throw new Error('无法获取 cloud.function.invoke，请检查 tbConfig 配置项');
        }
        return cloud.function.invoke(
          tbConfig.cloudFuncName,
          {
            domain: serverUrl,
            path: `/v3/projects/${projectId}/collect`,
            params: { stm: Date.now() },
            body: requestData
          },
          tbConfig.cloudFuncHandler
        );
      },
      // 云函数返回 success 只代表调用链路成功；服务端转发结果仍由云函数负责。
      (result) => !!result?.success,
      'taobao_cloud_function'
    );
  };

  // 云应用调用
  tbCloudAppInvoke(eventsQueue: EXTEND_EVENT[], requestData: EVENT) {
    const { uploader } = this.growingIO;
    uploader.sendExternalEvent(
      eventsQueue,
      requestData,
      () => {
        const { serverUrl, projectId, tbConfig } = this.growingIO.vdsConfig;
        const app = ut.niceTry(() => getApp() ?? $global);
        const cloud = tbConfig.cloud ?? app?.cloud;
        if (!cloud?.application?.httpRequest) {
          throw new Error(
            '无法获取 cloud.application.httpRequest，请检查 tbConfig 配置项'
          );
        }
        return cloud.application.httpRequest({
          //不需要完整域名，只需要接口访问路径即可
          path: tbConfig.path,
          method: 'POST',
          headers: { 'Content-Type': 'application/json;charset=UTF-8' },
          params: { serverUrl, projectId, stm: Date.now() },
          body: requestData,
          exts: { cloudAppId: tbConfig.cloudAppId }
        });
      },
      // 云应用与云函数一致：这里只能确认云平台调用成功，真实转发结果由云侧负责。
      (result) => !!result?.success,
      'taobao_cloud_application'
    );
  }
}

export default { name: 'gioTaobaoAdapter', method: GioTaobaoAdapter };
