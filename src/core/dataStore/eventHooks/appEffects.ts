import { AppHookLifeCircle } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import { isEmpty } from '@@/utils/glodash';
import { getPureParams, niceTry, qsStringify } from '@@/utils/tools';
import EMIT_MSG from '@@/constants/emitMsg';

class AppEffects {
  // 最近一次 App 入口的位置；originalSource 单独保留本次 VISIT 的首次来源。
  public enterParams: any = {};
  // 仅在 App 热进入切换会话的同步调用期间提供权威入口，避免补发 VISIT 读旧页面栈。
  public sessionEntry?: { path: string; query: string; referralPage: string };
  // 同步入口或生命周期参数携带的来源附加参数，用于识别入口页的完整 VISIT query。
  public entryExtraData: any = {};
  private parsedEntryExtraData: any = {};
  constructor(public growingIO: GrowingIOType) {}

  /**
   * App 生命周期处理主函数
   * @param {string} event - 生命周期事件名
   * @param {any} args - 参数
   */
  main = (event: AppHookLifeCircle, args: any) => {
    const eventTime = Date.now();
    const {
      emitter,
      userStore,
      vdsConfig,
      platformConfig,
      uploader,
      dataStore,
      minipInstance,
      dataStore: {
        trackersExecute,
        shareOut,
        lastCloseTime,
        saveStorageInfo,
        setOriginalSource,
        removeOriginalSource
      }
    }: GrowingIOType = this.growingIO;
    emitter.emit(EMIT_MSG.MINIP_LIFECYCLE, {
      event: `App ${event}`,
      timestamp: eventTime,
      params: args[0] ?? {}
    });
    if (vdsConfig.debug) {
      console.log('App:', event, eventTime);
    }
    const appListeners = platformConfig.listeners.app;
    // 向插件广播事件
    emitter.emit(EMIT_MSG.ON_COMPOSE_BEFORE, {
      event: `App ${event}`,
      params: args[0] ?? {}
    });
    switch (event) {
      case appListeners.appLaunch:
        // 在launch先获取一次是防止在此生命周期中发埋点或调用其他api时获取不到path和query
        this.enterParams = { ...args[0] };
        break;
      // 快应用是执行onCreate
      case appListeners.appCreate:
      // 各小程序执行onShow
      case appListeners.appShow: {
        // 获取进入小程序的path、query和scene
        const entry = this.enterParamsParse(args[0]);
        const { path, query, referralPage } = entry;
        // 外部 autoReLaunch 后，onLaunch/getLaunchOptionsSync 仍可能属于旧首页。
        // 在更新 session（可能同步补发事件）之前保存本次解析结果，供页面尚未
        // 建立时的通用上下文降级使用；query 已净化并合并同步入口的 extraData。
        this.enterParams = {
          path,
          query,
          scene: dataStore.scene,
          referrerInfo: { appId: referralPage }
        };
        // originalSource 表示“本次访问的入口”，不能把每次回到前台都当成新入口。
        // 必须先按 VISIT 的真实判定条件算出访问边界，再决定是否新建或替换来源；
        // 否则 dataCollect=false 时，同一访问内的一次普通前后台切换就会覆盖首次入口。
        const startsNewVisit =
          !lastCloseTime ||
          eventTime - lastCloseTime > vdsConfig.keepAlive * 60 * 1000 ||
          !!(dataStore.lastScene && dataStore.scene !== dataStore.lastScene);
        if (startsNewVisit) {
          // 普通回前台不会替换尚未消费的首次入口，附加参数也必须保留同一访问的快照。
          this.entryExtraData = this.parsedEntryExtraData;
          trackersExecute((trackingId: string) => {
            if (!shareOut && vdsConfig.originalSource && path) {
              // 新访问且入口有效时，原子地替换 path/query/referralPage 这一组来源。
              setOriginalSource(trackingId, { path, query, referralPage });
            } else {
              // 淘宝等平台在个别后台拉起场景中可能不给 path。此时宁可让 VISIT 使用
              // 当前页/历史页兜底，也不能让上一次访问遗留的持久化来源覆盖本次事件。
              // 分享返回的入口不代表新的外部来源，也必须清掉上一访问的临时来源；
              // originalSource 关闭时同样清理旧版本遗留，避免以后重新开启后复活旧值。
              removeOriginalSource(trackingId);
            }
          });
        }
        // 以下条件均会被认为是一次新的访问
        // 没有关闭时间说明是新访问
        if (!lastCloseTime) {
          trackersExecute((trackingId: string) => {
            dataStore.lastVisitEvent[trackingId] = {
              path,
              query,
              referralPage
            };
            this.buildVisitEvent(trackingId, { path, query, referralPage });
          });
        } else if (startsNewVisit) {
          // 重置sessionId
          const previousEntry = this.sessionEntry;
          this.sessionEntry = path ? entry : undefined;
          try {
            trackersExecute((trackingId: string) => {
              userStore.setSessionId(trackingId);
            });
          } finally {
            this.sessionEntry = previousEntry;
          }
        }
        // 添加网络状态变更监听
        minipInstance.setNetworkStatusListener();
        break;
      }
      case appListeners.appClose: {
        // 同步信息
        dataStore.lastScene = dataStore.scene;
        dataStore.lastCloseTime = Date.now();
        saveStorageInfo();
        userStore.saveUserInfo();
        trackersExecute((trackingId: string) => {
          this.buildCloseEvent(trackingId);
          // forceLogin不生效时强制把请求队列中的事件全部发送
          if (!vdsConfig.forceLogin) {
            uploader.initiateRequest(trackingId, true);
          }
        });

        break;
      }
      default:
        break;
    }
  };

