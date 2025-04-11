export interface StringObject {
  [key: string]: string;
}

interface TBConfig {
  cloud: any;
  cloudFuncSend?: boolean;
  cloudFuncName?: string;
  cloudFuncHandler?: string;
  cloudAppId?: string;
  path?: string;
}
export interface UserOptions {
  // 是否开启无埋点
  autotrack: boolean;
  // 是否开启加密压缩
  compress: boolean;
  // 是否开启数据采集
  dataCollect: boolean;
  // 是否开启调试模式
  debug: boolean;
  // 是否开启
  idMapping: boolean;
  // 与内嵌页打通时额外的信息参数
  extraParams: string[];
  // 是否开启分享跟踪
  followShare: boolean;
  // 是否开启强制登录
  forceLogin: boolean;
  // 或略上报字段
  ignoreFields: string[];
  // 曝光比例
  impressionScale: number;
  // 是否使用原始来源信息作为访问事件的参数上报
  originalSource: boolean;
  // session保活时长（5分钟）
  keepAlive: number;
  // 性能采集配置
  performance?: {
    monitor: boolean;
    exception: boolean;
    network: boolean;
  };
  // 请求超时时长
  requestTimeout?: number;
  // 数据上报域名
  serverUrl?: string;
  // session超时时长
  sessionExpires?: number;
  // taro框架实例
  taro?: any;
  // taro框架vue实例
  taroVue?: any;
  // 淘宝小程序/小部件配置
  tbConfig?: TBConfig;
  // uniapp vue实例
  uniVue?: boolean;
  // 上报间隔（1秒）
  uploadInterval: number;
  // 小程序应用版本
  version: string;
}

export interface ErrorEventParams {
  key?: string;
  error: string;
  page?: string;
  function?: string;
}

export interface Element {
  x: string;
  v?: string;
  h?: string;
  idx?: number;
  obj?: number;
}

export type EventTypes =
  | 'PAGE'
  | 'VISIT'
  | 'CUSTOM'
  | 'VISITOR_ATTRIBUTES'
  | 'LOGIN_USER_ATTRIBUTES'
  | 'APP_CLOSED'
  | 'VIEW_CLICK'
  | 'VIEW_CHANGE';

export interface EVENT {
  appChannel: string;
  appVersion: string;
  attributes?: any;
  dataSourceId: string;
  deviceBrand: string;
  deviceId: string;
  deviceModel: string;
  deviceType: string;
  domain: string;
  eventName: string;
  eventSequenceId: number;
  eventType: EventTypes;
  hyperlink?: string;
  index?: number;
  language: string;
  latitude?: number;
  longitude?: number;
  networkState: string;
  path?: string;
  platform: string;
  platformVersion: string;
  properties?: any;
  query?: string;
  referralPage?: string;
  screenHeight: number;
  screenWidth: number;
  sdkVersion: string;
  sessionId: string;
  textValue?: string;
  timestamp: number;
  title: string;
  userId?: string;
  xpath?: string;
}

export interface EXTEND_EVENT extends EVENT {
  requestId: string;
  trackingId: string;
}

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

export interface EventTarget {
  type: Actions;
  currentTarget: {
    id: string;
    dataset: {
      index: number | string;
      src: string;
      title: string;
      growingTrack: boolean;
      growingtrack: boolean;
      growingIgnore: boolean;
    };
  };
  target: {
    id: string;
    dataset: {
      index: number | string;
      src: string;
      title: string;
      growingTrack: boolean;
      growingtrack: boolean;
      growingIgnore: boolean;
    };
  };
  detail: any;
  handler: string | undefined;
}
