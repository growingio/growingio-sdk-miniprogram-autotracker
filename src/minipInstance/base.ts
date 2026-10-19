import { GrowingIOType } from '@@/types/growingIO';
import {
  AppSource,
  MinipInstanceType,
  SystemInfo
} from '@@/types/minipInstance';
import { PLATFORMS } from '@@/types/platforms';
import {
  isFunction,
  isObject,
  isString,
  last,
  typeOf,
  isEmpty,
  isArray
} from '@@/utils/glodash';
import EMIT_MSG from '@@/constants/emitMsg';
import { getPageIdentityPath } from '@@/utils/pageContext';
import {
  consoleText,
  limitString,
  niceTry,
  getPlainMinip,
  getPlainPlatform,
  getPlainConfig,
  getPlainAppCode
} from '@@/utils/tools';

// 此基础实现类仅包含所有小程序，快应用所有方法全部单独实现
class BaseInstance implements MinipInstanceType {
  readonly minip: any = getPlainMinip('__GIO_PLATFORM__');
  public platform: PLATFORMS;
  public scnPrefix: string;
  public appSource: AppSource;
  public systemInfo: any;
  public network: any;
  // App onShow 会多次触发；网络监听只需注册一次，避免重复回调和资源泄漏。
  protected networkStatusListenerRegistered = false;

  constructor(public growingIO: GrowingIOType) {
    const {
      platformConfig: { platform, scnPrefix }
    } = this.growingIO;
    this.platform = platform;
    this.scnPrefix = scnPrefix;
    this.growingIO.emitter.on(EMIT_MSG.OPTION_INITIALIZED, () => {
      this.loadMetadata('network', () => this.getNetworkType());
      this.loadMetadata('systemInfo', () => this.getSystemInfo());
    });
  }

