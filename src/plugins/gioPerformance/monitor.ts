import { PERF_MONITOR_VLUES } from '@@/types/gioPerformance';
import { GrowingIOType } from '@@/types/growingIO';
import { forEach, has, unset } from '@@/utils/glodash';
import { getSafeDuration, normalizePath } from '@@/utils/tools';
import EMIT_MSG from '@@/constants/emitMsg';

import { ColdStartTracker } from './monitor/coldStart';
import { ObserverCollector } from './monitor/observer';
import { PageLoadTracker } from './monitor/pageLoad';
import { WarmStartTracker } from './monitor/warmStart';
import {
  AppPerf,
  CONTEXT_CACHE_LIFECYCLES,
  PagePerf,
  REFERRER_LIFECYCLES,
  RebootMode,
  SEND_CHECK_LIFECYCLES
} from './monitor/types';

/**
 * APM 性能监控主类。
 *
 * 这一层只负责"串联"，不直接判定冷热启动：
 *   1. 订阅 SDK emitter，把 App / Page 生命周期事件路由到对应处理器
 *   2. 维护共享状态：appPerf / pagePerf / bootType / referrerPath
 *   3. 管理"一次访问"的页面状态机（reset / record / context cache）
 *   4. 协调发送管道：组装 perfData → 清洗 → 调用插件 emit
 *
 * 业务判定与时长计算被拆到三个 Tracker：
 *   - ColdStartTracker：SDK 启动后 App 首次进入
 *   - WarmStartTracker：App 已经经历过 onHide → onShow 的回前台
 *   - PageLoadTracker：普通页面跳转（非冷热启动）
 *
 * Observer 数据采集被拆到 ObserverCollector：
 *   订阅平台 PerformanceObserver，按 path 路由 entries，并管理等待门槛。
 *
 * 所有 Tracker / Observer 通过构造时传入的 Monitor 反向引用读写共享状态，
 * 这样既保留了模块边界，又避免在子模块间相互直接依赖。
 *
 * ============================================================================
 * 三类访问的判定决策矩阵
 * ============================================================================
 *
 *   ┌─────────────┬──────────────────────────────────┬────────────────────────┐
 *   │ 访问类型    │ 必要条件（互斥，自上而下命中）   │ 时长公式               │
 *   ├─────────────┼──────────────────────────────────┼────────────────────────┤
 *   │ 热启动 warm │ pagePerf.isWarmStart=true        │ ① 落到新页面：         │
 *   │             │ 且 warmAppShowEnd 已绑定         │   onReadyEnd-onShowEnd │
 *   │             │ （由 App.onHide → App.onShow 触发，│  （warmWaitReadyEnd）  │
 *   │             │  Page.onShowEnd 落地后固化）     │ ② 回到原页面：         │
 *   │             │                                  │   onShowEnd-onShowEnd  │
 *   ├─────────────┼──────────────────────────────────┼────────────────────────┤
 *   │ 冷启动 cold │ pagePerf.isColdStart=true 或     │ onReadyEnd-onLaunch    │
 *   │             │（referrerPath='' 且 bootType=cold）│ reboot_duration:       │
 *   │             │ 即首次进入小程序的落地页         │ onReadyEnd-appStartTime│
 *   ├─────────────┼──────────────────────────────────┼────────────────────────┤
 *   │ 普通跳转    │ 不满足以上 + referrerPath ≠ ''   │ onReadyEnd-navStart    │
 *   │ pageLoad    │ 即用户在 SDK 启动后内部页面跳转  │ （observer route 缺失  │
 *   │             │                                  │  时回退 onLoad）       │
 *   ├─────────────┼──────────────────────────────────┼────────────────────────┤
 *   │ 不发送      │ 不满足以上任意 + referrerPath='' │ —                      │
 *   │             │ 例如：SDK 晚于首页加载初始化、    │                        │
 *   │             │ Page 状态被异常重置等            │                        │
 *   └─────────────┴──────────────────────────────────┴────────────────────────┘
 *
 * 三类互斥保证：
 *   - bootType 翻成 'warm' 之前，warm 不可能命中（onHide 没发生 → lastWarm 永远 false）
 *   - bootType 翻成 'warm' 之后，cold 兜底分支不命中
 *   - 同一访问只可能命中其中一个
 *
 * 每类的详细判定规则、典型场景、平台差异见对应 Tracker 文件头部注释：
 *   - {@link ColdStartTracker} → monitor/coldStart.ts
 *   - {@link WarmStartTracker} → monitor/warmStart.ts
 *   - {@link PageLoadTracker}  → monitor/pageLoad.ts
 *
 * ============================================================================
 * 发送门槛（生命周期 + observer 双链路）
 * ============================================================================
 *
 *   生命周期门槛 hasReadyPagePerf：
 *     - cold / pageLoad：必须有 onReadyEnd
 *     - warm 形态 A（回到原页面）：允许仅 onShowEnd
 *     - warm 形态 B（落到新页面）：必须有 onReadyEnd
 *
 *   observer 门槛 hasProcessedObserverEntries（详见 observer.ts）：
 *     - 平台不支持 PerformanceObserver：直接放行
 *     - 微信：单轮 observer 完成即放行
 *     - 支付宝：必须等到第二轮 observer 或 2s 超时
 *
 *   两条门槛 AND 关系，但**热启动旁路 observer 门槛**：
 *   isVisit=warm 时不强等 observer，因为热启动回到原页面通常不会触发新的
 *   observer 回调，强等会永远卡住。FCP/LCP 在热启动事件里属于"有就带、没有就跳"。
 *
 * ============================================================================
 * 平台差异概览
 * ============================================================================
 *
 *   ⚙ App / Page 生命周期顺序：微信、支付宝、其他平台基本一致，本类不分平台
 *   ⚙ Performance Observer 行为差异：见 observer.ts 头部"微信 vs 支付宝差异速查"
 *   ⚙ 跨框架的 lifecycle 事件补齐：
 *       - 原生 wechat / alipay → 走 EventHooks.lifeFcEffects
 *       - mpx → gioMpxAdapter 用 mixin 注入并补 emitLifeEnd
 *       - Taro3 → gioTaroAdapter 拦截 hooks.call 并 wrapTaro3LifecycleResult
 *     这些适配器都把事件归一化成 "App xxx" / "App xxxEnd" / "Page xxx" / "Page xxxEnd"
 *     四种字符串，本类只消费这一套统一接口
 */
