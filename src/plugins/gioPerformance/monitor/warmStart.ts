import { PERF_MONITOR_VLUES } from '@@/types/gioPerformance';
import { forEach } from '@@/utils/glodash';
import { getSafeDuration, normalizePath } from '@@/utils/tools';

import type Monitor from '../monitor';
import { PagePerf } from './types';

/**
 * lastWarm 标记从 App 回前台开始最长保留多久。
 *
 * 用于兜底：当 landing 的 Page onShowEnd 因为页面被销毁、用户提前切走等原因
 * 永远不到达时，避免 lastWarm 一直挂着，把后续无关页面的 onShowEnd 误标成热启动。
 *
 * 正常的"App 回前台 → 落地页 ready"路径通常小于 1 秒，5 秒留足慢机型余量。
 * App onHide 仍然是主要清理触发点，这条 timer 只在极端时序下生效。
 */
const STALE_WARM_MARKER_TIMEOUT = 5000;

/**
 * 热启动（warm reboot）追踪器。
 *
 * ============================================================================
 * 热启动定义
 * ============================================================================
 *
 * App 已经至少经历过一次 onHide，本次 App 从后台回到前台的访问。
 * 即 App 维度的"二次进入前台"：
 *
 *   onLaunch → onShow → ... → onHide → onShow ★从这里开始算热启动
 *
 * App.onHide 之后，bootType 立即翻成 'warm'，warm 候选窗口在下一次 App.onShow 打开。
 *
 * ============================================================================
 * 落地页两种形态（热启动逻辑里最容易出错的地方）
 * ============================================================================
 *
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │ 形态 A：回到原页面（页面实例未销毁）                                │
 *   ├─────────────────────────────────────────────────────────────────────┤
 *   │ 触发场景：用户切到桌面再切回小程序，页面还在内存里                  │
 *   │ 生命周期：Page.onShow（不会再 onLoad/onReady）→ Page.onShowEnd     │
 *   │ 检测信号：本轮 App.onShow 之后**没有**新的 Page.onLoad             │
 *   │           （warmWaitReadyEnd = false）                              │
 *   │ 时长终点：Page.onShowEnd                                            │
 *   │ duration = Page.onShowEnd - App.onShowEnd                           │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │ 形态 B：落到新页面（页面被销毁后重建 / 落地到不同的页面）           │
 *   ├─────────────────────────────────────────────────────────────────────┤
 *   │ 触发场景：① 通过分享卡片进入应用，落地到分享页                      │
 *   │           ② 通过桌面图标 / 浮窗进入，落地到入口页                   │
 *   │           ③ 系统因内存压力销毁原页面，回前台时重建                  │
 *   │ 生命周期：Page.onLoad → onShow → onShowEnd → onReady → onReadyEnd  │
 *   │ 检测信号：本轮 App.onShow 之后**有**新的 Page.onLoad                │
 *   │           （warmWaitReadyEnd = true）                               │
 *   │ 时长终点：Page.onReadyEnd                                           │
 *   │ duration = Page.onReadyEnd - App.onShowEnd                          │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * 形态判别字段：`warmWaitReadyEnd`
 *   在 markIfMatched 时根据 hasNewLoadAfterWarmStart(path) 计算并固化到 PagePerf。
 *   一旦写入，发送阶段直接按它选 pageEnd，不再受后续 observer 回调或 currentPage
 *   状态影响（防止 observer 延迟回调时拿错数据）。
 *
 * ============================================================================
 * "双向触发"发送模型
 * ============================================================================
 *
 * 不同框架（taro / mpx / native）里 `App.onShowEnd` 与 `Page.onShowEnd` 的
 * 先后顺序不稳定，因此采用三步双向触发：
 *
 *   ① App.onShow（warm cycle 开始）
 *      → 打开本轮 warm 候选窗口（lastWarm=true，登记 landing path）
 *      → 注册 setTimeout(0) 的 App.onShowEnd 兜底（针对只广播 onShow 的适配器）
 *      → 注册 5s 的过期清理 timer（避免 lastWarm 长期残留）
 *
 *   ② Page.onShowEnd 命中 landing path
 *      → 把 warm 资格固化到 PagePerf（isWarmStart + warmWaitReadyEnd）
 *      → App.onShowEnd 已先到 → warmAppShowEnd 直接固化，立刻可发送
 *      → App.onShowEnd 还没到 → warmAppShowEnd=undefined，等待补齐
 *
 *   ③ App.onShowEnd
 *      → 找 pending 落地页（PagePerf 里 isWarmStart=true 且还缺 warmAppShowEnd）
 *      → 补齐 warmAppShowEnd，立刻尝试发送
 *      → 没有 pending 但当前页已经走过 onShowEnd → 当作 landing 立刻固化
 *
 * 不论 ② 和 ③ 谁先到，"条件齐"那一刻就由它触发发送。Monitor 的 eventSent 防重发。
 *
 * ============================================================================
 * 互斥与优先级
 * ============================================================================
 *
 *   - 与 coldStart.isVisit 互斥：lastWarm=true 必然在 App.onHide 之后，
 *     此时 bootType='warm'，coldStart.isVisit 兜底分支不命中
 *   - 与 pageLoad（普通跳转）互斥：buildPerfData 先问 warm，命中即返回
 *
 * ============================================================================
 * 平台差异说明
 * ============================================================================
 *
 *   - 微信、支付宝在 App 生命周期顺序上一致，warm 判定逻辑无平台分支
 *   - 平台差异主要在 observer 链路（见 observer.ts），warm 不强等 observer
 *     就能发送（isVisit 旁路），不受支付宝多轮 observer 延迟影响
 *
 * ============================================================================
 * 已知边界场景（已修复）
 * ============================================================================
 *
 *   ⚠ Page.onShowEnd 早于 App.onShowEnd（mpx 部分版本、Taro3 hook 链路）
 *     → 主公式产生负值，appendMetrics 用 App.onShow 兜底
 *   ⚠ 旧页面被框架补发"幽灵 onShowEnd"
 *     → markIfMatched 跳过 eventSent=true 的 PagePerf
 *   ⚠ landing 永远不到 → lastWarm 残留
 *     → 5 秒 staleMarkerTimer 兜底清理
 *   ⚠ 跨 cycle 的旧 pending 页污染本轮
 *     → getPendingPath/hasPendingWarmStart 按 onShowEnd >= warmStartBegin 过滤
 */
