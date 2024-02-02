// @ts-nocheck
import { GrowingIOType } from '@@/types/growingIO';
import { PluginItem, PluginsType } from '@@/types/plugins';
import { isEmpty, isFunction, keys, lowerFirst, unset } from '@@/utils/glodash';
import { consoleText } from '@@/utils/tools';

import * as pluginsContext from '../pluginsIn/*.ts';

class Plugins implements PluginsType {
  public pluginItems: PluginItem[];
  constructor(public growingIO: GrowingIOType) {
    this.pluginItems = [];
    this.growingIO.emitter.on('onComposeBefore', this.onComposeBefore);
    this.growingIO.emitter.on('onComposeAfter', this.onComposeAfter);
    this.growingIO.emitter.on('onSendBefore', this.onSendBefore);
    this.growingIO.emitter.on('onSendAfter', this.onSendAfter);
  }

  // 初始化内置插件，不允许客户自己热插拔的插件，内置打包完成
  innerPluginInit = () => {
    keys(pluginsContext.pluginsIn).forEach((key) => {
      const { name, method }: { name: string; method: any } =
        pluginsContext.pluginsIn[key];
      // 若列表中出现同名插件，以第一个扫描出来的插件为准
      const isExist = this.pluginItems.find((o) => o.name === name);
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
  install = (pluginName: string, pluginItem?: any, options?: any): boolean => {
    const pluginTarget: PluginItem =
      pluginItem ||
      this.pluginItems.find((o: PluginItem) => o.name === pluginName);
    // 插件已加载或与已加载的插件重名
    if (this.growingIO?.plugins[pluginName]) {
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
      this.growingIO.plugins[pluginName] = new pluginTarget.method(
        this.growingIO,
        options
      );
      if (pluginItem) {
        consoleText(`加载插件：${pluginName}`, 'info');
      }
      return true;
    } catch (error) {
      consoleText(`插件【${pluginName}】加载异常 ${error}`, 'error');
      return false;
    }
  };

  // 挂载所有插件
  installAll = (plugins: PluginItem[]) => {
    (plugins || this.pluginItems).forEach((o: PluginItem) =>
      this.install(o.name, plugins ? o : undefined, o.options)
    );
  };

  // 移除插件
  uninstall = (pluginName: string): boolean => {
    unset(this.pluginItems, pluginName);
    const u = unset(this.growingIO?.plugins, pluginName);
    if (!u) {
      consoleText(`卸载插件 ${pluginName} 失败!`, 'error');
    }
    return u;
  };

  // 移除所有插件
  uninstallAll = () => {
    this.pluginItems.forEach((o: PluginItem) => this.uninstall(o.name));
  };

  lifeError = (p: PluginItem, e: any) =>
    consoleText(`插件执行错误 ${p.name} ${e}`, 'error');

  // 触发生命周期事件（事件合成前）
  onComposeBefore = (args: any) => {
    this.pluginItems.forEach((o: PluginItem) => {
      const method = this.growingIO.plugins[o.name]?.onComposeBefore;
      if (method && isFunction(method)) {
        try {
          method(args);
        } catch (e) {
          this.lifeError(o, e);
        }
      }
    });
  };

  // 触发生命周期事件（事件合成后）
  onComposeAfter = (args: any) => {
    this.pluginItems.forEach((o: PluginItem) => {
      const method = this.growingIO.plugins[o.name]?.onComposeAfter;
      if (method && isFunction(method)) {
        try {
          method(args);
        } catch (e) {
          this.lifeError(o, e);
        }
      }
    });
  };

  // 触发生命周期事件（事件发送前）
  onSendBefore = (args: any) => {
    this.pluginItems.forEach((o: PluginItem) => {
      const method = this.growingIO.plugins[o.name]?.onSendBefore;
      if (method && isFunction(method)) {
        try {
          method(args);
        } catch (e) {
          this.lifeError(o, e);
        }
      }
    });
  };

  // 触发生命周期事件（事件发送后）
  onSendAfter = (args: any) => {
    this.pluginItems.forEach((o: PluginItem) => {
      const method = this.growingIO.plugins[o.name]?.onSendAfter;
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

export default Plugins;
