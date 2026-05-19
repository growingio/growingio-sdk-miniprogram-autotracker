import { PERF_MONITOR_VLUES } from '@@/types/gioPerformance';
import { getSafeDuration } from '@@/utils/tools';

import type Monitor from '../monitor';
import { PagePerf } from './types';

/**
 * 冷启动追踪器。
 *
 * ============================================================================
 * 冷启动定义
 * ============================================================================
 *
 * 满足**全部**条件才认为是一次冷启动访问：
 *
 *   ① App 从未经历过 onHide → bootType === 'cold'
 *      也就是说，本次会话 App 还没进过后台，是 SDK 启动后**第一次**进入前台。
 *
 *   ② 当前 Page 没有 referrer → referrerPath === ''
 *      也就是说，进入这个页面之前 SDK 没记录过任何 Page onHide / onUnload。
 *      → 通常意味着这是用户进入小程序的第一个页面（落地页）。
 *
 * 两个条件由 markIfNeeded 在 Page onShowEnd 时联合判定，命中即把
 * isColdStart=true 写入 PagePerf 固化。
 *
 * ============================================================================
 * 典型场景
 * ============================================================================
 *
 *   ✅ 用户首次打开小程序，进入首页 A → A 被标 cold
 *   ✅ 用户从聊天分享卡片进入小程序，落地到 B → B 被标 cold
 *      （分享场景下 referrer 也是空）
 *   ❌ 用户从 A 跳到 B → B 不是 cold（referrerPath='A'）
 *   ❌ App 进过后台再回来后访问的任何页面 → 不是 cold（bootType='warm'）
 *
 * ============================================================================
 * 时长计算（保持与历史代码一致）
 * ============================================================================
 *
 *   page_launch_duration = onReadyEnd - App.onLaunch
 *     起点 onLaunch 是生命周期事件的时间戳，所有平台都有；
 *     observer 缺失时（淘宝、老基础库等）也能正常算出。
 *
 *   reboot_duration = onReadyEnd - App.appStartTime
 *     起点 appStartTime 来自 observer 的 appLaunch entry，更精确反映"小程序进程
 *     真正开始执行"的时刻。observer 缺失时回退到 App.onLaunch，与 page_launch_duration
 *     保持一致。
 *
 * ============================================================================
 * 关键设计
 * ============================================================================
 *
 *   - 起点（appLaunch / appStartTime）会在 onShowEnd 阶段固化到当前 PagePerf 上，
 *     避免 observer 延迟时全局 appPerf 已经被后续生命周期覆盖。
 *
 *   - 一旦冷启动事件成功发出，会把 Monitor.bootType 翻成 'warm'，使后续所有
 *     App 回前台的访问都按热启动候选处理。即便冷启动事件因 observer 卡住
 *     一直没发出，App.onHide 也会强制翻 bootType='warm'，避免冷热标记混淆。
 */
export class ColdStartTracker {
  constructor(private monitor: Monitor) {}

  // ===========================================================================
  // 判定 / 固化
  // ===========================================================================

  /**
   * 在 Page onShowEnd 时尝试把当前页固化为冷启动落地页。
   *
   * 仅在两个条件同时成立时才认为冷启动：
   *   1. referrerPath 为空 —— 当前访问没有"上一页"
   *      → 排除内部跳转过来的页面（A → B 时 B 不会被标 cold）
   *   2. bootType === 'cold' —— App 还没经历过 onHide → onShow 的回前台
   *      → 排除热启动后访问的任何页面
   *
   * 为什么要"固化"到 PagePerf：
   *   observer 可能延迟到页面切走后才回来；若发送时再读全局 appPerf / bootType，
   *   就可能拿到后续页面的状态。因此把冷启动起点和身份**绑定到具体 path**，
   *   后续无论 bootType 怎么翻、appPerf 怎么变，发送阶段都能拿到正确数据。
   */
  markIfNeeded = (path: string) => {
    if (this.monitor.referrerPath || this.monitor.bootType !== 'cold') {
      return;
    }
    this.monitor.pagePerf[path] = {
      ...this.monitor.pagePerf[path],
      isColdStart: true,
      coldAppLaunch: this.monitor.appPerf.onLaunch,
      coldAppStartTime: this.monitor.appPerf.appStartTime
    };
  };

  /**
   * 判断给定 PagePerf 是否代表一次冷启动访问。
   *
   * 判定优先级：
   *   1. PagePerf.isColdStart 已固化为 true → 是冷启动
   *      （markIfNeeded 在 onShowEnd 写入；即使全局 bootType 后来翻成 'warm'，
   *      该页面仍要按冷启动语义发送）
   *
   *   2. 全局兜底：referrerPath 为空 且 bootType === 'cold'
   *      （首屏页面 markIfNeeded 还没固化时的极少数时序兜底）
   *
   * 与 warmStart.isVisit 互斥：
   *   - bootType 翻成 'warm' 之前，warmStart.isVisit 必定为 false（lastWarm
   *     不可能在 onHide 没发生时被设置）
   *   - bootType 翻成 'warm' 之后，coldStart 兜底分支也不会命中
   *   - 同一访问只可能命中 cold / warm 中的一个
   *
   * 与 buildPerfData 的优先级配合：
   *   monitor.buildPerfData 先调 warmStart.isVisit 再调 coldStart.isVisit。
   *   这样保证冷启动事件未发完就被切后台 + 切回前台时（pagePerf.isColdStart=true
   *   但同时 isWarmStart 也被新写入），按热启动语义优先发送。
   */
  isVisit = (pagePerf: PagePerf): boolean =>
    Boolean(
      pagePerf.isColdStart ||
        (!this.monitor.referrerPath && this.monitor.bootType === 'cold')
    );

  // ===========================================================================
  // 时长写入
  // ===========================================================================

  /**
   * 把冷启动相关时长写入事件属性。
   *
   * 起点优先级：
   *   - page_launch_duration 用 coldAppLaunch（onLaunch 时间），缺失时回退 onLoad（pageStart）
   *   - reboot_duration      用 coldAppStartTime（observer），缺失时回退 coldAppLaunch
   *
   * 写入完毕后立即把 Monitor.bootType 翻成 'warm'，
   * 使后续 App onShowEnd 都按热启动候选处理。即使下一次 App onHide 之前，
   * 同一会话不会再次进入冷启动分支。
   *
   * @param perfData   - 正在组装的事件属性，会被原地修改
   * @param pagePerf   - 当前页对应的 PagePerf 缓存
   * @param pageStart  - 页面 onLoad 时刻，作为最末级的起点回退
   */
  appendMetrics = (
    perfData: PERF_MONITOR_VLUES,
    pagePerf: PagePerf,
    pageStart?: number
  ) => {
    const pageEnd = pagePerf.onReadyEnd;
    const appLaunch = pagePerf.coldAppLaunch ?? this.monitor.appPerf.onLaunch;
    const appStartTime =
      pagePerf.coldAppStartTime ?? this.monitor.appPerf.appStartTime;

    perfData.page_launch_duration = getSafeDuration(
      pageEnd,
      appLaunch,
      pageStart
    );
    perfData.reboot_duration = getSafeDuration(
      pageEnd,
      appStartTime,
      appLaunch
    );
    perfData.reboot_mode = 'cold';

    // 首次冷启动事件处理完后，后续 App onShowEnd 都按热启动候选处理
    this.monitor.bootType = 'warm';
  };
}
