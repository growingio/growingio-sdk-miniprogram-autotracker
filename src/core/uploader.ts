import {
  isArray,
  isEmpty,
  startsWith,
  throttle,
  unset
} from '@@/utils/glodash';
import { Event } from '@@/types/base';
import { consoleText } from '@@/utils/tools';
import { GrowingIOType } from '@@/types/growingIO';
import { UploaderType } from '@@/types/uploader';

class Uploader implements UploaderType {
  // 因forceLogin配置积压的事件请求队列
  public hoardingQueue: any[];
  // 请求队列
  public requestQueue: any[];
  // 请求限制最大数
  public requestLimit: number;
  // 请求重试限制最大数
  public retryLimit: number;
  // 请求重试的原请求id
  public retryIds: any;
  // 请求中的请求数
  public requestingNum: number;
  // 请求地址
  public requestURL: string;

  constructor(public growingIO: GrowingIOType) {
    this.hoardingQueue = [];
    this.requestQueue = [];
    this.requestLimit = 3;
    this.retryLimit = 2;
    this.retryIds = {};
    this.requestingNum = 0;
    this.requestURL = this.generateURL();
  }

  // 生成上报地址
  generateURL = () => {
    const { serverUrl, projectId } = this.growingIO.vdsConfig;
    if (!startsWith(serverUrl, 'http')) {
      return `https://${serverUrl}/v3/projects/${projectId}/collect`;
    } else {
      return `${serverUrl}/v3/projects/${projectId}/collect`;
    }
  };

  // 提交请求（将请求按队列进行管理）
  commitRequest = (reqData: Event) => {
    const data: Event = { ...reqData };
    const { vdsConfig } = this.growingIO;
    // 如果开启forceLogin 则将请求推入积压队列，反之则进入请求队列
    if (vdsConfig.forceLogin) {
      this.hoardingQueue.push(data);
    } else {
      this.requestQueue.push(data);
      this.initiateRequest();
    }
  };

  // 发起请求
  initiateRequest = (forceSend?: boolean) => {
    const { plugins, vdsConfig } = this.growingIO;
    // 同时请求数的限制，防止挤占小程序本身的业务请求
    if (
      [...this.hoardingQueue, ...this.requestQueue].length > 0 &&
      this.requestingNum < this.requestLimit
    ) {
      // 淘宝云函数单发判断
      if (vdsConfig?.tbConfig?.cloudFuncSend) {
        plugins?.gioTaobaoAdapter?.singleInvoke();
      } else if (forceSend) {
        this.batchInvoke();
      } else {
        this.batchInvokeThrottle();
      }
    }
  };

  // 批量发送无延时(强制发送)
  batchInvoke = () => {
    const { vdsConfig, plugins, emitter } = this.growingIO;
    let queues = [...this.hoardingQueue, ...this.requestQueue];
    // 如果事件数大于50，剩下的切断放到下次请求
    if (queues.length > 50) {
      queues = queues.slice(0, 50);
      // 如果积压队列超过50，只截取积压队列，剩下的下一次发
      if (this.hoardingQueue.length > 50) {
        this.hoardingQueue = this.hoardingQueue.slice(50);
      } else {
        // 如果积压队列小于50，正常的请求队列就只截取补满50后剩下的事件
        this.requestQueue = this.requestQueue.slice(
          50 - this.hoardingQueue.length
        );
        this.hoardingQueue = [];
      }
    } else {
      this.hoardingQueue = [];
      this.requestQueue = [];
    }
    // 过滤掉重试超过3次的请求(直接丢弃)
    let eventsQueue: Event[] = queues.filter(
      (o) => (this.retryIds[o.requestId] || 0) <= this.retryLimit
    );
    if (isEmpty(eventsQueue)) {
      return;
    }
    // 生成新的请求事件（过滤事件中不能被上报的字段）
    const requestData = eventsQueue.map((eData) => {
      const rdata = { ...eData };
      unset(rdata, 'requestId');
      return rdata;
    });
    // 开启debug模式时，打印事件日志
    if (vdsConfig.debug) {
      console.log('[GrowingIO Debug]:', JSON.stringify(requestData, null, 2));
    }
    // 广播事件
    emitter.emit('onSendBefore', { requestData });
    if (vdsConfig?.tbConfig?.cloudAppId) {
      plugins?.gioTaobaoAdapter?.tbCloudAppInvoke(requestData);
    } else {
      this.normalBatchInvoke(eventsQueue, requestData);
    }
  };

  // 批量发送(1秒钟之内产生的请求只会组团发送一次)
  batchInvokeThrottle = throttle(
    this.batchInvoke,
    this.growingIO.vdsConfig.uploadInterval,
    false,
    false
  );

  // 基础请求逻辑
  normalBatchInvoke = (eventsQueue: any, requestData: any) => {
    const { minipInstance, vdsConfig, emitter, plugins } = this.growingIO;
    this.requestingNum += 1;
    // 根据设置拼装最后请求数据
    const header: any = {
      // !!!京东小程序在7月4号的发版中，ios全匹配了application/json;导致我们的请求没法发出去，这里做一下兼容，等他们修复上线以后改回已注释的部分
      // 'content-type': 'application/json;charset=UTF-8'
      'content-type':
        minipInstance.platform === 'jdp'
          ? 'application/json'
          : 'application/json;charset=UTF-8'
    };
    let compressData = [...requestData];
    // 数据加密
    const isCompress =
      vdsConfig.compress && plugins?.gioCompress?.compressToUTF16;
    if (isCompress) {
      compressData = plugins.gioCompress.compressToUTF16(
        JSON.stringify(requestData)
      );
      header['X-Compress-Codec'] = '1';
    }
    minipInstance.request({
      url: `${this.requestURL}?stm=${Date.now()}&compress=${
        isCompress ? '1' : '0'
      }`,
      header,
      method: 'POST',
      data: compressData,
      timeout: vdsConfig.requestTimeout,
      fail: (result: any) => {
        if (![200, 204].includes(result.code)) {
          if (isArray(eventsQueue)) {
            eventsQueue.forEach((o: any) => {
              this.requestFailFn(o);
            });
          } else {
            this.requestFailFn(eventsQueue);
          }
          consoleText(`请求失败!${JSON.stringify(result)}`, 'error');
        }
      },
      complete: (args: any) => {
        this.requestingNum -= 1;
        emitter.emit('onSendAfter', { result: args });
        this.initiateRequest();
      }
    });
  };

  // 请求失败的回调
  requestFailFn = (eventsQueue: any) => {
    // 把重试的请求进行计数，超过重试上限的会被丢弃
    if (!this.retryIds[eventsQueue.requestId]) {
      this.retryIds[eventsQueue.requestId] = 0;
    }
    this.retryIds[eventsQueue.requestId] += 1;
    // 发送失败的事件会重新推入请求队列
    const eventExist = this.requestQueue.some(
      (o) => o.requestId === eventsQueue.requestId
    );
    if (!eventExist) {
      // 延迟半秒后再推入请求队列，给网络一点恢复时间
      let t = setTimeout(() => {
        if (!isEmpty(this.requestQueue)) {
          this.requestQueue.push(eventsQueue);
        } else {
          this.requestQueue.push(eventsQueue);
          this.initiateRequest();
        }
        clearTimeout(t);
        t = null;
      }, 800);
    }
  };
}

export default Uploader;
