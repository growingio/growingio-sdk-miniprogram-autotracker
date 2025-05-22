import { compact, has, isEmpty, keys, last, unset } from '@@/utils/glodash';
import { GrowingIOType } from '@@/types/growingIO';
import { MinipPageType, PageShareResult } from '@@/types/eventHooks';
import {
  qsStringify,
  normalPath,
  splitPath,
  qsParse,
  niceTry,
  getDynamicAttributes,
  limitObject,
  getLaunchQuery
} from '@@/utils/tools';
import { EVENT } from '@@/types/base';

class MinipPage implements MinipPageType {
  // 根据页面存储的页面参数
  public queryOptions: any;
  // 通过调用wx.setNavigationBarTitle设置的title
  public configuredTitle: any;
  // 页面级属性
  public pageProps: any;
  // 上一个执行的小程序生命周期
  public lastLifecycle: string;
  // 当前执行的小程序生命周期
  public currentLifecycle: string;
  // 当前生命周期是否在页面显示前
  public lifeBeforeShow = true;

  constructor(public growingIO: GrowingIOType) {
    this.queryOptions = {};
    this.configuredTitle = {};
    this.pageProps = {};
  }

  /**
   * 获取当前页面路径
   * 优先级：页面堆栈路径 > 启动参数路径 > 最近 page 事件路径 > 最近 visit 事件路径
   * 插件环境下无页面时返回插件 appId
   */
  getPagePath = () => {
    const { minipInstance, inPlugin, dataStore, trackingId } = this.growingIO;
    const path = minipInstance.getCurrentPath();
    if (inPlugin) {
      const vds = dataStore.getTrackerVds(trackingId);
      // 插件中没有页面时直接将插件appId作为页面信息
      return path || `/插件${vds.appId}`;
    } else {
      return (
        path ||
        dataStore.eventHooks.appEffects.enterParams?.path ||
        // 作为页面组件时component created生命周期中的埋点会取不到页面堆栈，所以拿最近的一个page事件中的页面信息做兜底
        dataStore.lastPageEvent[trackingId]?.path ||
        // 没有最近的一个page事件说明在app初始化的生命周期中，有些框架可能会有异步处理逻辑导致事件触发比visit晚，则使用visit事件中的页面信息兜底
        dataStore.lastVisitEvent[trackingId]?.path
      );
    }
  };

  /**
   * 获取当前页面参数（query）
   * 优先级：页面堆栈参数 > 生命周期参数 > 启动参数 > 最近 page 事件参数 > 最近 visit 事件参数
   */
  getPageQuery = () => {
    const { minipInstance, dataStore, trackingId } = this.growingIO;
    const stackPage = minipInstance.getCurrentPage();
    const stackPath = minipInstance.getCurrentPath();
    const { enterParams = {} } = dataStore.eventHooks.appEffects;
    if (stackPath) {
      const pageParams = stackPage.options ?? stackPage.$taroParams;
      // 堆栈中有页面信息，则使用堆栈中的页面参数
      if (!isEmpty(pageParams)) {
        // 删掉 taro 框架中自带的字段，删除圈选可能带进来的参数
        unset(pageParams, ['$taroTimestamp', 'gdpCircleRoomCollectUrl']);
        // 有页面解析的 option 直接取
        return this.qsQuery(pageParams);
      } else if (!isEmpty(this.queryOptions[stackPath])) {
        // 没有 option 从 hook 获取的生命周期参数中取
        return this.qsQuery(this.queryOptions[stackPath]);
      } else if (stackPath === enterParams.path) {
        // 某些小程序虽然有页面堆栈，但是页面还没加载完，兜底取启动参数
        return this.qsQuery(
          getLaunchQuery(
            enterParams?.query,
            enterParams?.referrerInfo?.extraData
          )
        );
      }
    } else if (enterParams.path) {
      // 堆栈中没有页面信息，但启动参数中有，说明是小程序刚启动还没加载页面，直接取启动参数
      return this.qsQuery(
        getLaunchQuery(enterParams?.query, enterParams?.referrerInfo?.extraData)
      );
    } else {
      // 作为页面组件时 component created 生命周期中的埋点会取不到页面堆栈，所以拿最近的一个 page 事件中的页面信息做兜底
      return dataStore.lastPageEvent[trackingId]?.path
        ? dataStore.lastPageEvent[trackingId]?.query
        : // 没有最近的一个 page 事件说明在 app 初始化的生命周期中，有些框架可能会有异步处理逻辑导致事件触发比 visit 晚，则使用 visit 事件中的页面信息兜底
          dataStore.lastVisitEvent[trackingId]?.query;
    }
  };

