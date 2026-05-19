import { forEach, head, isEmpty } from '@@/utils/glodash';
import { normalizePath } from '@@/utils/tools';

import {
  FCP_ENTRY_NAME,
  LCP_ENTRY_NAME,
  OBSERVER_ENTRY_NAMES,
  OBSERVER_WAIT_TIMEOUT,
  ObserverEntries,
  ObserverEntryName,
  PagePerf
} from './types';
import type Monitor from '../monitor';

/**
 * 性能 Observer 采集器。
 *
 * 负责的职责（不涉及任何冷/热启动判定）：
 *   1. 探测当前平台是否支持 performance.observer，并初始化订阅
 *   2. 把每一轮回调中的 entries 按 path 路由到对应 PagePerf
 *   3. 维护“等待轮次”/“等待真实指标”的发送门槛
 *   4. 超时后兜底放行，避免事件被永久挂起
 *
 * ============================================================================
 * 微信 (`MinP`) vs 支付宝 (`alip`) 平台差异速查
 * ============================================================================
 *
 * 两个平台都支持 PerformanceObserver，但实现细节差别较大，本文件用以下三套
 * 机制吸收差异，让上层（cold/warm/load tracker）看到的是统一接口。
 *
 *   ┌──────────────────┬────────────────────────────┬─────────────────────────┐
 *   │ 维度             │ 微信                       │ 支付宝                  │
 *   ├──────────────────┼────────────────────────────┼─────────────────────────┤
 *   │ entry path 字段  │ entry.path / entry.route   │ entry.pageURL（特有）   │
 *   │ 首轮 entry       │ 通常即可拿到真实指标       │ 经常全是"空壳 entry"    │
 *   │                  │ 偶有 FCP/LCP 晚一轮        │ （带 name/path 但缺    │
 *   │                  │                            │ startTime），第二轮才  │
 *   │                  │                            │ 回真实数据             │
 *   │ pathless entry   │ 当前页 FCP/LCP 经常无 path │ 偶尔出现               │
 *   │ 回调时机         │ 与 Page 生命周期基本对齐   │ 可能在 Page 切走后才回  │
 *   │ 多轮             │ 一般 1 轮够               │ 至少等第二轮；若第 2 轮 │
 *   │                  │                            │ 仍缺 paint 再等第 3 轮 │
 *   │                  │                            │ 或超时                 │
 *   └──────────────────┴────────────────────────────┴─────────────────────────┘
 *
 * 处理对应（按机制类型）：
 *
 *   1. 字段差异 → {@link extractEntryPath} 同时尝试 path/route/pagePath/pageURL/url
 *
 *   2. 空壳 entry → {@link hasPaintEntry} 要求 FCP/LCP 必须有 startTime；
 *      只有真实指标才会标记 handledEntries，空壳交给超时兜底处理
 *
 *   3. 多轮等待 → 支付宝首轮必等第二轮；如果第二轮后 paint 仍未齐，
 *      再等第三轮或 2s 超时。非支付宝 1 轮即放行
 *
 *   4. 等指标 vs 等轮次 → {@link scheduleObserverFallback} 把这两个条件
 *      解耦成 `shouldWaitEntries` 与 `shouldWaitAlipaySecondRound`，
 *      避免支付宝把"等指标"和"等轮次"混在一起
 *
 *   5. 等待上限 → 微信 / 支付宝都最多等 2 秒（{@link OBSERVER_WAIT_TIMEOUT}）；
 *      其他平台直接跳过等待，避免稳定缺指标的平台固定延迟 2 秒
 *
 *   6. pathless 归属 → {@link recordObserverMetric} 注释专门说明：
 *      pathless FCP/LCP 只跟随本轮主 path，不允许被 pending 页"偷走"
 *
 *   7. 平台不支持 observer → {@link hasProcessedObserverEntries} 直接放行，
 *      让冷启动 / 普通跳转事件靠生命周期数据正常发出（淘宝、老基础库等场景）
 */
export class ObserverCollector {
  /** 每个 path 各自的等待计时器，便于按 path 取消而不影响其他页面 */
  private observerWaitTimers: Record<string, any> = {};

  constructor(private monitor: Monitor) {}

  // ===========================================================================
  // 初始化
  // ===========================================================================

