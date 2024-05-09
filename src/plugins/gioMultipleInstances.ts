/**
 * 名称：多实例插件
 * 用途：用于提供多实例以向指定项目和数据源发数的插件。
 */

import { EXTEND_EVENT } from '@@/types/base';
import { GrowingIOType } from '@@/types/growingIO';
import { isString, unset } from '@@/utils/glodash';
import { getGlobal, niceTry } from '@@/utils/tools';
import { OriginOptions } from '@@/types/dataStore';
import EMIT_MSG from '@@/constants/emitMsg';

export class GioMultipleInstances {
  public pluginVersion: string;
  public subTrackingIds: string[];
  constructor(public growingIO: GrowingIOType) {
    this.pluginVersion = '__PLUGIN_VERSION__';
    this.subTrackingIds = [];
    this.growingIO.emitter.on(EMIT_MSG.ON_SDK_INITIALIZE_BEFORE, () => {
      // 自动重写部分代码以实现多实例功能
      if (!this.growingIO.trackingId) {
        this.rewriteDataStore();
      }
      // 挂载子实例集合对象
      if (!this.growingIO.subInstance) {
        this.growingIO.subInstance = {};
      }
    });
    this.growingIO.emitter.on(EMIT_MSG.OPTION_INITIALIZED, ({ trackingId }) => {
      // 是子实例
      if (
        this.growingIO.trackingId &&
        this.growingIO.trackingId !== trackingId
      ) {
        // 把所有已初始化过的子实例trackingId保存下来方便预定义事件和无埋点事件广播时调用
        this.subTrackingIds.push(trackingId);
      }
    });
  }

  // 判断当前trackingId实例类型，为主实例还是子实例
  getTrackerType = (trackingId: string, growingIO: GrowingIOType): number => {
    return !growingIO.trackingId || growingIO.trackingId === trackingId ? 1 : 0;
  };

  // 重写dataStore中的部分内容
  rewriteDataStore = () => {
    // 获取采集实例
    this.growingIO.dataStore.getTrackerVds = (trackingId: string) => {
      if (this.growingIO.trackingId === trackingId) {
        const vds = { ...this.growingIO.vdsConfig };
        unset(vds, 'subInstance');
        if (!this.growingIO.plugins.gioTaobaoAdapter) {
          unset(vds, 'tbConfig');
        }
        return vds;
      } else {
        return this.growingIO.subInstance[trackingId]
          ? { ...this.growingIO.subInstance[trackingId] }
          : undefined;
      }
    };

    // 初始化实例配置的方法
    this.growingIO.dataStore.initTrackerOptions = (options: OriginOptions) => {
      const trackerOptions = this.growingIO.dataStore.initOptions(options);
      const trackerType = this.getTrackerType(
        options.trackingId,
        this.growingIO
      );
      trackerOptions.trackingId = options.trackingId;
      if (trackerType) {
        // 当前初始化主实例时给主实例赋值trackingId
        this.growingIO.trackingId = options.trackingId;
        // 主实例的配置直接挂在growingIO上
        this.growingIO.vdsConfig = trackerOptions;
        // 把主实例挂到小程序全局对象上
        getGlobal().vdsConfig = trackerOptions;
      } else {
        // 子实例无效的配置项删除
        unset(trackerOptions, [
          'autotrack',
          'debug',
          'forceLogin',
          'keepAlive',
          'originalSource',
          'performance',
          'pluginMode',
          'taro',
          'taroVue',
          'tbConfig',
          'uniVue'
        ]);
        // 子实例的配置挂在subInstance下，以trackingId作为key值存储
        this.growingIO.subInstance[options.trackingId] = trackerOptions;
        // 把子实例挂到小程序全局对象上
        if (!getGlobal().vdsConfig?.subInstance) {
          getGlobal().vdsConfig.subInstance = {};
        }
        getGlobal().vdsConfig.subInstance[options.trackingId] = trackerOptions;
      }
      return trackerOptions;
    };

    // 初始化实例的hooker
    this.growingIO.dataStore.initTrackerHooker = (options: OriginOptions) => {
      const trackerType = this.getTrackerType(
        options.trackingId,
        this.growingIO
      );
      if (trackerType) {
        const { platformConfig, inPlugin, minipInstance, plugins, dataStore } =
          this.growingIO;
        const { uniVue, taro } = options;
        // 如果是使用全量版本时，当前小程序不是框架的，要允许原生的hook
        if (!(uniVue || taro)) {
          platformConfig.canHook = true;
        }
        // 初始化核心钩子（重写全局）
        if (!inPlugin || ['tbp', 'jdp'].includes(minipInstance.platform)) {
          dataStore.eventHooks.initEventHooks();
        }
        /** 第三方框架重写 */
        // uniapp
        if (uniVue) {
          plugins?.gioUniAppAdapter?.main();
        }
        // taro
        if (taro) {
          plugins?.gioTaroAdapter?.main();
        }
      }
    };

    // 多实例时处理复制发送
    const originFunction = this.growingIO.dataStore.eventConverter;
    const self = this;
    this.growingIO.dataStore.eventConverter = function (...args) {
      const event: EXTEND_EVENT = args[0];
      // 埋点事件使用合并后的发送目标发送
      if (event.eventType === 'CUSTOM') {
        const sendTo = [event.trackingId];
        niceTry(() => {
          event['&&sendTo'].forEach((s) => {
            // 合法且不重复的实例
            if (
              isString(s) &&
              self.growingIO.dataStore.getTrackerVds(s) &&
              !sendTo.includes(s)
            ) {
              sendTo.push(s);
            }
          });
        });
        unset(event, '&&sendTo');
        sendTo.forEach((trackingId: string) => {
          const { eventContextBuilder } = self.growingIO.dataStore;
          const newEvent = {
            ...event,
            ...eventContextBuilder(
              trackingId,
              undefined,
              event.trackingId !== trackingId
            )
          };
          newEvent.attributes = {
            ...newEvent.attributes,
            ...event.attributes
          };
          originFunction.call(this, newEvent);
        });
      } else {
        // 其他事件直接发给指定调用实例
        originFunction.call(this, event);
      }
    };
  };

  onSendBefore = ({ eventsQueue, requestData, trackingId }: any) => {
    // 不是主实例的事件由多实例插件来提交请求
    if (trackingId !== this.growingIO.trackingId) {
      this.growingIO.uploader.sendEvent(eventsQueue, requestData);
    }
  };
}

export default { name: 'gioMultipleInstances', method: GioMultipleInstances };
