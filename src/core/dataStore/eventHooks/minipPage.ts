import {
  compact,
  has,
  isEmpty,
  keys,
  last,
  typeOf,
  unset
} from '@@/utils/glodash';
import { GrowingIOType } from '@@/types/growingIO';
import {
  MinipPageType,
  PageContext,
  PageContextOptions,
  PageShareResult
} from '@@/types/eventHooks';
import {
  qsStringify,
  normalPath,
  splitPath,
  qsParse,
  niceTry,
  getDynamicAttributes,
  limitObject,
  getPureParams
} from '@@/utils/tools';
import { EVENT } from '@@/types/base';
import { getPageIdentityPath, isPageTarget } from '@@/utils/pageContext';

/**
 * 页面位置快照。
 * path 与 query 是不可拆分的一组；title 保留既有实时页面规则。
 */
type PageLocation = Pick<PageContext, 'page' | 'path' | 'query'>;

class MinipPage implements MinipPageType {
  // 当前同步执行的页面生命周期。使用栈是为了兼容生命周期嵌套调用。
  private pageContextStack: any[] = [];
  private queryByPage = new WeakMap<object, any>();
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
   * 在指定页面的同步生命周期上下文中执行。
   * 生命周期结束或抛错后必须恢复，不能把页面实例保存成长期全局状态。
   */
  withPageContext = <T>(page: any, callback: () => T): T => {
    this.pageContextStack.push(page);
    try {
      return callback();
    } finally {
      this.pageContextStack.pop();
    }
  };

  /** 获取当前同步生命周期对应的页面实例 */
  getContextPage = () => last(this.pageContextStack);

  /**
   * 判断对象是否带有页面身份。
   * 这些字段是不同平台/框架对同一个“页面路由”的命名差异，不是多级历史降级。
   * 普通组件没有这些字段，不能把组件实例误认为页面。
   */
  isPageTarget = isPageTarget;
  getPageIdentityPath = getPageIdentityPath;

  /**
   * 为一次解析确定唯一页面实例：调用方指定页 > 当前同步生命周期页 > 页面栈顶。
   * path/query 围绕这个实例解析；标题沿用既有页面栈取值规则。
   */
  private getTargetPage = (page?: any) => {
    if (this.isPageTarget(page)) return page;
    const contextPage = this.getContextPage();
    if (this.isPageTarget(contextPage)) return contextPage;
    return this.growingIO.minipInstance.getCurrentPage();
  };

  /**
   * 从已经确定的页面实例读取路径。
   * route/uri/__route__/$vm.__route__ 是平台别名；fullPath/$taroPath 仅在这些字段
   * 都不存在时使用，并只截取字面量问号前的路径，不解码、不改写原有路径格式。
   */
  private getPathFromPage = (page?: any) => {
    return (
      this.getPageIdentityPath(page) ||
      this.growingIO.minipInstance.getCurrentPath(page) ||
      ''
    );
  };

  /** 将页面参数稳定转换为事件 query 字符串 */
  private stringifyQuery = (query: any) =>
    typeOf(query) === 'string' ? query : qsStringify(query || {});

  setPageQuery = (page: any, query: any, path = this.getPagePath(page)) => {
    const snapshot = getPureParams(query);
    if (this.isPageTarget(page)) this.queryByPage.set(page, snapshot);
    this.queryOptions[path] = snapshot;
  };

  setConfiguredTitle = (title: string) => {
    // 与 master4.0 一致，导航标题按当前页面栈的路由缓存。
    const path = this.growingIO.minipInstance.getCurrentPath();
    this.configuredTitle[path] = title;
  };

