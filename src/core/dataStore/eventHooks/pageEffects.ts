import { get, isEmpty, isFunction, unset } from '@@/utils/glodash';
import { GrowingIOType } from '@@/types/growingIO';
import { PageHookLifeCircle } from '@@/types/eventHooks';

class PageEffects {
  public buildTabClickEvent: (tabItem: any) => void;
  private prevEvent: any;
  private argQuery: any;
  constructor(public growingIO: GrowingIOType) {
    this.prevEvent = {};
    this.argQuery = {};
  }

  main = (page: any, event: PageHookLifeCircle, args: any) => {
    const eventTime = Date.now();
    const {
      emitter,
      minipInstance,
      plugins,
      vdsConfig,
      platformConfig,
      dataStore: {
        shareOut,
        eventHooks,
        toggleShareOut,
        buildAppMessageEvent,
        buildTimelineEvent,
        buildAddFavorites
      },
      inPlugin
    }: GrowingIOType = this.growingIO;
    const { currentPage } = eventHooks;
    if (
      // 防止重写页面后可能出现重复的事件
      this.prevEvent[event] &&
      Date.now() - Number(this.prevEvent[event]) < 50
    ) {
      return;
    }
    if (!page) {
      page = minipInstance.getCurrentPage();
    }
    if (vdsConfig.wepy) {
      page.route = page.$is;
    }
    if (!page.route) {
      page.route = minipInstance.getCurrentPath(page);
    }
    const path =
      page.route || page.uri || page.__route__ || page?.$page?.fullPath || '';
    emitter.emit('minipLifecycle', {
      event: `Page ${event}`,
      timestamp: eventTime,
      params: { page, args: args[0] }
    });
    if (vdsConfig.debug) {
      console.log('Page:', path, '#', event, eventTime);
    }
    this.prevEvent[event] = Date.now();
    const pageListeners = platformConfig.listeners.page;
    // 向插件广播事件
    emitter.emit('onComposeBefore', {
      page,
      event: `Page ${event}`,
      params: { page, args: args[0] }
    });
    currentPage.lastLifecycle = currentPage.currentLifecycle;
    currentPage.currentLifecycle = event;
    switch (event) {
      case pageListeners.pageLoad: {
        this.argQuery[path] =
          get(page, 'options') ||
          get(page, '__displayReporter.query') ||
          get(page, '$page.query') ||
          get(page, '$wx.__displayReporter.query') ||
          args[0] ||
          {};
        unset(this.argQuery[path], '$taroTimestamp');
        currentPage.parsePage(page, this.argQuery[path]);
        break;
      }
      case pageListeners.pageShow: {
        if (inPlugin) {
          // 插件中没有页面实例，获取不到path，就不发page事件了
          break;
        }
        // 不是因为分享切出再返回的onshow（视为第一次进入改页面）和切出去以后因为超时或者进入的场景值不一致时（会在appshow清掉页面时间），发page
        if (!shareOut || !eventHooks.currentPage.time) {
          currentPage.parsePage(page, this.argQuery[path]);
          // 超时进入页面时前后path一致parsePage方法不会重置页面时间，可能会没有值，所以要补充重设一次
          eventHooks.currentPage.time = Date.now();
          this.buildPageEvent();
        }
        // 分享标记置为false
        toggleShareOut(false);
        // 保存分享id（记录是从哪个用户id的分享来的）
        currentPage.saveShareId(this.argQuery[path]);
        break;
      }
      case pageListeners.pageHide:
      case pageListeners.pageUnload: {
        break;
      }
      case pageListeners.shareApp: {
        toggleShareOut(true);
        if (vdsConfig.followShare) {
          buildAppMessageEvent(args);
        }
        break;
      }
      case pageListeners.shareTime: {
        if (vdsConfig.followShare) {
          buildTimelineEvent(args);
        }
        break;
      }
      case pageListeners.addFavorites: {
        buildAddFavorites(args);
        break;
      }
      case pageListeners.tabTap: {
        const buildTabClickEvent =
          plugins?.gioEventAutoTracking?.buildTabClickEvent;
        if (
          vdsConfig.autotrack &&
          buildTabClickEvent &&
          isFunction(buildTabClickEvent)
        ) {
          buildTabClickEvent(args[0]);
        }
        break;
      }
      default:
        break;
    }
    // 页面销毁移除当前页面的属性
    if (event === pageListeners.pageUnload) {
      currentPage.pageProps[path] = undefined;
    }
  };

  // 构建页面访问事件
  buildPageEvent = () => {
    const {
      minipInstance,
      dataStore: {
        scene,
        lastPageEvent,
        eventContextBuilder,
        eventInterceptor,
        eventHooks
      }
    } = this.growingIO;
    const { currentPage } = eventHooks;
    const event = {
      eventType: 'PAGE',
      referralPage:
        lastPageEvent?.path ||
        lastPageEvent?.p ||
        (scene ? `scn:${minipInstance.scnPrefix}${scene}` : null),
      ...eventContextBuilder(),
      timestamp: currentPage.time
    };
    // 添加页面属性
    if (!isEmpty(currentPage.pageProps[event.path])) {
      event.attributes = currentPage.pageProps[event.path];
    }
    eventInterceptor(event);
  };
}

export default PageEffects;