export class WarmStartTracker {
  /**
   * “本轮 App 已经回前台、但还没确认落地页”的一次性标记。
   *
   * - App onShow（warm 判定通过）置 true
   * - markIfMatched 命中后置 false（避免后续无关页面被误标）
   * - App onHide 重置为 false
   */
  private lastWarm = false;

  /**
   * 本轮 App 回前台声明的落地页（来自 App onShow / onShowEnd 的 path 参数）。
   *
   * 当平台明确告知本次应该落到哪个 path 时，只有该 path 能消费 warm 标记，
   * 用于过滤掉旧页面被框架补发的“补偿性 Page onShowEnd”。
   *
   * 平台不传 path 时会留空，此时不做 path 过滤（兜底兼容）。
   */
  private warmLandingPath = '';

  /**
   * 给“只广播 App onShow，不广播 App onShowEnd”的链路用的兜底定时器。
   */
  private appShowEndFallbackTimer: any = null;

  /**
   * 本轮 App 回前台触发后，lastWarm / warmLandingPath 的过期兜底定时器。
   *
   * 在 5 秒内仍未命中 landing（比如 Page onShowEnd 永远不到、用户提前切走）时
   * 主动清掉 warm 候选窗口，避免标记残留污染后续普通跳转。
   */
  private staleMarkerTimer: any = null;

  /**
   * 由 fallback timer 合成的 App onShowEnd 时间戳。
   *
   * 仅在以下场景写入：scheduleAppShowEndFallback 触发后，真实 App onShowEnd 始终未到达。
   * 写入到 WarmStartTracker 私有状态而不是 monitor.appPerf.onShowEnd，
   * 避免污染全局 appPerf —— 其他子模块读 appPerf 时仍然看到的是真实值（缺失 / 上一轮）。
   *
   * 仅用作 getCurrentAppShowEnd 的内部回退；在 App onHide 时清掉。
   */
  private syntheticAppShowEnd: number | undefined = undefined;

