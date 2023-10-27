/**
 * 名称：WePY代理插件
 * 用途：用于重写WePY框架下的创建App/Page/Component方法实现代理Hook。
 */
import { GrowingIOType } from '@@/types/growingIO';

class GioWepyAdapter {
  private wepy: any;
  constructor(public growingIO: GrowingIOType) {
    this.wepy = this.growingIO?.vdsConfig?.wepy;
  }

  // 主入口，版本判断
  main = () => {
    // 插件挂载时可能还没取到
    if (!this.wepy) {
      this.wepy = this.growingIO?.vdsConfig?.wepy;
    }
    this.proxyWepy(this.wepy);
  };

  // 代理wepy并存储页面中代理的方法地址对应的真实方法名
  proxyWepy = (wepy: any) => {
    const { appOverriding, pageOverriding, componentOverriding } =
      this.growingIO.dataStore.eventHooks;
    const originApp = wepy.app;
    const originPage = wepy.page;
    const originComponent = wepy.component;
    wepy.app = function (pageOptions, rel) {
      return originApp(appOverriding(pageOptions), rel);
    };
    wepy.page = function (pageOptions, rel) {
      return originPage(pageOverriding(pageOptions), rel);
    };
    wepy.component = function (componentOptions, rel) {
      return originComponent(componentOverriding(componentOptions), rel);
    };
  };
}

export default { name: 'gioWepyAdapter', method: GioWepyAdapter };
