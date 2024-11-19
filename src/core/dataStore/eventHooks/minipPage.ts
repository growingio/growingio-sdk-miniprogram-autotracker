import {
  compact,
  has,
  head,
  isEmpty,
  keys,
  last,
  unset
} from '@@/utils/glodash';
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
  public queryOption: any;
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
    this.queryOption = {};
    this.configuredTitle = {};
    this.pageProps = {};
  }

  // 获取页面地址
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

  // 获取页面参数
  getPageQuery = () => {
    const { minipInstance, dataStore, trackingId } = this.growingIO;
    const stackPage = minipInstance.getCurrentPage();
    const stackPath = minipInstance.getCurrentPath();
    const { enterParams = {} } = dataStore.eventHooks.appEffects;
    if (stackPath) {
      const pageParams = stackPage.options ?? stackPage.$taroParams;
      // 堆栈中有页面信息，则使用堆栈中的页面参数
      if (!isEmpty(pageParams)) {
        // 删掉taro框架中自带的字段
        unset(pageParams, '$taroTimestamp');
        // 有页面解析的option直接取
        return this.qsQuery(pageParams);
      } else if (!isEmpty(this.queryOption[stackPath])) {
        // 没有option从hook获取的生命周期参数中取
        return this.qsQuery(this.queryOption[stackPath]);
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
      // 作为页面组件时component created生命周期中的埋点会取不到页面堆栈，所以拿最近的一个page事件中的页面信息做兜底
      return dataStore.lastPageEvent[trackingId]?.path
        ? dataStore.lastPageEvent[trackingId]?.query
        : // 没有最近的一个page事件说明在app初始化的生命周期中，有些框架可能会有异步处理逻辑导致事件触发比visit晚，则使用visit事件中的页面信息兜底
          dataStore.lastVisitEvent[trackingId]?.query;
    }
  };

  // 获取页面标题
  // 页面title (优先级：setNavigationBarTitle > data.gioPageTitle[不保证能取到] > config.js中设置的值 > tabBar配置)
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

  // 格式化页面参数
  qsQuery = (query = {}) => {
    const slimQuery = { ...query };
    unset(slimQuery, 'wxShoppingListScene');
    return qsStringify(slimQuery);
  };

  // 获取页面来源
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

  // 处理分享参数
  buildShareQuery(
    result: PageShareResult // 客户自定义的参数
  ): [string, string] {
    // 自定义path的地址参数截取（onShareAppMessage中的页面参数是拼在地址中的）
    const customSplit = splitPath(result.path ?? '');

    let path = this.getPagePath();
    let parsedQuery: any = {};
    let resultHasPath = has(result, 'path');
    // 优先使用自定义的地址
    if (resultHasPath) {
      path = head(customSplit);
      parsedQuery = qsParse(last(customSplit)) || {};
    }

    // 自定义path中没有截取到query说明是在onShareAppMessage中没有参数，或是在onShareTimeline中需要取自定义query
    if (isEmpty(parsedQuery)) {
      parsedQuery = qsParse(result.query ?? '') || {};
      compact(keys(parsedQuery)).forEach((key) => {
        // 删除从默认页面的query中原有的utm参数，防止带入到下一次分享导致渠道统计错误（如果客户质疑参数被删，让他们自己拼回去或者关followShare）
        if (key.toLowerCase().startsWith('utm_')) {
          unset(parsedQuery, key);
        }
      });
    }

    // 以上两种都是自定义的地址和参数，不做处理直接用，防止出现encode/decode的问题。

    // 自定义query没有值则使用当前页面默认参数
    // 如果path存在，但是不携带参数，此时不使用当前页面的默认参数
    if (!resultHasPath && isEmpty(parsedQuery)) {
      const stackPage = this.growingIO.minipInstance.getCurrentPage();
      parsedQuery =
        stackPage.options || this.queryOption[stackPage.route] || {};
    }

    return [path, qsStringify(parsedQuery)];
  }

  // 更新分享结果
  updateShareResult = (result: PageShareResult) => {
    const [path, queryString] = this.buildShareQuery(result);
    result.path = normalPath(path + (queryString ? `?${queryString}` : ''));
    result.query = queryString;
    return result;
  };

  // 更新分享转发事件的结果
  updateAppMessageResult = this.updateShareResult;

  // 更新分享朋友圈结果
  updateTimelineResult = this.updateShareResult;

  // 更新收藏结果
  updateAddFavoritesResult = (result: PageShareResult) => {
    const [path, queryString] = this.buildShareQuery(result);
    result.path = normalPath(path + (queryString ? `?${queryString}` : ''));
    result.query = queryString;
    return result;
  };

  // 给事件合并页面属性
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