  /**
   * 初始化 observer。
   *
   * 仅在平台 `getPerformance` 真正可用时订阅，避免在不支持的平台抛错。
   */
  init = () => {
    if (!this.canObservePerformance()) {
      return;
    }
    const performance = this.monitor.minipInst.getPerformance();
    const observer = performance?.createObserver(this.handleObserverEntries);
    observer?.observe({ entryTypes: ['render', 'script', 'navigation'] });
  };

  /**
   * 平台能力探测。
   *
   * 双重判断（方法存在 + canIUse 通过）的原因：
   *   - 部分平台对象上有 `getPerformance` 方法但基础库未真正开放能力
   *   - canIUse 是平台官方建议的能力探测方式
   */
  canObservePerformance = () => {
    const { minipInst } = this.monitor;
    const hasGetPerformance = typeof minipInst?.getPerformance === 'function';
    const canIUseResult =
      typeof minipInst?.canIUse === 'function'
        ? minipInst.canIUse('getPerformance')
        : true;
    return hasGetPerformance && canIUseResult;
  };

  // ===========================================================================
  // 一轮 observer 回调的主流程
  // ===========================================================================

  /**
   * 处理 performance observer 一轮回调。
   *
   * 同一轮回调中可能同时包含多个页面的迟到指标：
   *   - route 通常代表当前页
   *   - LCP/FCP 可能是上一页迟到补回来的 entry
   *
   * 因此这里收集 touchedPaths，对每个被写入的页面分别 finalize。
   */
  handleObserverEntries = (entryList: any) => {
    const entries = this.pickObserverEntries(entryList);

    // route 优先级最高，因为它最稳定地标识页面；都没有时再退化到 FCP/LCP/launch 里的 path
    const path = this.getObserverPath(
      head(entries.routeEntries),
      head(entries.fcpEntries),
      head(entries.lcpEntries),
      entries.launchEntry
    );
    const touchedPaths: Record<string, boolean> = {};

    // 即使本轮全空也要把它归到主 path，
    // 这样支付宝第一轮空 observer 也能启动“等第二轮 / 必要时等第三轮 / 等超时”
    // 的发送门槛
    this.markTouchedPath(touchedPaths, path);

    // App 维度只有 launch 这一类指标，写入全局 appPerf
    this.handleLaunch(entries.launchEntry);

    // Page 维度按各自 path 写入 pagePerf
    for (const entry of entries.fcpEntries) {
      this.markTouchedPath(touchedPaths, this.handleFCP(entry, path));
    }
    for (const entry of entries.lcpEntries) {
      this.markTouchedPath(touchedPaths, this.handleLCP(entry, path));
    }
    for (const entry of entries.routeEntries) {
      this.markTouchedPath(touchedPaths, this.handleRoute(entry, path));
    }

    this.finalizeTouchedObserverPaths(touchedPaths);
  };

  /**
   * 从 entryList 中按名称取出本逻辑关心的 entries。
   *
   * 单独收口名称映射，后续平台新增别名时只需要改这里一个地方。
   */
  pickObserverEntries = (entryList: any): ObserverEntries => ({
    launchEntry: this.getEntry(entryList, ['appLaunch']),
    fcpEntries: this.getEntries(entryList, [FCP_ENTRY_NAME]),
    lcpEntries: this.getEntries(entryList, [LCP_ENTRY_NAME]),
    routeEntries: this.getEntries(entryList, ['route'])
  });

  /**
   * 完成本轮 observer 影响到的所有页面。
   *
   * 顺序故意写成两个 forEach：
   *   1. 先统一记录每个 touched path 的“轮次信息”
   *   2. 再统一 finalize
   *
   * 这样在同一轮里如果多个 path 都被触达，每个 path 都能在 finalize 阶段
   * 看到最新的轮次计数。
   */
  finalizeTouchedObserverPaths = (touchedPaths: Record<string, boolean>) => {
    forEach(touchedPaths, (_, touchedPath) => {
      this.markObserverRound(touchedPath);
    });
    forEach(touchedPaths, (_, touchedPath) => {
      this.finalizeObserverRound(touchedPath);
    });
  };

  // ===========================================================================
  // entry 写入
  // ===========================================================================

  /**
   * 记录 appLaunch 指标。
   *
   * 这部分数据主要用于冷启动整体时长计算。
   */
  handleLaunch = (entry: any) => {
    if (!this.hasPerformanceEntry(entry)) {
      return;
    }
    this.monitor.appPerf = {
      ...this.monitor.appPerf,
      appStartTime: entry.startTime,
      appDuration: entry.duration,
      firstPath: entry.path
    };
  };

