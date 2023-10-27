import { AppHookLifeCircle } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import {
  isEmpty,
  isObject,
  typeOf,
  keys,
  forEach,
  has
} from '@@/utils/glodash';
import { qsStringify } from '@@/utils/tools';

class AppEffects {
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
      dataStore: { keepAlive, lastCloseTime, eventHooks, saveStorageInfo }
    }: GrowingIOType = this.growingIO;
    emitter.emit('minipLifecycle', {
      event: `App ${event}`,
      timestamp: eventTime,
      params: args[0] ?? {}
    });
    if (vdsConfig.debug) {
      console.log('App:', event, eventTime);
    }
    const appListeners = platformConfig.listeners.app;
    // 向插件广播事件
    emitter.emit('onComposeBefore', {
      event: `App ${event}`,
      params: args[0] ?? {}
    });
    switch (event) {
      // 快应用是执行onCreate
      case appListeners.appCreate:
      // 各小程序执行onShow
      case appListeners.appShow: {
        // 获取进入小程序的path、query和scene
        const { path, query } = this.enterParamsParse(args[0]);
        // 以下条件均会被认为是一次新的访问
        // 没有关闭时间说明是新访问
        if (!lastCloseTime) {
          // 保存进入小程序的参数
          this.growingIO.dataStore.lastVisitEvent = { path, query };
          this.buildVisitEvent({ path, query });
        } else if (
          // 两次打开间隔时间超过keepAlive设定(默认5分钟)
          Date.now() - lastCloseTime > keepAlive ||
          // 两次打开时的场景值不一样（即从不同的来源进入小程序）
          (dataStore.lastScene && dataStore.scene !== dataStore.lastScene)
        ) {
          // 重置sessionId
          userStore.sessionId = '';
          // 需要按自然逻辑发visit时，清掉pagetime，防止取值错误
          eventHooks.currentPage.time = undefined;
          this.buildVisitEvent({ path, query });
        }
        break;
      }
      case appListeners.appClose: {
        // 同步信息
        dataStore.lastScene = dataStore.scene;
        dataStore.lastCloseTime = Date.now();
        saveStorageInfo();
        userStore.saveUserInfo();
        this.buildCloseEvent();
        // forceLogin不生效时强制把请求队列中的事件全部发送
        if (!vdsConfig.forceLogin) {
          uploader.initiateRequest(true);
        }
        break;
      }
      default:
        break;
    }
  };

  // 进入小程序时的相关数据处理
  enterParamsParse = (args: any) => {
    const { gioPlatform, minipInstance, dataStore } = this.growingIO;
    let vPath = ''; // 进入小程序时的path
    let vQuery = ''; // 进入小程序时的参数（启动参数）
    const assignment = (p: string, q = {}) => {
      vPath = p;
      vQuery = keys(q)
        .map((k) => `${k}=${q[k]}`)
        .join('&');
    };
    // 支持getEnterOptionsSync
    if (
      gioPlatform !== 'quickapp' &&
      minipInstance.minip.canIUse('getEnterOptionsSync')
    ) {
      const { path, query, scene, referrerInfo } =
        minipInstance.minip.getEnterOptionsSync() || {};
      const originQuery = args.query || query;
      assignment(args.path || path, originQuery);
      dataStore.scene = args.scene || scene;
      // extraData字段计入query
      if (!isEmpty(referrerInfo) && isObject(referrerInfo?.extraData)) {
        let extraQuery = [];
        forEach(referrerInfo.extraData, (v, k) => {
          if (
            // 与原始query中的key冲突时，以原始query为准
            !has(originQuery, k) &&
            // 只处理字符串、数字和布尔类型的值
            ['string', 'number', 'boolean'].includes(typeOf(v))
          ) {
            extraQuery.push(`${k}=${v}`);
          }
        });
        const extraQueryString = extraQuery.join('&');
        vQuery =
          vQuery && extraQueryString
            ? `${vQuery}&${extraQueryString}`
            : vQuery || extraQueryString;
      }
    } else {
      // 不支持的按老逻辑兜底
      const { path, query } = args;
      assignment(path, query);
      this.parseScene(args);
    }
    return { path: vPath, query: vQuery };
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
  buildVisitEvent = (params: any) => {
    const { dataStore } = this.growingIO;
    const { eventContextBuilder, eventInterceptor } = dataStore;
    // 生命周期中调用构建使用参数赋值，补发场景调用构建使用上一次的值
    const query = params?.query || params?.q || '';
    const event = {
      eventType: 'VISIT',
      ...eventContextBuilder({
        // params.path是生命周期值或者是已有的cdp值，params.p是已有的saas值
        path: params?.path || params?.p || '',
        // params.query是对象说明是生命周期调用，否则是补发调用
        query: typeOf(query) === 'string' ? query : qsStringify(query)
      })
    };
    eventInterceptor(event);
  };

  // 构建关闭事件
  buildCloseEvent = () => {
    const {
      dataStore: { eventContextBuilder, eventInterceptor }
    } = this.growingIO;
    const event = {
      eventType: 'APP_CLOSED',
      ...eventContextBuilder()
    };
    eventInterceptor(event);
  };
}

export default AppEffects;
