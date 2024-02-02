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
  path: string;
  time: number;
  query: any;
  settedTitle: any;
  title: string;
  pageProps: any;
  lastLifecycle: string;
  currentLifecycle: string;
  parsePage: (page: any, query: any) => void;
  getQuery: (query: any) => string;
  getReferralPage: () => string;
  saveShareId: (query: string) => void;
  buildShareQuery: (result: PageShareResult) => [string, string];
  updateAppMessageResult: (result: PageShareResult) => PageShareResult;
  updateTimelineResult: (result: PageShareResult) => PageShareResult;
  updateAddFavoritesResult: (result: PageShareResult) => PageShareResult;
}

export interface EventHooksType {
  defAppCbs: any;
  defPageCbs: any;
  appHandlers: string[];
  pageHandlers: string[];
  actionEventTypes: string[];
  originalApp: (any: any) => any;
  originalPage: (any: any) => any;
  originalComponent: (any: any) => any;
  originalBehavior: (any: any) => any;
  appEffects: (app: any, event: AppHookLifeCircle, args: any) => void;
  pageEffects: (page: any, event: PageHookLifeCircle, args: any) => void;
  actionEffects: (event: EventTarget, method: string) => void;
  currentPage: MinipPageType;
  // 判断是否为非构造函数的一个函数
  isNormalFc: (key: string, method: any) => any;
  // 补充生命周期函数
  supLifeFcs: (target: any, type: 'app' | 'page') => void;
  // 对象的遍历
  objectTraverse: (target: any, fn: any) => any;
  // 初始化无埋点
  initEventHooks: () => void;
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
}
