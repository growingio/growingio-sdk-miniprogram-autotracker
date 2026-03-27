/**
 * 字符串对象接口
 */
export interface StringObject {
  [key: string]: string;
}

/**
 * 淘宝小程序/小部件配置接口
 */
interface TBConfig {
  /** 云开发环境 ID */
  cloud: any;
  /** 是否使用云函数发送数据 */
  cloudFuncSend?: boolean;
  /** 云函数名称 */
  cloudFuncName?: string;
  /** 云函数处理方法 */
  cloudFuncHandler?: string;
  /** 云开发 AppId */
  cloudAppId?: string;
  /** 路径 */
  path?: string;
}

/**
 * 用户配置项接口
 */
export interface UserOptions {
  /** 是否开启无埋点 */
  autotrack: boolean;
  /** 是否开启加密压缩 */
  compress: boolean;
  /** 是否开启数据采集 */
  dataCollect: boolean;
  /** 是否开启调试模式 */
  debug: boolean;
  /** 是否开启 idMapping */
  idMapping: boolean;
  /** 与内嵌页打通时额外的信息参数 */
  extraParams: string[];
  /** 是否开启分享跟踪 */
  followShare: boolean;
  /** 是否开启强制登录 */
  forceLogin: boolean;
  /** 忽略上报字段 */
  ignoreFields: string[];
  /** 曝光比例 */
  impressionScale: number;
  /** 是否使用原始来源信息作为访问事件的参数上报 */
  originalSource: boolean;
  /** session 保活时长（分钟） */
  keepAlive: number;
  /** 性能采集配置 */
  performance?: {
    /** 是否开启监控 */
    monitor: boolean;
    /** 是否开启异常监控 */
    exception: boolean;
    /** 是否开启网络监控 */
    network: boolean;
  };
  /** 请求超时时长 */
  requestTimeout?: number;
  /** 数据上报域名 */
  serverUrl?: string;
  /** session 超时时长 */
  sessionExpires?: number;
  /** taro 框架实例 */
  taro?: any;
  /** taro 框架 vue 实例 */
  taroVue?: any;
  /** 淘宝小程序/小部件配置 */
  tbConfig?: TBConfig;
  /** uniapp vue 实例 */
  uniVue?: boolean;
  /** mpx 框架实例 */
  mpx?: any;
  /** 上报间隔（毫秒） */
  uploadInterval: number;
  /** 小程序应用版本 */
  version: string;
}

/**
 * 错误事件参数接口
 */
export interface ErrorEventParams {
  /** 错误 key */
  key?: string;
  /** 错误信息 */
  error: string;
  /** 发生错误的页面 */
  page?: string;
  /** 发生错误的函数 */
  function?: string;
}

/**
 * 元素接口
 */
export interface Element {
  /** xpath */
  x: string;
  /** textValue */
  v?: string;
  /** hyperlink */
  h?: string;
  /** index */
  idx?: number;
  /** object */
  obj?: number;
}

/**
 * 事件类型定义
 */
export type EventTypes =
  | 'PAGE'
  | 'VISIT'
  | 'CUSTOM'
  | 'VISITOR_ATTRIBUTES'
  | 'LOGIN_USER_ATTRIBUTES'
  | 'APP_CLOSED'
  | 'VIEW_CLICK'
  | 'VIEW_CHANGE';

/**
 * 事件基础接口
 */
export interface EVENT {
  /** 应用渠道 */
  appChannel: string;
  /** 应用版本 */
  appVersion: string;
  /** 事件属性 */
  attributes?: any;
  /** 数据源 ID */
  dataSourceId: string;
  /** 设备品牌 */
  deviceBrand: string;
  /** 设备 ID */
  deviceId: string;
  /** 设备型号 */
  deviceModel: string;
  /** 设备类型 */
  deviceType: string;
  /** 域名（AppId） */
  domain: string;
  /** 事件名称 */
  eventName: string;
  /** 事件序列号 */
  eventSequenceId: number;
  /** 事件类型 */
  eventType: EventTypes;
  /** 超链接 */
  hyperlink?: string;
  /** 索引 */
  index?: number;
  /** 语言 */
  language: string;
  /** 纬度 */
  latitude?: number;
  /** 经度 */
  longitude?: number;
  /** 网络状态 */
  networkState: string;
  /** 路径 */
  path?: string;
  /** 平台 */
  platform: string;
  /** 平台版本 */
  platformVersion: string;
  /** 属性（兼容旧版本） */
  properties?: any;
  /** 查询参数 */
  query?: string;
  /** 来源页面 */
  referralPage?: string;
  /** 屏幕高度 */
  screenHeight: number;
  /** 屏幕宽度 */
  screenWidth: number;
  /** SDK 版本 */
  sdkVersion: string;
  /** 会话 ID */
  sessionId: string;
  /** 文本值 */
  textValue?: string;
  /** 时间戳 */
  timestamp: number;
  /** 标题 */
  title: string;
  /** 用户 ID */
  userId?: string;
  /** xpath */
  xpath?: string;
}

/**
 * 扩展事件接口
 */
export interface EXTEND_EVENT extends EVENT {
  /** 请求 ID */
  requestId: string;
  /** 实例 ID */
  trackingId: string;
}

/**
 * 动作类型定义
 */
export type Actions =
  | 'tap'
  | 'longpress'
  | 'longtap'
  | 'change'
  | 'confirm'
  | 'blur'
  | 'getphonenumber'
  | 'contact'
  | 'getuserinfo';

/**
 * 事件目标接口
 */
export interface EventTarget {
  /** 事件类型 */
  type: Actions;
  /** 当前目标 */
  currentTarget: {
    /** ID */
    id: string;
    /** 数据集 */
    dataset: {
      index: number | string;
      src: string;
      title: string;
      growingTrack: boolean;
      growingtrack: boolean;
      growingIgnore: boolean;
    };
  };
  /** 目标 */
  target: {
    /** ID */
    id: string;
    /** 数据集 */
    dataset: {
      index: number | string;
      src: string;
      title: string;
      growingTrack: boolean;
      growingtrack: boolean;
      growingIgnore: boolean;
    };
  };
  /** 详情 */
  detail: any;
  /** 处理函数 */
  handler: string | undefined;
}