export default class Monitor {
  // ===========================================================================
  // 共享状态：Tracker / Observer 都通过这些字段读写
  // ===========================================================================

  /** 平台 minip 实例（小程序原生 API） */
  public minipInst: any;

  /** App 维度性能时间戳缓存 */
  public appPerf: AppPerf = {};

  /** Page 维度性能时间戳 + observer 指标 + 启动标记缓存（按归一化 path 分桶） */
  public pagePerf: Record<string, PagePerf> = {};

  /**
   * 当前 App 启动状态。
   * - 'cold'：SDK 启动后还没经历过 App onHide
   * - 'warm'：至少经历过一次 App onHide → onShow
   *
   * 翻转时机：
   *   - App onHide：立刻翻成 'warm'
   *   - 冷启动事件成功发送：翻成 'warm'
   */
  public bootType: RebootMode = 'cold';

  /**
   * 上一次 Page onHide / onUnload 的页面路径。
   *
   * 用途：
   *   - 冷启动判定：referrerPath 为空 + bootType=cold 才可能是冷启动
   *   - 普通跳转判定：referrerPath 非空 + 非冷热启动 → 普通跳转
   *
   * 适配低版本基础库（< 2.23.1）和 Taro 等框架 referrerPageId 缺失的情况。
   */
  public referrerPath = '';

  // ===========================================================================
  // 子模块
  // ===========================================================================

  private observer: ObserverCollector;
  private coldStart: ColdStartTracker;
  private warmStart: WarmStartTracker;
  private pageLoad: PageLoadTracker;

  /** 实际发出 apm_app_launch 事件的回调，由插件层注入 */
  private buildMonitorEvent: (attributes: any, extra: any) => void;