  constructor(private monitor: Monitor) {}

  // ===========================================================================
  // App 生命周期入口
  // ===========================================================================

  /**
   * 处理 App onHide。
   *
   * 这里把所有 warm 相关状态全部清掉，并把 Monitor.bootType 翻成 'warm'，
   * 表示后续 App onShow 都属于热启动候选。
   *
   * 注意：bootType 翻转**不能**等冷启动事件成功发送之后再做，
   * 否则冷启动还在等 observer 时进入后台，再回来会被识别为冷启动而漏掉热启动。
   */
  handleAppHide = () => {
    this.lastWarm = false;
    this.warmLandingPath = '';
    this.syntheticAppShowEnd = undefined;
    this.clearAppShowEndFallback();
    this.clearStaleMarkerCleanup();
    this.monitor.bootType = 'warm';
  };

  /**
   * 处理 App onShow。
   *
   * 仅在 isAppWarmForeground 通过时（即已有过 onHide）才打开 warm 候选窗口；
   * 首次冷启动也会触发 App onShow，但这里会被过滤掉。
   *
   * @param timestamp - App onShow 触发时间
   * @param params    - 平台传入的 onShow 参数（可能含 path/query）
   */
  handleAppShow = (timestamp: number, params: any) => {
    if (!this.isAppWarmForeground(timestamp)) {
      return;
    }
    this.cacheLandingPath(params);
    this.lastWarm = true;
    this.scheduleAppShowEndFallback();
    this.scheduleStaleMarkerCleanup();
  };

  /**
   * 处理 App onShowEnd。
   *
   * 这是热启动起点固化的最关键时刻：
   *   - 清掉 onShowEnd 兜底定时器（真实事件已到）
   *   - 再尝试登记一次 landing path（onShowEnd 的 params 也可能带 path）
   *   - 如果当前没有任何 pending warm 页，说明本轮还没走到 Page onShowEnd
   *     → 兜底把 lastWarm 置 true，让后续 Page onShowEnd 能消费
   *     → 同时挂上 stale marker timer，避免 lastWarm 永远残留
   *   - 不论是否有 pending，都调用 completeAfterAppShowEnd 尝试推进发送
   */
  handleAppShowEnd = (timestamp: number, params: any) => {
    if (!this.isAppWarmForeground(timestamp)) {
      return;
    }
    this.clearAppShowEndFallback();
    this.cacheLandingPath(params);

    // 兜底兼容“没有 App onShow start 广播的链路”
    if (!this.hasPendingWarmStart()) {
      this.lastWarm = true;
      this.scheduleStaleMarkerCleanup();
    }
    this.completeAfterAppShowEnd();
  };

  // ===========================================================================
  // Page 生命周期入口
  // ===========================================================================

