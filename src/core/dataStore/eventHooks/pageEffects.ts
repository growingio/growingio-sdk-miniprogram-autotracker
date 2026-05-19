import { get, isEmpty, isFunction, unset } from '@@/utils/glodash';
import { GrowingIOType } from '@@/types/growingIO';
import { PageHookLifeCircle } from '@@/types/eventHooks';
import EMIT_MSG from '@@/constants/emitMsg';

class PageEffects {
  public buildTabClickEvent: (tabItem: any) => void;
  private prevEvent: Record<string, number>;
  private prevEventByPage: WeakMap<object, Record<string, number>>;
  constructor(public growingIO: GrowingIOType) {
    this.prevEvent = {};
    this.prevEventByPage = new WeakMap();
  }

  /**
   * 获取某个页面实例专属的去重桶
   * @param {any} page - 页面实例
   * @returns {Record<string, number> | null} - 当前页面对应的生命周期时间戳缓存
   */
  private getPrevEventBucket = (page: any) => {
    if (!page || typeof page !== 'object') {
      return null;
    }
    // 旧逻辑只按 onLoad/onShow 这类事件名去重，两个页面只要在 50ms 内连续触发同名生命周期，
    // 后一个页面的事件就会被前一个页面“误伤”掉。
    // 这里改成按页面实例分桶，优先保证“同一个页面的重复注入”被压掉，而不是全局粗暴去重。
    const cached = this.prevEventByPage.get(page);
    if (cached) return cached;
    const bucket: Record<string, number> = {};
    this.prevEventByPage.set(page, bucket);
    return bucket;
  };

  /**
   * 记录生命周期最近一次触发时间
   * @param {any} page - 页面实例
   * @param {PageHookLifeCircle} event - 生命周期事件名
   * @param {number} timestamp - 事件触发时间
   */
  private setPrevEventTime = (
    page: any,
    event: PageHookLifeCircle,
    timestamp: number
  ) => {
    const bucket = this.getPrevEventBucket(page);
    if (bucket) {
      bucket[event] = timestamp;
      return;
    }
    // 极少数情况下拿不到稳定页面实例，这时再退回到 event + path 的弱去重兜底，
    // 继续保留原先“防重复注入”的能力，但把误伤范围控制在同一路径内。
    const path =
      page?.route || page?.uri || page?.__route__ || page?.$page?.fullPath || '';
    this.prevEvent[`${event}:${path}`] = timestamp;
  };

  /**
   * Page 生命周期处理主函数
   * @param {any} page - 页面实例
   * @param {string} event - 生命周期事件名
   * @param {any} args - 参数
   */
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
    if (!page) {
      page = minipInstance.getCurrentPage();
    }
    if (!page.route) {
      page.route = minipInstance.getCurrentPath(page);
    }
    const path =
      page.route || page.uri || page.__route__ || page?.$page?.fullPath || '';
    const dedupeKey = `${event}:${path}`;
    const bucket = this.getPrevEventBucket(page);
    const prevEventTime = bucket ? bucket[event] : this.prevEvent[dedupeKey];
    if (
      // 防止重写页面后可能出现重复的事件，但不要让不同页面实例互相吞事件
      prevEventTime &&
      eventTime - Number(prevEventTime) < 50
    ) {
      return false;
    }
    emitter.emit(EMIT_MSG.MINIP_LIFECYCLE, {
      event: `Page ${event}`,
      timestamp: eventTime,
      params: { page, args: args[0] }
    });
    if (vdsConfig.debug) {
      console.log('Page:', path, '#', event, eventTime);
    }
    this.setPrevEventTime(page, event, eventTime);
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
        currentPage.queryOptions[path] =
          get(page, 'options') ||
          get(page, '__displayReporter.query') ||
          get(page, '$page.query') ||
          get(page, '$wx.__displayReporter.query') ||
          get(page, '$taroParams') ||
          args[0] ||
          {};
        unset(currentPage.queryOptions[path], [
          '$taroTimestamp',
          'gdpCircleRoomCollectUrl'
        ]);
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
      case pageListeners.shareChat: // 小红书特有事件
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
        if (minipInstance.platform === 'xhsp') {
          toggleShareOut(true);
        }
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
    return true;
  };

  /**
   * 构建页面访问事件
   * @param {string} trackingId - 实例 ID
   * @param {any} [props] - 属性
   */
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