  /**
   * 记录 firstContentfulPaint 的原始开始时间。
   *
   * 真正发送时会再减去页面 onLoad，换算成首屏白屏时长。
   * entry 为空时不立即标记完成，避免真实指标晚一轮回来时被提前发送吞掉。
   */
  handleFCP = (entry: any, fallbackPath: string) => {
    if (!this.hasPaintEntry(entry)) {
      return undefined;
    }
    return this.recordObserverMetric(entry, fallbackPath, FCP_ENTRY_NAME, {
      FCPStartTime: entry.startTime
    });
  };

  /**
   * 记录 largestContentfulPaint 的原始开始时间。
   *
   * 真正发送时同样会减去页面 onLoad，得到最大内容渲染耗时。
   */
  handleLCP = (entry: any, fallbackPath: string) => {
    if (!this.hasPaintEntry(entry)) {
      return undefined;
    }
    return this.recordObserverMetric(entry, fallbackPath, LCP_ENTRY_NAME, {
      LCPStartTime: entry.startTime
    });
  };

  /**
   * 记录 route 指标。
   *
   * route 的 startTime/duration 是普通页面跳转的最佳起点，
   * 同时 route 也是最稳定的一类页面标识来源。
   */
  handleRoute = (entry: any, fallbackPath: string) => {
    if (!this.hasPerformanceEntry(entry)) {
      return undefined;
    }
    return this.recordObserverMetric(entry, fallbackPath, 'route', {
      navigationStart: entry.startTime,
      routeDuration: entry.duration
    });
  };

  /**
   * 把指标写入对应页面桶，并标记 entry 已收到。
   *
   * 写入路径优先用 entry 自带 path，只有 entry 完全没带页面信息时才用 fallbackPath。
   * 这个优先级很重要：快速切页时，上一页迟到的 FCP/LCP 可能和当前页 route
   * 出现在同一轮 observer 里；如果迟到指标自带 path，就按它自己的 path 归桶。
   *
   * 但反过来，如果 FCP/LCP 没带 path，**不要再去猜测它属于哪个 pending 页**：
   * 微信当前页的 FCP/LCP 也经常是 pathless，强行补给 pending 页会偷走当前页指标。
   */
  recordObserverMetric = (
    entry: any,
    fallbackPath: string,
    entryName: ObserverEntryName,
    values: any
  ) => {
    const path = this.extractEntryPath(entry) || fallbackPath;
    if (!path) {
      return undefined;
    }
    this.monitor.ensurePagePerf(path);
    this.monitor.pagePerf[path] = {
      ...this.monitor.pagePerf[path],
      ...values
    };
    this.markEntryHandled(path, entryName);
    return path;
  };

  // ===========================================================================
  // 等待 / 放行
  // ===========================================================================

  /**
   * 标记某个页面收到了一次 observer 回调。
   *
   * 同时记录两类信息：
   *   - observerTriggerCount：当前页累计收到了几轮 observer
   *   - firstObserverTimestamp：第一轮 observer 的时间戳，作为 2s 等待的计时起点
   *
   * 平台差异：
   *   - 微信：通常一轮就能拿到全部指标，count 从 1 开始即可放行
   *   - 支付宝：首轮一定先等第 2 轮；若第 2 轮后 paint 仍未齐，再等第 3 轮
   *     或超时。这里不直接做决策，只维护计数，判定放在 schedule / hasProcessed
   *
   * firstObserverTimestamp 是两个平台共用的：单页等待最长 2 秒从这一刻开始算，
   * 即使支付宝晚一轮回来，总等待时间也不会超过 2s。
   */
  markObserverRound = (path: string) => {
    this.monitor.ensurePagePerf(path);
    if (!this.monitor.pagePerf[path].firstObserverTimestamp) {
      this.monitor.pagePerf[path].firstObserverTimestamp = Date.now();
    }
    this.monitor.pagePerf[path].observerTriggerCount =
      (this.monitor.pagePerf[path].observerTriggerCount || 0) + 1;
  };