  /**
   * 在 Page onShowEnd 时尝试把当前页固化为本轮 warm landing。
   *
   * 进入条件：
   *   1. lastWarm 为 true（本轮 App 还在等待 landing 出现）
   *   2. 若 warmLandingPath 已知，path 必须和它一致
   *   3. 当前页 PagePerf 没有被标记为 eventSent
   *      —— 跳过已经发过事件的旧页面，避免分享/桌面入口热启动时
   *      框架对旧页面补发的"幽灵 Page onShowEnd"偷走 warm 标记。
   *      正常的"回到原页面"场景下，Page onShow 已经把 PagePerf 重置过，
   *      eventSent 此刻为 false，不会被这条守卫拦截。
   *
   * 命中后会：
   *   - 把 warm 资格写入 PagePerf（isWarmStart / warmAppShowEnd / warmWaitReadyEnd）
   *   - 立刻消费 warm 标记，避免后续无关页面被误标
   *
   * @param explicitAppShowEnd - 由 fallback 路径传入的合成 App onShowEnd；
   *                             正常路径不传，由 getCurrentAppShowEnd 自己解析。
   * @returns 是否成功固化
   */
  markIfMatched = (path: string, explicitAppShowEnd?: number): boolean => {
    if (!this.lastWarm) {
      return false;
    }
    if (this.warmLandingPath && this.warmLandingPath !== path) {
      return false;
    }
    // 已经发过事件的旧 PagePerf 不能消费 warm 标记，否则真正的落地页会
    // 因为 lastWarm 被提前清掉而退化成普通跳转事件。
    if (this.monitor.pagePerf[path]?.eventSent) {
      return false;
    }

    // 直接把热启动资格和 App onShowEnd 一起绑定到当前 path：
    // 后续 observer 即使迟到，也不会再依赖易变的全局 appPerf。
    this.monitor.pagePerf[path] = {
      ...this.monitor.pagePerf[path],
      isWarmStart: true,
      // 当前 App onShowEnd 还没到时，这里写入的是 undefined；后续 App onShowEnd 会补齐
      warmAppShowEnd: explicitAppShowEnd ?? this.getCurrentAppShowEnd(),
      // 不能只看 onLoad 是否存在：同页回前台时旧 onLoad/onReady 仍在缓存里
      // 只有本次 App onShow 之后的新 onLoad，才说明热启动落到了新页面
      warmWaitReadyEnd: this.hasNewLoadAfterWarmStart(path)
    };
    this.consumeMarker();
    return true;
  };

  // ===========================================================================
  // 发送阶段查询
  // ===========================================================================

  /**
   * 判断 PagePerf 是否代表一次有效的热启动访问。
   *
   * 只认页面级缓存，不再回头读 lastWarm（lastWarm 是一次性 App 状态，
   * 可能早已被后续页面消费）。同时要求 warmAppShowEnd 已绑定，否则时长无法计算。
   */
  isVisit = (pagePerf: PagePerf): boolean =>
    Boolean(pagePerf.isWarmStart && this.hasAppShowEnd(pagePerf));

  /**
   * 当前页面是否允许发送热启动事件（生命周期门槛已就绪）。
   *
   * 规则：
   *   1. 落到新页面（warmWaitReadyEnd=true）：必须等 onReadyEnd
   *   2. 回到原页面（warmWaitReadyEnd=false）：用 onShowEnd
   *
   * 同时要求 warmAppShowEnd 已绑定，否则时长无法计算。
   */
  canSend = (path: string): boolean => {
    const pagePerf = this.monitor.pagePerf[path];
    if (!pagePerf) {
      return false;
    }
    if (!pagePerf.isWarmStart || !this.hasAppShowEnd(pagePerf)) {
      return false;
    }
    return pagePerf.warmWaitReadyEnd
      ? Boolean(pagePerf.onReadyEnd)
      : Boolean(pagePerf.onShowEnd);
  };

  /**
   * 获取热启动访问的 ready 时刻（用于 observer pathless 路由）。
   *
   * 落到新页面看 onReadyEnd；回到原页面看 onShowEnd。
   */
  getReadyTimestamp = (pagePerf: PagePerf): number | undefined =>
    pagePerf.warmWaitReadyEnd ? pagePerf.onReadyEnd : pagePerf.onShowEnd;

  // ===========================================================================
  // 时长写入
  // ===========================================================================

  /**
   * 把热启动相关时长写入事件属性。
   *
   * 形态 A（回到原页面）：duration = Page onShowEnd - App onShowEnd
   * 形态 B（落到新页面）：duration = Page onReadyEnd - App onShowEnd
   *
   * 两个字段（page_launch_duration / reboot_duration）值相同：
   * 热启动里它们都表达“App 回前台到落地页就绪”的时长。
   *
   * 时序异常兜底：
   *   有些框架（mpx 部分版本、Taro3 hook 链路等）会先广播 Page onShowEnd
   *   再广播 App onShowEnd，使得 pageEnd < appShowEnd。这时主公式计算出来
   *   是负数，getSafeDuration 会兜底成 0，导致脏数据。我们额外把当轮 App onShow
   *   作为最后一档起点：onShow → page ready 仍然能反映“App 回到前台到落地页就绪”的时长，
   *   语义上比 0 更接近真实情况，且不会污染正常时序的事件。
   */
  appendMetrics = (perfData: PERF_MONITOR_VLUES, pagePerf: PagePerf) => {
    const pageEnd = this.getPageEnd(pagePerf);
    const appShowEnd = pagePerf.warmAppShowEnd;
    const appShow = this.getCurrentAppShow();

    perfData.page_launch_duration = getSafeDuration(
      pageEnd,
      appShowEnd,
      appShow
    );
    perfData.reboot_duration = getSafeDuration(pageEnd, appShowEnd, appShow);
    perfData.reboot_mode = 'warm';
  };

