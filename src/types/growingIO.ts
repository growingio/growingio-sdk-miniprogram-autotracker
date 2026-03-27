import { DataStoreType, OriginOptions } from '@@/types/dataStore';
import { MinipInstanceType } from '@@/types/minipInstance';
import { FRAMEWORKS, PLATFORMTYPES } from '@@/types/platforms';
import { PluginsType } from '@@/types/plugins';
import { UploaderType } from '@@/types/uploader';
import { UserStoreType } from '@@/types/userStore';

/**
 * GrowingIO 核心实例接口
 * @interface GrowingIOType
 */
export interface GrowingIOType {
  /** 工具类 */
  utils?: any;
  /** 监听器 */
  emitter: {
    emit?: (msg: string, args?: any) => void;
    on?: (msg: string, method: (args?: any) => any) => void;
    once?: (msg: string, method: (args?: any) => any) => void;
    off?: (msg: string, method: (args?: any) => any) => void;
  };
  /** 小程序平台 */
  gioPlatform: PLATFORMTYPES;
  /** 标记当前小程序是什么框架 */
  gioFramework: FRAMEWORKS;
  /** sdk版本号 */
  sdkVersion: string;
  /** 是否在小程序插件中标识 */
  inPlugin: boolean;
  /** 分包在全局中的实例key值 */
  subKey?: string;
  /** 小程序实例配置 */
  platformConfig: any;
  /** sdk初始化标识 */
  gioSDKInitialized: boolean;
  /** 所有配置项 */
  vdsConfig: OriginOptions;
  /** 小程序实例 */
  minipInstance: MinipInstanceType;
  /** 用户管理实例 */
  userStore: UserStoreType;
  /** 数据管理实例 */
  dataStore: DataStoreType;
  /** 插件管理实例 */
  plugins: PluginsType;
  /** 上传组件实例 */
  uploader: UploaderType;
  /** 无埋点插件实例 */
  eventTracking?: any;
  /** 埋点插件实例 */
  customTracking?: any;
  /** taro3中存储完整的页面节点信息 */
  taro3VMs?: any;
  /** 分享数据 */
  shareAppMessage?: any;
  /** 用于放在事件中区别于为其他功能而生成事件的跟踪器Id，默认为g0 */
  trackingId: string;
  /** 存储子实例的配置和信息 */
  subInstance: {
    [key: string]: OriginOptions;
  };
  /**
   * 初始化方法
   * @param {any} args 初始化参数
   */
  init: (args: any) => void;
  /**
   * 注册插件
   * @param {string} [path] 插件路径
   */
  registerPlugins?: (path?: string) => void;
  /**
   * 运行中修改配置
   * @param {string} trackingId 跟踪器 ID
   * @param {string} optionKey 配置键
   * @param {any} value 配置值
   */
  setOption: (trackingId: string, optionKey: string, value: any) => void;
  /**
   * 运行中获取配置
   * @param {string} trackingId 跟踪器 ID
   * @param {string} [optionKey] 配置键
   * @returns {any} 配置值
   */
  getOption: (trackingId: string, optionKey?: string) => any;
  /**
   * 设置页面属性
   * @param {string} trackingId 跟踪器 ID
   * @param {any} properties 页面属性
   */
  setPageAttributes: (trackingId: string, properties: any) => void;
  /**
   * 清空已设置的页面属性
   * @param {string} trackingId 跟踪器 ID
   * @param {string[] | undefined} properties 要清除的属性键列表
   */
  clearPageAttributes: (
    trackingId: string,
    properties: string[] | undefined
  ) => void;
  /**
   * 手动发 page 事件
   * @param {string} trackingId 跟踪器 ID
   * @param {any} [props] 页面属性
   */
  sendPage: (trackingId: string, props?: any) => void;
  /**
   * 设置 openId 作为 uid
   * @param {string} trackingId 跟踪器 ID
   * @param {string} openId 用户的 OpenID
   */
  identify?: (trackingId: string, openId: string) => void;
  /**
   * 发送用户变量
   * @param {string} trackingId 跟踪器 ID
   * @param {any} userAttributes 用户属性
   */
  setUserAttributes?: (trackingId: string, userAttributes: any) => void;
  /**
   * 设置登录用户Id
   * @param {string} trackingId 跟踪器 ID
   * @param {string} userId 用户 ID
   * @param {string} [userKey] 用户 Key
   */
  setUserId?: (trackingId: string, userId: string, userKey?: string) => void;
  /**
   * 清除登录用户Id
   * @param {string} trackingId 跟踪器 ID
   */
  clearUserId?: (trackingId: string) => void;
  /**
   * 设置全局通用属性
   * @param {string} trackingId 跟踪器 ID
   * @param {any} properties 通用属性
   */
  setGeneralProps?: (trackingId: string, properties: any) => void;
  /**
   * 清除已设置的全局通用属性
   * @param {string} trackingId 跟踪器 ID
   * @param {string[] | undefined} properties 要清除的属性键列表
   */
  clearGeneralProps?: (
    trackingId: string,
    properties: string[] | undefined
  ) => void;
  /**
   * 创建自定义埋点事件
   * @param {string} trackingId 跟踪器 ID
   * @param {string} name 事件名称
   * @param {Object} properties 事件属性
   * @param {Object} [items] 物品信息
   */
  track?: (
    trackingId: string,
    name: string,
    properties: { [key: string]: string },
    items?: { key: string; id: string; attributes?: { [key: string]: string } }
  ) => void;
  /**
   * 初始化事件计时器
   * @param {string} trackingId 跟踪器 ID
   * @param {string} eventName 事件名称
   * @returns {any} 计时器 ID
   */
  trackTimerStart: (trackingId: string, eventName: string) => any;
  /**
   * 暂停事件计时器
   * @param {string} trackingId 跟踪器 ID
   * @param {string} timerId 计时器 ID
   * @returns {boolean} 是否成功
   */
  trackTimerPause: (trackingId: string, timerId: string) => boolean;
  /**
   * 恢复事件计时器
   * @param {string} trackingId 跟踪器 ID
   * @param {string} timerId 计时器 ID
   * @returns {boolean} 是否成功
   */
  trackTimerResume: (trackingId: string, timerId: string) => boolean;
  /**
   * 停止事件计时器并上报事件
   * @param {string} trackingId 跟踪器 ID
   * @param {string} timerId 计时器 ID
   * @param {any} properties 事件属性
   * @returns {boolean} 是否成功
   */
  trackTimerEnd: (
    trackingId: string,
    timerId: string,
    properties: any
  ) => boolean;
  /**
   * 移除事件计时器
   * @param {string} trackingId 跟踪器 ID
   * @param {string} timerId 计时器 ID
   * @returns {boolean} 是否成功
   */
  removeTimer: (trackingId: string, timerId: string) => boolean;
  /**
   * 清除所有事件计时器
   * @param {string} trackingId 跟踪器 ID
   */
  clearTrackTimer: (trackingId: string) => void;
  /**
   * 手动获取位置信息补发visit上报
   * @param {string} trackingId 跟踪器 ID
   * @param {number} latitude 纬度
   * @param {number} longitude 经度
   */
  setLocation: (
    trackingId: string,
    latitude: number,
    longitude: number
  ) => void;
  /**
   * 手动更新曝光监听
   * @param {any} [collect] 采集配置
   */
  updateImpression?: (collect?: any) => void;
  /**
   * 获取ABTest数据
   * @param {string} trackingId 跟踪器 ID
   * @param {string} layerId 层级 ID
   * @param {Function} [callback] 回调函数
   */
  getABTest?: (
    trackingId: string,
    layerId: string,
    callback?: (arg: any) => any
  ) => void;
  /**
   * 获取打通信息
   * @param {string} trackingId 跟踪器 ID
   * @returns {string} 打通信息
   */
  getGioInfo: (trackingId: string) => string;
  /**
   * 初始化回调
   */
  initCallback?: () => void;
  /**
   * 错误提示
   * @param {string} fn 函数名
   * @param {boolean} [type] 错误类型
   * @param {string} [msg] 错误信息
   */
  callError?: (fn: string, type?: boolean, msg?: string) => void;
  GioApp?: any;
  GioPage?: any;
  GioComponent?: any;
  GioBehavior?: any;
}