  // ===========================================================================
  // 初始化
  // ===========================================================================

  constructor(public growingIO: GrowingIOType) {
    this.minipInst = this.growingIO.minipInstance.minip;

    // Tracker / Observer 通过反向引用访问共享状态
    this.observer = new ObserverCollector(this);
    this.coldStart = new ColdStartTracker(this);
    this.warmStart = new WarmStartTracker(this);
    this.pageLoad = new PageLoadTracker(this);

    // 注入实际发送函数：发送时延迟读 plugins.gioPerformance，避免循环依赖
    this.buildMonitorEvent = (attributes: any, extra: any) =>
      this.growingIO.plugins.gioPerformance?.buildPerfEvent(
        'apm_app_launch',
        attributes,
        extra
      );

    // observer 在能力探测内部判断是否真的订阅，外部直接 init 即可
    this.observer.init();
    this.initLifecycleListener();
  }

  /**
   * 注册 SDK 生命周期监听。
   *
   * constructor 只做依赖初始化和监听注册，状态变更放到具体处理器中，
   * 让入口函数职责尽量单一。
   */
  private initLifecycleListener = () => {
    this.growingIO.emitter.on(
      EMIT_MSG.MINIP_LIFECYCLE,
      this.handleLifecycleEvent
    );
  };

  // ===========================================================================
  // 生命周期事件路由
  // ===========================================================================

  /**
   * 生命周期事件统一入口。
   *
   * SDK emitter 传入的 event 是字符串形式：
   *   - "App onShowEnd"
   *   - "Page onReadyEnd"
   *
   * 这里只负责拆分事件类型并分发，不改写业务状态。
   */
  private handleLifecycleEvent = ({ event, timestamp, params }: any) => {
    const [actionType, lifeCycleName] = event.split(' ');
    if (actionType === 'App') {
      this.handleAppLifecycle(lifeCycleName, timestamp, params);
      return;
    }
    if (actionType === 'Page') {
      this.handlePageLifecycle(lifeCycleName, timestamp, params);
    }
  };

  /**
   * 处理 App 维度生命周期。
   *
   * 这一层只做：
   *   - 把生命周期时间戳写入全局 appPerf
   *   - 把 onHide / onShow / onShowEnd 派发给 WarmStartTracker
   *
   * 冷启动判定不在这里做：冷启动是“Page onShowEnd 时回看 referrer + bootType”
   * 才能确定的状态，App 阶段还判断不了。
   */
  private handleAppLifecycle = (
    lifeCycleName: string,
    timestamp: number,
    params?: any
  ) => {
    this.appPerf = {
      ...this.appPerf,
      [lifeCycleName]: timestamp
    };

    if (lifeCycleName === 'onHide') {
      this.warmStart.handleAppHide();
      return;
    }
    if (lifeCycleName === 'onShow') {
      this.warmStart.handleAppShow(timestamp, params);
      return;
    }
    if (lifeCycleName === 'onShowEnd') {
      this.warmStart.handleAppShowEnd(timestamp, params);
    }
  };

  /**
   * 处理 Page 维度生命周期。
   *
   * 这个方法刻意按“页面访问状态机”的顺序排列：
   *   1. 必要时开启同 path 的新访问周期（reset 旧缓存）
   *   2. 记录当前生命周期时间戳
   *   3. 在页面上下文可信时缓存 path/query/title
   *   4. onShowEnd 时固化冷 / 热启动身份
   *   5. 到达发送生命周期后尝试发送
   *   6. 最后再更新 referrer，供下一个页面判定
   */
  private handlePageLifecycle = (
    lifeCycleName: string,
    timestamp: number,
    params: any
  ) => {
    const path = this.getLifecyclePath(params);
    if (!path) {
      return;
    }

    if (this.shouldResetForNewVisit(path, lifeCycleName)) {
      this.resetPagePerf(path);
    }

    this.recordPageLifecycle(path, lifeCycleName, timestamp);

    if (this.shouldCachePageContext(lifeCycleName)) {
      this.cachePageContext(path);
    }

    // onShowEnd 同时固化冷启动和热启动身份。
    // 冷启动只是写标记，仍要等 onReadyEnd 才真正发送；
    // 热启动“回到原页面”形态会在这一步直接放行 onShowEnd 触发的 tryHandleEvent。
    if (lifeCycleName === 'onShowEnd') {
      this.coldStart.markIfNeeded(path);
      this.warmStart.markIfMatched(path);
    }

    // SEND_CHECK_LIFECYCLES = ['onShowEnd', 'onReadyEnd']
    // tryHandleEvent 内还会继续检查 observer 是否已经处理完成。
    if (this.shouldCheckSendOnLifecycle(lifeCycleName)) {
      this.tryHandleEvent(path);
    }

    // referrerPath 必须在发送判定之后再更新，否则当前页会被误认为“上一页”
    if (this.shouldUpdateReferrer(lifeCycleName)) {
      this.referrerPath = path;
    }
  };