  /**
   * 进入小程序时的相关数据处理
   * @param {any} [args={}] - 参数
   * @returns {object} - 处理后的参数
   */
  enterParamsParse = (args: any = {}) => {
    const { gioPlatform, minipInstance, dataStore } = this.growingIO;
    let rPath = ''; // 进入小程序时的path
    let rQuery = ''; // 进入小程序时的参数（启动参数）
    let rAppId = ''; // scene=1037或1038时来源小程序、公众号或 App 的 appId
    // 支持getEnterOptionsSync
    const canIUse = minipInstance.minip?.canIUse;
    const getEnterOptionsSync = minipInstance.minip?.getEnterOptionsSync;
    if (
      gioPlatform !== 'quickapp' &&
      typeof canIUse === 'function' &&
      typeof getEnterOptionsSync === 'function' &&
      niceTry(() => canIUse.call(minipInstance.minip, 'getEnterOptionsSync'))
    ) {
      // 部分低版本平台会声明 canIUse 却在实际调用时抛错。启动参数只是增强信息，
      // 必须退回生命周期 args，而不能让 SDK 在业务 App.onShow 前中断。
      const enterOptions =
        niceTry(() => getEnterOptionsSync.call(minipInstance.minip)) || {};
      const { path, query, scene } = enterOptions;
      // 同步 API 在部分框架中会返回空 query/referrerInfo，而 onShow 参数仍然有值。
      // 这里按“第一个非空来源”选择，既保留同步 API 的优先级，也让真正的空对象继续兜底。
      const referrerInfo = [
        enterOptions.referrerInfo,
        enterOptions.refererInfo, // tt里取值是refererInfo
        args.referrerInfo,
        args.refererInfo
      ].find((info) => !isEmpty(info));
      this.parsedEntryExtraData = getPureParams({}, referrerInfo?.extraData);
      rPath = path || args.path;
      rQuery = !isEmpty(query) ? query : args.query;
      rAppId = referrerInfo?.appId || args?.referrerInfo?.appId || '';
      dataStore.scene = scene || args.scene;
      // getPureParams 会在副本中统一过滤圈选、Taro 等 SDK 内部参数，不能直接 unset
      // 平台返回的 query；部分运行时会复用该对象，原地删除会污染宿主后续读取结果。
      rQuery = qsStringify(
        getPureParams(rQuery, referrerInfo?.extraData || {})
      );
    } else {
      // 不支持的按老逻辑兜底
      const { path, query } = args;
      const referrerInfo = args.referrerInfo || args.refererInfo;
      this.parsedEntryExtraData = getPureParams({}, referrerInfo?.extraData);
      rPath = path;
      // 不支持 getEnterOptionsSync 的平台也必须走同一套净化和 extraData 合并规则，
      // 否则 originalSource.query 会随平台能力不同而出现脏字段或缺失来源参数。
      rQuery = qsStringify(getPureParams(query, referrerInfo?.extraData || {}));
      rAppId = referrerInfo?.appId || '';
      this.parseScene(args);
    }
    return { path: rPath, query: rQuery, referralPage: rAppId };
  };