  /**
   * 结束当前页面的一轮 observer 处理。
   *
   * 这里不会简单要求 route/FCP/LCP 全部存在，而是按平台差异判断
   * “还缺的 entry 是否值得继续等”，避免不支持某类 entry 的平台固定延迟 2 秒。
   */
  finalizeObserverRound = (path: string) => {
    this.monitor.ensurePagePerf(path);
    this.monitor.pagePerf[path].observerProcessed =
      this.getWaitableMissingObserverEntries(path).length === 0;

    // 依然缺关键指标 / 还没等到支付宝目标轮次时挂上超时兜底
    this.scheduleObserverFallback(path);

    // 触发一次发送判定，让 observer 已就绪的页面尽早发出去
    this.monitor.tryHandleEvent(path);
  };

  /**
   * observer 的超时兜底。
   *
   * 把两类等待显式拆开，避免互相干扰：
   *
   *   shouldWaitEntries：等关键指标（FCP/LCP）真实数据到位
   *     - 微信：偶尔 FCP/LCP 晚一轮，需要再等
   *     - 支付宝：首轮指标可能空，需要等
   *     - 其他平台：默认不等（getWaitableMissingObserverEntries 直接返回 []）
   *
   *   shouldWaitAlipayObserverRound：支付宝**专属**的"等目标轮次 observer"
   *     - 第 1 轮后：一定等第 2 轮，因为支付宝首轮 LCP 可能还不稳定
   *     - 第 2 轮后：若 FCP/LCP 已齐，立即放行；若仍缺 paint，再等第 3 轮
   *     - 第 3 轮后：不再继续等第 4 轮，剩余缺口交给 2s 超时兜底
   *     - 这条只适用于 isAlipay()，微信不需要
   *
   * 两条都用 OBSERVER_WAIT_TIMEOUT (2s) 作为上限，保证事件不会无限挂起。
   * 任一条件触发就会挂表，谁先到就由谁推进 tryHandleEvent。
   */
  scheduleObserverFallback = (path: string) => {
    this.monitor.ensurePagePerf(path);
    const pagePerf = this.monitor.pagePerf[path];

    // 关键指标缺失：微信 / 支付宝都可能出现
    const shouldWaitEntries =
      this.getWaitableMissingObserverEntries(path).length > 0;
    // 支付宝 observer 轮次：第 1 轮后必等第 2 轮；第 2 轮仍缺 paint 再等第 3 轮
    const shouldWaitAlipayObserverRound =
      this.shouldWaitAlipayObserverRound(pagePerf);

    // 不需要等 → 清掉可能存在的旧计时器
    if (!shouldWaitEntries && !shouldWaitAlipayObserverRound) {
      this.clearObserverWaitTimer(path);
      return;
    }

    // 已经过了一轮兜底超时，或当前已经在等了，就不重复挂表
    if (pagePerf.observerFallbackExpired || this.observerWaitTimers[path]) {
      return;
    }

    const elapsed =
      Date.now() - (pagePerf.firstObserverTimestamp || Date.now());
    // 总等待时间从第一次 observer 开始算，最多 2 秒
    const waitMs = Math.max(0, OBSERVER_WAIT_TIMEOUT - elapsed);
    this.observerWaitTimers[path] = setTimeout(() => {
      delete this.observerWaitTimers[path];
      // 标记“已经等满 2 秒”，缺失的指标会被视为已处理
      this.markObserverFallbackExpired(path);
      this.monitor.tryHandleEvent(path);
    }, waitMs);
  };

  /**
   * 支付宝是否还需要继续等后续 observer 轮次。
   *
   * 规则：
   *   - 第 1 轮后：总是再等第 2 轮
   *   - 第 2 轮后：若关键 paint 已齐，不再继续等；未齐则再等第 3 轮
   *   - 第 3 轮及以后：不再继续等第 4 轮，剩余缺口交给超时兜底
   */
  shouldWaitAlipayObserverRound = (pagePerf: Partial<PagePerf> = {}) => {
    if (!this.isAlipay()) {
      return false;
    }
    const observerTriggerCount = pagePerf.observerTriggerCount || 0;
    if (observerTriggerCount < 2) {
      return true;
    }
    return observerTriggerCount < 3 && !pagePerf.observerProcessed;
  };