  // ===========================================================================
  // 页面状态机
  // ===========================================================================

  /**
   * 从生命周期参数中提取当前页面路径。
   *
   * 正常情况下 Page 生命周期会把 route 放在 params.page 或 params.instance 上；
   * 部分框架 / 基础库组合可能缺这个字段，这时用 currentPath 兜底，
   * 比落到空字符串 pagePerf[''] 更安全（也能避免多个未知页面混到同一个空桶）。
   */
  private getLifecyclePath = (params: any): string => {
    const page = params?.page || params?.instance;
    const routePath = normalizePath(page?.route);
    if (routePath) {
      return routePath;
    }
    return normalizePath(this.getCurrentPath());
  };

  /**
   * 判断同一路径是否已经开始了一轮新的页面访问。
   *
   * 仅按 `eventSent` 判断不够：
   * 上一轮访问即使因为 observer 延迟而没发出事件，也可能已经执行过 onReady / onHide；
   * 如果再次进入同一路径却不重置，就会把上一轮的生命周期时间戳带到新一轮访问里。
   */
  private shouldResetForNewVisit = (path: string, lifeCycleName: string) => {
    const pagePerf = this.pagePerf[path];
    if (!pagePerf) {
      return false;
    }

    if (lifeCycleName === 'onLoad') {
      // 同一路径重新创建页面实例时，一定要清理上一轮残留状态。
      // 但**不能**仅因为 observerProcessed 就重置：
      // 快速切页或平台回调顺序变化时，observer 可能先于 Page onLoad 写入当前页指标，
      // 这类 observer-only 缓存属于本轮访问，不能在 onLoad 到来时清掉。
      return Boolean(
        pagePerf.onLoad ||
          pagePerf.onShow ||
          pagePerf.onReady ||
          pagePerf.onHide ||
          pagePerf.onUnload ||
          pagePerf.eventSent
      );
    }

    if (lifeCycleName === 'onShow') {
      // navigateBack / tab 切回同一路径时通常不会重新 onLoad，
      // 但只要上一轮已经 hide / unload，说明这是一次新的可见周期。
      return Boolean(
        pagePerf.onHide || pagePerf.onUnload || pagePerf.eventSent
      );
    }

    return false;
  };

  /**
   * 开始同一路径的一次新页面访问。
   *
   * observer 可能延迟回调（尤其支付宝），因此 path 维度的缓存不能在发送后彻底删掉；
   * 但同一路径再次进入时，又必须清掉上一次访问的 eventSent / 启动标记，
   * 否则会把前一次访问的状态带到下一次页面展示中。
   */
  private resetPagePerf = (path: string) => {
    this.observer.clearObserverWaitTimer(path);
    // 只重建当前 path 这一页的缓存，不动其他页面。
    // observer 是按 path 分桶的，别的页面可能还在等第二次回调或超时兜底。
    this.pagePerf[path] = {
      path
    };
  };

