/** AB 分流插件：配置、逻辑请求合并和实验命中；身份与缓存由各自所有者管理。 */
import { GrowingIOType } from '@@/types/growingIO';
import {
  isEmpty,
  isNaN,
  isNumber,
  isObject,
  isString,
  keys,
  startsWith,
  toString,
  unset
} from '@@/utils/glodash';
import {
  consoleText,
  hashCode,
  limitObject,
  niceCallback
} from '@@/utils/tools';
import EMIT_MSG from '@@/constants/emitMsg';
import { createRequestAttempt } from '@@/utils/requestAttempt';
import {
  ABRequestSnapshot,
  appendStm,
  buildABRequestBody,
  getABCacheKeys,
  sha1
} from './gioABTest/request';
import { ABCacheStore } from './gioABTest/cacheStore';
import {
  ABIdentityChange,
  createABIdentityProvider
} from './gioABTest/identity';

/** 一个逻辑分流拥有稳定输入、调用方和重试预算；每次原生尝试独立管理。 */
interface ABRequestJob {
  readonly snapshot: ABRequestSnapshot;
  readonly originData: any;
  readonly originDataExpiresAt: number;
  callbacks: any[];
  retryCount: number;
  lastStm?: number;
  cancelled: boolean;
  settled: boolean;
  settle: (result: any) => void;
  attempt?: ReturnType<typeof createRequestAttempt>;
}

class GioABTest {
  public pluginVersion = '__PLUGIN_VERSION__';
  /** 同一身份缓存槽两次分流请求的最小间隔，分钟。 */
  public requestInterval: number;
  /** 单次原生尝试的超时时间，毫秒。 */
  public requestTimeout: number;
  public url: Record<string, string> = {};
  /** 先按实例寻址，再按身份缓存槽合并；身份变更只访问所属实例。 */
  private pendingRequests: Record<string, Record<string, ABRequestJob>> = {};
  private cacheStore: ABCacheStore;
  private identityProvider: ReturnType<typeof createABIdentityProvider>;

  constructor(public growingIO: GrowingIOType, options: any) {
    const {
      abServerUrl = 'https://ab.growingio.com',
      requestInterval,
      requestTimeout
    } = options ?? {};
    this.timeoutCheck(requestInterval, requestTimeout);
    this.cacheStore = new ABCacheStore(
      () => growingIO.minipInstance,
      () => this.requestInterval
    );
    this.identityProvider = createABIdentityProvider(growingIO, abServerUrl);
    this.growingIO.getABTest = this.getABTest;
    const { emitter } = growingIO;
    emitter.on(EMIT_MSG.OPTION_INITIALIZED, (vdsConfig: any = {}) => {
      if (isEmpty(abServerUrl)) {
        consoleText(
          '如果您需要使用ABTest功能，请配置服务地址 abServerUrl!',
          'warn'
        );
        return;
      }
      if (vdsConfig.dataCollect !== false) this.cacheStore.prune();
      this.url = {};
      if (isString(abServerUrl))
        this.generateUrl(growingIO.trackingId, abServerUrl);
      else if (isObject(abServerUrl))
        keys(abServerUrl).forEach((trackingId: string) =>
          this.generateUrl(trackingId, abServerUrl[trackingId])
        );
    });
    emitter.on(
      EMIT_MSG.OPTION_CHANGE,
      ({ trackingId, optionName, optionValue }: any = {}) => {
        if (optionName === 'dataCollect' && optionValue === false) {
          this.cancelPendingRequests(trackingId || growingIO.trackingId);
        }
      }
    );
    this.identityProvider.subscribe(this.onIdentityChanged);
  }

  timeoutCheck = (
    requestInterval: number | string,
    requestTimeout: number | string
  ) => {
    this.requestInterval =
      isNumber(Number(requestInterval)) &&
      !isNaN(Number(requestInterval as string))
        ? Number(requestInterval as string)
        : 5;
    if (this.requestInterval > 60 * 24 || this.requestInterval < 0) {
      this.requestInterval = 5;
    }
    this.requestTimeout =
      isNumber(Number(requestTimeout)) &&
      !isNaN(Number(requestTimeout as string))
        ? Number(requestTimeout as string)
        : 1000;
    if (this.requestTimeout > 5000 || this.requestTimeout < 100) {
      this.requestTimeout = 1000;
    }
  };

