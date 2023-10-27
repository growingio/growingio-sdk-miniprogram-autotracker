import BaseGrowingIO from '@@/core/growingIO';
import { verifyId } from '@@/utils/verifiers';
import { isEmpty, isObject, toString } from '@@/utils/glodash';

import DataStore from './dataStore';
import Uploader from './uploader';

class GrowingIO extends BaseGrowingIO {
  constructor() {
    super();
    this.dataStore = new DataStore(this);
  }

  // 初始化回调
  initCallback = () => {
    this.uploader = new Uploader(this);
  };

  // 设置openId作为uid
  identify = (openId: string | number, unionId?: string) => {
    if (this.vdsConfig.forceLogin) {
      if (!verifyId(openId) || (unionId && !verifyId(unionId))) {
        this.callError('identify');
        return;
      }
      // 截取长度
      const oId = toString(openId).slice(0, 1000);
      const unId = toString(unionId).slice(0, 1000) || '';
      // 在之后的请求中使用openId作为uid使用
      this.userStore.uid = oId;
      // 为已积压的请求使用openId全部赋值deviceId
      this.uploader.hoardingQueue.forEach(
        (o, i) => (this.uploader.hoardingQueue[i].u = oId)
      );
      this.dataStore.setOption('forceLogin', false);
      // 发送积压队列中的请求
      this.uploader.initiateRequest();
      // 补发vstr事件
      // 这里的openId和unionId得是全小写，要不然服务端处理不了会导致丢数
      const vstr: any = { openid: oId };
      if (unId) vstr.unionid = unId;
      this.setVisitor(vstr);
    } else {
      this.callError('identify', !1, 'forceLogin 未开启');
    }
  };

  // 访问用户变量事件
  setVisitor = (properties: { [key: string]: string }) => {
    if (!isEmpty(properties) && isObject(properties)) {
      this.plugins.gioCustomTracking?.buildVisitorVariable(properties);
    } else {
      this.callError('setVisitor');
    }
  };

  // 登录用户变量事件
  setUser = (properties: { [key: string]: string }) => {
    if (!isEmpty(properties) && isObject(properties)) {
      this.plugins.gioCustomTracking?.buildPeopleVariable(properties);
    } else {
      this.callError('setUser');
    }
  };

  // 设置登录用户Id
  setUserId = (userId: string | number) => {
    if (verifyId(userId)) {
      userId = toString(userId).slice(0, 1000);
      // 切换userId时要重设session补发visit
      const gioId = this.userStore.gioId;
      const prevId = this.userStore.userId;
      this.userStore.userId = userId;
      this.reissueLogic(prevId, userId, gioId);
    } else {
      this.callError('setUserId');
    }
  };

  // 清除登录用户Id
  clearUserId = () => {
    this.userStore.userId = undefined;
  };

  // 页面级变量事件
  setPage = (properties: { [key: string]: string }) => {
    if (!isEmpty(properties) && isObject(properties)) {
      this.plugins.gioCustomTracking?.buildPageLevelVariable(properties);
    } else {
      this.callError('setPage');
    }
  };

  // 变量转化事件
  setEvar = (properties: { [key: string]: string }) => {
    if (!isEmpty(properties) && isObject(properties)) {
      this.plugins.gioCustomTracking?.buildConversionVariable(properties);
    } else {
      this.callError('setEvar');
    }
  };

  // 创建自定义埋点事件
  track = (name: string, properties: { [key: string]: string }) => {
    const customEvent =
      this.plugins?.gioCustomTracking?.buildCustomEvent || function () {};
    customEvent(name, {
      ...this.dataStore.generalProps,
      ...(isObject(properties) && !isEmpty(properties) ? properties : {})
    });
  };

  // 补发逻辑
  reissueLogic = (prevId: string, userId: string, gioId: string) => {
    // 切换userId时重置session并补发visit和page
    if (gioId && gioId !== userId) {
      this.userStore.sessionId = '';
      this.dataStore.sendVisit();
      this.dataStore.sendPage();
    } else if (prevId !== userId) {
      // 设置userId时补发page
      this.dataStore.sendPage();
    }
  };
}

export default GrowingIO;
