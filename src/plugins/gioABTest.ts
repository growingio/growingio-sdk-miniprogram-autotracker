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
  toString
} from '@@/utils/glodash';
import { consoleText, hashCode, niceCallback } from '@@/utils/tools';
import EMIT_MSG from '@@/constants/emitMsg';
import { ABTEST_DATA_REG, ABTEST_SIGN_REG } from '@@/constants/regex';

class GioABTest {
  // 请求间隔时长
  public requestInterval: number;
  // 请求超时时长
  public requestTimeout: number;
  // 分流服务请求地址
  public url: any;
  // 接口重试计数
  public retryCount: number;
  constructor(public growingIO: GrowingIOType, options: any) {
    const {
      abServerUrl = 'https://ab.growingio.com',
      requestInterval,
      requestTimeout
    } = options ?? {};
    this.timeoutCheck(requestInterval, requestTimeout);
    const { emitter } = this.growingIO;
    this.growingIO.getABTest = this.getABTest;
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
    const abtData =
      minipInstance.getStorageSync(
        `${this.getHashKey(trackingId, layerId)}_gdp_abtd`
      ) || {};
    // 没有有效数据或者接口请求标记超时则从调用分流服务获取数据
    if (!abtSign || abtSign < Date.now()) {
      this.initiateRequest(trackingId, layerId, abtData, callback);
    } else {
      niceCallback(callback, abtData);
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
      userStore: { getUid },
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
        layerId
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
    const { layerId, strategyId, experimentId, variables } = responseData;
    const abtDataKey = `${this.getHashKey(trackingId, layerId)}_gdp_abtd`;
    const abtData = {
      layerId: toString(layerId),
      strategyId: toString(strategyId),
      experimentId: toString(experimentId),
      variables
    };
    const comparisonValue = hashCode(JSON.stringify(abtData));
    const controlValue = hashCode(JSON.stringify(originData));
    // 本地实验和请求回来的实验直接做整体hash数据对比
    if (comparisonValue !== controlValue) {
      // 存储实验数据
      this.growingIO.minipInstance.setStorageSync(
        abtDataKey,
        abtData,
        new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          new Date().getDate() + 1
        ).getTime()
      );
      // 数据不一致重新发命中埋点
      if (strategyId && experimentId) {
        this.buildExperimentHitEvent(
          trackingId,
          toString(layerId),
          toString(experimentId),
          toString(strategyId)
        );
      }
    }
    // 回调调用
    niceCallback(callback, abtData);
  };

  // 构建实验命中事件
  buildExperimentHitEvent = (
    trackingId: string,
    layerId: string,
    experimentId: string,
    strategyId: string
  ) => {
    const {
      dataStore: { eventContextBuilder, eventConverter }
    } = this.growingIO;
    let event = {
      eventType: 'CUSTOM',
      eventName: '$exp_hit',
      attributes: {
        $exp_layer_id: layerId,
        $exp_id: experimentId,
        $exp_strategy_id: strategyId
      },
      ...eventContextBuilder(trackingId),
      customEventType: 0
    };
    eventConverter(event);
  };
}

export default { name: 'gioABTest', method: GioABTest };
