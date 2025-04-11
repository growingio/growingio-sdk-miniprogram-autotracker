/**
 * 名称：性能采集插件
 * 用途：用于采集小程序基本性能信息。
 */
import { GrowingIOType } from '@@/types/growingIO';
import { isEmpty } from '@@/utils/glodash';
import { limitObject } from '@@/utils/tools';
import EMIT_MSG from '@@/constants/emitMsg';
import Exception from './gioPerformance/exception';
import Monitor from './gioPerformance/monitor';
import Network from './gioPerformance/network';

let ut;
class GioPerformance {
  public pluginVersion: string;
  public network: any;
  public exception: any;
  public monitor: any;
  // 缓存队列，SDK初始化完成之后再根据性能的配置项发送数据
  private cacheQueue: any[];
  constructor(public growingIO: GrowingIOType, public options: any = {}) {
    this.pluginVersion = '__PLUGIN_VERSION__';
    ut = this.growingIO.utils;
    this.options = {
      monitor: true,
      exception: true,
      network: false,
      ...this.options
    };
    this.cacheQueue = [];
    this.growingIO.emitter.on(EMIT_MSG.SDK_INITIALIZED, (vdsConfig: any) => {
      if (vdsConfig.trackingId === this.growingIO.trackingId) {
        // 初始化配置项优先级更高（后续版本考虑把配置项值放在插件options上去配，弱化初始化配置项）
        const { monitor, exception, network } = vdsConfig.performance;
        if (monitor !== this.options.monitor) {
          this.options.monitor = monitor;
        }
        if (exception !== this.options.exception) {
          this.options.exception = exception;
        }
        if (network !== this.options.network) {
          this.options.network = network;
        }
        this.init();
      }
    });
    // 采集开关从关闭到打开时要把队列中存的启动和错误都发出去
    // 采集开关开启必会更新session
    this.growingIO.emitter?.on(EMIT_MSG.SESSIONID_UPDATE, () => {
      const { trackingId, getOption } = this.growingIO;
      if (getOption(trackingId, 'dataCollect')) {
        this.sendCacheQuene();
      }
    });
  }

  init = () => {
    const { dataCollect } = this.growingIO.vdsConfig;
    const { monitor, exception, network } = this.options;
    if (monitor) {
      this.monitor = new Monitor(this.growingIO);
    }
    if (exception) {
      this.exception = new Exception(this.growingIO);
    }
    if (network) {
      this.network = new Network(this.growingIO, this.options);
    }
    // SDK初始化完成发送缓存队列
    if (dataCollect) {
      this.sendCacheQuene();
    }
  };

  // 发送缓存队列
  sendCacheQuene = () => {
    if (!ut.isEmpty(this.cacheQueue)) {
      this.cacheQueue.forEach((o: any) => {
        this.buildPerfEvent(o.eventName, o.attributes, o.extra);
      });
      this.cacheQueue = [];
    }
  };

  // 构建各种性能事件
  buildPerfEvent = (eventName: string, attributes: any, extra?: any) => {
    const {
      dataStore: { eventContextBuilder, eventConverter },
      gioSDKInitialized,
      vdsConfig
    } = this.growingIO;
    // SDK没初始化完成或初始化关闭采集开关的事件先存起来，等SDK初始化完成或开启采集开关再发
    if (!gioSDKInitialized || !vdsConfig.dataCollect) {
      this.cacheQueue = [
        ...this.cacheQueue,
        {
          eventName,
          attributes,
          extra
        }
      ];
      return false;
    }
    // 处理过长的小数，保留0位
    ut.forEach(attributes, (v, k) => {
      if (Number.isNaN(v) || ut.isNil(v) || Number(v) < 0) {
        attributes[k] = 0;
      }
      attributes[k] = ut.fixed(v, 0);
    });
    let event = {
      eventType: 'CUSTOM',
      eventName,
      attributes,
      ...eventContextBuilder(this.growingIO.trackingId)
    };
    event.attributes = limitObject({
      ...(event.attributes ?? {}),
      ...attributes
    });
    if (!isEmpty(extra)) {
      event = { ...event, ...extra };
    }
    eventConverter(event);
  };
}

export default {
  name: 'gioPerformance',
  method: GioPerformance
};