  /**
   * 获取当前热启动访问的页面终点时刻。
   *
   * 形态 A 用 onShowEnd，形态 B 用 onReadyEnd。
   */
  getPageEnd = (pagePerf: PagePerf): number | undefined =>
    pagePerf.warmWaitReadyEnd ? pagePerf.onReadyEnd : pagePerf.onShowEnd;

  // ===========================================================================
  // App onShowEnd 兜底定时器
  // ===========================================================================

  /**
   * 为没有 App onShowEnd 的框架链路设置兜底。
   *
   * 正常 EventHooks 包装链路会在同步 task 内补发 App onShowEnd，
   * timer 在执行前就已经被 clearAppShowEndFallback 清掉。
   *
   * 但如果某个适配器只广播 App onShow，timer 会用本轮 App onShow 时间
   * 降级当作 onShowEnd，避免 warm 页面已经 onShowEnd 但一直缺 App onShowEnd
   * 导致永远不发送。
   *
   * 关键约束：合成值只写到 WarmStartTracker 的 syntheticAppShowEnd 私有字段，
   * **不**写回 monitor.appPerf.onShowEnd —— 避免污染全局 appPerf 让其他模块
   * 把合成值误读成真实事件时间。后续 getCurrentAppShowEnd 会优先用真实 onShowEnd，
   * 缺失时才回退到 syntheticAppShowEnd。
   */
  private scheduleAppShowEndFallback = () => {
    this.clearAppShowEndFallback();
    this.appShowEndFallbackTimer = setTimeout(() => {
      this.appShowEndFallbackTimer = null;

      // warm 状态早已结束 → 不需要兜底
      if (!this.lastWarm && !this.hasPendingWarmStart()) {
        return;
      }
      // 真实 App onShowEnd 已经到位 → 不需要兜底
      if (this.getCurrentAppShowEnd()) {
        return;
      }

      // 用本轮 App onShow 时间作为 onShowEnd 降级起点。
      // 不能用 timer 触发时的 Date.now：Page onShowEnd 已发生时会被倒挂成 0。
      const fallbackShowEnd = this.monitor.appPerf.onShow ?? Date.now();
      this.syntheticAppShowEnd = fallbackShowEnd;
      this.completeAfterAppShowEnd(fallbackShowEnd);
    }, 0);
  };

  /**
   * 清理 App onShowEnd 兜底定时器。
   *
   * 真实 App onShowEnd 到达 / App onHide / 重新 schedule 时调用。
   */
  private clearAppShowEndFallback = () => {
    if (this.appShowEndFallbackTimer) {
      clearTimeout(this.appShowEndFallbackTimer);
      this.appShowEndFallbackTimer = null;
    }
  };

  // ===========================================================================
  // 过期 marker 兜底定时器（Bug 4）
  // ===========================================================================

  /**
   * 给本轮 lastWarm / warmLandingPath 设置过期清理。
   *
   * 解决场景：landing 的 Page onShowEnd 由于页面被销毁、用户提前切走、
   * path 始终不匹配等原因永远不到达，markIfMatched 没机会消费 marker，
   * 导致 lastWarm 一直挂着，污染后续无关页面的 onShowEnd 判定。
   *
   * 5 秒内若 markIfMatched 命中并 consumeMarker，timer 会被立即清掉；
   * 否则 timer 触发时强制清空 marker 状态。
   */
  private scheduleStaleMarkerCleanup = () => {
    this.clearStaleMarkerCleanup();
    this.staleMarkerTimer = setTimeout(() => {
      this.staleMarkerTimer = null;
      this.lastWarm = false;
      this.warmLandingPath = '';
    }, STALE_WARM_MARKER_TIMEOUT);
  };