  /**
   * 记录当前页面生命周期时间。
   *
   * 页面生命周期与 observer 都使用归一化 path 作为同一把 key，
   * 避免支付宝 pageURL、微信 route、框架 route 格式不完全一致时串桶。
   */
  private recordPageLifecycle = (
    path: string,
    lifeCycleName: string,
    timestamp: number
  ) => {
    this.ensurePagePerf(path);
    this.pagePerf[path] = {
      ...this.pagePerf[path],
      [lifeCycleName]: timestamp
    };
  };

  /**
   * 缓存页面自身上下文，避免 observer 延迟补发时被“当前页”污染。
   *
   * 支付宝真机下性能事件可能在页面切走后才满足发送条件；
   * 这时如果继续从 currentPage 取 path / query / title，会把事件挂到新页面上。
   */
  private cachePageContext = (path: string) => {
    const { currentPage } = this.growingIO.dataStore.eventHooks;
    const currentPath = currentPage.getPagePath();
    this.ensurePagePerf(path);
    this.pagePerf[path] = {
      ...this.pagePerf[path],
      pagePath: path,
      // 只有 currentPage 仍然指向当前 path 时，query / title 才可信。
      // 已经切到别的页面时宁可保留空字符串，也不要写入别的页面信息。
      pageQuery: currentPath === path ? currentPage.getPageQuery() : '',
      pageTitle: currentPath === path ? currentPage.getPageTitle() : ''
    };
  };

  /**
   * 确保当前 path 对应的 PagePerf 节点存在。
   *
   * 统一懒初始化入口，避免各方法里重复写空对象判断。
   */
  public ensurePagePerf = (path: string) => {
    if (!this.pagePerf[path]) {
      this.pagePerf[path] = { path };
    }
  };

  // ===========================================================================
  // 发送管道
  // ===========================================================================

  /**
   * 尝试发送当前页面的性能事件。
   *
   * 仅做“是否满足发送条件”的判定，真正的 payload 构建在 handleEvent 里。
   *
   * 放行规则：
   *   1. 路径有效
   *   2. 生命周期门槛已就绪（hasReadyPagePerf）
   *   3. observer 链路就绪 OR 当前是热启动访问
   *      （热启动不强等 observer：回到原页面时通常不会再触发 observer 回调）
   */
  public tryHandleEvent = (path: string): boolean => {
    if (
      !path ||
      !this.hasReadyPagePerf(path) ||
      (!this.warmStart.isVisit(this.pagePerf[path]) &&
        !this.observer.hasProcessedObserverEntries(path))
    ) {
      return false;
    }
    return this.handleEvent(path);
  };

  /**
   * 发送最终性能事件。
   *
   * 步骤：
   *   1. eventSent 防重发
   *   2. 组装属性（buildPerfData）
   *   3. 清洗非法值（cleanPerfData）
   *   4. 没有 page_launch_duration 则放弃，避免发空事件
   *   5. 实际通过插件层发送
   *   6. 标记 eventSent，并清掉 observer 等待计时器
   */
  private handleEvent = (path: string): boolean => {
    if (this.pagePerf[path]?.eventSent) {
      return false;
    }

    const pagePerf = this.pagePerf[path] || ({} as PagePerf);
    const perfData = this.buildPerfData(path);
    this.cleanPerfData(perfData);

    if (!has(perfData, 'page_launch_duration')) {
      return false;
    }

    this.emitPerfEvent(path, pagePerf, perfData);
    this.observer.clearObserverWaitTimer(path);
    this.pagePerf[path].eventSent = true;
    return true;
  };