  /**
   * 获取来源场景值
   * wx：https://developers.weixin.qq.com/miniprogram/dev/reference/scene-list.html
   * alipay：https://opendocs.alipay.com/mini/framework/scene
   * swan：https://smartprogram.baidu.com/docs/data/host_scene/
   * tt：https://microapp.bytedance.com/docs/zh-CN/mini-app/develop/framework/scene-value/
   * qq：https://q.qq.com/wiki/develop/game/frame/scene/
   * quickapp：https://doc.quickapp.cn/features/system/app.html?h=%E6%9D%A5%E6%BA%90
   * @param {any} args - 参数
   */
  parseScene = (args) => {
    const { minipInstance, gioPlatform, dataStore } = this.growingIO;
    let newScene;
    // 快应用处理逻辑
    if (gioPlatform === 'quickapp') {
      const { extra, type } = minipInstance.getAppSource();
      newScene = extra?.scene || type;
    } else if (!isEmpty(args)) {
      if (args?.query?.wxShoppingListScene) {
        newScene = args.query.wxShoppingListScene;
      } else if (args?.scene) {
        newScene = args.scene;
      } else {
        dataStore.scene = 'NA';
      }
    }
    dataStore.scene = newScene;
  };

  /**
   * 构建访问事件
   * @param {string} trackingId - 实例 ID
   * @param {any} [props] - 属性
   */
  buildVisitEvent = (trackingId: string, props?: any) => {
    const {
      dataStore: {
        getOriginalSource,
        eventContextBuilder,
        eventInterceptor,
        eventHooks: { currentPage }
      },
      vdsConfig
    } = this.growingIO;
    const originalSource = getOriginalSource(trackingId);
    // App.onShow/getEnterOptionsSync 提供的是本次访问入口，可能早于新页面压栈；
    // 因此 VISIT 不能先读页面栈再覆盖字段，而要把入口 path/query 作为一组显式上下文。
    // Session 补发等没有 props 的场景，才使用统一解析器的当前页/历史页降级结果。
    const query = props?.query || '';
    const hasEntryPage = !isEmpty(props) && props.path;
    const pageContext = currentPage.getPageContext(
      trackingId,
      hasEntryPage
        ? {
            path: props.path,
            query,
            resolveTitle: false
          }
        : { resolveTitle: false }
    );
    let event = {
      eventType: 'VISIT',
      ...eventContextBuilder(trackingId, {}, true, pageContext)
    };
    if (hasEntryPage) {
      // 如果有来源
      if (props.referralPage) {
        event.referralPage = props.referralPage;
      }
    }
    // originalSource 是既有业务规则，优先级高于本次入口快照；这里保持原行为，
    // 但覆盖时仍然整组使用已经保存的 VISIT 来源数据。
    if (vdsConfig.originalSource && !isEmpty(originalSource)) {
      event = { ...event, ...originalSource };
    }
    eventInterceptor(event);
  };

  /**
   * 构建关闭事件
   * @param {string} trackingId - 实例 ID
   */
  buildCloseEvent = (trackingId: string) => {
    const {
      dataStore: { eventContextBuilder, eventInterceptor }
    } = this.growingIO;
    const event = {
      eventType: 'APP_CLOSED',
      ...eventContextBuilder(trackingId)
    };
    eventInterceptor(event);
  };
}

export default AppEffects;