  /**
   * 清理过期 marker 定时器。
   *
   * App onHide / consumeMarker / 重新 schedule 时调用。
   */
  private clearStaleMarkerCleanup = () => {
    if (this.staleMarkerTimer) {
      clearTimeout(this.staleMarkerTimer);
      this.staleMarkerTimer = null;
    }
  };

  // ===========================================================================
  // App onShowEnd 到达后的补齐 / 推进
  // ===========================================================================

  /**
   * App onShowEnd 到达后补齐热启动起点。
   *
   * 两种典型时序：
   *
   *   1. Page onShowEnd 已经先到（pendingPath 不为空）
   *      → markIfMatched 在 PagePerf 上写入了 isWarmStart 但 warmAppShowEnd 为空
   *      → bindAppShowEnd 补齐起点，立刻发送
   *
   *   2. Page onShowEnd 还没到，但当前 currentPage 已经走过 onShowEnd
   *      → 直接对 currentPath 调一次 markIfMatched 立刻固化并发送
   *      （这个分支主要服务一些异常时序场景）
   *
   * @param explicitAppShowEnd - 由 fallback 路径传入的合成 App onShowEnd 值；
   *                             正常路径不传，bind / mark 会从 getCurrentAppShowEnd 解析。
   */
  private completeAfterAppShowEnd = (explicitAppShowEnd?: number) => {
    const pendingPath = this.getPendingPath();
    if (pendingPath) {
      this.bindAppShowEnd(pendingPath, explicitAppShowEnd);
      this.monitor.tryHandleEvent(pendingPath);
      return;
    }

    const currentPath = normalizePath(this.monitor.getCurrentPath());
    if (
      currentPath &&
      this.lastWarm &&
      this.hasPageShownAfterWarmStart(currentPath) &&
      this.markIfMatched(currentPath, explicitAppShowEnd)
    ) {
      this.monitor.tryHandleEvent(currentPath);
    }
  };

  /**
   * 找到本轮已命中 landing 但还缺 App onShowEnd 起点的页面。
   *
   * 理论上一轮 App 回前台只会有一个 landing；这里仍按 onShowEnd 最早的页面选择，
   * 避免异常情况下多个页面都带 pending 标记时发送错页。
   *
   * 跨 cycle 过滤：
   *   PagePerf 不会随 App onHide 重置（observer 仍可能晚到）。如果 cycle 1
   *   有页面被标记成 isWarmStart 但因为某些极端时序（fallback 被取消、用户极快
   *   切后台等）始终没绑定 warmAppShowEnd，这个旧页面会一直挂在 pagePerf 里。
   *   cycle 2 触发 completeAfterAppShowEnd 时若不过滤，会把旧页面当成 pending
   *   并用 cycle 2 的 appShowEnd 强行绑上去，造成一条跨 cycle 的脏事件。
   *   这里用 onShowEnd >= warmStartBegin 过滤掉所有旧 cycle 的残留。
   */
  private getPendingPath = (): string => {
    const warmStartBegin = this.getWarmStartBeginTimestamp();
    let pendingPath = '';
    let pendingTimestamp = Infinity;
    forEach(this.monitor.pagePerf, (pagePerf: PagePerf, path: string) => {
      if (
        !pagePerf?.isWarmStart ||
        this.hasAppShowEnd(pagePerf) ||
        typeof pagePerf.onShowEnd !== 'number'
      ) {
        return;
      }
      // 仅取本轮 cycle 的 pending 页，跨 cycle 残留直接跳过
      if (
        typeof warmStartBegin === 'number' &&
        pagePerf.onShowEnd < warmStartBegin
      ) {
        return;
      }
      if (pagePerf.onShowEnd < pendingTimestamp) {
        pendingTimestamp = pagePerf.onShowEnd;
        pendingPath = path;
      }
    });
    return pendingPath;
  };

