import { AppHookLifeCircle } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import { isEmpty, typeOf, unset } from '@@/utils/glodash';
import { getPureParams, qsStringify } from '@@/utils/tools';
import EMIT_MSG from '@@/constants/emitMsg';

class AppEffects {
  public enterParams: any = {};
  constructor(public growingIO: GrowingIOType) {}

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
        setOriginalSource
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
        const { path, query, referralPage } = this.enterParamsParse(args[0]);
        if (!shareOut && vdsConfig.originalSource) {
          // 个别（说的就是你：淘宝）小程序场景值不一样后台拉起时可能args中会没有path和query
          if (path) {
            // 保存初始来源信息
            trackersExecute((trackingId: string) => {
              setOriginalSource(trackingId, { path, query, referralPage });
            });
          }
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
        } else if (
          // 两次打开间隔时间超过keepAlive设定(默认5分钟)
          Date.now() - lastCloseTime > vdsConfig.keepAlive * 60 * 1000 ||
          // 两次打开时的场景值不一样（即从不同的来源进入小程序）
          (dataStore.lastScene && dataStore.scene !== dataStore.lastScene)
        ) {
          // 重置sessionId
          trackersExecute((trackingId: string) => {
            userStore.setSessionId(trackingId);
          });
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

  // 进入小程序时的相关数据处理
  enterParamsParse = (args: any = {}) => {
    const { gioPlatform, minipInstance, dataStore } = this.growingIO;
    let rPath = ''; // 进入小程序时的path
    let rQuery = ''; // 进入小程序时的参数（启动参数）
    let rAppId = ''; // scene=1037或1038时来源小程序、公众号或 App 的 appId
    // 支持getEnterOptionsSync
    if (
      gioPlatform !== 'quickapp' &&
      minipInstance.minip.canIUse('getEnterOptionsSync')
    ) {
      const enterOptions = minipInstance.minip.getEnterOptionsSync() || {};
      const { path, query, scene } = enterOptions;
      const referrerInfo =
        enterOptions.referrerInfo || enterOptions.refererInfo; // tt里取值是refererInfo
      rPath = path || args.path;
      rQuery = query || args.query;
      rAppId = referrerInfo?.appId || args?.referrerInfo?.appId || '';
      dataStore.scene = scene || args.scene;
      // 移除某些小程序圈选时我们带入的圈选地址参数
      unset(query, 'gdpCircleRoomCollectUrl');
      // 来源有额外参数时并入页面参数
      rQuery = qsStringify(
        getPureParams(rQuery, referrerInfo?.extraData || {})
      );
    } else {
      // 不支持的按老逻辑兜底
      const { path, query, referrerInfo } = args;
      rPath = path;
      rQuery = qsStringify(query);
      rAppId = referrerInfo?.appId || '';
      this.parseScene(args);
    }
    return { path: rPath, query: rQuery, referralPage: rAppId };
  };

  // 获取来源场景值
  /**
   * wx：https://developers.weixin.qq.com/miniprogram/dev/reference/scene-list.html
   * alipay：https://opendocs.alipay.com/mini/framework/scene
   * swan：https://smartprogram.baidu.com/docs/data/host_scene/
   * tt：https://microapp.bytedance.com/docs/zh-CN/mini-app/develop/framework/scene-value/
   * qq：https://q.qq.com/wiki/develop/game/frame/scene/
   * quickapp：https://doc.quickapp.cn/features/system/app.html?h=%E6%9D%A5%E6%BA%90
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

  // 构建访问事件
  buildVisitEvent = (trackingId: string, props?: any) => {
    const {
      dataStore: { getOriginalSource, eventContextBuilder, eventInterceptor },
      vdsConfig
    } = this.growingIO;
    const originalSource = getOriginalSource(trackingId);
    // 生命周期中调用构建使用参数赋值，补发场景调用构建使用上一次的值
    const query = props?.query || '';
    let event = {
      eventType: 'VISIT',
      ...eventContextBuilder(trackingId, {})
    };
    if (!isEmpty(props) && props.path) {
      // props.path是生命周期值或者是已有的值
      event.path = props.path || '';
      // props.query是对象说明是生命周期调用，否则是补发调用
      event.query = typeOf(query) === 'string' ? query : qsStringify(query);
      // 如果有来源
      if (props.referralPage) {
        event.referralPage = props.referralPage;
      }
    }
    // 配置使用初始来源时，visit使用初始来源数据
    if (vdsConfig.originalSource && !isEmpty(originalSource)) {
      event = { ...event, ...originalSource };
    }
    eventInterceptor(event);
  };

  // 构建关闭事件
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
