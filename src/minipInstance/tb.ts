import { GrowingIOType } from '@@/types/growingIO';
import { isObject } from '@@/utils/glodash';
import { niceTry } from '@@/utils/tools';
import BaseImplements from './base';

class Taobao extends BaseImplements {
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

  // 淘宝 my.request 的请求头参数名为 headers。
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
    return this.minip?.request({
      url,
      data,
      headers: header,
      timeout,
      method,
      success,
      fail,
      complete
    });
  };
}

export default Taobao;