  /**
   * 获取页面标题
   * 优先级：setNavigationBarTitle > data.gioPageTitle > config.js 中设置的值 > tabBar 配置
   * 插件环境下无页面时返回插件 appId
   * @param trackingId 可选，追踪 id
   */
  getPageTitle = (trackingId?: string) => {
    const { minipInstance, inPlugin, dataStore } = this.growingIO;
    const path = minipInstance.getCurrentPath();
    const title =
      this.configuredTitle[path] ||
      minipInstance.getPageTitle(minipInstance.getCurrentPage());
    if (inPlugin) {
      const vds = dataStore.getTrackerVds(
        trackingId || this.growingIO.trackingId
      );
      // 插件中没有页面时直接将插件appId作为页面信息
      return (
        title || `/插件${vds.appId}${path ? '_' + last(path.split('/')) : ''}`
      );
    } else {
      return title;
    }
  };

  /**
   * 格式化页面参数为 query string
   * 会去除 wxShoppingListScene 字段
   * @param query 页面参数对象
   */
  qsQuery = (query = {}) => {
    const slimQuery = { ...query };
    unset(slimQuery, 'wxShoppingListScene');
    return qsStringify(slimQuery);
  };

  /**
   * 获取页面来源（referrer）
   * 优先级：最近 page 事件路径 > 启动参数 referrerInfo.appId > scene 场景值
   * @param trackingId 追踪 id
   */
  getReferralPage = (trackingId: string) => {
    const {
      minipInstance,
      dataStore: { lastPageEvent, scene, eventHooks }
    } = this.growingIO;
    return (
      lastPageEvent[trackingId]?.path ||
      eventHooks.appEffects.enterParams?.referrerInfo?.appId ||
      (scene ? `scn:${minipInstance.scnPrefix}${scene}` : null)
    );
  };

  /**
   * 处理分享参数，生成分享用的 path 和 query
   * 优先级：result.query > result.path > 当前页面参数（去除 utm_ 开头参数）
   * @param result PageShareResult 客户自定义的参数
   * @returns [path, queryString]
   */
  buildShareQuery(result: PageShareResult): [string, string] {
    // 自定义 path 的地址参数截取（onShareAppMessage 中的页面参数是拼在地址中的）
    const customSplit = splitPath(result.path ?? '');

    let path = result.path || this.getPagePath();
    let parsedQuery: any = {};
    let resultHasPath = has(result, 'path');
    let resultHasQuery = has(result, 'query');
    // 如果定义了 query 字段则优先取 query 参数
    if (resultHasQuery) {
      parsedQuery = qsParse(result.query ?? '') || {};
    } else if (resultHasPath) {
      // 没有定义 query 字段则尝试取 path 中的参数
      parsedQuery = qsParse(last(customSplit)) || {};
    } else {
      // 只有在没有自定义 path 和 query 的情况下，才使用页面堆栈中的默认参数并删除 utm 参数
      const stackPage = this.growingIO.minipInstance.getCurrentPage();
      // 这里不要直接用对象赋值，下面的 unset 会修改原对象，导致触发一次分享以后当前页面事件中的 utm 参数就会被删除掉
      parsedQuery = {
        ...(stackPage.options || this.queryOptions[stackPage.route] || {})
      };

      // 删除 utm_ 参数
      compact(keys(parsedQuery)).forEach((key) => {
        if (key.toLowerCase().startsWith('utm_')) {
          unset(parsedQuery, key);
        }
      });
    }

    return [path, qsStringify(parsedQuery)];
  }

  /**
   * 更新分享结果，补全参数
   * @param result PageShareResult 分享参数对象
   * @param fillParams 是否补全参数，默认 true
   * @returns 更新后的 result
   */
  updateShareResult = (result: PageShareResult, fillParams = true) => {
    const [path, queryString] = this.buildShareQuery(result);
    if (fillParams || has(result, 'path')) {
      result.path = normalPath(path + (queryString ? `?${queryString}` : ''));
    }
    if (fillParams || has(result, 'query')) {
      result.query = queryString;
    }
    return result;
  };

  /**
   * 给事件合并页面属性
   * @param trackingId 追踪 id
   * @param event 事件对象
   * @returns 合并后的属性对象
   */
  eventSetPageProps = (trackingId: string, event: EVENT) => {
    const pageProps = niceTry(
      () => this.pageProps[trackingId][this.getPagePath()]
    );
    if (!isEmpty(pageProps)) {
      return limitObject(
        getDynamicAttributes({
          ...event.attributes,
          ...pageProps
        })
      );
    }
    return event.attributes;
  };
}

export default MinipPage;
