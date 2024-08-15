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
  isEmpty
} from '@@/utils/glodash';
import EMIT_MSG from '@@/constants/emitMsg';
import {
  limitString,
  niceTry,
  getPlainMinip,
  getPlainPlatform,
  getPlainConfig
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
            self.growingIO.dataStore.eventHooks.currentPage.settedTitle[
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
    // 第一优先级在base中的hook setNavigationBarTitle设置的值(在dataStore page实例中实现)
    // 第二优先级支持客户自己在页面中设置页面title
    const data = page?.data || page.$data || {};
    title = isString(data?.gioPageTitle) ? data?.gioPageTitle : '';
    if (instConfig) {
      // 第三优先级app生命周期中拿不到page对象，拿生命周期的参数来匹配
      const { enterParams } = this.growingIO.dataStore.eventHooks.appEffects;
      if (!page.route && !isEmpty(enterParams)) {
        page.route = enterParams.path || '';
        title = this._getTitleFromTabbar(instConfig, page.route);
      }
      // 第四优先级取页面的navigationBarTitleText
      niceTry(() => {
        if (!title) {
          const instPage = instConfig.page || {};
          const pageInfo =
            instPage[page.route] || instPage[`${page.route}.html`];
          if (pageInfo) {
            title = pageInfo?.window?.navigationBarTitleText;
          } else if (['wx', 'tt'].includes(platform)) {
            title = (instConfig || global || $global)?.global?.window
              ?.navigationBarTitleText;
          } else {
            title = (instConfig || global || $global)?.window
              ?.navigationBarTitleText;
          }
        }
      });
      // 第五优先级取tabBar配置
      if (!title) {
        title = this._getTitleFromTabbar(instConfig, page.route);
      }
    }
    return limitString(title);
  };

  private _getTitleFromTabbar = (
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
      // 支付宝小程序里叫headers
      headers: header,
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
}

export default BaseInstance;
