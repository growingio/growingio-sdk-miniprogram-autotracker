import { get, isEmpty, isFunction, unset } from '@@/utils/glodash';
import { GrowingIOType } from '@@/types/growingIO';
import { PageHookLifeCircle } from '@@/types/eventHooks';
import EMIT_MSG from '@@/constants/emitMsg';

class PageEffects {
  public buildTabClickEvent: (tabItem: any) => void;
  private prevEvent: any;
  constructor(public growingIO: GrowingIOType) {
    this.prevEvent = {};
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
        getOriginalSource,
        setOriginalSource,
        trackersExecute,
        eventHooks,
        toggleShareOut,
        buildAppMessageEvent,
        buildTimelineEvent,
        buildAddFavorites
      }
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
        // 获取一次页面参数存起来，防止类似支付宝小程序只能通过生命周期获取页面参数或页面堆栈拿不到页面参数，做兜底
        currentPage.queryOption[path] =
          get(page, 'options') ||
          get(page, '__displayReporter.query') ||
          get(page, '$page.query') ||
          get(page, '$wx.__displayReporter.query') ||
          get(page, '$taroParams') ||
          args[0] ||
          {};
        unset(currentPage.queryOption[path], '$taroTimestamp');
        break;
      }
      case pageListeners.pageShow: {
        trackersExecute((trackingId: string) => {
          // 检查originalSource内容是否已经被消费，如果没有被消费是同一个页面，说明visit还没被发出去，要更新title
          const originalSource = getOriginalSource(trackingId);
          if (!isEmpty(originalSource) && originalSource.path === path) {
            setOriginalSource(trackingId, {
              ...originalSource,
              title: currentPage.getPageTitle()
            });
          }
          // 发page事件
          const { trackPage } = getTrackerVds(trackingId);
          if (trackPage) {
            this.buildPageEvent(trackingId);
          }
        });
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
    currentPage.lastLifecycle = currentPage.currentLifecycle;
    currentPage.currentLifecycle = `${event}End`;
    if (['onHideEnd', 'onUnloadEnd'].includes(currentPage.currentLifecycle)) {
      currentPage.lifeBeforeShow = true;
    }
    if (currentPage.currentLifecycle === 'onShowEnd') {
      currentPage.lifeBeforeShow = false;
    }
  };

  // 构建页面访问事件
  buildPageEvent = (trackingId: string, props?: any) => {
    const {
      dataStore: {
        eventContextBuilder,
        eventInterceptor,
        eventHooks: { currentPage }
      }
    } = this.growingIO;
    const event = {
      eventType: 'PAGE',
      referralPage: currentPage.getReferralPage(trackingId),
      ...eventContextBuilder(trackingId)
    };
    // 合并页面属性
    event.attributes = currentPage.eventSetPageProps(trackingId, event);
    // 传入参数生成的page事件取值为传入参数
    if (!isEmpty(props) && props.title) {
      event.title = props.title;
    }
    eventInterceptor(event);
  };
}

export default PageEffects;
