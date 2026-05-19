import { GrowingIOType } from '@@/types/growingIO';
import { has, isFunction } from '@@/utils/glodash';
import { consoleText } from '@@/utils/tools';

let globalEventHooks: any = null;

class GioMpxAdapter {
  public pluginVersion: string;
  private mpx: any;
  public actionEventTypes: string[] = [];
  public actionEffects: any;

  constructor(public growingIO: GrowingIOType) {
    this.pluginVersion = '__PLUGIN_VERSION__';
    const { dataStore } = this.growingIO;
    this.actionEventTypes = dataStore?.eventHooks?.actionEventTypes || [];
  }

  /**
   * 自定义方法代理 - 重写 eventHooks 的 customFcEffects
   * 用于处理 Mpx 框架下事件的真实 eventName 获取
   * Mpx 中事件名存储在 dataset.eventconfigs.bubble.tap[0][0]，而非原生事件类型
   * @param {string} eventName - 原生事件名（如 tap）
   * @param {any} method - 原方法
   * @returns {Function} - 代理后的函数
   */
  customFcEffects = (eventName: string, method: any) => {
    const self = this;
    return function (...args: any[]) {
      let result;
      if (
        self.growingIO.vdsConfig.autotrack &&
        self.growingIO.plugins.gioEventAutoTracking
      ) {
        try {
          let event: any = args[0] || {};
          if (
            !(has(event, 'type') && (event?.currentTarget || event?.target))
          ) {
            event = args[args.length - 1];
          }
          if (
            (event?.currentTarget || event?.target) &&
            self.actionEventTypes.includes(event.type)
          ) {
            if (!isFunction(self.actionEffects)) {
              self.actionEffects =
                self.growingIO.plugins?.gioEventAutoTracking?.main ||
                (() => {});
            }
            const dataset =
              event?.currentTarget?.dataset || event?.target?.dataset || {};
            const eventConfigs = dataset.eventconfigs || {};
            const bubble = eventConfigs.bubble || {};
            const eventTypeList = bubble[event.type] || [];
            // Mpx 事件配置路径：dataset -> eventconfigs -> bubble -> [eventType] -> 二维数组
            // 真实 eventName 取二维数组的第一个元素的第一个值
            const realEventName =
              Array.isArray(eventTypeList) &&
              eventTypeList[0] &&
              eventTypeList[0][0]
                ? eventTypeList[0][0]
                : eventName;
            self?.actionEffects(event, realEventName);
          }
        } catch (error) {
          consoleText(error, 'error');
        }
      }
      result = method.apply(this, args);
      return result;
    };
  };

  /**
   * 插件主入口
   * 负责初始化适配器并完成 SDK 方法重写
   */
  main = () => {
    const { dataStore, vdsConfig } = this.growingIO;
    this.mpx = vdsConfig.mpx;
    dataStore.eventHooks.customFcEffects = this.customFcEffects;
    globalEventHooks = dataStore.eventHooks;
    this.setupAppLifecycleHook();
  };

  /**
   * 执行 MPX 注入的 App 生命周期 effects，并补齐 App xxxEnd。
   *
   * MPX 这里没有走 EventHooks.lifeFcEffects 包装链路，如果只调用
   * appEffects.main，就只会广播 App onShow/onHide，不会有 App onShowEnd。
   * APM 热启动按 `Page onReadyEnd/onShowEnd - App onShowEnd` 计算，
   * 所以必须在这条适配链路里手动补齐 End 事件。
   */
  private runAppLifecycle = (
    instance: any,
    eventName: string,
    args: any[]
  ) => {
    globalEventHooks?.appEffects?.main(eventName, args);
    globalEventHooks?.emitLifeEnd?.(instance, args, 'App', eventName);
  };

  /**
   * 通过 mpx.injectMixins API 注入 App 生命周期 mixin
   * 确保 SDK 能够正确发送 visit 等基于生命周期的事件
   */
  private setupAppLifecycleHook = () => {
    if (!this.mpx) {
      return;
    }

    const { injectMixins } = this.mpx;
    if (typeof injectMixins !== 'function') {
      return;
    }

    // 在闭包中保存 dataStore 引用，确保 mixin 中可以访问
    const dataStore = this.growingIO.dataStore;
    const adapter = this;
    const appLifecycleMixin = {
      onLaunch(this: any, ...args: any[]) {
        adapter.runAppLifecycle(this, 'onLaunch', args);
      },
      onShow(this: any, ...args: any[]) {
        // mpx 中 Page onShow 在 App onShow 之后执行
        // 如果是从后台返回且之前触发了分享（shareOut=true），需要提前重置 shareOut
        // 因为原生逻辑中 Page onShow 先于 App onShow，会在 App onShow 之前重置 shareOut
        // 这里主动重置 shareOut，模拟原生执行顺序，确保 appEffects.main 中的判断正确
        if (dataStore.lastCloseTime && dataStore.shareOut) {
          dataStore.toggleShareOut(false);
        }
        adapter.runAppLifecycle(this, 'onShow', args);
      },
      onHide(this: any, ...args: any[]) {
        adapter.runAppLifecycle(this, 'onHide', args);
      }
    };

    injectMixins(appLifecycleMixin, { types: 'app' });
  };

}

export default { name: 'GioMpxAdapter', method: GioMpxAdapter };
