/**
 * APM Monitor 子模块共享的类型与常量定义。
 *
 * 这一层只放“数据形状”和“枚举值”，不放任何业务逻辑：
 *   - 让 Monitor 主类、observer、coldStart、warmStart、pageLoad 共用同一套字段命名
 *   - 让任意一个子模块的字段含义在编译期可被 TypeScript 跨文件追踪
 *   - 把生命周期常量集中到一处，避免分散在各文件里出现拼写漂移
 */

/**
 * 当前页面访问被识别为冷启动还是热启动。
 *
 * - cold：SDK 启动后 App 第一次进入，没经历过 onHide
 * - warm：App 至少经历过一次 onHide → onShow，本次属于回到前台的二次进入
 *
 * 注意：这是“App 维度”的状态，不是“当前页是冷/热”的判断。
 * 当前页是冷/热由 ColdStartTracker / WarmStartTracker 各自固化到 PagePerf 上。
 */
export type RebootMode = 'cold' | 'warm';

/**
 * Performance Observer 关心的 entry 名称。
 *
 * 这三类对应：
 *   - firstContentfulPaint：首屏白屏结束
 *   - largestContentfulPaint：首屏最大内容渲染
 *   - route：页面跳转开始时间，可用作普通页面加载起点
 */
export type ObserverEntryName =
  | 'firstContentfulPaint'
  | 'largestContentfulPaint'
  | 'route';

/**
 * 一轮 observer 回调中按 entry 名分类后的结果。
 *
 * 用对象封装而不是按 entry 数组，是为了让消费方能按指标语义直接读，
 * 避免每次都要 getEntriesByName('firstContentfulPaint')。
 */
export type ObserverEntries = {
  /** appLaunch 仅取一条；它是 App 维度的启动指标 */
  launchEntry?: any;
  /** FCP 在快速切页时同一轮可能包含多个页面的数据 */
  fcpEntries: any[];
  /** LCP 同上 */
  lcpEntries: any[];
  /** route 同上 */
  routeEntries: any[];
};

/**
 * App 维度的性能时间戳缓存。
 *
 * 其中 `appStartTime` / `appDuration` / `firstPath` 是 observer 提供的；
 * 其余字段是生命周期事件的到达时间。
 */
export type AppPerf = {
  onLaunch?: number;
  onShow?: number;
  onShowEnd?: number;
  onHide?: number;
  appStartTime?: number;
  appDuration?: number;
  firstPath?: string;
};

/**
 * 单页面访问期间累积的所有性能信息。
 *
 * 字段按用途分组：
 *   1) Page 生命周期时间戳 - SDK 内部 emitter 广播
 *   2) Observer 指标 - 平台 PerformanceObserver 回调
 *   3) Observer 等待状态 - 用于决定何时解除发送门槛
 *   4) 冷启动固化标记 - markColdStartIfNeeded 写入
 *   5) 热启动固化标记 - markWarmStartIfMatched 写入
 *   6) 上下文快照 - cachePageContext 写入
 *   7) eventSent - handleEvent 成功后置 true，防重发
 *
 * 关键约束：发送阶段所有数据都从 PagePerf 读取，不再回头读 currentPage 或全局 appPerf，
 * 避免支付宝 observer 延迟回调时把事件挂到错误的页面上。
 */
