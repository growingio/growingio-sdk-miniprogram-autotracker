import { GrowingIOType } from '@@/types/growingIO';
import {
  AppSource,
  Location,
  MinipInstanceType,
  NavigateToMiniProgramOption,
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
import {
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
  public location: Location;
  public appSource: AppSource;
  public systemInfo: any;
  public network: any;

  constructor(public growingIO: GrowingIOType) {
    const {
      platformConfig: { platform, scnPrefix }
    } = this.growingIO;
    this.platform = platform;
    this.scnPrefix = scnPrefix;
    this.growingIO.emitter.on(EMIT_MSG.OPTION_INITIALIZED, () => {
      this.getNetworkType().then(() =>
        this.growingIO.dataStore?.eventReleaseInspector()
      );
      this.getSystemInfo().then(() =>
        this.growingIO.dataStore?.eventReleaseInspector()
      );
    });
  }

  // 通过hook setNavigationBarTitle方法优雅地获取客户设置的当前页面标题
  hookSetTitle = () => {
    const originSetter = this.minip?.setNavigationBarTitle;
    const self = this;
    if (originSetter) {
      Object.defineProperty(this.minip, 'setNavigationBarTitle', {
        writable: true,
        enumerable: true,
        configurable: true,
        value: function () {
          if (self.growingIO.gioSDKInitialized) {
            // 这个currentPath一般认为是在onLoad中获取的当前小程序页面的path，此时SDK还没有parse，保存的还是上一个页面的信息
            const currentPath = self.getCurrentPath();
            const { title } = arguments[0] || {};
            self.growingIO.dataStore.eventHooks.currentPage.configuredTitle[
              currentPath
            ] = title;
          }
          return originSetter.apply(this, arguments);
        }
      });
    }
  };

  // -----以下为除快应用以外的小程序通用的实现，由各平台端继承并差异化实现-----

  /**
   * 业务相关
   */
  // 保留当前页面，跳转到应用内的某个页面
  navigateTo = (opt: {
    url: string;
    fail: () => void;
    success: () => void;
    complete: () => void;
  }) => this.minip?.navigateTo(opt);

  // 跳转到 tabBar 页面，并关闭其他所有非 tabBar 页面
  switchTab = (opt: {
    url: string;
    fail: () => void;
    success: () => void;
    complete: () => void;
  }) => {
    this.minip?.switchTab(opt);
  };

  // 打开另一个小程序
  navigateToMiniProgram = (opt: NavigateToMiniProgramOption) =>
    this.minip?.navigateToMiniProgram(opt);

  // 获取图片信息
  getImageInfo = ({ src, success, fail, complete }: any) =>
    this.minip?.getImageInfo({ src, success, fail, complete });

  // 采集曝光事件
  initImpression = (collectPage: any) => {
    this.growingIO.plugins?.gioImpressionTracking?.main(
      collectPage,
      'observeAll'
    );
  };

  /**
   * 页面相关
   */
  // 获取当前页面栈
  getCurrentPage = (): any => {
    // @ts-ignore 小程序自带api
    return niceTry(() => last(getCurrentPages())) || {};
  };

  // 获取当前页面路由
  getCurrentPath = () => {
    const currentPage = this.getCurrentPage();
    // wx/my取route; swan取uri; tt取__route__; qq无值
    return (
      currentPage?.route || currentPage?.uri || currentPage?.__route__ || ''
    );
  };

  // 获取页面标题
  getPageTitle = (page) => {
    const platform = getPlainPlatform();
    let title = '';
    let instConfig = getPlainConfig(platform);
    if (typeOf(instConfig) === 'string') {
      instConfig = niceTry(() => JSON.parse(instConfig)) ?? {};
    }
    // 第一优先级在base中的hook setNavigationBarTitle设置的值(在dataStore page实例中实现，准确率最高)
    // 第二优先级支持客户自己在页面中设置页面title（保持3.8的向下兼容，不准确但优先级高）
    const data = page?.data || page.$data || {};
    title = isString(data?.gioPageTitle) ? data?.gioPageTitle : '';

    let instPage;
    // 第三优先级取页面的配置json的navigationBarTitleText（仅部分支持）
    if (!title) {
      // 存在__[wx]AppCode__时尝试从__[wx]AppCode__中匹配
      niceTry(() => {
        const instAppCode = getPlainAppCode(platform);
        if (instAppCode) {
          instPage = instAppCode[`${page.route}.json`] || {};
          title =
            instPage?.navigationBarTitleText || // wx/qq/jd
            instPage?.mod?.exports?.navigationBarTitleText; // ks
        }
      });
    }
    if (!title && instConfig) {
      // 第四优先级在app生命周期中拿不到page对象，拿生命周期的参数来匹配
      const { enterParams } = this.growingIO.dataStore.eventHooks.appEffects;
      if (!page.route && !isEmpty(enterParams)) {
        page.route = enterParams.path || '';
        title = page.route
          ? this._getTitleFromTabBar(instConfig, page.route)
          : '';
      }

      // 第五优先级存在pages数组或page对象时尝试从page中匹配（大概率匹配不到，跟框架有关）
      if (!title) {
        if (isArray(instConfig.pages)) {
          instPage = instConfig.pages.find((o) => o.path === page.route) ?? {};
        } else {
          instPage = instConfig.page || {};
        }
        if (instPage) {
          const pageInfo =
            instPage[page.route] || instPage[`${page.route}.html`] || instPage;
          title =
            pageInfo?.navigationBarTitleText ||
            pageInfo?.window?.navigationBarTitleText;
        }
      }

      // 第六优先级取tabBar配置匹配（只有tabbar的4个页面有机会）
      if (!title) {
        title = this._getTitleFromTabBar(instConfig, page.route);
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
  // 同步获取存储数据
  getStorageSync = (key: string): any => {
    let value = this.minip?.getStorageSync(key);
    if (isObject(value) && value.expiredAt) {
      if (value.expiredAt < Date.now()) {
        return '';
      } else {
        return value.value;
      }
    }
    return value;
  };

  // 异步获取存储数据
  getStorage = (key: string): Promise<string> => {
    return new Promise((resolve) => {
      this.minip?.getStorage({
        key,
        success: ({ data }) => resolve(data),
        fail: () => resolve('')
      });
    });
  };

  // 同步存储数据
  setStorageSync = (key: string, value: any, expiredAt?: string | number) => {
    if (expiredAt) {
      value = { value, expiredAt };
    }
    this.minip?.setStorageSync(key, value);
  };

  // 异步存储数据
  setStorage = (key: string, value: any) => {
    this.minip?.setStorage({ key, data: value });
  };

  // 同步移除指定数据
  removeStorageSync = (key: string) => {
    this.minip?.removeStorageSync(key);
  };

  // 异步移除指定数据
  removeStorage = (key: string) => {
    this.minip?.removeStorage(key);
  };

  /**
   * 网络相关
   */
  // 获取网络类型
  getNetworkType = (): Promise<{ networkType: string }> => {
    const self = this;
    return new Promise((resolve) => {
      this.minip?.getNetworkType({
        success: (r) => {
          self.network = r;
          resolve(r);
        },
        fail: () => resolve(null)
      });
    });
  };

  // 发起请求
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
    // 设置超时中断请求
    let t = setTimeout(() => {
      if (requestTask?.abort && isFunction(requestTask?.abort)) {
        requestTask?.abort();
      }
      clearTimeout(t);
      t = null;
    }, (timeout || 10000) + 10);
    return requestTask;
  };

  /**
   * 系统相关
   */
  // 获取小程序系统信息
  getSystemInfo = (): Promise<SystemInfo> => {
    const self = this;
    return new Promise((resolve) => {
      this.minip?.getSystemInfo({
        success: (r) => {
          self.systemInfo = r;
          resolve(r);
        },
        fail: () => resolve(null)
      });
    });
  };

  // 获取小程序设置
  getSetting = () => {
    return new Promise((resolve) => {
      this.minip?.getSetting({ success: resolve, fail: resolve });
    });
  };

  // 监听网络变更
  setNetworkStatusListener = () => {
    this.minip?.onNetworkStatusChange(({ networkType }) => {
      if (networkType) {
        this.network.networkType = networkType;
      }
    });
  };
}

export default BaseInstance;
