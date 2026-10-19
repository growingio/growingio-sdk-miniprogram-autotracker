import { consoleText, niceTry } from '@@/utils/tools';
import { GrowingIOType } from '@@/types/growingIO';
import { isObject } from '@@/utils/glodash';
import BaseImplements from './base';

class Alipay extends BaseImplements {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.hookSetTitle();
  }

  hookSetTitle = () => {
    const originSetter = this.minip?.setNavigationBar;
    const self = this;
    if (originSetter) {
      Object.defineProperty(this.minip, 'setNavigationBar', {
        writable: true,
        enumerable: true,
        configurable: true,
        value: function () {
          const { title } = arguments[0] || {};
          if (self.growingIO.gioSDKInitialized) {
            niceTry(() => {
              self.growingIO.dataStore.eventHooks.currentPage.setConfiguredTitle(title);
            });
          }
          return originSetter.apply(this, arguments);
        }
      });
    }
  };

  // 采集曝光事件
  initImpression = (collectPage: any) => {
    this.growingIO.plugins?.gioImpressionTracking?.main(
      collectPage,
      'selectAll'
    );
  };

  // 同步获取存储数据（支付宝小程序返回值与其他平台不同）
  getStorageSync = (key: string) => {
    const { data } = my.getStorageSync({ key });
    if (isObject(data) && data.expiredAt) {
      if (data.expiredAt < Date.now()) {
        this.removeStorageSync(key);
        return '';
      }
      return data.value;
    }
    return data;
  };

  // 同步存储数据（支付宝小程序参数与其他平台不同）
  setStorageSync = (key: string, value: any, expiredAt?: string | number) => {
    this.minip?.setStorageSync({
      key,
      data: expiredAt ? { value, expiredAt } : value
    });
  };

  // 同步移除指定数据
  removeStorageSync = (key: string) => {
    this.minip?.removeStorageSync({ key });
  };

  // 支付宝和mpass单独处理
  request = ({
    url,
    data,
    header,
    timeout,
    method,
    success,
    fail,
    complete
  }) => {
    const requestTask = this.minip?.request({
      url,
      data,
      // 支付宝小程序里叫headers
      headers: header,
      timeout,
      method,
      success,
      fail,
      complete
    });
    return requestTask;
  };

  // 执行支付宝特有的promise分享
  handleSharePromise = (originResult, handlePromiseResult) => {
    // 创建监听_result变化的Promise
    const alipayPromise = new Promise((resolve) => {
      // 如果已有_result直接返回
      if (originResult._result) {
        resolve(originResult._result);
        return;
      }
      // 监听_result属性变化
      Object.defineProperty(originResult, '_result', {
        set(value) {
          this.__result = value;
          resolve(value);
        },
        get() {
          return this.__result;
        }
      });
    });
    // 如果三秒内不resolve结果，分享会使用原默认参数
    Promise.race([
      alipayPromise,
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(originResult._result || {});
        }, 3000);
      })
    ])
      .then(handlePromiseResult)
      .catch((error) => consoleText(error, 'error'));
  };
}

export default Alipay;