  /** 深复制 JSON 响应，并保留缺省字段；业务回调不能修改其他调用方或缓存的对象。 */
  private cloneExperimentResult = (value: any): any => {
    if (Array.isArray(value)) {
      return value.map((item) => this.cloneExperimentResult(item));
    }
    if (!isObject(value)) return value;
    const result = {};
    keys(value).forEach((key: string) => {
      // defineProperty 保留 JSON 中名为 __proto__ 的普通属性，不触发原型 setter。
      Object.defineProperty(result, key, {
        value: this.cloneExperimentResult(value[key]),
        enumerable: true,
        writable: true,
        configurable: true
      });
    });
    return result;
  };

  generateUrl = (trackingId: string, abServerUrl: string) => {
    // 只有旧核心的兼容 provider 需要补建延迟实例首访；当前核心由 UserStore 持有。
    this.identityProvider.ensureTracker(trackingId);
    const root = startsWith(abServerUrl, 'http')
      ? abServerUrl
      : `https://${abServerUrl}`;
    this.url[trackingId] = `${root}/diversion/specified-layer-variables`;
  };

  isDataCollectEnabled = (trackingId: string) =>
    !!this.growingIO.dataStore.getTrackerVds(trackingId)?.dataCollect;

  private isRequestJobActive = (job: ABRequestJob) => {
    if (job.cancelled) return false;
    const { snapshot } = job;
    const { userStore, dataStore } = this.growingIO;
    const tracker = dataStore.getTrackerVds(snapshot.trackingId);
    const userId = toString(userStore.getUserId(snapshot.trackingId) || '');
    const userKey = tracker?.idMapping
      ? toString(userStore.getUserKey(snapshot.trackingId) || '')
      : '';
    if (
      !tracker?.dataCollect ||
      toString(userStore.getUid()) !== snapshot.deviceId ||
      userId !== snapshot.identity.userId ||
      userKey !== snapshot.identity.userKey
    ) {
      job.cancelled = true;
      return false;
    }
    return true;
  };

  private detachRequest = (job: ABRequestJob) => {
    const { trackingId, signKey } = job.snapshot;
    const bucket = this.pendingRequests[trackingId];
    if (bucket?.[signKey] === job) {
      delete bucket[signKey];
      if (!keys(bucket).length) delete this.pendingRequests[trackingId];
    }
  };

  private settleRequest = (
    job: ABRequestJob,
    result: any,
    legacyDeferred = false
  ) => {
    if (job.settled) return;
    job.settled = true;
    this.detachRequest(job);
    job.attempt?.cancel();
    const notify = () =>
      job.callbacks
        .slice()
        .forEach((callback) =>
          niceCallback(
            callback,
            this.isRequestJobActive(job)
              ? this.cloneExperimentResult(result)
              : {}
          )
        );
    // 旧核心仍逐字段通知；该兼容路径不会在支持完整事务的核心中运行。
    if (legacyDeferred) Promise.resolve().then(notify);
    else notify();
  };

  private cancelRequests = (jobs: ABRequestJob[], legacyDeferred = false) => {
    // 在客户回调前令整批旧 job 失效并脱离表，重入不能加入或取消新 job。
    jobs.forEach((job) => {
      job.cancelled = true;
      this.detachRequest(job);
    });
    jobs.forEach((job) => this.settleRequest(job, {}, legacyDeferred));
  };

  private cancelPendingRequests = (trackingId: string) => {
    const bucket = this.pendingRequests[trackingId] || {};
    this.cancelRequests(keys(bucket).map((key: string) => bucket[key]));
  };

