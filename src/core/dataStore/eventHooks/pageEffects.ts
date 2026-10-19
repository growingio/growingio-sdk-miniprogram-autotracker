import { get, has, isEmpty, isFunction } from '@@/utils/glodash';
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
      page?.route ||
      page?.uri ||
      page?.__route__ ||
      page?.$page?.fullPath ||
      '';
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
        updateOriginalSourceTitle,
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
    // 生命周期回调中的 page 才是这次事件的权威页面。统一解析器会兼容各平台路由字段，
    // 不再像旧逻辑那样给宿主对象补写 route，也不会在页面栈尚未更新时误用上一页。
    const path = currentPage.getPagePath(page);
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
        // 获取一次页面参数存起来，防止支付宝等平台离开 onLoad 后无法再取得 query。
        // 使用第一个非空来源而不是普通的 ||/??：空 options 不能遮挡后面的有效参数。
        // 保存副本后再删除 SDK 内部参数，不能直接修改框架传入的 options/query 对象。
        const queryOptions = [
          get(page, 'options'),
          get(page, '__displayReporter.query'),
          get(page, '$page.query'),
          get(page, '$wx.__displayReporter.query'),
          get(page, '$taroParams'),
          args[0]
        ].find((params) => !isEmpty(params));
        currentPage.setPageQuery(page, queryOptions || {}, path);
        break;
      }
      case pageListeners.pageShow: {
        trackersExecute((trackingId: string) => {
          // 沿用 master4.0：onShow 采集前只更新未消费的来源缓存，
          // 不修改已经创建、转换或进入请求队列的 VISIT。
          const originalSource = getOriginalSource(trackingId);
          if (!isEmpty(originalSource) && originalSource.path === path) {
            updateOriginalSourceTitle(
              trackingId,
              path,
              currentPage.getPageTitle()
            );
          }
          // 发page事件
          const { trackPage } = getTrackerVds(trackingId);
          if (trackPage) {
            this.buildPageEvent(trackingId, undefined, page);
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
   * @param {any} [page] - 触发生命周期的页面实例
   */
  buildPageEvent = (trackingId: string, props?: any, page?: any) => {
    const {
      dataStore: {
        eventContextBuilder,
        eventInterceptor,
        eventHooks: { currentPage }
      }
    } = this.growingIO;
    // 自动 PAGE 传入真实生命周期 page；手动 PAGE 可以覆盖 path/query/title。
    // 如果手动指定了新 path 却没提供 query，明确使用空 query，不能沿用当前页面参数。
    const pageContextOptions: any = { page, resolveTitle: false };
    if (!isEmpty(props)) {
      if (has(props, 'path')) {
        pageContextOptions.path = props.path;
        pageContextOptions.query = has(props, 'query') ? props.query : '';
      } else if (has(props, 'query')) {
        pageContextOptions.query = props.query;
      }
    }
    const pageContext = currentPage.getPageContext(
      trackingId,
      pageContextOptions
    );
    // PAGE 的位置来自触发生命周期或手动指定的页面；标题沿用既有实时取值。
    // 进入拦截队列后，释放时仍按 master4.0 重读标题。
    const event = {
      eventType: 'PAGE',
      referralPage: currentPage.getReferralPage(trackingId),
      ...eventContextBuilder(trackingId, undefined, true, pageContext)
    };
    // 合并页面属性
    event.attributes = currentPage.eventSetPageProps(trackingId, event);
    // 与 master4.0 一样，显式标题在通用字段过滤和属性求值后覆盖。
    if (!isEmpty(props) && props.title) {
      event.title = props.title;
    }
    eventInterceptor(event);
  };
}

export default PageEffects;