export type PagePerf = {
  /** 归一化后的页面 path（去掉 query 与前导 /） */
  path: string;

  // ===== Page 生命周期时间戳 =====
  onLoad?: number;
  onShow?: number;
  onShowEnd?: number;
  onReady?: number;
  onReadyEnd?: number;
  onHide?: number;
  onUnload?: number;

  // ===== Observer 指标 =====
  /** firstContentfulPaint 起始时间（原始值，事件里需要再减 onLoad） */
  FCPStartTime?: number;
  /** largestContentfulPaint 起始时间（原始值，事件里需要再减 onLoad） */
  LCPStartTime?: number;
  /** route entry 起始时间，普通跳转的 page_launch_duration 起点 */
  navigationStart?: number;
  /** route entry 自身耗时，目前未直接使用，保留与历史代码一致 */
  routeDuration?: number;

  // ===== Observer 等待状态 =====
  /** 已经收到真实数据的 entry 名集合 */
  handledEntries?: Record<string, boolean>;
  /** 当前轮 observer 处理是否已经达到“放行发送”的条件 */
  observerProcessed?: boolean;
  /** observer 等待已超时（按需触发兜底放行） */
  observerFallbackExpired?: boolean;
  /** 当前页一共收到了几轮 observer 回调（支付宝特判用） */
  observerTriggerCount?: number;
  /** 当前页第一次 observer 回调的时间戳，作为等待计时起点 */
  firstObserverTimestamp?: number;

  // ===== 冷启动固化标记 =====
  isColdStart?: boolean;
  /** 冷启动起点（App onLaunch），observer 缺失时用作回退 */
  coldAppLaunch?: number;
  /** 冷启动起点（App appStartTime），observer 提供，是更精确的起点 */
  coldAppStartTime?: number;

  // ===== 热启动固化标记 =====
  isWarmStart?: boolean;
  /** 当前热启动对应的 App onShowEnd 时刻 */
  warmAppShowEnd?: number;
  /**
   * 当前热启动是否需要等到 onReadyEnd 才发送。
   * - true：本次回前台后页面发生了新的 onLoad，按“新页面”等 onReadyEnd
   * - false：只是回到原页面没有新 onLoad，可以直接用 onShowEnd 发送
   */
  warmWaitReadyEnd?: boolean;

  // ===== 上下文快照 =====
  pagePath?: string;
  pageQuery?: string;
  pageTitle?: string;

  // ===== 发送幂等 =====
  eventSent?: boolean;
};

/**
 * Observer 单页等待上限。
 *
 * 超过这个时间还没等到的关键指标会被视为“放弃等待”，立即放行已就绪的事件，
 * 避免某些平台或低版本基础库稳定缺失某类指标时事件被永久挂起。
 */
export const OBSERVER_WAIT_TIMEOUT = 2000;

/**
 * 我们关心的 observer entry 集合，决定 finalize 时检查哪些 entry 是否到位。
 */
export const OBSERVER_ENTRY_NAMES: ObserverEntryName[] = [
  'firstContentfulPaint',
  'largestContentfulPaint',
  'route'
];

/**
 * 显式拆出 FCP / LCP 名称常量，避免拼写错误并便于在等待规则里复用。
 */
export const FCP_ENTRY_NAME: ObserverEntryName = 'firstContentfulPaint';
export const LCP_ENTRY_NAME: ObserverEntryName = 'largestContentfulPaint';

/**
 * 这些生命周期时刻 currentPage 仍然指向当前页面，缓存上下文是安全的。
 *
 * onHide / onUnload 阶段 currentPage 已经可能切走，所以不在此列。
 */
export const CONTEXT_CACHE_LIFECYCLES = [
  'onShow',
  'onShowEnd',
  'onReady',
  'onReadyEnd'
];

/**
 * 主流程在这些生命周期事件到达时尝试发送 APM。
 *
 * - onShowEnd 主要服务“回到原页面”的热启动
 * - onReadyEnd 服务冷启动 / 普通跳转 / 落到新页面的热启动
 */
export const SEND_CHECK_LIFECYCLES = ['onShowEnd', 'onReadyEnd'];

/**
 * 这些生命周期会更新 referrerPath（“刚刚离开的页面”）。
 *
 * referrerPath 用于：
 *   - 冷启动判定（无 referrer 才可能是冷启动）
 *   - 普通跳转判定（有 referrer 且非热启动 → 普通跳转）
 */
export const REFERRER_LIFECYCLES = ['onHide', 'onUnload'];
