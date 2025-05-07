import {
  head,
  isEmpty,
  isNil,
  startsWith,
  throttle,
  unset
} from '@@/utils/glodash';
import { EVENT, EXTEND_EVENT } from '@@/types/base';
import { consoleText } from '@@/utils/tools';
import { GrowingIOType } from '@@/types/growingIO';
import { UploaderType } from '@@/types/uploader';
import EMIT_MSG from '@@/constants/emitMsg';

class Uploader implements UploaderType {
  // 因forceLogin配置积压的事件请求队列
  public hoardingQueue: any;
  // 请求队列
  public requestQueue: any;
  // 请求限制最大数
  public requestLimit: number;
  // 请求重试限制最大数
  public retryLimit: number;
  // 请求重试的原请求id
  public retryIds: any;
  // 请求中的请求数
  public requestingNum: number;

  constructor(public growingIO: GrowingIOType) {
    this.hoardingQueue = {};
    this.requestQueue = {};
    this.requestLimit = 3;
    this.retryLimit = 2;
    this.retryIds = {};
    this.requestingNum = 0;
    this.growingIO.emitter.on(
      EMIT_MSG.ON_SEND_BEFORE,
      ({ eventsQueue, requestData, trackingId }) => {
        const { vdsConfig, plugins } = this.growingIO;
        // 核心逻辑中只发送主实例的事件
        if (trackingId === this.growingIO.trackingId) {
          if (vdsConfig?.tbConfig?.cloudAppId) {
            // 通过淘宝云应用转发
            plugins?.gioTaobaoAdapter?.tbCloudAppInvoke(
              eventsQueue,
              requestData
            );
          } else {
            this.sendEvent(eventsQueue, requestData);
          }
        }
      }
    );
  }

  // 生成上报地址
  generateURL = (trackingId: string) => {
    const { serverUrl, projectId } =
      this.growingIO.dataStore.getTrackerVds(trackingId);
    if (!startsWith(serverUrl, 'http')) {
      return `https://${serverUrl}/v3/projects/${projectId}/collect`;
    } else {
      return `${serverUrl}/v3/projects/${projectId}/collect`;
    }
  };

  // 获取积压队列
  getHoardingQueue = (trackingId: string) =>
    this.hoardingQueue[trackingId] ?? [];

  // 获取请求队列
  getRequestQueue = (trackingId: string) => this.requestQueue[trackingId] ?? [];

  // 提交请求（将请求按队列进行管理）
  commitRequest = (commitData: EXTEND_EVENT) => {
    const data: EXTEND_EVENT = { ...commitData };
    const { vdsConfig, emitter } = this.growingIO;
    emitter.emit(EMIT_MSG.ON_COMMIT_REQUEST, {
      eventData: commitData,
      trackingId: commitData.trackingId
    });
    // 如果开启forceLogin 则将请求推入积压队列，反之则进入请求队列
    if (vdsConfig.forceLogin) {
      if (isNil(this.hoardingQueue[commitData.trackingId])) {
        this.hoardingQueue[commitData.trackingId] = [];
      }
      this.hoardingQueue[commitData.trackingId]?.push(data);
    } else {
      if (isNil(this.requestQueue[commitData.trackingId])) {
        this.requestQueue[commitData.trackingId] = [];
      }
      this.requestQueue[commitData.trackingId]?.push(data);
      this.initiateRequest(commitData.trackingId);
    }
  };

  // 发起请求
  initiateRequest = (trackingId: string, forceSend?: boolean) => {
    const { plugins, vdsConfig, minipInstance, dataStore } = this.growingIO;
    const hoardingQueue = this.getHoardingQueue(trackingId);
    const requestQueue = this.getRequestQueue(trackingId);
    // 同时请求数的限制，防止挤占小程序本身的业务请求
    const queues = [...hoardingQueue, ...requestQueue];
    const requestProcess = (tid: string) => {
      // 淘宝云函数直接发送要单发
      if (vdsConfig?.tbConfig?.cloudFuncSend) {
        plugins?.gioTaobaoAdapter?.singleInvoke(tid);
      } else if (forceSend) {
        // 强制即时发送
        this.batchInvoke(tid);
      } else {
        // 有节流的批量发送(1秒钟之内产生的请求只会组团发送一次)
        const { uploadInterval } = this.growingIO.dataStore.getTrackerVds(tid);
        throttle(this.batchInvoke, uploadInterval, false, false)(tid);
      }
      // 发起visit请求时把存储里的originalSource删掉
      const hasVisit = queues.some((e) => e.eventType === 'VISIT');
      if (hasVisit) {
        minipInstance.removeStorageSync(
          dataStore.getStorageKey(tid, 'originalSource')
        );
      }
    };
    if (queues.length > 0) {
      // 同时请求数在3个以下直接发起请求
      if (this.requestingNum < this.requestLimit) {
        requestProcess(trackingId);
      } else {
        // 同时有3个请求在发送时，设轮询延时直到请求数在3个以下
        let t = setInterval(() => {
          if (this.requestingNum < this.requestLimit) {
            requestProcess(trackingId);
            clearInterval(t);
            t = undefined;
          }
        }, 500);
      }
    }
  };

