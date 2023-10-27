/**
 * 名称：淘宝小程序单发插件
 * 用途：用于提供淘宝小程序云函数和云应用的请求方法。
 */
import { CdpEvent, SaasEvent } from '@@/types/base';
import { GrowingIOType } from '@@/types/growingIO';

let ut;
class GioTaobaoSendAdapter {
  constructor(public growingIO: GrowingIOType) {
    ut = this.growingIO.utils;
  }

  // 单条发送无延迟
  singleInvoke = () => {
    const { vdsConfig, emitter, uploader } = this.growingIO;
    // 过滤掉重试超过3次的请求(直接丢弃)
    const requestList: SaasEvent[] | CdpEvent[] = [
      ...uploader.hoardingQueue,
      ...uploader.requestQueue
    ].filter(
      (o) =>
        (uploader.retryIds[o.globalSequenceId || o.esid] || 0) <
        uploader.retryLimit
    );
    if (ut.isEmpty(requestList)) {
      return;
    }
    let requestData = requestList.shift();
    // 开启debug模式时，打印事件日志
    if (vdsConfig.debug) {
      console.log('[GrowingIO Debug]:', JSON.stringify(requestData, null, 2));
    }
    emitter.emit('onSendBefore', { requestData });
    this.cloudFuncInvoke(requestData);
  };

  // 云函数调用
  cloudFuncInvoke = (requestData) => {
    const { vdsConfig, emitter, uploader } = this.growingIO;
    let app;
    try {
      app = getApp();
    } catch (error) {
      app = $global;
    }
    if (!app) {
      app = $global;
    }
    if (app?.cloud?.function?.invoke) {
      const { host, projectId, tbConfig } = vdsConfig;
      uploader.requestingNum += 1;
      app?.cloud.function
        .invoke(
          tbConfig.cloudFuncName,
          {
            domain: host,
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
            emitter.emit('onSendAfter', { result: res });
          } else {
            uploader.requestFailFn(requestData);
            ut.consoleText(`请求失败! ${JSON.stringify(res)}`, 'error');
          }
          uploader.initiateRequest();
        })
        .catch((e) => {
          uploader.requestingNum -= 1;
          uploader.requestFailFn(requestData);
          ut.consoleText(`请求失败! ${JSON.stringify(e)}`, 'error');
          uploader.initiateRequest();
        });
    } else {
      ut.consoleText('请求失败!当前应用不支持淘宝云函数!', 'error');
    }
  };

  // 云应用调用
  tbCloudAppInvoke(requestData) {
    const { vdsConfig, emitter, uploader } = this.growingIO;
    let app;
    try {
      app = getApp();
    } catch (error) {
      app = $global;
    }
    if (!app) {
      app = $global;
    }
    if (app?.cloud?.application?.httpRequest) {
      const { host, projectId, tbConfig } = vdsConfig;
      uploader.requestingNum += 1;
      app.cloud.application
        .httpRequest({
          //不需要完整域名，只需要接口访问路径即可
          path: tbConfig.path,
          method: 'POST',
          headers: { 'Content-Type': 'application/json;charset=UTF-8' },
          params: { host, projectId, stm: Date.now() },
          body: requestData,
          exts: { cloudAppId: tbConfig.cloudAppId }
        })
        .then((res) => {
          uploader.requestingNum -= 1;
          // 这里的返回值只是调用了api是否成功，真正是否上报成功不知道，要看云应用的服务端是不是真的转发成功
          if (res.success) {
            emitter.emit('onSendAfter', { result: res });
          } else {
            if (ut.isArray(requestData)) {
              requestData.forEach((o: any) => {
                uploader.requestFailFn(o);
              });
            } else {
              uploader.requestFailFn(requestData);
            }
            ut.consoleText(`请求失败! ${JSON.stringify(res)}`, 'error');
          }
          uploader.initiateRequest();
        })
        .catch((e) => {
          uploader.requestingNum -= 1;
          if (ut.isArray(requestData)) {
            requestData.forEach((o: any) => {
              uploader.requestFailFn(o);
            });
          } else {
            uploader.requestFailFn(requestData);
          }
          ut.consoleText(`请求失败! ${JSON.stringify(e)}`, 'error');
          uploader.initiateRequest();
        });
    } else {
      ut.consoleText('请求失败!当前应用不支持淘宝云应用!', 'error');
    }
  }
}

export default { name: 'gioTaobaoSendAdapter', method: GioTaobaoSendAdapter };
