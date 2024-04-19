import { GrowingIOType } from '@@/types/growingIO';
import { isString, last } from '@@/utils/glodash';
import { limitString } from '@@/utils/tools';
import { SystemInfo } from '@@/types/minipInstance';
import app from '@system.app';
import BaseImplements from './base';
import device from '@system.device';
import EMIT_MSG from '@@/constants/emitMsg';
import fetch from '@system.fetch';
import image from '@system.image';
import network from '@system.network';
import router from '@system.router';
import share from '@system.share';
import storage from '@system.storage';

class QuickApp extends BaseImplements {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.growingIO.emitter.on(EMIT_MSG.MINIP_LIFECYCLE, ({ event }) => {
      switch (event) {
        case 'App onCreate':
          {
            this.getNetworkType().then(() =>
              this.growingIO.dataStore?.eventReleaseInspector()
            );
            this.getSystemInfo().then(() =>
              this.growingIO.dataStore?.eventReleaseInspector()
            );
          }
          break;
        case 'App onCreateEnd':
          {
            this.setStorage = (key: string, value: string) => {
              storage?.set({ key, value });
            };
          }
          break;
        default:
          break;
      }
    });
  }

  /**
   * 业务相关
   */
  // 获取应用来源
  getAppSource = () => {
    const { source } = app.getInfo();
    this.appSource = source || {};
    return this.appSource;
  };

  // 保留当前页面，跳转到应用内的某个页面（重写为空）
  navigateTo = () => {}; // eslint-disable-line

  // 跳转到 tabBar 页面，并关闭其他所有非 tabBar 页面（重写为空）
  switchTab = () => {}; // eslint-disable-line

  // 打开另一个小程序（重写为空）
  navigateToMiniProgram = () => {}; // eslint-disable-line

  // 监听小程序切前台事件（重写为空）
  onAppShow = () => {}; // eslint-disable-line

  // 监听小程序切后台事件（重写为空）
  onAppHide = () => {}; // eslint-disable-line

  // 获取图片信息
  getImageInfo = ({ src, success, fail, complete }: any) => {
    return image?.getImageInfo({ uri: src, success, fail, complete });
  };

  // 采集曝光事件
  initImpression = () => {}; // eslint-disable-line

  // 初始化分享
  initShareAppMessage = (growingIO: GrowingIOType) => {
    const { platformConfig } = growingIO;
    try {
      this.growingIO.shareAppMessage = function () {
        const params = arguments[0];
        share?.share(params);
        growingIO?.eventTracking?.pageEffects(
          this,
          platformConfig.listeners.page.shareApp as any,
          arguments
        );
      };
    } catch (e) {
      //
    }
  };

  /**
   * 页面相关
   */
  // 获取当前页面栈
  getCurrentPage = () => {
    if (router?.getPages) {
      return last(router?.getPages());
    }
    return {};
  };

  // 获取当前页面路由
  getCurrentPath = () => {
    const route = router?.getState();
    return route?.path;
  };

  // 获取页面标题(除wx以外其他平台)
  getPageTitle = (page) => {
    let title = '';
    try {
      // this.$page.setTitleBar是只读方法，不能hook
      // 第一优先级支持客户自己在页面中设置页面title
      title = isString(page?.gioPageTitle) ? page?.gioPageTitle : '';
      // 第三优先级取页面的titleBarText
      if (!title) {
        const instConfig = page?.$app?.$def?.manifast?.display?.pages ?? {};
        const pageInfo = instConfig?.[page.route];
        if (pageInfo) {
          title = pageInfo.titleBarText;
        }
      }
      // 第四优先级取router状态
      if (!title) {
        const route = router?.getState();
        title = route?.name || '';
      }
    } catch (e) {
      return '';
    }
    return limitString(title);
  };

  /**
   * 存储相关
   */
  // 同步获取存储数据
  getStorageSync = () => '';

  // 异步获取存储数据
  getStorage = async (key: string): Promise<string> => {
    return await new Promise((resolve) => {
      storage?.get({
        key,
        success: (res) => resolve(res),
        fail: () => resolve(null)
      });
    });
  };

  // 同步存储数据
  setStorageSync = () => {}; // eslint-disable-line

  // 异步存储数据
  setStorage = (key: string, value: string) => {}; // eslint-disable-line

  // 同步移除指定数据
  removeStorageSync = () => {}; // eslint-disable-line

  // 异步移除指定数据
  removeStorage = (key: string) => {
    storage?.delete({ key });
  };

  /**
   * 网络相关
   */
  // 获取网络类型
  getNetworkType = async (): Promise<{
    networkType: string;
  }> => {
    const self = this;
    return await new Promise((resolve) => {
      network?.getType({
        success: (res) => {
          self.network = res;
          resolve(res);
        },
        fail: () => resolve(null)
      });
    });
  };

  // 发起请求
  request = ({ url, header, method, data, success, fail, complete }) => {
    return fetch?.fetch({ url, header, method, data, success, fail, complete });
  };

  /**
   * 系统相关
   */
  // 获取设备系统信息
  getSystemInfo = async (): Promise<SystemInfo> => {
    const self = this;
    return await new Promise((resolve) => {
      device?.getInfo({
        success: (res) => {
          const info = {
            ...res,
            version: res.platformVersionName,
            platform: res.osType
          };
          self.systemInfo = info;
          resolve(info);
        },
        fail: () => resolve(null)
      });
    });
  };
}

export default QuickApp;