  /**
   * observer 等待超时后，把缺失的 entry 视为已处理。
   *
   * 这只是解除发送门槛，并不会伪造 FCP/LCP/route 的时间值；
   * 已经拿到的真实指标仍正常进入事件属性。
   */
  markObserverFallbackExpired = (path: string) => {
    this.monitor.ensurePagePerf(path);
    const pagePerf = this.monitor.pagePerf[path];
    const handledEntries = pagePerf.handledEntries || {};
    OBSERVER_ENTRY_NAMES.forEach((name) => {
      handledEntries[name] = true;
    });
    pagePerf.handledEntries = handledEntries;
    pagePerf.observerProcessed = true;
    pagePerf.observerFallbackExpired = true;
  };

  /**
   * 清理 observer 等待超时定时器。
   *
   * 一旦等到目标轮次 observer 或事件已成功发送，就不需要再保留兜底。
   */
  clearObserverWaitTimer = (path: string) => {
    if (this.observerWaitTimers[path]) {
      clearTimeout(this.observerWaitTimers[path]);
      delete this.observerWaitTimers[path];
    }
  };

  /**
   * observer 链路是否已经满足发送条件。
   *
   * 三档判定，按平台支持度和精度递增：
   *
   *   档 0 - 平台不支持 PerformanceObserver（淘宝、老基础库等）：
   *     observer 永远不会被调用，observerProcessed 永远是 false。
   *     若不放行，冷启动 / 普通跳转事件会被永久卡在 tryHandleEvent 这一关。
   *     这些平台拿不到 FCP/LCP/route，让事件按生命周期数据正常发出即可。
   *
   *   档 1 - 微信 (`MinP`) 等单轮 observer 平台：
   *     observerProcessed=true 即放行。observerProcessed 由 finalizeObserverRound
   *     在"该等的指标都拿到"后置 true（缺失指标超过 2s 也会通过 fallback 标 true）。
   *
   *   档 2 - 支付宝 (`alip`)：
   *     在档 1 基础上额外要求 observerTriggerCount >= 2 或 observerFallbackExpired。
   *     原因：支付宝首轮的 LCP 可能不是最终最大元素，至少要过第 2 轮才能信。
   *     若第 2 轮后指标已齐，会立即放行；若第 2 轮后仍缺 paint，
   *     scheduleObserverFallback 会继续等第 3 轮或 2s 超时。
   */
  hasProcessedObserverEntries = (path: string) => {
    // 档 0：平台不支持 observer 直接放行
    if (!this.canObservePerformance()) {
      return true;
    }
    // 档 1：基础门槛 - 该等的指标都到位（或 2s 超时兜底）
    if (!this.monitor.pagePerf[path]?.observerProcessed) {
      return false;
    }
    if (!this.isAlipay()) {
      return true;
    }
    // 档 2：支付宝基础轮次门槛 - 至少第 2 轮 observer 或超时
    return (
      (this.monitor.pagePerf[path]?.observerTriggerCount || 0) >= 2 ||
      Boolean(this.monitor.pagePerf[path]?.observerFallbackExpired)
    );
  };

  // ===========================================================================
  // 内部辅助
  // ===========================================================================

  /**
   * 判断 observer entry 是否有真实内容。
   *
   * 一些平台返回的 PerformanceEntry 字段可能不是普通可枚举属性，
   * 但仍然能通过 entry.startTime / entry.duration 读到有效数据。
   */
  hasPerformanceEntry = (entry: any) =>
    !isEmpty(entry) ||
    typeof entry?.startTime === 'number' ||
    typeof entry?.duration === 'number';

  /**
   * FCP/LCP 必须有 startTime 才算真实指标。
   *
   * 平台差异：
   *   - 支付宝：第一轮 observer 经常返回带 name/path 的"空壳 entry"
   *     （字段齐全但 startTime/duration 缺失），是 paint 还没真正完成的占位
   *   - 微信：偶尔也出现，但不如支付宝普遍
   *
   * 这种空壳对归页有帮助（能告诉我们该指标确实属于哪个 path），但不能视为
   * paint 已完成；否则真实 startTime 还在路上时页面就被 markEntryHandled
   * 标记成 paint 就绪并被提前放行，最终事件里就缺 first/largest_contentful_paint。
   */
  hasPaintEntry = (entry: any) =>
    this.hasPerformanceEntry(entry) && typeof entry?.startTime === 'number';

