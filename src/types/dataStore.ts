import { UserOptions } from '@@/types/base';
import { EventHooksType, PageContext } from '@@/types/eventHooks';

/**
 * 存储键类型
 */
export type StorageKeyType =
  | 'gsid'
  | 'originalSource'
  | 'uid'
  | 'sessionId'
  | 'userId'
  | 'userKey'
  | 'gioId';

/**
 * 原始配置项接口
 */
export interface OriginOptions extends UserOptions {
  /** 小程序 AppId */
  appId: string;
  /** 数据源 ID */
  dataSourceId?: string;
  /** 项目 ID */
  projectId: string;
  /** 实例 ID */
  trackingId: string;
}

/**
 * 数据存储类型接口
 */
export interface DataStoreType {
  /** 构建添加收藏事件 */
  buildAddFavorites: (trackingId: string, args: any) => void;
  /** 构建应用消息事件 */
  buildAppMessageEvent: (trackingId: string, args: any) => void;
  /** 构建朋友圈事件 */
  buildTimelineEvent: (trackingId: string, args: any) => void;
  /** 事件通用维度组装 */
  eventContextBuilder?: (
    trackingId: string,
    params?: any,
    executeAttributes?: boolean,
    /** PAGE/VISIT 已解析的页面快照；普通事件可省略并在构建器内解析 */
    pageContext?: PageContext
  ) => any;
  /** 事件转换器 */
  eventConverter?: (event) => void;
  /** 事件钩子 */
  eventHooks: EventHooksType;
  /** 事件拦截器 */
  eventInterceptor?: (event: any | void) => void;
  /** 事件释放检查器 */
  eventReleaseInspector?: () => void;
  /** 通用属性 */
  generalProps: any;
  /** 获取存储 key */
  getStorageKey: (trackingId: string, name: StorageKeyType) => string;
  /** 获取追踪器 VDS 配置 */
  getTrackerVds: (trackingId: string) => any;
  /** 获取配置 */
  getOption: (trackingId: string, k?: string) => OriginOptions;
  /** 获取原始来源 */
  getOriginalSource: (trackingId: string) => any;
  /** 消费生成时绑定到当前入口的 VISIT；旧批次不能消费后来建立的入口。 */
  consumeOriginalSource: (trackingId: string, events: import('./base').EXTEND_EVENT[]) => void;
  /** 删除尚未被 VISIT 消费的原始来源 */
  removeOriginalSource: (trackingId: string) => void;
  /** 获取 gsid */
  getGsid: (trackingId: string) => number;
  /** 设置 gsid */
  setGsid: (trackingId: string, value: number) => void;
  /** 初始化追踪器配置 */
  initTrackerOptions: (userOptions: OriginOptions) => any;
  /** 初始化追踪器钩子 */
  initTrackerHooker: (trackerOptions: OriginOptions) => boolean;
  /** 在修改身份和宿主钩子前校验框架对象及适配器。 */
  validateTrackerFramework: (trackerOptions: OriginOptions) => void;
  /** 初始化配置 */
  initOptions: (userOptions: OriginOptions) => OriginOptions;
  /** 初始化存储信息 */
  initStorageInfo: (trackingId: string) => void;
  /** 拦截的事件列表 */
  interceptEvents: any[];
  /** 上次关闭时间 */
  lastCloseTime: number;
  /** 上次页面事件 */
  lastPageEvent: any;
  /** 上次场景值 */
  lastScene: number | string;
  /** 上次访问事件 */
  lastVisitEvent: any;
  /** 位置数据 */
  locationData: any;
  /** 保存存储信息 */
  saveStorageInfo: () => void;
  /** 场景值 */
  scene: number | string;
  /** 发送页面事件 */
  sendPage: (trackingId: string, props?: any) => void;
  /** 发送访问事件 */
  sendVisit: (trackingId: string, props?: any) => void;
  /** 设置配置 */
  setOption: (trackingId: string, k: string, v: any) => boolean;
  /** SDK 内部修改非公开配置，不能由公共 setOption 调用。 */
  setInternalOption: (trackingId: string, k: string, v: any) => boolean;
  /** 校验并规范化数据上报基础地址。 */
  normalizeServerUrl: (serverUrl: any) => string;
  /** 设置原始来源 */
  setOriginalSource: (trackingId: string, origins: any) => void;
  /** 按路径更新未消费的来源标题，不修改已经创建的 VISIT */
  updateOriginalSourceTitle: (
    trackingId: string,
    path: string,
    title: any
  ) => boolean;
  /** 分享标识 */
  shareOut: boolean;
  /** 切换分享标识 */
  toggleShareOut: (v?: boolean) => void;
  /** 计时器 */
  trackTimers?: any;
  /** 已初始化的追踪器 ID 列表 */
  initializedTrackingIds: string[];
  /** 追踪器执行器 */
  trackersExecute: (callback: (trackingId: string) => void) => void;
}
