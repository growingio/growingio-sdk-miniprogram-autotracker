import { EVENT } from './base';

export type AppHookLifeCircle = 'onShow' | 'onHide' | 'onError';
export type PageHookLifeCircle =
  | 'onShow'
  | 'onLoad'
  | 'onReady'
  | 'onHide'
  | 'onUnload'
  | 'onShareAppMessage'
  | 'onTabItemTap';

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
export interface EventTarget {
  type: ActionEventTypes;
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
  timeStamp: number | string;
}

export interface ShareQuery {
  // 访问用户id
  suid: string;
  // 当前用户分享id
  gioShareId: string;
  // 之前用户分享id
  gioPreShareId?: string;
  // 内容类型
  contentType?: string;
  // 内容id
  contentId?: string;

  [K: string]: string;
}

export interface PageShareResult {
  title: string;
  path?: string;
  query?: string;
  imageUrl?: string;
  contentType?: string;
  contentId?: string;
  attributes?: any;
}

export interface MinipPageType {
  queryOptions: any;
  configuredTitle: any;
  pageProps: any;
  lastLifecycle: string;
  currentLifecycle: string;
  lifeBeforeShow: boolean;
  getPagePath: () => string;
  getPageQuery: () => string;
  getPageTitle: (trackingId?: string) => string;
  getReferralPage: (trackingId: string) => string;
  buildShareQuery: (result: PageShareResult) => [string, string];
  updateShareResult: (
    result: PageShareResult,
    fillParams?: boolean
  ) => PageShareResult;
  eventSetPageProps: (trackingId: string, event: EVENT) => any;
}

export interface EventHooksType {
  defAppCbs: any;
  defPageCbs: any;
  appHandlers: string[];
  pageHandlers: string[];
  actionEventTypes: string[];
  appEffects: any;
  pageEffects: any;
  actionEffects: any;
  currentPage: MinipPageType;
  // 判断是否为非构造函数的一个函数
  isNormalFc: (key: string, method: any) => any;
  // 补充生命周期函数
  supLifeFcs: (target: any, type: 'app' | 'page') => void;
  // 对象的遍历
  objectTraverse: (target: any, fn: any) => any;

  // 生命周期方法effects
  lifeFcEffects: (eventName: string, method: any, cType: 'App' | 'Page') => any;
  // 自定义方法effects
  customFcEffects: (eventName: string, method: any) => any;
  // app逻辑执行代理
  appApplyProxy: (eventName: string, method: any) => Function;
  // Page事件执行代理
  pageApplyProxy: (eventName: string, method: any) => Function;
  // App重写(重写除构造函数之外的所有方法)
  appOverriding: (options: any) => any;
  // Page/Component/Behavior重写(重写除构造函数之外的所有方法，原生小程序使用)
  pageOverriding: (options: any) => any;
  // Component/Behavior重写(重写除构造函数之外的所有方法)
  componentOverriding: (options: any) => any;
  // 挂载App生命周期的effect方法
  setAppEffectCbs: () => void;
  // 挂载Page/Component生命周期的effect方法
  setPageEffectCbs: () => void;
  // App属性重写复用方法
  growingApp: (app: any) => any;
  // Page属性重写复用方法
  growingPage: (page: any) => any;
  // Component属性重写复用方法
  growingComponent: (component: any) => any;
  // Behavior属性重写复用方法
  growingBehavior: (behavior: any) => any;
  // 对原生的重写方法
  nativeGrowing: (designated?: string[]) => void;
  // 初始化原始值
  initOriginalValue: () => void;
  // 初始化事件钩子
  initEventHooks: () => void;
}
