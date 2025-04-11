import { PERF_MONITOR_VLUES } from '@@/types/gioPerformance';
import { GrowingIOType } from '@@/types/growingIO';
import { forEach, has, head, isEmpty, keys, unset } from '@@/utils/glodash';
import EMIT_MSG from '@@/constants/emitMsg';

export default class Monitor {
  private minipInst: any;
  private appPerf: any;
  private pagePerf: any;
  private bootType: 'cold' | 'warm';
  private lastWarm = false;
  public referrerPath = ''; // 基础库低于2.23.1或者taro等一些框架中会没有referrerPageId，因此需要靠自己记录上一个页面
  private lastUnloadPath = ''; // 打开小程序后再点击分享的连接进入小程序时，页面会被销毁，会触发页面重新加载，从而变成两个热启动，根据上一个被销毁的页面地址来判断是否要发热启动
  private buildMonitorEvent: (attributes: any, extra: any) => void;
  constructor(public growingIO: GrowingIOType) {
    this.minipInst = this.growingIO.minipInstance.minip;
    this.appPerf = {};
    this.pagePerf = {};
    this.bootType = 'cold';
    this.lastWarm = false;
    this.buildMonitorEvent = (attributes: any, extra: any) =>
      this.growingIO.plugins.gioPerformance?.buildPerfEvent(
        'apm_app_launch',
        attributes,
        extra
      );
    // 目前仅微信和字节小程序支持小程序启动性能的获取
    if (['MinP', 'bytedance'].includes(this.growingIO.minipInstance.platform)) {
      this.initObserver();
    }
    this.growingIO.emitter.on(
      EMIT_MSG.MINIP_LIFECYCLE,
      ({ event, timestamp, params }) => {
        const [actionType, lifeCycleName] = event.split(' ');
        switch (actionType) {
          case 'App': {
            this.appPerf = {
              ...this.appPerf,
              [lifeCycleName]: timestamp
            };
            if (lifeCycleName === 'onShowEnd') {
              // 只有靠appOnShow才能判断是不是热启动，所以放在App的生命周期中做标记
              // 也因为App的生命周期先执行，在后面Page和Component中判断的时候是没问题的
              if (this.bootType === 'warm' && !this.lastWarm) {
                this.lastWarm = true;
              }
            }
            break;
          }
          case 'Page': {
            const path = (params.page || params.instance)?.route;
            this.pagePerf[path] = {
              ...this.pagePerf[path],
              [lifeCycleName]: timestamp
            };
            if (lifeCycleName === 'onShowEnd') {
              // 标记当前页面是热启动，则发送App热启动性能
              if (
                this.lastWarm &&
                this.bootType === 'warm' &&
                this.referrerPath === path &&
                this.lastUnloadPath !== path
              ) {
                this.handleEvent(path);
              }
            }
            if (['onHide', 'onUnload'].includes(lifeCycleName)) {
              this.referrerPath = path;
            }
            if (lifeCycleName === 'onUnload') {
              this.lastUnloadPath = path;
            }
            break;
          }
          default:
            break;
        }
      }
    );
  }

  // 初始化性能监听
  initObserver = () => {
    const performance = this.minipInst.canIUse('getPerformance')
      ? this.minipInst.getPerformance()
      : {};
    const observer = performance?.createObserver((entryList) => {
      this.handleLaunch(head(entryList.getEntriesByName('appLaunch')));
      // this.handleScript(head(entryList.getEntriesByName('evaluateScript')));
      // this.handleFR(head(entryList.getEntriesByName('firstRender')));
      // this.handleFP(head(entryList.getEntriesByName('firstPaint')));
      this.handleFCP(head(entryList.getEntriesByName('firstContentfulPaint')));
      this.handleLCP(
        head(entryList.getEntriesByName('largestContentfulPaint'))
      );
      this.handleRoute(head(entryList.getEntriesByName('route')));
    });
    observer?.observe({ entryTypes: ['render', 'script', 'navigation'] });
  };

  // 小程序初始化耗时
  handleLaunch = (entry: any) => {
    if (!isEmpty(entry)) {
      this.appPerf = {
        ...this.appPerf,
        appStartTime: entry.startTime,
        appDuration: entry.duration,
        firstPath: entry.path
      };
    }
  };

  // 注入代码耗时
  // handleScript = (entry: any) => {
  //   if (!isEmpty(entry)) {
  //     this.appPerf = {
  //       ...this.appPerf,
  //       scriptStartTime: entry.startTime,
  //       scriptDuration: entry.duration
  //     };
  //   }
  // };

  // firstRender耗时
  // handleFR = (entry: any) => {
  //   if (!isEmpty(entry)) {
  //     this.pagePerf[entry.path] = {
  //       ...this.pagePerf[entry.path],
  //       FRStartTime: entry.startTime,
  //       FRDuration: entry.duration,
  //     };
  //   }
  // };

  // firstPaint耗时
  // handleFP = (entry: any) => {
  //   if (!isEmpty(entry)) {
  //     this.pagePerf[entry.path] = {
  //       ...this.pagePerf[entry.path],
  //       FPStartTime: entry.startTime,
  //     };
  //   }
  // };

