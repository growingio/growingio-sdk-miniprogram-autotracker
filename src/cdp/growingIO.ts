import { IPReg, URLReg } from '@@/constants/regex';
import BaseGrowingIO from '@@/core/growingIO';
import { verifyId } from '@@/utils/verifiers';
import {
  forEach,
  isEmpty,
  isFunction,
  isNil,
  isObject,
  toString
} from '@@/utils/glodash';
import { consoleText, eventNameValidate, guid } from '@@/utils/tools';

import DataStore from './dataStore';
import Uploader from './uploader';

class GrowingIO extends BaseGrowingIO {
  constructor() {
    super();
    this.dataStore = new DataStore(this);
    // 小程序切后台把所有还在计时中的计时器记一次时长
    if (isFunction(this.minipInstance.minip?.onAppHide)) {
      this.minipInstance.minip.onAppHide(() => {
        forEach(this.dataStore.trackTimers, (tracker: any) => {
          if (tracker.start) {
            tracker.leng = tracker.leng + (+Date.now() - tracker.start);
          }
        });
      });
    }

    // 小程序切前台把所有还在计时中的计时器重置开始时间
    if (isFunction(this.minipInstance.minip?.onAppShow)) {
      this.minipInstance.minip.onAppShow(() => {
        forEach(this.dataStore.trackTimers, (tracker: any) => {
          if (tracker.start) {
            tracker.start = +Date.now();
          }
        });
      });
    }
    // 关闭数据采集时要移除所有的计时器
    this.emitter.on('OPTION_CHANGE', ({ optionName, optionValue }) => {
      if (optionName === 'dataCollect' && optionValue === false) {
        this.clearTrackTimer();
      }
    });
  }

  // 手动注册插件
  registerPlugins = (plugins: any) => {
    this.plugins.pluginItems = [...this.plugins.pluginItems, ...plugins];
    this.plugins.installAll(plugins);
  };

  // 初始化回调
  initCallback = () => {
    this.uploader = new Uploader(this);
    // 没有开启IDMapping的时候要把userKey清掉，防止之前有数被带到上报数据里
    if (!this.vdsConfig.enableIdMapping) {
      this.userStore.userKey = '';
    }
  };

  // 修改scheme方法（兼容性保留，后续迭代可能会移除，建议使用setOption，删除时记得删除constans->config中配置）
  setTrackerScheme = (scheme: 'http' | 'https') => {
    if (['http', 'https'].includes(scheme)) {
      this.dataStore.setOption('scheme', scheme);
      this.notRecommended();
    } else {
      this.callError('scheme', !1);
    }
  };

  // 修改host方法（兼容性保留，后续迭代可能会移除，建议使用setOption，删除时记得删除constans->config中配置）
  setTrackerHost = (host: string) => {
    if (IPReg.test(host) || URLReg.test(host)) {
      this.dataStore.setOption('host', host);
      this.notRecommended();
    } else {
      this.callError('host', !1);
    }
  };

  // 设置指定的Id作为uid，一般为openId
  identify = (assignmentId: string | number) => {
    if (this.vdsConfig.forceLogin) {
      if (!verifyId(assignmentId)) {
        this.callError('identify');
        return;
      }
      // 截取长度
      const asId = toString(assignmentId).slice(0, 1000);
      // 在之后的请求中使用assignmentId作为uid(deviceId)使用
      this.userStore.uid = asId;
      // 为已积压的请求使用assignmentId全部赋值deviceId
      this.uploader.hoardingQueue.forEach(
        (o, i) => (this.uploader.hoardingQueue[i].deviceId = asId)
      );
      this.dataStore.setOption('forceLogin', false);
      // 发送积压队列中的请求
      this.uploader.initiateRequest(true);
    } else {
      this.callError('identify', !1, 'forceLogin未开启');
    }
  };

  // 发送用户变量
  setUserAttributes = (userAttributes: any) => {
    if (!isEmpty(userAttributes) && isObject(userAttributes)) {
      this.plugins?.gioCustomTracking?.buildUserAttributesEvent(userAttributes);
    } else {
      this.callError('setUserAttributes');
    }
  };

