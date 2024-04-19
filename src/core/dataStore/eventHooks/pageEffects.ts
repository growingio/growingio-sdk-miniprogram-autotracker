import { get, isEmpty, isFunction, unset } from '@@/utils/glodash';
import { GrowingIOType } from '@@/types/growingIO';
import { niceTry } from '@@/utils/tools';
import { PageHookLifeCircle } from '@@/types/eventHooks';
import EMIT_MSG from '@@/constants/emitMsg';

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
        getTrackerVds,
        trackersExecute,
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
    if (!page.route) {
      page.route = minipInstance.getCurrentPath(page);
    }
    const path =
      page.route || page.uri || page.__route__ || page?.$page?.fullPath || '';
    emitter.emit(EMIT_MSG.MINIP_LIFECYCLE, {
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
    emitter.emit(EMIT_MSG.ON_COMPOSE_BEFORE, {
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
          currentPage.parsePage(page, this.argQuery[path]);
          if (!currentPage.path) {
            // 插件中没有页面时直接将插件appId作为页面信息
            currentPage.path = `/插件${vdsConfig.appId}}`;
            currentPage.title = `/插件${vdsConfig.appId}}`;
          }
          trackersExecute((trackingId: string) => {
            const { trackPage } = getTrackerVds(trackingId);
            if (trackPage) {
              this.buildPageEvent(trackingId);
            }
          });
        } else if (!shareOut || !eventHooks.currentPage.time) {
          // 不是因为分享切出再返回的onshow（视为第一次进入改页面）和切出去以后因为超时或者进入的场景值不一致时（会在appshow清掉页面时间），发page
          currentPage.parsePage(page, this.argQuery[path]);
          // 超时进入页面时前后path一致parsePage方法不会重置页面时间，可能会没有值，所以要补充重设一次
          eventHooks.currentPage.time = Date.now();
          trackersExecute((trackingId: string) => {
            const { trackPage } = getTrackerVds(trackingId);
            if (trackPage) {
              this.buildPageEvent(trackingId);
            }
          });
        }
        // 分享标记置为false
        toggleShareOut(false);
        break;
      }
      case pageListeners.pageHide:
      case pageListeners.pageUnload: {
        break;
      }
      case pageListeners.shareApp: {
        toggleShareOut(true);
        trackersExecute((trackingId: string) => {
          const { followShare } = getTrackerVds(trackingId);
          if (followShare) {
            buildAppMessageEvent(trackingId, args);
          }
        });
        break;
      }
      case pageListeners.shareTime: {
        trackersExecute((trackingId: string) => {
          const { followShare } = getTrackerVds(trackingId);
          if (followShare) {
            buildTimelineEvent(trackingId, args);
          }
        });
        break;
      }
      case pageListeners.addFavorites: {
        trackersExecute((trackingId: string) => {
          const { followShare } = getTrackerVds(trackingId);
          if (followShare) {
            buildAddFavorites(trackingId, args);
          }
        });
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
          buildTabClickEvent(this.growingIO.trackingId, args[0]);
        }
        break;
      }
      default:
        break;
    }
    // 页面销毁移除当前页面的属性
    if (event === pageListeners.pageUnload) {
      trackersExecute((trackingId: string) => {
        currentPage.pageProps[trackingId] = undefined;
      });
    }
  };

  // 构建页面访问事件
  buildPageEvent = (trackingId: string, props?: any) => {
    const {
      dataStore: {
        eventContextBuilder,
        eventInterceptor,
        eventHooks: { currentPage }
      },
      minipInstance
    } = this.growingIO;
    const event = {
      eventType: 'PAGE',
      referralPage: currentPage.getReferralPage(trackingId),
      ...eventContextBuilder(trackingId),
      // page事件要单独设一个title以覆盖eventContextBuilder中的lastPage的title错误值
      title:
        currentPage?.title ||
        minipInstance.getPageTitle(minipInstance.getCurrentPage()),
      timestamp: currentPage.time
    };
    // 传入参数生成的page事件取值为传入参数
    if (!isEmpty(props) && props.title) {
      event.title = props.title;
    }
    // 添加页面属性
    const pageProps = niceTry(() => currentPage.pageProps[trackingId]);
    if (!isEmpty(pageProps)) {
      event.attributes = pageProps;
      currentPage.pageProps[trackingId] = undefined;
    }
    eventInterceptor(event);
  };
}

export default PageEffects;
