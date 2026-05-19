import { PERF_MONITOR_VLUES } from '@@/types/gioPerformance';
import { getSafeDuration } from '@@/utils/tools';

import type Monitor from '../monitor';
import { PagePerf } from './types';

/**
 * 普通页面跳转追踪器。
 *
 * ============================================================================
 * 普通跳转定义
 * ============================================================================
 *
 * 既不是冷启动、也不是热启动的页面访问 —— 用户在小程序**内部**完成的
 * 一次页面切换。典型场景：
 *
 *   ✅ navigateTo / redirectTo / switchTab / navigateBack
 *   ✅ 点击页面内的跳转链接
 *   ✅ tab 切换（同一会话内）
 *   ❌ 首次进入小程序 → 那是冷启动
 *   ❌ App 从后台回前台 → 那是热启动
 *
 * ============================================================================
 * 判定规则
 * ============================================================================
 *
 * 普通跳转**没有**专属固化标记（不像 cold 有 isColdStart、warm 有 isWarmStart），
 * 完全依靠**反向排除**判定：
 *
 *   if (warmStart.isVisit) → 热启动
 *   else if (coldStart.isVisit) → 冷启动
 *   else if (referrerPath) → 普通跳转 ★ 命中这里
 *   else → 不发送（既无 referrer 又非冷热，数据不可信）
 *
 * 关键判定信号是 Monitor.referrerPath：
 *   - 上一个页面 onHide / onUnload 时被设置
 *   - 非空 → 用户从某个页面跳过来 → 内部跳转
 *   - 为空 + 非冷启动 → 状态异常，不发送（保守处理）
 *
 * ============================================================================
 * 时长计算（保持与历史代码一致）
 * ============================================================================
 *
 *   page_launch_duration = onReadyEnd - route.navigationStart
 *
 *   起点优先级：
 *     ① route.navigationStart：observer 提供的"路由切换发起时刻"，最精确
 *     ② onLoad：observer 缺失时的兜底（不支持 PerformanceObserver 的平台
 *        / 平台返回的 entries 没有 route）
 *     ③ 都没有 → 0
 *
 *   不写 reboot_duration / reboot_mode：这两个字段语义上属于"App 启动"，
 *   普通跳转里没有 App 维度的启动概念。
 *
 * ============================================================================
 * 平台差异
 * ============================================================================
 *
 *   - 微信：observer 通常都会发 route entry，navigationStart 可用
 *   - 支付宝：observer 也发 route，但回调可能滞后；如果 onReadyEnd 已经到
 *     observer 还没回，2s 兜底超时后用 onLoad 算时长
 *   - 不支持 observer 的平台：直接退到 onLoad 起点
 *
 * 这些差异由 observer.ts 吸收，pageLoad 这层看到的就是"PagePerf 上有没有
 * navigationStart"，逻辑统一。
 */
export class PageLoadTracker {
  constructor(private monitor: Monitor) {}

  /**
   * 把普通跳转时长写入事件属性。
   *
   * @param perfData  - 正在组装的事件属性，会被原地修改
   * @param pagePerf  - 当前页对应的 PagePerf 缓存
   * @param pageStart - 页面 onLoad 时刻；route.navigationStart 缺失时使用
   */
  appendMetrics = (
    perfData: PERF_MONITOR_VLUES,
    pagePerf: PagePerf,
    pageStart?: number
  ) => {
    perfData.page_launch_duration = getSafeDuration(
      pagePerf.onReadyEnd,
      pagePerf.navigationStart,
      pageStart
    );
  };
}