  /**
   * 根据已经缓存的生命周期与 observer 数据，组装性能属性。
   *
   * 计算三类时长：
   *   1. first_contentful_paint_duration（FCP，由 observer 提供）
   *   2. largest_contentful_paint_duration（LCP，由 observer 提供）
   *   3. page_launch_duration / reboot_duration / reboot_mode（启动 / 跳转时长）
   *
   * ┌──────────────────────────────────────────────────────────────────────┐
   * │ 启动类型判定（**互斥**，自上而下命中即返回）                         │
   * ├──────────────────────────────────────────────────────────────────────┤
   * │                                                                      │
   * │  warmStart.isVisit(pagePerf)?                                        │
   * │     ├── yes → 热启动                                                  │
   * │     │       reboot_mode='warm'                                        │
   * │     │       page_launch_duration / reboot_duration                    │
   * │     │           = pageEnd - warmAppShowEnd                            │
   * │     │             pageEnd = onReadyEnd（落到新页面）                  │
   * │     │                     | onShowEnd（回到原页面）                   │
   * │     │                                                                 │
   * │     └── no                                                            │
   * │           coldStart.isVisit(pagePerf)?                               │
   * │              ├── yes → 冷启动                                         │
   * │              │       reboot_mode='cold'                               │
   * │              │       page_launch_duration                             │
   * │              │           = onReadyEnd - App.onLaunch                  │
   * │              │       reboot_duration                                  │
   * │              │           = onReadyEnd - App.appStartTime              │
   * │              │       （副作用：bootType 翻成 'warm'）                 │
   * │              │                                                       │
   * │              └── no                                                  │
   * │                    referrerPath ≠ ''?                                │
   * │                       ├── yes → 普通跳转                              │
   * │                       │       reboot_mode 不写                        │
   * │                       │       page_launch_duration                    │
   * │                       │           = onReadyEnd - route.navigationStart│
   * │                       │             （缺失时回退 onLoad）             │
   * │                       │                                              │
   * │                       └── no  → 不写启动时长                          │
   * │                              perfData 只剩 title + paint              │
   * │                              handleEvent 检测无 page_launch_duration │
   * │                              直接放弃发送                            │
   * └──────────────────────────────────────────────────────────────────────┘
   *
   * 为什么先问 warm：
   *   冷启动事件未发出前 App 进过后台再回来，pagePerf 里可能同时存在
   *   isColdStart=true（cold 阶段写入）和 isWarmStart=true（warm 阶段重写）。
   *   按用户体验，这次访问是"热启动到原页面"更准确，所以 warm 优先。
   *
   * 冷热判定优先读 PagePerf 上**固化**的标记（isColdStart / isWarmStart），
   * 因为 observer 可能延迟回调，发送时的全局 referrerPath / bootType
   * 已经不一定属于当前页面。各 Tracker 的 isVisit 内部也会优先读 PagePerf。
   */
  private buildPerfData = (path: string): PERF_MONITOR_VLUES => {
    const pagePerf = this.pagePerf[path] || ({} as PagePerf);
    const perfData: PERF_MONITOR_VLUES = {
      title: pagePerf.pageTitle || ''
    };
    // 页面开始时间统一取 onLoad，对齐“页面真正开始构建”的时刻
    const pageStart = pagePerf.onLoad;

    this.appendPaintMetrics(perfData, pagePerf, pageStart);

    if (this.warmStart.isVisit(pagePerf)) {
      this.warmStart.appendMetrics(perfData, pagePerf);
    } else if (this.coldStart.isVisit(pagePerf)) {
      this.coldStart.appendMetrics(perfData, pagePerf, pageStart);
    } else if (this.referrerPath) {
      this.pageLoad.appendMetrics(perfData, pagePerf, pageStart);
    }

    return perfData;
  };

  /**
   * 写入 FCP / LCP 指标。
   *
   * observer 存的是原始 startTime，事件里需要转成相对页面 onLoad 的耗时。
   * 使用 getSafeDuration 可以避免平台时间轴不同步时产生负值。
   */
  private appendPaintMetrics = (
    perfData: PERF_MONITOR_VLUES,
    pagePerf: PagePerf,
    pageStart?: number
  ) => {
    if (typeof pagePerf.FCPStartTime === 'number') {
      perfData.first_contentful_paint_duration = getSafeDuration(
        pagePerf.FCPStartTime,
        pageStart
      );
    }
    if (typeof pagePerf.LCPStartTime === 'number') {
      perfData.largest_contentful_paint_duration = getSafeDuration(
        pagePerf.LCPStartTime,
        pageStart
      );
    }
  };