  // 批量发送无延时(强制发送)
  batchInvoke = (trackingId: string) => {
    const { vdsConfig, emitter } = this.growingIO;
    const hoardingQueue = this.getHoardingQueue(trackingId);
    const requestQueue = this.getRequestQueue(trackingId);
    let queues = [...hoardingQueue, ...requestQueue];
    // 如果事件数大于50，剩下的切断放到下次请求
    if (queues.length > 50) {
      queues = queues.slice(0, 50);
      // 如果积压队列超过50，只截取积压队列，剩下的下一次发
      if (hoardingQueue.length > 50) {
        this.hoardingQueue[trackingId] = hoardingQueue.slice(50);
      } else {
        // 如果积压队列小于50，正常的请求队列就只截取补满50后剩下的事件
        this.requestQueue[trackingId] = requestQueue.slice(
          50 - hoardingQueue.length
        );
        this.hoardingQueue[trackingId] = [];
      }
    } else {
      this.hoardingQueue[trackingId] = [];
      this.requestQueue[trackingId] = [];
    }
    // 过滤掉重试超过3次的请求(直接丢弃)
    let eventsQueue: EXTEND_EVENT[] = queues.filter(
      (o) => (this.retryIds[o.requestId] || 0) <= this.retryLimit
    );
    if (isEmpty(eventsQueue)) {
      return;
    }
    // 生成新的请求事件（过滤事件中不能被上报的字段）
    const requestData: EVENT[] = eventsQueue.map((eData) => {
      const rdata = { ...eData };
      unset(rdata, ['requestId', 'trackingId']);
      return rdata;
    });
    // 开启debug模式时，打印事件日志
    if (vdsConfig.debug) {
      console.log('[GrowingIO Debug]:', JSON.stringify(requestData, null, 2));
    }
    // 广播事件
    emitter.emit(EMIT_MSG.ON_SEND_BEFORE, {
      eventsQueue,
      requestData,
      trackingId
    });
  };

  // 发送事件
  sendEvent = (eventsQueue: EXTEND_EVENT[], requestData: EVENT[]) => {
    const trackingId = head(eventsQueue).trackingId;
    const { minipInstance, dataStore, emitter, plugins } = this.growingIO;
    const { compress, requestTimeout } = dataStore.getTrackerVds(trackingId);
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
    const isCompress = !!compress && plugins?.gioCompress?.compressToUTF16;
    if (isCompress) {
      compressData = plugins.gioCompress.compressToUTF16(
        JSON.stringify(requestData)
      );
      header['X-Compress-Codec'] = '1';
    }
    const sendURL = this.generateURL(trackingId);
    minipInstance.request({
      url: `${sendURL}?stm=${Date.now()}&compress=${isCompress ? '1' : '0'}`,
      header,
      method: 'POST',
      data: compressData,
      timeout: requestTimeout,
      fail: (result: any) => {
        if (![200, 204].includes(result.code)) {
          eventsQueue.forEach((o: any) => {
            this.requestFailFn(o);
          });
          consoleText(`请求失败!${JSON.stringify(result)}`, 'error');
          emitter.emit(EMIT_MSG.ON_SEND_ERROR, {
            eventsQueue,
            requestData,
            trackingId
          });
        }
      },
      complete: (args: any) => {
        this.requestingNum -= 1;
        emitter.emit(EMIT_MSG.ON_SEND_AFTER, {
          result: args,
          requestData,
          trackingId
        });
        this.initiateRequest(trackingId);
      }
    });
  };

  // 请求失败的回调
  requestFailFn = (event: EXTEND_EVENT) => {
    // 把重试的请求进行计数，超过重试上限的会被丢弃
    if (!this.retryIds[event.requestId]) {
      this.retryIds[event.requestId] = 0;
    }
    this.retryIds[event.requestId] += 1;
    // 发送失败的事件会重新推入请求队列
    const eventExist = this.requestQueue[event.trackingId].some(
      (o) => o.requestId === event.requestId
    );
    if (!eventExist) {
      // 延迟半秒后再推入请求队列，给网络一点恢复时间
      let t = setTimeout(() => {
        if (!isEmpty(this.requestQueue[event.trackingId])) {
          this.requestQueue[event.trackingId].push(event);
        } else {
          this.requestQueue[event.trackingId].push(event);
          this.initiateRequest(event.trackingId);
        }
        clearTimeout(t);
        t = null;
      }, 800);
    }
  };
}

export default Uploader;
