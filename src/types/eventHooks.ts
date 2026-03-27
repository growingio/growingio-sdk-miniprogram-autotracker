import { EVENT } from './base';

/**
 * App 生命周期钩子
 */
export type AppHookLifeCircle = 'onShow' | 'onHide' | 'onError';

/**
 * Page 生命周期钩子
 */
export type PageHookLifeCircle =
  | 'onShow'
  | 'onLoad'
  | 'onReady'
  | 'onHide'
  | 'onUnload'
  | 'onShareAppMessage'
  | 'onTabItemTap';

/**
 * 动作事件类型
 */
export type ActionEventTypes =
  | 'tap'
  | 'longpress'
  | 'longtap'
  | 'change'
  | 'confirm'
  | 'blur'
  | 'getphonenumber'
  | 'contact'
  | 'submit'
  | 'getuserinfo';

/**
 * 事件目标接口
 */
export interface EventTarget {
  /** 事件类型 */
  type: ActionEventTypes;
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
  /** 时间戳 */
  timeStamp: number | string;
}

/**
 * 分享查询参数接口
 */
export interface ShareQuery {
  /** 访问用户 id */
  suid: string;
  /** 当前用户分享 id */
  gioShareId: string;
  /** 之前用户分享 id */
  gioPreShareId?: string;
  /** 内容类型 */
  contentType?: string;
  /** 内容 id */
  contentId?: string;

  [K: string]: string;
}

/**
 * 页面分享结果接口
 */
export interface PageShareResult {
  /** 标题 */
  title: string;
  /** 路径 */
  path?: string;
  /** 查询参数 */
  query?: string;
  /** 图片 URL */
  imageUrl?: string;
  /** 内容类型 */
  contentType?: string;
  /** 内容 ID */
  contentId?: string;
  /** 属性 */
  attributes?: any;
}

/**
 * 小程序页面类型接口
 */
export interface MinipPageType {
  /** 查询参数选项 */
  queryOptions: any;
  /** 配置的标题 */
  configuredTitle: any;
  /** 页面属性 */
  pageProps: any;
  /** 上一个生命周期 */
  lastLifecycle: string;
  /** 当前生命周期 */
  currentLifecycle: string;
  /** 显示前的生命周期 */
  lifeBeforeShow: boolean;
  /** 获取页面路径 */
  getPagePath: () => string;
  /** 获取页面查询参数 */
  getPageQuery: () => string;
  /** 获取页面标题 */
  getPageTitle: (trackingId?: string) => string;
  /** 获取来源页面 */
  getReferralPage: (trackingId: string) => string;
  /** 构建分享查询参数 */
  buildShareQuery: (result: PageShareResult) => [string, string];
  /** 更新分享结果 */
  updateShareResult: (
    result: PageShareResult,
    fillParams?: boolean
  ) => PageShareResult;
  /** 设置页面属性事件 */
  eventSetPageProps: (trackingId: string, event: EVENT) => any;
}

/**
 * 事件钩子类型接口
 */
export interface EventHooksType {
  /** 默认 App 回调 */
  defAppCbs: any;
  /** 默认 Page 回调 */
  defPageCbs: any;
  /** App 处理程序列表 */
  appHandlers: string[];
  /** Page 处理程序列表 */
  pageHandlers: string[];
  /** 动作事件类型列表 */
  actionEventTypes: string[];
  /** App 效果 */
  appEffects: any;
  /** Page 效果 */
  pageEffects: any;
  /** 动作效果 */
  actionEffects: any;
  /** 当前页面 */
  currentPage: MinipPageType;
  /** 判断是否为非构造函数的一个函数 */
  isNormalFc: (key: string, method: any) => any;
  /** 补充生命周期函数 */
  supLifeFcs: (target: any, type: 'app' | 'page') => void;
  /** 对象的遍历 */
  objectTraverse: (target: any, fn: any) => any;

  /** 生命周期方法 effects */
  lifeFcEffects: (eventName: string, method: any, cType: 'App' | 'Page') => any;
  /** 自定义方法 effects */
  customFcEffects: (eventName: string, method: any) => any;
  /** app 逻辑执行代理 */
  appApplyProxy: (eventName: string, method: any) => Function;
  /** Page 事件执行代理 */
  pageApplyProxy: (eventName: string, method: any) => Function;
  /** App 重写(重写除构造函数之外的所有方法) */
  appOverriding: (options: any) => any;
  /** Page/Component/Behavior 重写(重写除构造函数之外的所有方法，原生小程序使用) */
  pageOverriding: (options: any) => any;
  /** Component/Behavior 重写(重写除构造函数之外的所有方法) */
  componentOverriding: (options: any) => any;
  /** 挂载 App 生命周期的 effect 方法 */
  setAppEffectCbs: () => void;
  /** 挂载 Page/Component 生命周期的 effect 方法 */
  setPageEffectCbs: () => void;
  /** App 属性重写复用方法 */
  growingApp: (app: any) => any;
  /** Page 属性重写复用方法 */
  growingPage: (page: any) => any;
  /** Component 属性重写复用方法 */
  growingComponent: (component: any) => any;
  /** Behavior 属性重写复用方法 */
  growingBehavior: (behavior: any) => any;
  /** 对原生的重写方法 */
  nativeGrowing: (designated?: string[]) => void;
  /** 初始化原始值 */
  initOriginalValue: () => void;
  /** 初始化事件钩子 */
  initEventHooks: () => void;
}