  /**
   * 从同一个页面实例读取 query，不在这里读取其他页面的历史值。
   * 页面实例字段优先；生命周期缓存用于支付宝等离开 onLoad 后拿不到参数的平台；
   * fullPath 和匹配同一路径的启动参数只做当前页面内部补足。
   */
  private getQueryFromPage = (page: any, path: string) => {
    const pageParams = [
      page?.options,
      page?.$taroParams,
      page?.$page?.query
    ].find((params) => !isEmpty(params));
    if (!isEmpty(pageParams)) {
      return this.stringifyQuery(getPureParams(pageParams));
    }

    // 空参数也是该实例的权威快照，不能被同路由另一个实例的缓存替代。
    if (page && this.queryByPage.has(page)) {
      return this.stringifyQuery(this.queryByPage.get(page));
    }

    const lifecycleQuery = this.queryOptions[path];
    if (!isEmpty(lifecycleQuery)) {
      return this.stringifyQuery(getPureParams(lifecycleQuery));
    }

    // fullPath/$taroPath 是同一个框架位置字段的两种形态。仅在页面参数字段和生命周期
    // 缓存都不可用时，从本次已选中的完整路径补 query，并过滤 SDK 内部参数。
    const frameworkFullPath = page?.$page?.fullPath || page?.$taroPath;
    const [, frameworkQuery] = splitPath(frameworkFullPath);
    if (frameworkQuery) {
      return this.stringifyQuery(getPureParams(frameworkQuery));
    }

    const { enterParams = {} } = this.growingIO.dataStore.eventHooks.appEffects;
    if (path === enterParams.path) {
      return this.stringifyQuery(
        getPureParams(enterParams.query, enterParams.referrerInfo?.extraData)
      );
    }
    return '';
  };

  /**
   * 页面实例完全不可用时才进入历史降级。
   * 保留原有顺序：启动入口 > 最近 PAGE > 最近 VISIT；每次返回完整的 path/query，
   * 禁止 path 命中一个来源后再去另一个来源寻找 query。
   */
  private getHistoryLocation = (trackingId: string): PageLocation => {
    const { dataStore } = this.growingIO;
    const { enterParams = {} } = dataStore.eventHooks.appEffects;
    if (enterParams.path) {
      return {
        path: enterParams.path,
        query: this.stringifyQuery(
          getPureParams(enterParams.query, enterParams.referrerInfo?.extraData)
        )
      };
    }

    const lastPage = dataStore.lastPageEvent[trackingId];
    if (lastPage?.path) {
      return {
        path: lastPage.path,
        query: this.stringifyQuery(lastPage.query)
      };
    }

    const lastVisit = dataStore.lastVisitEvent[trackingId];
    return {
      path: lastVisit?.path || '',
      query: this.stringifyQuery(lastVisit?.query)
    };
  };

  /**
   * 解析基础页面位置：先读唯一页面实例；无页面时，插件使用插件占位页，
   * 普通小程序使用历史上下文。显式 VISIT/PAGE 字段在 getPageContext 中覆盖。
   * 无论使用哪一层，path 和 query 都必须整组返回，不能各自独立降级。
   */
  private getPageLocation = (
    trackingId: string,
    sourcePage?: any
  ): PageLocation => {
    const page = this.getTargetPage(sourcePage);
    const path = this.getPathFromPage(page);
    if (path) {
      return {
        page,
        path,
        query: this.getQueryFromPage(page, path)
      };
    }

    if (this.growingIO.inPlugin) {
      const vds = this.growingIO.dataStore.getTrackerVds(trackingId);
      return { page, path: `/插件${vds.appId}`, query: '' };
    }

    return { page, ...this.getHistoryLocation(trackingId) };
  };

  /**
   * 获取当前页面路径
   * 兼容旧调用方式，实际来源由统一页面位置解析器决定。
   * @returns {string} - 页面路径
   */
  getPagePath = (page?: any) =>
    this.getPageLocation(this.growingIO.trackingId, page).path;

