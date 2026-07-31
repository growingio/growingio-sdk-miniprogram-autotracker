/**
 * 名称：mpvue代理插件
 * 用途：用于重写mpvue框架下的创建Page方法实现代理Hook。
 */
import { GrowingIOType } from '@@/types/growingIO';

const PAGE_WRAPPED_FLAG = '__gioMpvuePageWrapped__';
const METHOD_WRAPPED_FLAG = '__gioMpvueMethodWrapped__';

let ut: any;

class GioMpvueAdapter {
  public pluginVersion: string;
  private mpvue: any;

  constructor(public growingIO: GrowingIOType) {
    this.pluginVersion = '__PLUGIN_VERSION__';
    ut = this.growingIO.utils;
    this.mpvue = this.growingIO?.vdsConfig?.mpvue;
  }

  /**
   * 插件主入口
   * 保留 App / Component / Behavior 原生 hook，仅接管 mpvue Page 的包装。
   */
  main = () => {
    if (!this.mpvue) {
      this.mpvue = this.growingIO?.vdsConfig?.mpvue;
    }
    if (!this.mpvue) {
      ut.consoleText('未获取到 mpvue 实例，请检查初始化参数!', 'error');
      return;
    }
    if (!ut.isFunction(this.mpvue.mixin)) {
      ut.consoleText('当前 mpvue 实例不支持 mixin，请检查!', 'error');
      return;
    }

    ut.consoleText(`mpvue version ${this.mpvue.version || 'unknown'}`, 'info');
    this.growingIO.dataStore.eventHooks.nativeGrowing([
      'App',
      'Component',
      'Behavior'
    ]);
    this.installPageProxy();
    this.installMixin();
  };

  private installPageProxy = () => {
    const globalTarget = ut.getGlobal();
    const eventHooks = this.growingIO.dataStore.eventHooks;
    const originPage = eventHooks.originalPage || globalTarget.Page;
    const self = this;

    if (!ut.isFunction(originPage)) {
      ut.consoleText('未获取到原始 Page 构造器，无法接入 mpvue!', 'error');
      return;
    }

    const wrappedPage = function (...args: any[]) {
      return originPage(self.pageOverriding(args[0]));
    };

    globalTarget.Page = wrappedPage;
    try {
      // 让直接调用全局 Page 的编译产物也走同一条包装链路。
      // @ts-ignore
      Page = wrappedPage;
    } catch (error) {
      ut.consoleText(error, 'warn');
    }
    globalTarget.App = ut.niceTry(() => App ?? globalTarget.App);
    globalTarget.Component = ut.niceTry(
      () => Component ?? globalTarget.Component
    );
    globalTarget.Behavior = ut.niceTry(() => Behavior ?? globalTarget.Behavior);
  };

  private installMixin = () => {
    const self = this;
    this.mpvue.mixin({
      beforeCreate() {
        if (this.$mp?.mpType !== 'app') {
          this.$options.methods = self.pageCustomOverriding(this.$options.methods);
        }
      }
    });
  };

  /**
   * Page 生命周期重写
   */
  pageOverriding = (options: any) => {
    if (!options || options[PAGE_WRAPPED_FLAG]) {
      return options;
    }
    const { supLifeFcs, setPageEffectCbs, pageApplyProxy, pageHandlers } =
      this.growingIO.dataStore.eventHooks;
    setPageEffectCbs();
    supLifeFcs(options, 'page');
    ut.forEach(options, (value: any, key: string) => {
      if (pageHandlers.includes(key) && ut.isFunction(value)) {
        const wrapped = pageApplyProxy(key, value);
        wrapped[METHOD_WRAPPED_FLAG] = true;
        options[key] = wrapped;
      }
    });
    options[PAGE_WRAPPED_FLAG] = true;
    return options;
  };

  /**
   * Page 自定义方法重写
   */
  pageCustomOverriding = (methods: any = {}) => {
    ut.forEach(methods, (value: any, key: string) => {
      if (ut.isFunction(value) && !value[METHOD_WRAPPED_FLAG]) {
        const wrapped = this.growingIO.dataStore.eventHooks.pageApplyProxy(
          key,
          value
        );
        wrapped[METHOD_WRAPPED_FLAG] = true;
        methods[key] = wrapped;
      }
    });
    return methods;
  };
}

export default { name: 'gioMpvueAdapter', method: GioMpvueAdapter };
