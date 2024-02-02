export interface PERF_MONITOR_VLUES {
  title: string;
  page_launch_duration?: number | string;
  first_contentful_paint_duration?: number;
  largest_contentful_paint_duration?: number;
  reboot_duration?: number;
  reboot_mode?: 'warm' | 'cold';
}
