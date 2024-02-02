import { GrowingIOType } from '@@/types/growingIO';
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
            self.growingIO.dataStore.eventHooks.currentPage.settedTitle[
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
}

export default Alipay;