  /**
   * 把 App onShowEnd 绑定到指定页面的 PagePerf。
   *
   * 发送阶段只读 PagePerf，避免后续再次 App onShow 覆盖全局 appPerf 时
   * 迟到的 observer 或生命周期回调拿错起点。
   *
   * @param explicitAppShowEnd - 由 fallback 路径传入的合成值；
   *                             正常路径不传，由 getCurrentAppShowEnd 自己解析。
   */
  private bindAppShowEnd = (path: string, explicitAppShowEnd?: number) => {
    this.monitor.ensurePagePerf(path);
    this.monitor.pagePerf[path] = {
      ...this.monitor.pagePerf[path],
      warmAppShowEnd: explicitAppShowEnd ?? this.getCurrentAppShowEnd()
    };
  };

  /**
   * 是否有“已固化为 warm 但 App onShowEnd 还没补齐”的页面。
   *
   * 同样按 onShowEnd >= warmStartBegin 过滤跨 cycle 残留，避免
   * 旧 cycle 的未绑定页让 handleAppShowEnd 误以为本轮已经有 pending、
   * 从而拒绝把 lastWarm 重新置 true。
   */
  private hasPendingWarmStart = (): boolean => {
    const warmStartBegin = this.getWarmStartBeginTimestamp();
    let hasPending = false;
    forEach(this.monitor.pagePerf, (pagePerf: PagePerf) => {
      if (!pagePerf?.isWarmStart || this.hasAppShowEnd(pagePerf)) {
        return;
      }
      if (
        typeof warmStartBegin === 'number' &&
        typeof pagePerf.onShowEnd === 'number' &&
        pagePerf.onShowEnd < warmStartBegin
      ) {
        return;
      }
      hasPending = true;
    });
    return hasPending;
  };

  /**
   * PagePerf 是否已经绑定可用于计算热启动的 App onShowEnd。
   */
  private hasAppShowEnd = (pagePerf: PagePerf): boolean =>
    typeof pagePerf?.warmAppShowEnd === 'number';

  // ===========================================================================
  // landing path 的登记 / 提取
  // ===========================================================================

  /**
   * 缓存本次 App 回前台声明的落地页。
   *
   * 分享 / 桌面入口的热启动里，旧页面可能先收到补偿性的 Page onShowEnd。
   * 如果 App onShow 参数已经告诉我们这次应该落到哪个 path，就只允许该 path 消费 warm 标记。
   *
   * 平台没传 path 时此处留空，等于不做 path 过滤；后续 markIfMatched 会接受任意 path。
   */
  private cacheLandingPath = (params: any) => {
    const path = this.getLandingPath(params);
    if (path) {
      this.warmLandingPath = path;
    }
  };

  /**
   * 从 App 生命周期参数中提取入口 path。
   *
   * - App onShow 的 start 事件：appEffects 直接把 args[0] 透传过来
   * - App onShowEnd：emitLifeEnd 把参数包在 arguments[0] 里
   */
  private getLandingPath = (params: any): string => {
    const appOptions = params?.arguments?.[0] || params;
    return normalizePath(appOptions?.path);
  };

  /**
   * 消费本次 App warm 标记。
   *
   * lastWarm 一旦被消费，后续无关页面就不会被误标。
   * warmLandingPath 也一并清空，避免污染后续普通跳转。
   * 同时清掉过期 marker 兜底定时器（已经命中正常路径，不再需要兜底）。
   */
  private consumeMarker = () => {
    if (this.lastWarm) {
      this.lastWarm = false;
    }
    this.warmLandingPath = '';
    this.clearStaleMarkerCleanup();
  };

  // ===========================================================================
  // 时间判定
  // ===========================================================================

  /**
   * 判断给定 timestamp 是否属于一次真正的热启动回前台。
   *
   * 首次冷启动也会触发 App onShow / onShowEnd，但那时没有之前的 onHide；
   * 只有发生过 onHide 之后的 timestamp 才被视为 App 维度 warm reboot。
   */
  private isAppWarmForeground = (timestamp: number) =>
    typeof this.monitor.appPerf.onHide === 'number' &&
    timestamp >= this.monitor.appPerf.onHide;

