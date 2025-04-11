/**
 * 名称：ABTest插件
 * 用途：用于提供自动获取AB实验数据和上报实验命中的插件。
 */
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
import { ABTEST_DATA_REG, ABTEST_SIGN_REG } from '@@/constants/regex';

class GioABTest {
  public pluginVersion: string;
  // 请求间隔时长
  public requestInterval: number;
  // 请求超时时长
  public requestTimeout: number;
  // 分流服务请求地址
  public url: any;
  // 接口重试计数
  public retryCount: number;
  // 标记当前是否为新访问设备
  public newDevice: boolean;
  // 各个实例新设备进入时的sessionId；小程序没有刷新页面保持session的问题，所以存在内存里就可以
  public visitSids: any;
  constructor(public growingIO: GrowingIOType, options: any) {
    this.pluginVersion = '__PLUGIN_VERSION__';
    const {
      abServerUrl = 'https://ab.growingio.com',
      requestInterval,
      requestTimeout
    } = options ?? {};
    this.timeoutCheck(requestInterval, requestTimeout);
    const { emitter, userStore } = this.growingIO;
    this.growingIO.getABTest = this.getABTest;
    this.visitSids = {};
    emitter.on(EMIT_MSG.OPTION_INITIALIZED, () => {
      if (!isEmpty(abServerUrl)) {
        this.abtStorageCheck();
        this.url = {};
        if (isString(abServerUrl)) {
          this.generateUrl(this.growingIO.trackingId, abServerUrl);
        } else if (isObject(abServerUrl)) {
          keys(abServerUrl).forEach((trackingId: string) => {
            this.generateUrl(trackingId, abServerUrl[trackingId]);
          });
        }
      } else {
        consoleText(
          '如果您需要使用ABTest功能，请配置服务地址 abServerUrl!',
          'warn'
        );
      }
    });
    emitter.on(EMIT_MSG.UID_UPDATE, ({ newUId, oldUId }) => {
      // 没有旧deviceId说明是第一次进入的新设备
      if (!oldUId && newUId) {
        if (isString(abServerUrl)) {
          const trackingId = this.growingIO.trackingId;
          const sId = userStore.getSessionId(trackingId);
          this.visitSids[trackingId] = sId;
        } else if (isObject(abServerUrl)) {
          keys(abServerUrl).forEach((trackingId: string) => {
            const sId = userStore.getSessionId(trackingId);
            this.visitSids[trackingId] = sId;
          });
        }
      }
    });
    this.retryCount = 0;
  }

  // 两个时长的初始化处理
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

  // 检查存储中的实验数据是否已过期
  abtStorageCheck = () => {
    const { minipInstance }: any = this.growingIO;
    const storageKeys = minipInstance.minip?.getStorageInfoSync().keys || [];
    // 请求标记
    const abtsKeys = storageKeys.filter((k) => ABTEST_SIGN_REG.test(k));
    abtsKeys.forEach((k) => {
      // 移除过期的数据，防止存储超限
      const sign = minipInstance.getStorageSync(k);
      if (!sign || sign < Date.now()) {
        minipInstance.removeStorageSync(k);
      }
    });
    // abtest数据
    const abtdKeys = storageKeys.filter((k) => ABTEST_DATA_REG.test(k));
    abtdKeys.forEach((k) => {
      // 移除过期的数据，防止存储超限
      if (isEmpty(minipInstance.getStorageSync(k))) {
        minipInstance.removeStorageSync(k);
      }
    });
  };

  // 生成存储的hash key
  getHashKey = (trackingId: string, layerId: string | number) => {
    const {
      userStore: { getUid },
      vdsConfig: { projectId }
    } = this.growingIO;
    return hashCode(`${trackingId}#${projectId}#${getUid()}#${layerId}`, true);
  };

  // 生成数据接口地址
  generateUrl = (trackingId: string, abServerUrl: string) => {
    // 如果是延迟初始化的实例，当前又是首次进入设备，要补充把session存起来
    if (this.newDevice && !this.visitSids[trackingId]) {
      // 这里要用userStore中的getSessionId，调用这个方法的时候实例肯定已经初始化了
      // 如果是新初始化可以通过getSessionId准确获取sessionExpires来生成准确的session值;
      // 如果是旧实例则直接用存储中的sessionId
      this.visitSids[trackingId] =
        this.growingIO.userStore.getSessionId(trackingId);
    }
    if (!startsWith(abServerUrl, 'http')) {
      this.url[
        trackingId
      ] = `https://${abServerUrl}/diversion/specified-layer-variables`;
    } else {
      this.url[
        trackingId
      ] = `${abServerUrl}/diversion/specified-layer-variables`;
    }
  };

