/**
 * 名称：Chameleon代理插件
 * 用途：用于重写Chameleon框架下的创建App/Page/Component方法实现代理Hook。
 */
import { GrowingIOType } from '@@/types/growingIO';

class GioChameleonAdapter {
  private cml: any;
  constructor(public growingIO: GrowingIOType) {
    this.cml = this.growingIO?.vdsConfig?.cml;
  }

  // 主入口
  main = () => {
    const {
      vdsConfig,
      dataStore: { eventHooks }
    } = this.growingIO;
    // 插件挂载时可能还没取到
    if (!this.cml) {
      this.cml = vdsConfig?.cml;
    }
    const originApp = this.cml.createApp;
    const originPage = this.cml.createPage;
    const originComponent = this.cml.createComponent;
    this.cml.createApp = function (option) {
      return originApp(eventHooks.appOverriding(option));
    };
    this.cml.createPage = function (option) {
      return originPage(eventHooks.pageOverriding(option));
    };
    this.cml.createComponent = function (option) {
      return originComponent(eventHooks.componentOverriding(option));
    };
  };
}

export default {
  name: 'gioChameleonAdapter',
  method: GioChameleonAdapter
};