  /**
   * 按候选名称从 entryList 中取所有有效 entry。
   *
   * 快速切页时，同一轮 observer 可能包含多个页面的同名指标。
   * 如果只取第一条，后续页面的指标会被丢掉。
   */
  getEntries = (entryList: any, names: string[]) => {
    const entries: any[] = [];
    for (const name of names) {
      const namedEntries = entryList?.getEntriesByName?.(name) || [];
      // 同名 entry 的顺序由平台决定，这里只过滤空 entry，不重排
      // route/FCP/LCP 自带 path 时后面会按 path 分桶；没有 path 时才用主 path 兜底
      for (const entry of namedEntries) {
        if (this.hasPerformanceEntry(entry)) {
          entries.push(entry);
        }
      }
    }
    return entries;
  };

  /**
   * 按候选名称从 entryList 中取第一条有效 entry。
   *
   * appLaunch 这类 App 级指标只需要一条；复用 getEntries 可以保持有效性判断一致。
   */
  getEntry = (entryList: any, names: string[]) =>
    head(this.getEntries(entryList, names));

  /**
   * 从 entry 中尽量提取自身声明的 path。
   *
   * 平台字段差异：
   *   - 微信 (`MinP`)：通常用 `path` 或 `route`
   *   - 支付宝 (`alip`)：用 `pageURL`（与微信不一致，必须同时支持）
   *   - 框架封装层（Taro 等）：可能用 `pagePath`
   *   - 部分平台：用 `url`
   *
   * 五个候选按"平台真机最常见"排序，取第一个非空值即可。
   *
   * 这里**不**回退到 currentPage：observer 回调可能发生在页面切走之后，
   * currentPage 已经不是 entry 对应页面（支付宝尤其明显，回调常滞后）。
   */
  extractEntryPath = (entry: any) =>
    normalizePath(
      entry?.path ||
        entry?.route ||
        entry?.pagePath ||
        entry?.pageURL ||
        entry?.url
    );

  /**
   * 选出当前最可能属于本轮 observer 的页面 path。
   *
   * 判定优先级：
   *   1. observer entry 自己携带的 path
   *   2. 已走到发送生命周期、但还在等 observer 的最早页面
   *   3. 当前页面
   *
   * 这样可以尽量避免支付宝空 observer 在快速切页时被误记到“下一页”。
   */
  getObserverPath = (...entries: any[]) => {
    for (const entry of entries) {
      const path = this.extractEntryPath(entry);
      if (path) {
        return path;
      }
    }
    const pendingPath = this.getPendingObserverPath();
    if (pendingPath) {
      return pendingPath;
    }
    return normalizePath(this.monitor.getCurrentPath());
  };

  /**
   * 选出最值得接住 pathless observer 的页面。
   *
   * 优先选择已经进入发送生命周期、但还没完成 observer 对齐的页面，
   * 并按进入该阶段的时间从早到晚排序。这样在"custom 刚 ready 就切到 form"
   * 的场景下，迟到的空 observer 仍会优先归到 custom，而不是 form。
   *
   * 平台差异：
   *   - 微信：当前页的 FCP/LCP 经常是 pathless，强制关联会偷走当前页指标，
   *     因此该函数仅在**整轮无任何 path** 时才使用，正常路径下 pathless 指标
   *     跟随本轮主 path（recordObserverMetric 里的 fallbackPath）
   *   - 支付宝：首轮经常全空，需要这条兜底把空 observer 归到当前 pending 页面，
   *     才能启动 markObserverRound 的 count 计数
   *
   * 这个函数仅在 getObserverPath 第二档使用——本轮 entry 全部没有 path 时
   * 兜底。一旦本轮任意 entry 自带 path（route/FCP/LCP），就以那个为主，
   * 不让 pending 页抢走。
   */
  getPendingObserverPath = () => {
    let candidatePath = '';
    let candidateTimestamp = Infinity;
    forEach(this.monitor.pagePerf, (pagePerf, path) => {
      if (
        !pagePerf ||
        pagePerf.eventSent ||
        this.hasProcessedObserverEntries(path) ||
        !this.monitor.hasReadyPagePerf(path)
      ) {
        return;
      }
      const readyAt = this.monitor.getPageReadyTimestamp(path);
      if (typeof readyAt === 'number' && readyAt < candidateTimestamp) {
        candidateTimestamp = readyAt;
        candidatePath = path;
      }
    });
    return candidatePath;
  };

  /**
   * 当前页面还没拿到真实 entry 的指标集合。
   */
  getMissingObserverEntries = (path: string) => {
    const handledEntries = this.monitor.pagePerf[path]?.handledEntries || {};
    return OBSERVER_ENTRY_NAMES.filter((name) => !handledEntries[name]);
  };

