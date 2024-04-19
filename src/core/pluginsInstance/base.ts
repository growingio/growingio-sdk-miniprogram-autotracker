// 原生环境下的plugin实例，无任何内置插件
import { GrowingIOType } from '@@/types/growingIO';
import { PluginItem, PluginsType } from '@@/types/plugins';
import {
  find,
  isEmpty,
  isFunction,
  keys,
  lowerFirst,
  unset
} from '@@/utils/glodash';
import { consoleText } from '@@/utils/tools';
import EMIT_MSG from '@@/constants/emitMsg';

// 会被强制剔除出内置的插件（即必须通过手动注册的方式加载的内置插件）
const EXTRA_PLUGINS = ['gioPerformance'];
// @ts-nocheck
class BasePlugins implements PluginsType {
  public pluginItems: PluginItem[];
  public pluginsContext: any;
  constructor(public growingIO: GrowingIOType) {
    this.pluginsContext = { plugins: {} };
    this.pluginItems = [];
    this.growingIO.emitter?.on(EMIT_MSG.ON_INSTALL, (args) =>
      this.callLifeCycle('onInstall', args)
    );
    this.growingIO.emitter?.on(EMIT_MSG.ON_ERROR, (args) =>
      this.callLifeCycle('onError', args)
    );
    this.growingIO.emitter?.on(EMIT_MSG.ON_COMPOSE_BEFORE, (args) =>
      this.callLifeCycle('onComposeBefore', args)
    );
    this.growingIO.emitter?.on(EMIT_MSG.ON_COMPOSE_AFTER, (args) =>
      this.callLifeCycle('onComposeAfter', args)
    );
    this.growingIO.emitter?.on(EMIT_MSG.ON_SEND_BEFORE, (args) =>
      this.callLifeCycle('onSendBefore', args)
    );
    this.growingIO.emitter?.on(EMIT_MSG.ON_SEND_AFTER, (args) =>
      this.callLifeCycle('onSendAfter', args)
    );
  }

  // 初始化内置插件，不允许客户自己热插拔的插件，内置打包完成
  innerPluginInit = () => {
    EXTRA_PLUGINS.forEach((o) => unset(this.pluginsContext?.plugins, o));
    keys(this.pluginsContext?.plugins).forEach((key) => {
      const { name, method }: PluginItem =
        this.pluginsContext?.plugins[key] ?? {};
      // 若列表中出现同名插件，以第一个扫描出来的插件为准
      const isExist = find(this.pluginItems, (o) => o.name === name);
      if (!isExist) {
        this.pluginItems.push({
          // 优先使用指定插件名
          name: lowerFirst(name || key),
          method: method ? method : (growingIO) => {} // eslint-disable-line
        });
      }
    });
    if (!isEmpty(this.pluginItems)) {
      this.installAll();
    }
  };

  // 挂载插件
  install = (pluginName: string, pluginItem?: any, options?: any) => {
    const { emitter } = this.growingIO;
    const pluginTarget: PluginItem =
      pluginItem ||
      find(this.pluginItems, (o: PluginItem) => o.name === pluginName);
    // 插件已加载或与已加载的插件重名
    if ((this.growingIO?.plugins as any)[pluginName]) {
      consoleText(`重复加载插件 ${pluginName} 或插件重名，已跳过加载!`, 'warn');
      return false;
    }
    // 插件列表中不存在要加载的插件
    if (!pluginTarget) {
      consoleText(`插件加载失败!不存在名为 ${pluginName} 的插件!`, 'error');
      return false;
    }
    // 将插件实例挂载到growingIO实例上使得其他模块可以调用
    try {
      (this.growingIO?.plugins as any)[pluginName] = new (
        pluginTarget as any
      ).method(this.growingIO, options);
      if (pluginItem) {
        emitter.emit(EMIT_MSG.ON_INSTALL, pluginName);
        consoleText(`加载插件 ${pluginName}`, 'info');
      }
      return true;
    } catch (error) {
      this.lifeError(pluginItem, error);
      consoleText(`插件【${pluginName}】加载异常 ${error}`, 'error');
      return false;
    }
  };

  // 挂载所有插件
  installAll = (plugins?: PluginItem[]) => {
    (plugins || this.pluginItems).forEach((o: PluginItem) => {
      const suc = this.install(
        o.name,
        plugins ? o : undefined,
        plugins ? o?.options : undefined
      );
      if (suc && !find(this.pluginItems, (p) => p.name === o.name)) {
        this.pluginItems.push({
          // 优先使用指定插件名
          name: lowerFirst(o.name),
          // @ts-ignore
          method: o.method ? o.method : () => {}
        });
      }
    });
  };

  // 移除插件
  uninstall = (pluginName: string) => {
    unset(this.pluginItems, pluginName);
    const u = unset(this.growingIO?.plugins, pluginName);
    if (!u) {
      consoleText(`卸载插件 ${pluginName} 失败!`, 'error');
    }
    return u as boolean;
  };

  // 移除所有插件
  uninstallAll = () => {
    this.pluginItems.forEach((o: PluginItem) => this.uninstall(o.name));
  };

  lifeError = (p: PluginItem, e: any) => {
    this.growingIO.emitter.emit(EMIT_MSG.ON_ERROR, {
      plugin: p,
      error: e
    });
    consoleText(`插件执行错误 ${p.name} ${e}`, 'error');
  };

  // 触发插件的生命周期事件
  callLifeCycle = (lifetime: string, args: any) => {
    this.pluginItems.forEach((o: PluginItem) => {
      const method = (this.growingIO.plugins as any)[o.name]
        ? (this.growingIO.plugins as any)[o.name][lifetime]
        : undefined;
      if (method && isFunction(method)) {
        try {
          method(args);
        } catch (e) {
          this.lifeError(o, e);
        }
      }
    });
  };
}

export default BasePlugins;