  private onIdentityChanged = (change: ABIdentityChange) => {
    const trackingIds = change.trackingId
      ? [change.trackingId]
      : keys(this.pendingRequests);
    trackingIds.forEach((trackingId: string) => {
      const bucket = this.pendingRequests[trackingId];
      if (!bucket) return;
      if (
        change.identity &&
        this.growingIO.userStore.getIdentitySnapshot(trackingId).revision !==
          change.identity.revision
      ) {
        return; // 更早的观察者重入身份 API 后，旧提交快照不能取消新身份的请求。
      }
      const jobs = keys(bucket)
        .map((key: string) => bucket[key])
        .filter((job) => {
          if (!change.identity) return !this.isRequestJobActive(job);
          const { snapshot } = job;
          const userKey = this.growingIO.dataStore.getTrackerVds(trackingId)
            ?.idMapping
            ? change.identity.userKey
            : '';
          return (
            snapshot.deviceId !== change.identity.deviceId ||
            snapshot.identity.userId !== change.identity.userId ||
            snapshot.identity.userKey !== userKey
          );
        });
      this.cancelRequests(jobs, change.legacy);
    });
  };

  getABTest = (trackingId: string, layerId: string | number, callback: any) => {
    if (!this.isDataCollectEnabled(trackingId)) {
      niceCallback(callback, {});
      return;
    }
    if (isEmpty(this.url[trackingId]))
      this.generateUrl(trackingId, 'https://ab.growingio.com');
    if (!layerId) {
      consoleText('获取ABTest数据失败! 实验层Id不合法!', 'error');
      niceCallback(callback, {});
      return;
    }
    const snapshot = this.createRequestSnapshot(trackingId, layerId);
    const cached = this.cacheStore.read(snapshot);
    if (cached.hit)
      niceCallback(callback, this.cloneExperimentResult(cached.result));
    else
      this.requestOrJoin(
        snapshot,
        callback,
        cached.originData,
        cached.originDataExpiresAt
      );
  };

  /** 冻结请求输入；mutable job 和 attempt 不放入协议上下文。 */
  createRequestSnapshot = (
    trackingId: string,
    layerId: string | number
  ): ABRequestSnapshot => {
    const { userStore, dataStore } = this.growingIO;
    const tracker = dataStore.getTrackerVds(trackingId) || {};
    const projectId = toString(tracker.projectId);
    const userId = toString(userStore.getUserId(trackingId) || '');
    const userKey = tracker.idMapping
      ? toString(userStore.getUserKey(trackingId) || '')
      : '';
    const identityHash = sha1(JSON.stringify([userId, userKey]));
    const deviceId = toString(userStore.getUid());
    return Object.freeze({
      trackingId,
      layerId,
      projectId,
      dataSourceId: toString(tracker.dataSourceId),
      deviceId,
      newDevice: this.identityProvider.getNewDevice(trackingId),
      url: this.url[trackingId],
      identity: Object.freeze({ userId, userKey }),
      ...getABCacheKeys(trackingId, projectId, deviceId, layerId, identityHash)
    });
  };

  private getNextStm = (job: ABRequestJob) => {
    const now = Date.now();
    const stm = job.lastStm && now <= job.lastStm ? job.lastStm + 1 : now;
    job.lastStm = stm;
    return String(stm);
  };

  private requestOrJoin = (
    snapshot: ABRequestSnapshot,
    callback: any,
    originData: any,
    originDataExpiresAt: number
  ) => {
    const bucket =
      this.pendingRequests[snapshot.trackingId] ||
      (this.pendingRequests[snapshot.trackingId] = {});
    const pending = bucket[snapshot.signKey];
    if (pending) {
      pending.callbacks.push(callback);
      return;
    }
    const job: ABRequestJob = {
      snapshot,
      originData: this.cloneExperimentResult(originData),
      originDataExpiresAt,
      callbacks: [callback],
      retryCount: 0,
      cancelled: false,
      settled: false,
      settle: (result) => this.settleRequest(job, result)
    };
    bucket[snapshot.signKey] = job;
    this.initiateRequest(job);
  };

