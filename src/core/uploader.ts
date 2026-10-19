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
import { emitSafely } from '@@/utils/safeEmitter';
import { createRequestAttempt } from '@@/utils/requestAttempt';

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
  // 按实例复用的节流发送器
  private throttledBatchInvoke: any;
  // 并发满载时只记录“需要继续发送”的实例，不为每个事件创建永久轮询器。
  private pendingInitiates: any;
  // 兼容旧多实例插件在发送前回调中转发同一批事件，避免递归通知和重复传输。
  private activeBatches = new WeakSet<EXTEND_EVENT[]>();

  constructor(public growingIO: GrowingIOType) {
    this.hoardingQueue = {};
    this.requestQueue = {};
    this.requestLimit = 3;
    this.retryLimit = 2;
    this.retryIds = {};
    this.requestingNum = 0;
    this.throttledBatchInvoke = {};
    this.pendingInitiates = {};
  }

  /**
   * 生成上报地址
   * @param {string} trackingId - 实例 ID
   * @returns {string} - 上报 URL
   */
  generateURL = (trackingId: string) => {
    const { serverUrl, projectId } =
      this.growingIO.dataStore.getTrackerVds(trackingId);
    if (!startsWith(serverUrl, 'http')) {
      return `https://${serverUrl}/v3/projects/${projectId}/collect`;
    } else {
      return `${serverUrl}/v3/projects/${projectId}/collect`;
    }
  };

  /**
   * 获取积压队列
   * @param {string} trackingId - 实例 ID
   * @returns {EXTEND_EVENT[]} - 积压队列
   */
  getHoardingQueue = (trackingId: string) =>
    this.hoardingQueue[trackingId] ?? [];

  /**
   * 获取请求队列
   * @param {string} trackingId - 实例 ID
   * @returns {EXTEND_EVENT[]} - 请求队列
   */
  getRequestQueue = (trackingId: string) => this.requestQueue[trackingId] ?? [];

  /**
   * 上传生命周期不能因单个监听器异常而中断后续传输或请求收尾。
   * 按 mitt 的顺序分别快照普通与通配监听器，不替换监听器，保留 on/off 与重入语义。
   */
  emitUploadEvent = (message: string, args: any) =>
    emitSafely(this.growingIO.emitter, message, args);

  /**
   * 提交请求（将请求按队列进行管理）
   * @param {EXTEND_EVENT} commitData - 提交的数据
   */
  commitRequest = (commitData: EXTEND_EVENT) => {
    const data: EXTEND_EVENT = { ...commitData };
    const { vdsConfig, emitter } = this.growingIO;
    const { dataStore } = this.growingIO;
    if (commitData.eventType === 'VISIT') dataStore.lastVisitEvent[commitData.trackingId] = commitData;
    if (commitData.eventType === 'PAGE') dataStore.lastPageEvent[commitData.trackingId] = commitData;
    emitSafely(emitter, EMIT_MSG.ON_COMMIT_REQUEST, {
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

  /**
   * 在 VISIT 真正被发送器取出时消费 originalSource。
   *
   * 不能在 initiateRequest 中根据队列快照提前删除：节流器可能尚未执行。
   * 只消费本批 VISIT 绑定的入口代次，不影响其他访问；请求失败仍重试同一个事件。
   * @param {string} trackingId - 实例 ID
   * @param {EXTEND_EVENT[]} eventsQueue - 本次实际取出的事件
   */
  prepareBatch = (
    trackingId: string,
    eventsQueue: EXTEND_EVENT[]
  ) => {
    const { dataStore } = this.growingIO;
    dataStore.consumeOriginalSource(trackingId, eventsQueue);
  };

  /**
   * 发起请求
   * @param {string} trackingId - 实例 ID
   * @param {boolean} [forceSend] - 是否强制发送
   */
  initiateRequest = (trackingId: string, forceSend?: boolean) => {
    const { plugins, vdsConfig } = this.growingIO;
    const hoardingQueue = this.getHoardingQueue(trackingId);
    const requestQueue = this.getRequestQueue(trackingId);
    // 同时请求数的限制，防止挤占小程序本身的业务请求
    const queues = [...hoardingQueue, ...requestQueue];
    const requestProcess = (tid: string) => {
      // 淘宝云函数直接发送要单发
      if (tid === this.growingIO.trackingId && vdsConfig?.tbConfig?.cloudFuncSend) {
        plugins?.gioTaobaoAdapter?.singleInvoke(tid);
      } else if (forceSend) {
        // 强制即时发送
        this.batchInvoke(tid);
      } else {
        // 有节流的批量发送(1秒钟之内产生的请求只会组团发送一次)
        const { uploadInterval } = this.growingIO.dataStore.getTrackerVds(tid);
        this.getThrottledBatchInvoke(tid, uploadInterval)(tid);
      }
    };
    if (queues.length > 0) {
      // 同时请求数在3个以下直接发起请求
      if (this.requestingNum < this.requestLimit) {
        requestProcess(trackingId);
      } else {
        // 旧实现会为每个后续事件创建一个 500ms 轮询器。请求若异常不回调，
        // 轮询器会永久累积。这里仅标记待发送实例；每个请求结算时统一唤醒它。
        // forceSend 也要随标记保留，否则原本要求立即发送的关闭/切后台事件
        // 会在槽位释放后意外降级为 uploadInterval 节流发送。
        this.pendingInitiates[trackingId] =
          this.pendingInitiates[trackingId] || !!forceSend;
      }
    }
  };

  /**
   * 请求结算后继续尝试此前因并发已满而延后的实例。
   * 使用标记而不是 interval：没有可用槽位时立即返回，不产生后台轮询负担。
   */
  flushPendingInitiates = () => {
    const pendingInitiates = this.pendingInitiates;
    const pendingTrackingIds = Object.keys(pendingInitiates);
    this.pendingInitiates = {};
    pendingTrackingIds.forEach((trackingId) =>
      this.initiateRequest(trackingId, pendingInitiates[trackingId])
    );
  };

  /**
   * 获取按实例复用的节流发送器
   * @param {string} trackingId - 实例 ID
   * @param {number} uploadInterval - 发送间隔
   * @returns {(trackingId: string) => void} - 节流后的发送器
   */
  getThrottledBatchInvoke = (trackingId: string, uploadInterval: number) => {
    const cached = this.throttledBatchInvoke[trackingId];
    if (!cached || cached.uploadInterval !== uploadInterval) {
      this.throttledBatchInvoke[trackingId] = {
        uploadInterval,
        invoke: throttle(
          (tid: string) => this.batchInvoke(tid),
          uploadInterval,
          false,
          false
        )
      };
    }
    return this.throttledBatchInvoke[trackingId].invoke;
  };

  /**
   * 获取小程序请求返回中的 HTTP 状态码
   * @param {any} result - 请求返回对象
   * @returns {number} - 兼容不同平台字段后的状态码
   */
  getHttpCode = (result: any) =>
    Number(result?.statusCode ?? result?.status ?? result?.code);

  /**
   * 批量发送无延时(强制发送)
   * @param {string} trackingId - 实例 ID
   */
  batchInvoke = (trackingId: string) => {
    // initiateRequest 允许多个实例先排入节流任务。执行任务时必须重新检查槽位，
    // 否则同一时刻醒来的任务会绕过最初的并发判断。
    if (this.requestingNum >= this.requestLimit) {
      this.initiateRequest(trackingId, true);
      return;
    }
    const { vdsConfig } = this.growingIO;
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
    const eventsQueue: EXTEND_EVENT[] = queues;
    if (isEmpty(eventsQueue)) {
      this.initiateRequest(trackingId);
      return;
    }
    // 到这里 eventsQueue 才是本批真正要冻结并发送的数据；超过 50 条留在队列中的事件
    // 以及尚未执行的节流任务都不能提前消费 originalSource。
    this.prepareBatch(trackingId, eventsQueue);
    // 生成新的请求事件（过滤事件中不能被上报的字段）
    const requestData: EVENT[] = eventsQueue.map((eData) => {
      const rdata = { ...eData };
      unset(rdata, ['requestId', 'trackingId', 'originalSourceId']);
      return rdata;
    });
    // 开启debug模式时，打印事件日志
    if (vdsConfig.debug) {
      console.log('[GrowingIO Debug]:', JSON.stringify(requestData, null, 2));
    }
    // Transport is mandatory work; observers cannot be responsible for starting it.
    if (trackingId === this.growingIO.trackingId && vdsConfig?.tbConfig?.cloudAppId) {
      this.growingIO.plugins.gioTaobaoAdapter.tbCloudAppInvoke(eventsQueue, requestData);
    } else {
      this.sendEvent(eventsQueue, requestData);
    }
  };

  /**
   * 创建一次发送尝试的唯一结算函数，并在占槽后通知发送前观察者。
   *
   * 小程序平台并不保证 request 在 abort、同步异常或实现缺陷下仍会执行 complete。
   * 因此“成功/失败/超时”必须共同走这里，保证请求槽位只释放一次，且异常批次
   * 仍按既有有限重试策略回队，而不是在 batchInvoke 已清空队列后静默丢失。
   */
  private createRequestFinalizer = (
    eventsQueue: EXTEND_EVENT[],
    requestData: EVENT[] | EVENT,
    getRequestTimeout: () => number,
    defaultFailureStage: string,
    externalTransport?: string
  ) => {
    if (this.activeBatches.has(eventsQueue)) return;
    const trackingId = head(eventsQueue).trackingId;
    this.activeBatches.add(eventsQueue);
    this.requestingNum += 1;

    const safeResultText = (result: any) => {
      try {
        return JSON.stringify(result);
      } catch (error) {
        return String(result);
      }
    };

    const complete = (
      result: any,
      failed = false,
      failureStage = defaultFailureStage
    ) => {
      try {
        if (failed) {
          // retryIds 记录的是“此前已经失败过几次”。在本次失败处理前读取，
          // 才能让最后一次失败在 requestFailFn 清理状态后仍报告正确尝试次数。
          const attempts = Math.max(
            1,
            ...eventsQueue.map((event) => (this.retryIds[event.requestId] || 0) + 1)
          );
          eventsQueue.forEach((event) => this.requestFailFn(event));
          consoleText(`请求失败!${safeResultText(result)}`, 'error');
          // 不附带 requestData，避免错误诊断再次泄露业务事件属性。
          this.emitUploadEvent(EMIT_MSG.ON_SEND_ERROR, {
            eventsQueue,
            trackingId,
            result,
            failureStage,
            attempts
          });
        } else {
          // 已重试后成功的事件不再需要 retryIds 状态。
          eventsQueue.forEach((event) => delete this.retryIds[event.requestId]);
        }
      } finally {
        // 即使错误诊断或失败处理意外抛错，也必须释放这个已结算请求的槽位。
        this.activeBatches.delete(eventsQueue);
        this.requestingNum = Math.max(0, this.requestingNum - 1);
        this.emitUploadEvent(EMIT_MSG.ON_SEND_AFTER, {
          result,
          requestData,
          trackingId,
          failed,
          failureStage: failed ? failureStage : undefined
        });
        // 已等待的实例先获得释放的槽位，避免淘宝主实例的单发队列一直抢占它。
        this.flushPendingInitiates();
        this.initiateRequest(trackingId);
      }
    };

    // before 观察者可能同步强发其他事件。本批必须已计入并发数，
    // 重入请求才能正确等待；超时计时则在观察者完成后再开始。
    this.emitUploadEvent(EMIT_MSG.ON_SEND_BEFORE, {
      eventsQueue,
      requestData,
      trackingId,
      ...(externalTransport ? { externalTransport } : {})
    });
    // 保留 before 回调修改当前请求配置的行为；配置读取失败也要释放已占槽位。
    let requestTimeout: number;
    try {
      requestTimeout = getRequestTimeout();
    } catch (error) {
      complete(error, true, 'configuration');
      return;
    }
    const attempt = createRequestAttempt(requestTimeout, () =>
      complete({ errMsg: 'GrowingIO request watchdog timeout' }, true, 'watchdog')
    );
    const finalize = (result: any, failed = false, failureStage = defaultFailureStage) => {
      if (attempt.finish()) complete(result, failed, failureStage);
    };
    return Object.assign(finalize, { setTask: attempt.setTask });
  };

  /** 发送标准 HTTP 事件批次，所有回调共享一次结算与重试逻辑。 */
  sendEvent = (eventsQueue: EXTEND_EVENT[], requestData: EVENT[]) => {
    const trackingId = head(eventsQueue).trackingId;
    const { minipInstance, dataStore, plugins } = this.growingIO;
    let finalize: any;
    try {
      let config;
      finalize = this.createRequestFinalizer(
        eventsQueue,
        requestData,
        () => {
          config = dataStore.getTrackerVds(trackingId);
          return config.requestTimeout;
        },
        'transport'
      );
      if (!finalize) return;
      const { compress, requestTimeout } = config;
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
      const requestTask = minipInstance.request({
        url: `${sendURL}?stm=${Date.now()}&compress=${isCompress ? '1' : '0'}`,
        header,
        method: 'POST',
        data: compressData,
        timeout: requestTimeout,
        success: (result: any) => {
          if (![200, 204].includes(this.getHttpCode(result))) {
            finalize(result, true, 'http');
          } else {
            finalize(result);
          }
        },
        fail: (result: any) => finalize(result, true, 'transport'),
        // complete 仍被保留给只触发 complete 的平台实现；若 success/fail 已结算，
        // finalize 的一次性保护会使这个回调成为无操作。
        complete: (result: any) => {
          const failed = ![200, 204].includes(this.getHttpCode(result));
          finalize(result, failed, 'http');
        }
      });
      finalize.setTask(requestTask);
    } catch (error) {
      if (finalize) {
        finalize(error, true, 'sync');
      } else {
        // 发送尝试创建前的异常也必须把已取出的事件送入有限重试。
        eventsQueue.forEach((event) => this.requestFailFn(event));
        this.emitUploadEvent(EMIT_MSG.ON_SEND_ERROR, {
          eventsQueue,
          trackingId,
          result: error,
          failureStage: 'configuration',
          attempts: 1
        });
      }
    }
  };

  /**
   * 淘宝云函数/云应用等 Promise 传输复用与普通 request 完全相同的结算规则。
   * 这样 cloud 缺失、同步抛错或 Promise 永不返回都不会绕过槽位释放和有限重试。
   */
  sendExternalEvent = (
    eventsQueue: EXTEND_EVENT[],
    requestData: EVENT[] | EVENT,
    invoke: () => Promise<any> | any,
    isSuccessful: (result: any) => boolean,
    failureStage: string
  ) => {
    const trackingId = head(eventsQueue).trackingId;
    const finalize = this.createRequestFinalizer(
      eventsQueue,
      requestData,
      () => this.growingIO.dataStore.getTrackerVds(trackingId).requestTimeout,
      failureStage,
      failureStage
    );
    if (!finalize) return;
    Promise.resolve()
      .then(invoke)
      .then((result) => {
        if (isSuccessful(result)) {
          finalize(result);
        } else {
          finalize(result, true, `${failureStage}_response`);
        }
      })
      .catch((error) => finalize(error, true, failureStage));
  };

  /**
   * 请求失败的回调
   * @param {EXTEND_EVENT} event - 失败的事件
   * @description
   * 统一处理单条事件的重试入队：
   * 1. 兼容 forceLogin 积压队列首次 flush 时 requestQueue 还没初始化的情况；
   * 2. 避免 batchInvoke 替换数组引用后把事件写回旧队列；
   * 3. 避免同一个 requestId 被多个失败回调重复塞回队列。
   */
  requestFailFn = (event: EXTEND_EVENT) => {
    // 把重试的请求进行计数，超过重试上限的会被丢弃
    if (!this.retryIds[event.requestId]) {
      this.retryIds[event.requestId] = 0;
    }
    this.retryIds[event.requestId] += 1;
    // retryLimit=2 的语义是“首次发送 + 两次重试”。第三次失败后立即终止，
    // 不再先塞回队列再由下一轮 batchInvoke 过滤，避免多余的计时器与状态残留。
    if (this.retryIds[event.requestId] > this.retryLimit) {
      consoleText(
        `请求已达到重试上限，事件将丢弃: ${event.requestId}`,
        'warn'
      );
      delete this.retryIds[event.requestId];
      return;
    }
    // 发送失败的事件会重新推入请求队列
    const queue =
      this.requestQueue[event.trackingId] ??
      (this.requestQueue[event.trackingId] = []);
    const eventExist = queue.some((o) => o.requestId === event.requestId);
    if (!eventExist) {
      // 延迟半秒后再推入请求队列，给网络一点恢复时间。
      // 这里不能继续闭包持有上面的 queue：
      // batchInvoke 在发送时会直接替换 this.requestQueue[trackingId] 的数组引用，
      // 如果定时器晚于那次替换执行，往旧数组 push 只会把事件丢进一个“脱离主流程”的废弃队列里。
      const baseDelay = 800 * Math.pow(2, this.retryIds[event.requestId] - 1);
      // 同批失败时加入轻微抖动，避免所有请求在相同毫秒再次抢占网络。
      const retryDelay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
      let t = setTimeout(() => {
        // 所以这里必须按执行时机重新读取当前 requestQueue，并再次做一次去重判断：
        // 一方面避免写回旧数组，另一方面避免事件已经被别的重试流程补回后又重复入队。
        const currentQueue =
          this.requestQueue[event.trackingId] ??
          (this.requestQueue[event.trackingId] = []);
        const currentEventExist = currentQueue.some(
          (o) => o.requestId === event.requestId
        );
        if (currentEventExist) {
          clearTimeout(t);
          t = null;
          return;
        }
        if (!isEmpty(currentQueue)) {
          currentQueue.push(event);
        } else {
          currentQueue.push(event);
          this.initiateRequest(event.trackingId);
        }
        clearTimeout(t);
        t = null;
      }, retryDelay);
    }
  };
}

export default Uploader;