  /**
   * 获取当前页面参数（query）
   * 兼容旧调用方式；指定 path 与当前页面不一致时不借用当前页面 query。
   * @returns {string} - 页面参数字符串
   */
  getPageQuery = (page?: any, path?: string) => {
    const location = this.getPageLocation(this.growingIO.trackingId, page);
    return typeof path === 'string' && path !== location.path
      ? ''
      : location.query;
  };

  /**
   * 获取页面标题
   * 优先级：setNavigationBarTitle > data.gioPageTitle > config.js 中设置的值 > tabBar 配置
   * 插件环境下无页面时返回插件 appId
   * @param {string} [trackingId] - 可选，追踪 id
   * @returns {string} - 页面标题
   */
  getPageTitle = (trackingId?: string) => {
    const { minipInstance, inPlugin, dataStore } = this.growingIO;
    const path = minipInstance.getCurrentPath();
    // 标题遵循 master4.0 的实时页面规则，不借事件入口或历史位置合成 route。
    // 页面对象直接交给平台读取，保留原型和非枚举字段中的标题。
    const title =
      this.configuredTitle[path] ||
      niceTry(() => {
        return minipInstance.getPageTitle(minipInstance.getCurrentPage());
      }) ||
      '';
    if (inPlugin) {
      const vds = dataStore.getTrackerVds(
        trackingId || this.growingIO.trackingId
      );
      return (
        title || `/插件${vds.appId}${path ? '_' + last(path.split('/')) : ''}`
      );
    }
    return title;
  };

  /**
   * 一次性解析 path/query 的所属页面；title 保留 master4.0 的实时页面取值规则。
   * 显式 query 永远按调用值序列化；只显式修改 path 且已经切换到另一页面时，
   * query 必须清空，不能把基础位置中的旧 query 拼到新 path 上。
   */
  getPageContext = (
    trackingId = this.growingIO.trackingId,
    options: PageContextOptions = {}
  ): PageContext => {
    const location = this.getPageLocation(trackingId, options.page);
    const explicitPath = has(options, 'path');
    const path = explicitPath ? options.path || '' : location.path;
    let query = location.query;
    if (has(options, 'query')) {
      query = this.stringifyQuery(options.query);
    } else if (explicitPath && path !== location.path) {
      query = '';
    }
    const title = has(options, 'title')
      ? options.title || ''
      : options.resolveTitle === false
      ? ''
      : this.getPageTitle();
    return { page: location.page, path, query, title };
  };

  /**
   * 获取页面来源（referrer）
   * 优先级：最近 page 事件路径 > 启动参数 referrerInfo.appId > scene 场景值
   * @param {string} trackingId - 追踪 id
   * @returns {string} - 页面来源
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
   * @param {PageShareResult} result - 客户自定义的参数
   * @returns {[string, string]} - [path, queryString]
   */
  buildShareQuery(
    result: PageShareResult,
    capturedContext?: PageContext
  ): [string, string] {
    // 自定义 path 的地址参数截取（onShareAppMessage 中的页面参数是拼在地址中的）
    const customSplit = splitPath(result.path ?? '');

    const context = capturedContext || this.getPageContext();
    let path = result.path || context.path;
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
      // 默认 path/query 使用已锁定的同一个页面，只对解析副本删除 utm 参数。
      parsedQuery = qsParse(context.query) || {};

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
   * @param {PageShareResult} result - 分享参数对象
   * @param {boolean} [fillParams=true] - 是否补全参数，默认 true
   * @returns {PageShareResult} - 更新后的 result
   */
  updateShareResult = (
    result: PageShareResult,
    fillParams = true,
    context?: PageContext
  ) => {
    const [path, queryString] = this.buildShareQuery(result, context);
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
   * @param {string} trackingId - 追踪 id
   * @param {EVENT} event - 事件对象
   * @returns {any} - 合并后的属性对象
   */
  eventSetPageProps = (trackingId: string, event: EVENT) => {
    const pageProps = niceTry(
      () => this.pageProps[trackingId][event.path || this.getPagePath()]
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