  private initiateRequest = (job: ABRequestJob) => {
    if (!this.isRequestJobActive(job)) {
      job.settle({});
      return;
    }
    const { snapshot } = job;
    const attempt = createRequestAttempt(this.requestTimeout, () => {
      job.cancelled = true;
      consoleText('获取ABTest数据失败! 请求超时!', 'error');
      job.settle({});
    });
    job.attempt = attempt;
    const fail = (result: any = {}) => {
      if (!attempt.finish()) return;
      if (!this.isRequestJobActive(job)) {
        job.settle({});
        return;
      }
      const errMsg = toString(result?.errMsg || result);
      if (errMsg.indexOf('timeout') > -1) {
        consoleText('获取ABTest数据失败! 请求超时!', 'error');
        job.settle({});
      } else if (job.retryCount < 2) {
        job.retryCount += 1;
        this.initiateRequest(job);
      } else {
        consoleText(
          `获取ABTest数据失败! ${JSON.stringify(errMsg).slice(0, 30)}!`,
          'error'
        );
        job.settle({});
      }
    };
    try {
      const stm = this.getNextStm(job);
      attempt.setTask(
        this.growingIO.minipInstance.request({
          url: appendStm(snapshot.url, stm),
          header: { 'Content-Type': 'application/x-www-form-urlencoded' },
          method: 'POST',
          data: buildABRequestBody(snapshot, stm),
          timeout: this.requestTimeout,
          success: (result: any = {}) => {
            if (!attempt.finish()) return;
            if (!this.isRequestJobActive(job)) {
              job.settle({});
              return;
            }
            try {
              const data = result?.data;
              if (!isObject(data)) {
                consoleText('获取ABTest数据失败! 响应数据格式不正确!', 'error');
                job.settle({});
              } else if (data.code === 0) {
                this.experimentVerify(job, {
                  ...data,
                  layerId: snapshot.layerId
                });
              } else {
                consoleText(`获取ABTest数据失败! ${data.errorMsg}!`, 'error');
                job.settle({});
              }
            } catch (error) {
              consoleText(`获取ABTest数据失败! ${error}!`, 'error');
              job.settle({});
            }
          },
          fail
        })
      );
    } catch (error) {
      fail({ errMsg: error });
    }
  };

  private experimentVerify = (job: ABRequestJob, responseData: any) => {
    if (!this.isRequestJobActive(job)) {
      job.settle({});
      return;
    }
    const {
      layerId,
      strategyId,
      experimentId,
      layerName,
      experimentName,
      strategyName,
      variables
    } = responseData;
    const comparisonData = {
      layerId: toString(layerId),
      strategyId: toString(strategyId),
      experimentId: toString(experimentId),
      variables
    };
    const controlData = {
      ...(Date.now() >= job.originDataExpiresAt ? {} : job.originData)
    };
    unset(controlData, ['layerName', 'strategyName', 'experimentName']);
    const expData = {
      ...comparisonData,
      layerName,
      strategyName,
      experimentName
    };
    // 完成缓存事务再调用业务代码，重入读取不会看到半写入状态。
    this.cacheStore.commit(job.snapshot, expData);
    if (
      hashCode(JSON.stringify(comparisonData)) !==
        hashCode(JSON.stringify(controlData)) &&
      strategyId &&
      experimentId
    ) {
      this.buildExperimentHitEvent(job.snapshot.trackingId, expData);
    }
    job.settle(expData);
  };

  /**
   * 将 AB 服务返回的实验标识映射为既有 $exp_hit 属性；事件名称、属性名和普通
   * 事件上下文均保持原协议，使分析端无需区分身份分流请求与原有实验命中事件。
   */
  buildExperimentHitEvent = (trackingId: string, expData: any) => {
    const {
      dataStore: { eventContextBuilder, eventConverter }
    } = this.growingIO;
    let event = {
      eventType: 'CUSTOM',
      eventName: '$exp_hit',
      ...eventContextBuilder(trackingId)
    };
    const {
      layerId,
      experimentId,
      strategyId,
      layerName,
      experimentName,
      strategyName
    } = expData;
    event.attributes = limitObject({
      ...(event.attributes ?? {}),
      $exp_layer_id: layerId,
      $exp_id: experimentId,
      $exp_strategy_id: strategyId,
      $exp_layer_name: layerName,
      $exp_name: experimentName,
      $exp_strategy_name: strategyName
    });
    eventConverter(event);
  };
}

export default { name: 'gioABTest', method: GioABTest };