  // 设置登录用户Id
  setUserId = (userId: string | number, userKey?: string) => {
    if (verifyId(userId)) {
      // 切换userId要重设session补发visit
      const prevId = this.userStore.gioId;
      userId = toString(userId).slice(0, 1000);
      userKey = toString(userKey).slice(0, 1000);
      this.userStore.userId = userId;
      if (this.vdsConfig.enableIdMapping) {
        this.userStore.userKey = isNil(userKey) ? '' : userKey;
      }
      this.reissueLogic(prevId, userId);
    } else {
      this.callError('setUserId');
    }
  };

  // 清除登录用户Id
  clearUserId = () => {
    this.userStore.userId = undefined;
    this.userStore.userKey = undefined;
  };

  // 创建自定义埋点事件
  track = (
    name: string,
    properties: { [key: string]: string | string[] },
    items?: { key: string; id: string; attributes?: { [key: string]: string } }
  ) => {
    const customEvent =
      this.plugins?.gioCustomTracking?.buildCustomEvent || function () {};
    customEvent(
      name,
      {
        ...this.dataStore.generalProps,
        ...(isObject(properties) && !isEmpty(properties) ? properties : {})
      },
      items
    );
  };

  // 补发逻辑
  reissueLogic = (prevId: string, userId: string) => {
    // 切换userId时重置session并补发visit
    if (prevId && prevId !== userId) {
      this.userStore.sessionId = '';
      this.dataStore.sendVisit();
    }
    // 设置userId时补发visit
    if (!prevId && prevId !== userId) {
      this.dataStore.sendVisit();
    }
  };

  // 初始化事件计时器
  trackTimerStart = (eventName: string) => {
    if (this.vdsConfig.dataCollect) {
      return eventNameValidate(eventName, () => {
        const timerId = guid();
        this.dataStore.trackTimers[timerId] = {
          eventName,
          leng: 0,
          start: +Date.now()
        };
        return timerId;
      });
    }
    return false;
  };

  // 暂停事件计时器
  trackTimerPause = (timerId: string) => {
    if (timerId && this.dataStore.trackTimers[timerId]) {
      const tracker = this.dataStore.trackTimers[timerId];
      if (tracker.start) {
        tracker.leng = tracker.leng + (+Date.now() - tracker.start);
      }
      tracker.start = 0;
      return true;
    }
    return false;
  };

  // 恢复事件计时器
  trackTimerResume = (timerId: string) => {
    if (timerId && this.dataStore.trackTimers[timerId]) {
      const tracker = this.dataStore.trackTimers[timerId];
      if (tracker.start === 0) {
        tracker.start = +Date.now();
      }
      return true;
    }
    return false;
  };

  // 停止事件计时器并上报事件
  trackTimerEnd = (timerId: string, attributes: any) => {
    if (this.vdsConfig.dataCollect) {
      const maxEnd = 60 * 60 * 24 * 1000;
      if (timerId && this.dataStore.trackTimers[timerId]) {
        const tracker = this.dataStore.trackTimers[timerId];
        if (tracker.start !== 0) {
          const shortCut = +Date.now() - tracker.start;
          tracker.leng = shortCut > 0 ? tracker.leng + shortCut : 0;
        }
        this.track(tracker.eventName, {
          ...attributes,
          event_duration: tracker.leng > maxEnd ? 0 : tracker.leng / 1000
        });
        this.removeTimer(timerId);
        return true;
      } else {
        consoleText('未查找到对应的计时器，请检查!', 'error');
        return false;
      }
    }
    return false;
  };

  // 移除事件计时器
  removeTimer = (timerId: string) => {
    if (timerId && this.dataStore.trackTimers[timerId]) {
      delete this.dataStore.trackTimers[timerId];
      return true;
    }
    return false;
  };

  // 清除所有事件计时器
  clearTrackTimer = () => {
    this.dataStore.trackTimers = {};
  };
}

export default GrowingIO;
