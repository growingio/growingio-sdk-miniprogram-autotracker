import { MinipPageType, PageShareResult } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import {
  qsStringify,
  guid,
  normalPath,
  splitPath,
  qsParse
} from '@@/utils/tools';
import {
  compact,
  forEach,
  has,
  head,
  isEmpty,
  keys,
  last,
  unset
} from '@@/utils/glodash';

class MinipPage implements MinipPageType {
  public path: string;
  public time: number;
  public query: any;
  // 页面title (优先级：setNavigationBarTitle > data.gioPageTitle[不保证能取到] > config.js中设置的值 > tabBar配置)
  public title: string;
  // 通过调用wx.setNavigationBarTitle设置的title
  public settedTitle: any;
  // 当前页面参数中的分享id
  public queryShareId: string;
  // 页面级属性
  public pageProps: any;
  // 上一个执行的小程序生命周期
  public lastLifecycle: string;
  // 当前执行的小程序生命周期
  public currentLifecycle: string;

  constructor(public growingIO: GrowingIOType) {
    this.query = undefined;
    this.settedTitle = {};
    this.pageProps = {};
  }

  // 存储页面参数
  parsePage = (page: any, query: any) => {
    // wx/my取route; swan取uri; tt取__route__; qq无值
    const path =
      page.route || page.uri || page.__route__ || page?.$page?.fullPath || '';
    if (!isEmpty(query)) {
      this.query = this.getQuery(query);
    } else {
      this.query = undefined;
    }
    if (this.path !== path) {
      this.time = Date.now();
    }
    this.path = path;
    this.title =
      // 如果在parse前（onLoad）动态设置了title，则优先获取动态设置的值
      this.settedTitle[this.path] ||
      this.growingIO.minipInstance.getPageTitle(
        page || this.growingIO.minipInstance.getCurrentPage()
      );
  };

  // 获取页面参数
  getQuery = (query: any) => {
    const filtQeury = { ...query };
    unset(filtQeury, 'wxShoppingListScene');
    return qsStringify(filtQeury);
  };

  // 保存分享id（记录是从哪个用户id的分享来的）
  saveShareId = (query: any) => {
    if (query?.gioShareId) {
      this.queryShareId = query.gioShareId;
    }
  };

  // 处理分享参数
  buildShareQuery(
    growingIO: any,
    result: PageShareResult, // 客户自定义的参数
    extraParams = true
  ): [string, string, any] {
    const { userStore } = growingIO;

    // 自定义path的地址参数截取（onShareAppMessage中的页面参数是拼在地址中的）
    const customSplit = splitPath(result.path ?? '');

    let path = this.path;
    let parsedQeury: any = {};
    let resultHasPath = has(result, 'path');
    // 优先使用自定义的地址
    if (resultHasPath) {
      path = head(customSplit);
      parsedQeury = qsParse(last(customSplit)) || {};
    }

    // 自定义path中没有截取到query说明是在onShareAppMessage中没有参数，或是在onShareTimeline中需要取自定义query
    if (isEmpty(parsedQeury)) {
      parsedQeury = qsParse(result.query ?? '') || {};
    }

    // 以上两种都是自定义的地址和参数，不做处理直接用，防止出现encode/decode的问题。

    // 自定义query没有值则使用当前页面默认参数
    // 如果path存在，但是不携带参数，此时不使用当前页面的默认参数
    if (!resultHasPath && isEmpty(parsedQeury)) {
      parsedQeury = qsParse(this.query ?? '') || {};
      compact(keys(parsedQeury)).forEach((key) => {
        // 删除从默认页面的query中原有的分享id和utm参数
        if (
          ['gioPreShareId', 'gioShareId', 'suid'].includes(key) ||
          key.toLowerCase().startsWith('utm_')
        ) {
          unset(parsedQeury, key);
        }
      });
    }

    // 收藏时不需要额外的分享参数，直接返回结果
    if (!extraParams) {
      return [path, qsStringify(parsedQeury), {}];
    }

    // 构建额外的分享参数
    const queries = {
      gioShareId: guid(),
      suid: userStore.uid
    };
    const attributes = {
      contentType: result.contentType || parsedQeury.contentType,
      contentId: result.contentId || parsedQeury.contentId,
      gioPreShareId: this.queryShareId
    };
    forEach(queries, (v, k) => {
      if (!v) {
        unset(queries, k);
      }
    });
    return [
      path,
      qsStringify({ ...parsedQeury, ...queries }),
      { ...queries, ...attributes }
    ];
  }

  // 更新分享结果（共用）
  updateShareResult = (growingIO: any, result: PageShareResult) => {
    const [path, queryString, attributes] = this.buildShareQuery(
      growingIO,
      result
    );
    result.path = normalPath(path + (queryString ? `?${queryString}` : ''));
    result.attributes = attributes;
    result.query = queryString;
    return result;
  };

  // 更新分享转发事件的结果
  updateAppMessageResult = this.updateShareResult;

  // 更新分享朋友圈结果
  updateTimelineResult = this.updateShareResult;

  // 更新收藏结果
  updateAddFavoritesResult = (growingIO: any, result: PageShareResult) => {
    const [path, queryString] = this.buildShareQuery(growingIO, result, false);
    result.path = normalPath(path + (queryString ? `?${queryString}` : ''));
    result.query = queryString;
    return result;
  };
}

export default MinipPage;