  /**
   * 获取“本次 App 回前台”的开始边界。
   *
   * 仅用于判断某个 Page onLoad / onShowEnd 是否属于本轮热启动；
   * 最终发送时长仍严格用 `Page onReadyEnd / onShowEnd - App onShowEnd`。
   *
   * 优先级：
   *   1. App onHide：覆盖 Page 生命周期早于 App onShow 的框架顺序
   *   2. App onShow：onHide 缺失时的兜底
   *   3. App onShowEnd：再退一档兜底
   */
  private getWarmStartBeginTimestamp = (): number | undefined =>
    this.monitor.appPerf.onHide ??
    this.monitor.appPerf.onShow ??
    this.monitor.appPerf.onShowEnd;

  /**
   * 获取“本轮 App 回前台”对应的 onShowEnd。
   *
   * 优先级：
   *   1. monitor.appPerf.onShowEnd —— 真实生命周期事件值，必须落在本轮回前台之后
   *   2. this.syntheticAppShowEnd —— scheduleAppShowEndFallback 合成的兜底值，
   *      仅在真实事件缺失（或属于上一轮）时使用
   *
   * 真实值优先确保正常时序下行为不变；syntheticAppShowEnd 仅作为内部兜底，
   * 不污染 monitor.appPerf —— 其他子模块读 appPerf.onShowEnd 仍然是真实值。
   */
  private getCurrentAppShowEnd = (): number | undefined => {
    const warmStartBegin = this.getWarmStartBeginTimestamp();
    const realShowEnd = this.monitor.appPerf.onShowEnd;
    if (
      typeof realShowEnd === 'number' &&
      (typeof warmStartBegin !== 'number' || realShowEnd >= warmStartBegin)
    ) {
      return realShowEnd;
    }

    // 真实值缺失或仍属于上一轮 → 回退到本轮 fallback timer 合成的值
    const synthetic = this.syntheticAppShowEnd;
    if (
      typeof synthetic === 'number' &&
      (typeof warmStartBegin !== 'number' || synthetic >= warmStartBegin)
    ) {
      return synthetic;
    }

    return undefined;
  };

  /**
   * 获取“本轮 App 回前台”对应的 onShow。
   *
   * 仅在 appendMetrics 兜底场景使用：当 Page onShowEnd 早于 App onShowEnd 时，
   * onShowEnd 不能用作起点，需要回退到本轮 App onShow。
   *
   * 这里只用 onHide 作为边界 —— 不再级联到 onShow / onShowEnd 自身，
   * 否则在 onShow 缺失的极端时序下会循环退化到自己。
   */
  private getCurrentAppShow = (): number | undefined => {
    const appShow = this.monitor.appPerf.onShow;
    const onHide = this.monitor.appPerf.onHide;
    if (typeof appShow !== 'number') {
      return undefined;
    }
    if (typeof onHide === 'number' && appShow < onHide) {
      return undefined;
    }
    return appShow;
  };

  /**
   * 当前页是否在本轮 App 回前台后已经走完 onShowEnd。
   */
  private hasPageShownAfterWarmStart = (path: string): boolean => {
    const pagePerf = this.monitor.pagePerf[path];
    const warmStartBegin = this.getWarmStartBeginTimestamp();
    return (
      typeof pagePerf?.onShowEnd === 'number' &&
      typeof warmStartBegin === 'number' &&
      pagePerf.onShowEnd >= warmStartBegin
    );
  };

  /**
   * 判断热启动后是否发生了新的页面加载。
   *
   * 同一路径的页面回前台时，PagePerf 会保留上一次访问的 onLoad / onReady；
   * 如果误把这些旧时间当作本次 ready 门槛，就会出现
   * `旧 Page onReadyEnd - 新 App onShowEnd` 的负值。
   *
   * 因此只有 onLoad 落在本轮回前台开始边界之后，才认为页面被重新加载。
   */
  private hasNewLoadAfterWarmStart = (path: string): boolean => {
    const pagePerf = this.monitor.pagePerf[path];
    const warmStartBegin = this.getWarmStartBeginTimestamp();
    return (
      typeof pagePerf?.onLoad === 'number' &&
      typeof warmStartBegin === 'number' &&
      pagePerf.onLoad >= warmStartBegin
    );
  };
}
