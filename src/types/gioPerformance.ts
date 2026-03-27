/**
 * 性能监控数值接口
 * @interface PERF_MONITOR_VLUES
 */
export interface PERF_MONITOR_VLUES {
  /** 页面标题 */
  title: string;
  /** 页面启动耗时 */
  page_launch_duration?: number | string;
  /** 首次内容绘制耗时 */
  first_contentful_paint_duration?: number;
  /** 最大内容绘制耗时 */
  largest_contentful_paint_duration?: number;
  /** 重启耗时 */
  reboot_duration?: number;
  /** 重启模式 */
  reboot_mode?: 'warm' | 'cold';
}