  // 获取实验调用
  getABTest = (trackingId: string, layerId: string | number, callback: any) => {
    if (isEmpty(this.url[trackingId])) {
      this.generateUrl(trackingId, 'https://ab.growingio.com');
    }
    if (!layerId) {
      consoleText('获取ABTest数据失败! 实验层Id不合法!', 'error');
      niceCallback(callback, {});
      return;
    }
    const { minipInstance } = this.growingIO;
    // 接口调用的超时时间
    const abtSign =
      minipInstance.getStorageSync(
        `${this.getHashKey(trackingId, layerId)}_gdp_abt_sign`
      ) || 0;
    // 没有超时尝试取数据
    const expData =
      minipInstance.getStorageSync(
        `${this.getHashKey(trackingId, layerId)}_gdp_abtd`
      ) || {};
    // 没有有效数据或者接口请求标记超时则从调用分流服务获取数据
    if (!abtSign || abtSign < Date.now()) {
      this.initiateRequest(trackingId, layerId, expData, callback);
    } else {
      niceCallback(callback, expData);
    }
  };

  // 发起请求
  initiateRequest = (
    trackingId: string,
    layerId: string | number,
    originData: any,
    callback: any
  ) => {
    const {
      userStore: { getUid, getSessionId },
      dataStore,
      minipInstance
    } = this.growingIO;
    const { projectId, dataSourceId } = dataStore.getTrackerVds(trackingId);
    minipInstance.request({
      url: this.url[trackingId],
      header: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
      data: {
        accountId: projectId,
        datasourceId: dataSourceId,
        distinctId: getUid(),
        layerId,
        newDevice: this.visitSids[trackingId] === getSessionId(trackingId)
      },
      timeout: this.requestTimeout,
      success: ({ data }: any) => {
        if (data.code === 0) {
          this.experimentVerify(
            trackingId,
            { ...data, layerId },
            originData,
            callback
          );
        } else {
          consoleText(`获取ABTest数据失败! ${data.errorMsg}!`, 'error');
          // 接口业务失败返回false信息
          niceCallback(callback, {});
        }
        // 接口调用返回后刷新接口调用标记
        minipInstance.setStorageSync(
          `${this.getHashKey(trackingId, layerId)}_gdp_abt_sign`,
          Date.now() + 1000 * 60 * this.requestInterval
        );
      },
      fail: ({ errMsg }: any) => {
        // 请求超时（这里没用微信提供的errno，因为它没有值，其他小程序也不一定能兼容）
        if (errMsg.indexOf('timeout') > -1) {
          consoleText('获取ABTest数据失败! 请求超时!', 'error');
          // 接口超时返回false信息
          niceCallback(callback, {});
        } else {
          // 其他失败情况重试
          if (this.retryCount < 2) {
            this.initiateRequest(trackingId, layerId, originData, callback);
            this.retryCount += 1;
          } else {
            consoleText(
              `获取ABTest数据失败! ${JSON.stringify(errMsg).slice(0, 30)}!`,
              'error'
            );
            // 重试结束后返回false信息
            niceCallback(callback, {});
          }
        }
      }
    });
  };

  // 实验校验（决定是否上报命中事件）
  experimentVerify = (
    trackingId: string,
    responseData: any,
    originData: any,
    callback: any
  ) => {
    const {
      layerId,
      strategyId,
      experimentId,
      layerName,
      experimentName,
      strategyName,
      variables
    } = responseData;
    const expDataKey = `${this.getHashKey(trackingId, layerId)}_gdp_abtd`;
    // 从接口取回来的用于hash比较的数据对象
    const comparisonData = {
      layerId: toString(layerId),
      strategyId: toString(strategyId),
      experimentId: toString(experimentId),
      variables
    };
    // 从本地存储中取回来的用于hash比较的数据对象
    const controlData = { ...originData };
    unset(controlData, ['layerName', 'strategyName', 'experimentName']);
    const comparisonValue = hashCode(JSON.stringify(comparisonData));
    const controlValue = hashCode(JSON.stringify(controlData));
    // 需要传给下一步和存储的数据对象
    const expData = {
      ...comparisonData,
      layerName,
      strategyName,
      experimentName
    };
    // 存储实验数据(无需经过hash对比判断直接复写存储，防止只改了名称)
    this.growingIO.minipInstance.setStorageSync(
      expDataKey,
      expData,
      new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate() + 1
      ).getTime()
    );
    // 本地实验和请求回来的实验直接做整体hash数据对比
    if (comparisonValue !== controlValue) {
      // 数据不一致重新发命中埋点
      if (strategyId && experimentId) {
        this.buildExperimentHitEvent(trackingId, expData);
      }
    }
    // 回调调用
    niceCallback(callback, expData);
  };

  // 构建实验命中事件
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