  /**
   * 清理非法属性。
   *
   * 只清理 null / NaN 这类明显无效值，**不删除 0**：
   * 0 是 getSafeDuration 对异常负值的合法兜底结果。
   */
  private cleanPerfData = (perfData: PERF_MONITOR_VLUES) => {
    forEach(perfData, (v: any, k: string) => {
      if (this.isInvalidPerfValue(v)) {
        unset(perfData, k);
      }
    });
    if (perfData.reboot_mode && !has(perfData, 'reboot_duration')) {
      unset(perfData, 'reboot_mode');
    }
  };

  /**
   * 判断性能属性值是否应该被移除。
   *
   * 这里不能用 falsy 判断，因为 0 是合法值；
   * 当平台时间轴异常导致负值时，getSafeDuration 会用 0 作为兜底。
   */
  private isInvalidPerfValue = (value: any): boolean =>
    value === null ||
    value === 'null' ||
    value === 'NaN' ||
    // 只把真正的 number NaN 视为非法，避免误删其它可转成 NaN 的字符串。
    (typeof value === 'number' && isNaN(value));

  /**
   * 实际触发 apm_app_launch 事件。
   *
   * 上下文只使用 PagePerf 中缓存的页面信息，不再读取 currentPage，
   * 避免 observer 延迟回调时把事件挂到当前可见页。
   */
  private emitPerfEvent = (
    path: string,
    pagePerf: PagePerf,
    perfData: PERF_MONITOR_VLUES
  ) => {
    this.buildMonitorEvent(perfData, {
      timestamp: +Date.now(),
      path: pagePerf.pagePath || path,
      query: pagePerf.pageQuery || '',
      title: perfData.title
    });
  };

  // ===========================================================================
  // 跨模块小工具（observer / pageLoad 复用）
  // ===========================================================================

  /**
   * 当前 minipInstance 报告的 currentPath。
   *
   * 包一层只是给 observer 子模块一个稳定入口，避免它直接依赖 minipInstance。
   */
  public getCurrentPath = (): string =>
    this.growingIO.minipInstance.getCurrentPath();

  /**
   * 页面生命周期是否已经走到可用于发送性能事件的阶段。
   *
   * 总门槛：
   *   - 普通页面加载、页面冷启动：必须有 onReadyEnd
   *   - 热启动落到新页面：必须有 onReadyEnd
   *   - 热启动回到原页面：允许只有 onShowEnd
   *
   * observer 链路仍由 ObserverCollector.hasProcessedObserverEntries 单独判断。
   */
  public hasReadyPagePerf = (path: string): boolean => {
    const pagePerf = this.pagePerf[path];
    if (!pagePerf) {
      return false;
    }
    if (pagePerf.isWarmStart) {
      return this.warmStart.canSend(path);
    }
    return Boolean(pagePerf.onReadyEnd);
  };

  /**
   * 获取某个页面达到“允许发送”生命周期门槛的时间点。
   *
   * - 普通页面 / 冷启动看 onReadyEnd
   * - 热启动看 WarmStartTracker.getReadyTimestamp（onReadyEnd 或 onShowEnd）
   *
   * observer 子模块用这个时间点决定 pathless entry 优先归到哪个页面。
   */
  public getPageReadyTimestamp = (path: string): number | undefined => {
    const pagePerf = this.pagePerf[path];
    if (!pagePerf) {
      return undefined;
    }
    if (this.warmStart.canSend(path)) {
      return this.warmStart.getReadyTimestamp(pagePerf);
    }
    return pagePerf.onReadyEnd;
  };

  // ===========================================================================
  // 生命周期阶段判定（小工具）
  // ===========================================================================

  /** 当前生命周期是否适合缓存页面上下文。 */
  private shouldCachePageContext = (lifeCycleName: string) =>
    CONTEXT_CACHE_LIFECYCLES.includes(lifeCycleName);

  /** 当前生命周期是否需要尝试发送性能事件。 */
  private shouldCheckSendOnLifecycle = (lifeCycleName: string) =>
    SEND_CHECK_LIFECYCLES.includes(lifeCycleName);

  /** 当前生命周期是否应该更新 referrerPath。 */
  private shouldUpdateReferrer = (lifeCycleName: string) =>
    REFERRER_LIFECYCLES.includes(lifeCycleName);
}
