import { PLATFORMS } from './platforms';

/**
 * 应用来源信息接口
 * @interface AppSource
 */
export interface AppSource {
  /** 来源附加信息 */
  extra: any;
  /** 包名 */
  packageName: string;
  /** 来源类型 */
  type: string;
}

/**
 * 用户信息接口
 * @interface UserInfo
 */
export interface UserInfo {
  /** 昵称 */
  nickname: string;
  /** 头像 URL */
  avatarUrl: string;
  /** 性别 0：未知、1：男、2：女 */
  gender: number;
  /** 省份 */
  province: string;
  /** 城市 */
  city: string;
  /** 国家 */
  country: string;
}

/**
 * 系统信息接口
 * @interface SystemInfo
 */
export interface SystemInfo {
  /** 设备品牌 */
  brand: string;
  /** 设备型号 */
  model: string;
  /** 设备像素比 */
  pixelRatio: number;
  /** 屏幕宽度，单位px */
  screenWidth: number;
  /** 屏幕高度，单位px */
  screenHeight: number;
  /** 语言 */
  language: string;
  /** 平台容器版本号 */
  version: string;
  /** 操作系统及版本 */
  system: string;
  /** 客户端基础库版本 */
  SDKVersion: string;
  /** 客户端平台 */
  platform: string;
}

/**
 * 小程序实例接口
 * @interface MinipInstanceType
 */
export interface MinipInstanceType {
  /** 小程序原生对象 wx/my/tt/swan/qq/ks/jd/xhs */
  readonly minip: any;
  /** 当前平台 */
  platform: PLATFORMS;
  /** 场景值前缀 */
  scnPrefix: string;
  /** 快应用来源 */
  appSource: AppSource;
  /** 系统信息 */
  systemInfo: any;
  /** 网络信息 */
  network: any;
  /** 快应用异步身份存储是否已恢复 */
  identityReady?: boolean;
  /** hook动态设置页面标题方法 */
  hookSetTitle: () => void;
  /** 获取快应用来源信息 */
  getAppSource?: () => AppSource;
  /** 采集曝光事件 */
  initImpression?: (collectPage: any) => void;
  /** 获取快应用分享信息 */
  initShareAppMessage?: (growingio: any) => void;
  /** 获取当前页面栈 */
  getCurrentPage: () => any;
  /** 获取当前页面路由 */
  getCurrentPath: (page?: any) => string;
  /** 获取页面标题 */
  getPageTitle: (page: any) => string;
  /** 同步获取存储数据 */
  getStorageSync: (key: string) => any;
  /** 同步存储数据 */
  setStorageSync: (
    key: string,
    value: any,
    expiredAt?: string | number
  ) => void;
  /** 异步存储数据 */
  setStorage: (key: string, value: any) => void;
  /** 同步移除指定数据 */
  removeStorageSync: (key: string) => void;
  /** 获取网络类型 */
  getNetworkType: () => Promise<{ networkType: string }>;
  /** 网络请求 */
  request: ({
    url,
    data,
    header,
    timeout,
    method,
    fail,
    success,
    complete
  }: any) => void;
  /** 获取小程序系统信息 */
  getSystemInfo?: () => Promise<SystemInfo>;
  /** 监听网络变更 */
  setNetworkStatusListener?: () => any;
  /** 执行特有的分享promise */
  handleSharePromise?: (
    originResult: any,
    handlePromiseResult: () => void
  ) => any;
}
