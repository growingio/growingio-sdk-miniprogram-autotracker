import { compareVersion } from '@@/utils/tools';
import { GrowingIOType } from '@@/types/growingIO';
import { isFunction } from '@@/utils/glodash';
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
          if (self.growingIO.gioSDKInitialized) {
            // 这个currentPath一般认为是在onLoad中获取的当前小程序页面的path，此时SDK还没有parse，保存的还是上一个页面的信息
            const currentPath = self.getCurrentPath();
            const { title } = arguments[0] || {};
            self.growingIO.dataStore.eventHooks.currentPage.configuredTitle[
              currentPath
            ] = title;
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
    return data;
  };

  // 同步存储数据（支付宝小程序参数与其他平台不同）
  setStorageSync = (key: string, value: any) => {
    this.minip?.setStorageSync({ key, data: value });
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
    const myVersion = this.minip.SDKVersion;
    // 支付宝小程序2.0.0版本及以上才超时中断请求
    // https://github.com/growingio/growingio-sdk-miniprogram-autotracker/issues/3
    if (compareVersion(myVersion, '2.0.0') >= 0) {
      // 设置超时中断请求
      let t = setTimeout(() => {
        if (requestTask?.abort && isFunction(requestTask?.abort)) {
          requestTask?.abort();
        }
        clearTimeout(t);
        t = null;
      }, (timeout || 10000) + 10);
    }
    return requestTask;
  };
}

export default Alipay;