  /**
   * 当前平台真正需要等待的缺失指标。
   *
   * 不同平台的等待策略：
   *   - 微信 (`MinP`) / 支付宝 (`alip`)：等 FCP/LCP（首屏白屏 / 最大内容渲染指标）
   *   - 其他平台：返回空数组，不等任何 entry
   *
   * 为什么 route 不在等待清单里：
   *   route 只用作普通跳转的 page_launch_duration 起点，缺失时 sender 阶段
   *   会回退到 onLoad。如果把 route 也设为硬等待，平台不返回 route 时（部分
   *   小程序根本不发 route entry）会固定多拖 2 秒。
   *
   * 为什么其他平台直接返回空：
   *   非微信 / 支付宝 的小程序大多稳定不发 FCP/LCP（基础库未实现），
   *   把它们设为硬等待会让每次发送都固定延迟 2 秒。
   */
  getWaitableMissingObserverEntries = (path: string) => {
    const missingEntries = this.getMissingObserverEntries(path);
    if (this.shouldWaitPaintEntries()) {
      return missingEntries.filter(
        (name) => name === FCP_ENTRY_NAME || name === LCP_ENTRY_NAME
      );
    }
    return [];
  };

  /**
   * 当前平台是否需要为 FCP/LCP 短暂等待。
   *
   * 平台差异：
   *   - 微信 (`MinP`)：FCP/LCP 偶尔晚 route/lifecycle 一轮 observer 才到，需要等
   *   - 支付宝 (`alip`)：首轮可能完全没有 paint entry，需要等下一轮
   *   - 其他平台：基础库稳定不发 FCP/LCP，没必要等
   *
   * 注意：支付宝额外的“至少等第 2 轮，必要时再等第 3 轮”不在这里判断，
   * 由 {@link scheduleObserverFallback} 通过 `observerTriggerCount` 单独控制，
   * 避免把“等指标”和“等轮次”耦合在一个标志位里。
   */
  shouldWaitPaintEntries = () => this.isWeChat() || this.isAlipay();

  /**
   * 当前是否运行在支付宝小程序环境。
   *
   * 支付宝特征：
   *   - observer 首轮回调可能全是空壳 entry（带 name/path 但无 startTime）
   *   - LCP 真实值通常在第二轮才稳定；第二轮后仍缺 paint 时再等第三轮
   *   - entry 用 `pageURL` 字段表示路径，与微信的 `path/route` 不一致
   *   - observer 回调可能滞后，发生在页面切走之后
   *
   * 这些差异在本文件以 isAlipay() 守卫的多处分支吸收，对外接口保持统一。
   */
  isAlipay = () => this.monitor.growingIO.minipInstance.platform === 'alip';

  /**
   * 当前是否运行在微信小程序环境。
   *
   * 微信特征：
   *   - observer 回调通常一轮就能拿到完整 route/FCP/LCP
   *   - 但 FCP/LCP 偶尔晚一轮才到，需要 2s 等待兜底
   *   - 当前页的 FCP/LCP 经常是 pathless（entry 不带 path 字段）
   *
   * 微信不需要支付宝这套“第二轮 / 第三轮”的多轮逻辑，主要区别就在这里。
   */
  isWeChat = () => this.monitor.growingIO.minipInstance.platform === 'MinP';

  /**
   * 标记当前页已收到某类真实 entry。
   *
   * 只有真实 entry 才会标记完成；空 entry 统一交给 observer 超时兜底处理，
   * 避免晚到的 FCP/LCP/route 被提前发送吞掉。
   */
  markEntryHandled = (path: string, entryName: ObserverEntryName) => {
    if (!path) {
      return;
    }
    this.monitor.ensurePagePerf(path);
    const pagePerf = this.monitor.pagePerf[path];
    const handledEntries = pagePerf.handledEntries || {};
    handledEntries[entryName] = true;
    pagePerf.handledEntries = handledEntries;
  };

  /**
   * 记录本轮 observer 实际影响到的页面。
   *
   * 同一轮 observer 中 route/FCP/LCP 可能属于不同 path，每个 touched path
   * 都需要单独 finalize，避免迟到指标写入后没人触发发送。
   */
  markTouchedPath = (touchedPaths: Record<string, boolean>, path?: string) => {
    if (path) {
      touchedPaths[path] = true;
    }
  };
}