  // firstContentfulPaint耗时
  handleFCP = (entry: any) => {
    if (!isEmpty(entry)) {
      this.pagePerf[entry.path] = {
        ...this.pagePerf[entry.path],
        FCPStartTime: entry.startTime
      };
    }
    this.entriesValidate(entry ?? { name: 'firstContentfulPaint' });
  };

  // largestContentfulPaint耗时
  handleLCP = (entry: any) => {
    if (!isEmpty(entry)) {
      this.pagePerf[entry.path] = {
        ...this.pagePerf[entry.path],
        LCPStartTime: entry.startTime
      };
    }
    this.entriesValidate(entry ?? { name: 'largestContentfulPaint' });
  };

  // 路由跳转耗时
  handleRoute = (entry: any) => {
    if (!isEmpty(entry)) {
      this.pagePerf[entry.path] = {
        ...this.pagePerf[entry.path],
        navigationStart: entry.startTime,
        routeDuration: entry.duration
      };
    }
    this.entriesValidate(entry ?? { name: 'route' });
  };

  // 校验指标是否都获取完毕
  entriesValidate = (entry: any) => {
    const path =
      entry.path || this.growingIO.minipInstance.getCurrentPage().route;
    if (!this.pagePerf[path]) {
      this.pagePerf[path] = {
        path
      };
    }
    if (!this.pagePerf[path].entries) {
      this.pagePerf[path].entries = [];
    }
    this.pagePerf[path].entries.push(entry.name);
    // 所有的entry都执行过（'firstContentfulPaint', 'largestContentfulPaint', 'route'）
    const matcher = ['firstContentfulPaint', 'largestContentfulPaint', 'route'];
    let eve = true;
    if (this.pagePerf[path].entries.length < matcher.length) {
      eve = false;
    }
    matcher.forEach((o) => {
      if (!this.pagePerf[path].entries.includes(o)) {
        eve = false;
      }
    });
    if (eve) {
      this.handleEvent(path);
    }
  };

  // 组装监控事件
  handleEvent = (path: string) => {
    const { currentPage } = this.growingIO.dataStore.eventHooks;
    const perfData: PERF_MONITOR_VLUES = {
      // 页面标题
      title: currentPage.getPageTitle()
    };
    const { appStartTime } = this.appPerf;
    const appLaunch = this.appPerf.onLaunch;
    const appShow = this.appPerf.onShow;
    const {
      onLoad, // page生命周期
      onShowEnd, // page生命周期
      onReadyEnd, // page生命周期
      navigationStart,
      FCPStartTime,
      LCPStartTime
    } = this.pagePerf[path];
    // 用于计算的页面开始时间
    const pageStart = onLoad;
    // 用于计算的页面结束时间
    const pageEnd = onReadyEnd || onShowEnd;
    // FCP（白屏时长）从created（相当于页面onLoad）开始算
    if (FCPStartTime) {
      perfData.first_contentful_paint_duration =
        FCPStartTime > pageStart ? FCPStartTime - pageStart : 0;
    }
    // LCP（最大内容加载时长）从created（相当于页面onLoad）开始算
    if (LCPStartTime) {
      perfData.largest_contentful_paint_duration =
        LCPStartTime > pageStart ? LCPStartTime - pageStart : 0;
    }
    // 页面加载时长
    if (this.referrerPath) {
      // 如果上次的页面和本次进入的页面是同一个说明是热启动
      if (path === this.referrerPath && appShow) {
        // 热启动
        perfData.page_launch_duration = pageEnd - appShow;
        perfData.reboot_duration = pageEnd - appShow;
        perfData.reboot_mode = 'warm';
        this.lastWarm = false;
      } else {
        // 如果上次的页面和本次进入的页面不是同一个说明是跳转页面
        perfData.page_launch_duration =
          pageEnd - (navigationStart ?? pageStart);
      }
    } else if (this.bootType === 'cold') {
      // 没有上次页面说明是冷启动
      perfData.page_launch_duration = pageEnd - appLaunch;
      // 如果标记是app首屏页面加载的冷启动，添加app的冷启动标识和冷启动整体加载时长
      perfData.reboot_duration = pageEnd - appStartTime;
      perfData.reboot_mode = 'cold';
      // 如果本次标记了冷启动耗时，则标记后续的小程序启动都是热启动
      this.bootType = 'warm';
    }
    forEach(perfData, (v, k) => {
      if ([null, 'null', NaN, 'NaN'].includes(v)) {
        unset(perfData, k);
      }
    });
    if (perfData.reboot_mode && !has(perfData, 'reboot_duration')) {
      unset(perfData, 'reboot_mode');
    }
    this.appPerf = {};
    this.pagePerf[path] = {};
    // 过滤没有性能信息和没有页面加载时长的性能数据
    if (keys(perfData).length <= 2 || !has(perfData, 'page_launch_duration')) {
      return false;
    }
    this.buildMonitorEvent(perfData, {
      timestamp: +Date.now(),
      path: currentPage.getPagePath(),
      query: currentPage.getPageQuery(),
      title: perfData.title
    });
  };
}