  /**
   * 加载首批事件依赖的网络和系统元数据。
   * 平台 API 缺失、抛错、拒绝或 3 秒内不返回时写入失败占位，确保拦截队列最终释放。
   */
  private loadMetadata = (
    key: 'network' | 'systemInfo',
    loader: () => Promise<any>
  ) => {
    const metadataPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve(undefined), 3000);
      Promise.resolve(niceTry(loader)).then(
        (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      );
    });
    metadataPromise.then(
      (value) => {
        if (isEmpty(this[key])) {
          this[key] = isEmpty(value) ? { __gioFailed: true } : value;
        }
        this.growingIO.dataStore?.eventReleaseInspector();
      },
      () => {
        this[key] = { __gioFailed: true };
        this.growingIO.dataStore?.eventReleaseInspector();
      }
    );
  };

  /**
   * 通过 hook setNavigationBarTitle 方法优雅地获取客户设置的当前页面标题
   */
  hookSetTitle = () => {
    const originSetter = this.minip?.setNavigationBarTitle;
    const self = this;
    if (originSetter) {
      Object.defineProperty(this.minip, 'setNavigationBarTitle', {
        writable: true,
        enumerable: true,
        configurable: true,
        value: function () {
          const { title } = arguments[0] || {};
          if (self.growingIO.gioSDKInitialized) {
            niceTry(() => {
              self.growingIO.dataStore.eventHooks.currentPage.setConfiguredTitle(title);
            });
          }
          return originSetter.apply(this, arguments);
        }
      });
    }
  };

  // -----以下为除快应用以外的小程序通用的实现，由各平台端继承并差异化实现-----

  /**
   * 采集曝光事件
   * @param {any} collectPage - 采集页面
   */
  initImpression = (collectPage: any) => {
    this.growingIO.plugins?.gioImpressionTracking?.main(
      collectPage,
      'observeAll'
    );
  };

  /**
   * 页面相关
   */
  /**
   * 获取当前页面栈
   * @returns {any} - 当前页面对象
   */
  getCurrentPage = (): any => {
    // @ts-ignore 小程序自带api
    return niceTry(() => last(getCurrentPages())) || {};
  };

  /**
   * 获取当前页面路由
   * @param {any} [page] - 指定页面实例
   * @returns {string} - 当前页面路由
   */
  getCurrentPath = (page?: any) => {
    // 调用方已经拿到生命周期 page 时直接读取它；只有传入对象没有页面身份时，
    // 才保持原逻辑回退页面栈。这样普通组件不会被误当页面，也不会忽略有效 page 参数。
    return (
      getPageIdentityPath(page) || getPageIdentityPath(this.getCurrentPage())
    );
  };

  /**
   * 获取页面标题
   * @param {any} page - 页面对象
   * @returns {string} - 页面标题
   */
  getPageTitle = (page) => {
    // 保留 master4.0 的优先级；入口兜底只修改局部路径，不补写宿主 route。
    let pageRoute = getPageIdentityPath(page) || page?.route;
    const platform = getPlainPlatform();
    let title = '';
    let instConfig = getPlainConfig(platform);
    if (typeOf(instConfig) === 'string') {
      instConfig = niceTry(() => JSON.parse(instConfig)) ?? {};
    }
    // 第一优先级在base中的hook setNavigationBarTitle设置的值(在dataStore page实例中实现，准确率最高)
    // 第二优先级支持客户自己在页面中设置页面title（保持3.8的向下兼容，不准确但优先级高）
    const data = page?.data || page?.$data || {};
    title = isString(data?.gioPageTitle) ? data?.gioPageTitle : '';

    let instPage;
    // 第三优先级取页面的配置json的navigationBarTitleText（仅部分支持）
    if (!title) {
      // 存在__[wx]AppCode__时尝试从__[wx]AppCode__中匹配
      niceTry(() => {
        const instAppCode = getPlainAppCode(platform);
        if (instAppCode) {
          instPage = instAppCode[`${pageRoute}.json`] || {};
          title =
            instPage?.navigationBarTitleText || // wx/qq/jd
            instPage?.mod?.exports?.navigationBarTitleText; // ks
        }
      });
    }
    if (!title && instConfig) {
      // 第四优先级在app生命周期中拿不到page对象，拿生命周期的参数来匹配
      const { enterParams } = this.growingIO.dataStore.eventHooks.appEffects;
      if (!pageRoute && !isEmpty(enterParams)) {
        pageRoute = enterParams.path || '';
        title = pageRoute
          ? this._getTitleFromTabBar(instConfig, pageRoute)
          : '';
      }

      // 第五优先级存在pages数组或page对象时尝试从page中匹配（大概率匹配不到，跟框架有关）
      if (!title) {
        if (isArray(instConfig.pages)) {
          instPage = instConfig.pages.find((o) => o.path === pageRoute) ?? {};
        } else {
          instPage = instConfig.page || {};
        }
        if (instPage) {
          const pageInfo =
            instPage[pageRoute] || instPage[`${pageRoute}.html`] || instPage;
          title =
            pageInfo?.navigationBarTitleText ||
            pageInfo?.window?.navigationBarTitleText;
        }
      }

      // 第六优先级取tabBar配置匹配（只有tabbar的4个页面有机会）
      if (!title) {
        title = this._getTitleFromTabBar(instConfig, pageRoute);
      }
    }

    // 第七优先级兜底取全局window的navigationBarTitleText
    if (!title) {
      if (['wx', 'tt'].includes(platform)) {
        title = (instConfig || global || $global)?.global?.window
          ?.navigationBarTitleText;
      } else {
        title = (instConfig || global || $global)?.window
          ?.navigationBarTitleText;
      }
    }
    return limitString(title);
  };

  /**
   * 从 TabBar 配置中获取页面标题
   * @param {any} instConfig - 实例配置
   * @param {string} pageRoute - 页面路由
   * @returns {string} - 页面标题
   */
  private _getTitleFromTabBar = (
    instConfig: any,
    pageRoute: string
  ): string => {
    const tabPage = instConfig?.tabBar?.list?.find((p) => {
      return p.pagePath === pageRoute || p.pagePath === `${pageRoute}.html`;
    });
    return tabPage?.text || '';
  };

  /**
   * 存储相关
   */
  /**
   * 同步获取存储数据
   * @param {string} key - 键
   * @returns {any} - 值
   */
  getStorageSync = (key: string): any => {
    let value = this.minip?.getStorageSync(key);
    if (isObject(value) && value.expiredAt) {
      if (value.expiredAt < Date.now()) {
        // 过期不仅是本次读取未命中，还要物理删除存储，
        // 避免残留封装反复被 AB 缓存和其他调用方判定为存在。
        this.removeStorageSync(key);
        return '';
      } else {
        return value.value;
      }
    }
    return value;
  };

  /**
   * 同步存储数据
   * @param {string} key - 键
   * @param {any} value - 值
   * @param {string | number} [expiredAt] - 过期时间
   */
  setStorageSync = (key: string, value: any, expiredAt?: string | number) => {
    if (expiredAt) {
      value = { value, expiredAt };
    }
    this.minip?.setStorageSync(key, value);
  };

  /**
   * 异步存储数据
   * @param {string} key - 键
   * @param {any} value - 值
   */
  setStorage = (key: string, value: any) => {
    this.minip?.setStorage({ key, data: value });
  };

  /**
   * 同步移除指定数据
   * @param {string} key - 键
   */
  removeStorageSync = (key: string) => {
    this.minip?.removeStorageSync(key);
  };

  /**
   * 网络相关
   */
  /**
   * 获取网络类型
   * @returns {Promise<{ networkType: string }>} - 网络类型
   */
  getNetworkType = (): Promise<{ networkType: string }> => {
    const self = this;
    return new Promise((resolve) => {
      this.minip?.getNetworkType({
        success: (r) => {
          self.network = r;
          resolve(r);
        },
        fail: () => {
          // 元数据获取失败时使用占位对象，避免首批事件永久阻塞。
          self.network = { __gioFailed: true };
          resolve(self.network as any);
        }
      });
    });
  };

  /**
   * 发起请求
   * @param {object} opt - 请求参数
   * @returns {any} - 请求任务
   */
  request = ({
    url,
    data,
    header,
    timeout,
    method,
    success,
    fail,
    complete
  }) => {
    const requestTask = this.minip?.request({
      url,
      data,
      // 微信小程序和其他小程序里叫header
      header,
      timeout,
      method,
      success,
      fail,
      complete
    });
    return requestTask;
  };

  /**
   * 系统相关
   */
  /**
   * 获取小程序系统信息
   * @returns {Promise<SystemInfo>} - 系统信息
   */
  getSystemInfo = (): Promise<SystemInfo> => {
    const self = this;
    return new Promise((resolve) => {
      this.minip?.getSystemInfo({
        success: (r) => {
          self.systemInfo = r;
          resolve(r);
        },
        fail: () => {
          // 元数据获取失败时使用占位对象，允许事件按缺省字段继续发送。
          self.systemInfo = { __gioFailed: true };
          resolve(self.systemInfo as any);
        }
      });
    });
  };

  /**
   * 监听网络变更
   */
  setNetworkStatusListener = () => {
    if (this.networkStatusListenerRegistered) return;
    const onNetworkStatusChange = this.minip?.onNetworkStatusChange;
    if (!isFunction(onNetworkStatusChange)) return;
    try {
      onNetworkStatusChange.call(this.minip, ({ networkType }) => {
        if (networkType) {
          if (!this.network || !isObject(this.network)) {
            this.network = {};
          }
          this.network.networkType = networkType;
        }
      });
      this.networkStatusListenerRegistered = true;
    } catch (error) {
      // 网络状态只是事件上下文的附加字段；订阅失败不得打断 App onShow。
      consoleText(error, 'warn');
    }
  };
}

export default BaseInstance;
