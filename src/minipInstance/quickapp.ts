import { GrowingIOType } from '@@/types/growingIO';
import { isObject, isString, last } from '@@/utils/glodash';
import { limitString, niceTry } from '@@/utils/tools';
import { SystemInfo } from '@@/types/minipInstance';
import app from '@system.app';
import BaseImplements from './base';
import device from '@system.device';
import EMIT_MSG from '@@/constants/emitMsg';
import fetch from '@system.fetch';
import network from '@system.network';
import router from '@system.router';
import share from '@system.share';
import storage from '@system.storage';

class QuickApp extends BaseImplements {
  // 快应用存储只有异步 API。身份恢复前禁止 UserStore 生成临时 uid，
  // 首批事件会继续等待系统/网络元数据，并在释放时重建身份上下文。
  public identityReady = false;
  private appCreatedPromise: Promise<void>;
  private resolveAppCreated: () => void;
  private runtimeReadyPromise: Promise<void>;
  private storageWritable = false;
  private storageCache: Record<string, any> = {};
  private pendingStorageWrites: Record<string, any> = {};
  private pendingStorageDeletes: Record<string, boolean> = {};

  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.appCreatedPromise = new Promise((resolve) => {
      this.resolveAppCreated = resolve;
    });
    this.growingIO.emitter.on(EMIT_MSG.MINIP_LIFECYCLE, ({ event }) => {
      switch (event) {
        case 'App onCreate':
          {
            // @system.* 在应用创建前不保证可用，收到 onCreate 后才启动恢复。
            this.resolveAppCreated?.();
            this.ensureRuntimeReady();
          }
          break;
        case 'App onCreateEnd':
          {
            // 用户 onCreate 执行期间产生的写入先留在内存，恢复完成后再统一落盘，
            // 防止新生成的值覆盖尚未读取到的历史身份。
            this.resolveAppCreated?.();
            this.ensureRuntimeReady().then(() => {
              this.storageWritable = true;
              this.flushPendingStorage();
            });
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
  getCurrentPage = () =>
    niceTry(() => (router?.getPages ? last(router.getPages()) || {} : {})) ||
    {};

  // 获取当前页面路由
  getCurrentPath = () =>
    niceTry(() => (router?.getState ? router.getState()?.path || '' : '')) ||
    '';

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
  /**
   * 所有依赖快应用运行时的身份读取只执行一次，并作为系统、网络元数据加载的共同前置 Promise。
   */
  private ensureRuntimeReady = () => {
    if (!this.runtimeReadyPromise) {
      this.runtimeReadyPromise = this.appCreatedPromise.then(() =>
        this.restoreUserInfo()
      );
    }
    return this.runtimeReadyPromise;
  };

  /**
   * 将异步存储值预加载到内存。单个 key 最多等待 1 秒，平台不回调时也不能卡住首屏。
   * uid 优先采用已持久化值；其他身份字段保留启动前由客户显式设置的新值。
   */
  private loadStorageValue = (key: string, preferPersisted = false) =>
    new Promise<void>((resolve) => {
      if (!storage?.get) {
        resolve();
        return;
      }
      let settled = false;
      const finish = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve();
        }
      };
      const timeout = setTimeout(finish, 1000);
      try {
        storage.get({
          key,
          success: (result: any) => {
            const value = result?.data ?? result;
            const hasPendingWrite = Object.prototype.hasOwnProperty.call(
              this.pendingStorageWrites,
              key
            );
            if (
              !this.pendingStorageDeletes[key] &&
              (!hasPendingWrite || preferPersisted) &&
              value !== undefined &&
              value !== null
            ) {
              this.storageCache[key] = value;
              if (preferPersisted) {
                delete this.pendingStorageWrites[key];
              }
            }
            finish();
          },
          fail: finish
        });
      } catch (error) {
        finish();
      }
    });

  /**
   * 批量恢复所有已初始化实例的身份字段，再开放同步身份读取。
   */
  private restoreUserInfo = async () => {
    const { dataStore, userStore }: any = this.growingIO;
    const trackingIds = [...(dataStore?.initializedTrackingIds || [])];
    const uidKey = userStore._getUidKey();
    const storageKeys = [uidKey];
    trackingIds.forEach((trackingId: string) => {
      storageKeys.push(
        userStore._getUserIdKey(trackingId),
        userStore._getUserKeyKey(trackingId),
        userStore._getGioIdKey(trackingId)
      );
    });
    await Promise.all(
      storageKeys.map((key, index) => this.loadStorageValue(key, index === 0))
    );
    // 标记身份已就绪，再从缓存恢复稳定 uid；没有持久值时才生成新 uid。
    this.identityReady = true;
    userStore._uid = undefined;
    trackingIds.forEach((trackingId: string) => {
      niceTry(() => userStore.initUserInfo(trackingId));
    });
  };

  /**
   * 同步更新内存镜像；运行时可写之前先进入待写队列。
   */
  private writeStorage = (key: string, value: any) => {
    this.storageCache[key] = value;
    delete this.pendingStorageDeletes[key];
    if (this.storageWritable) {
      niceTry(() => storage?.set({ key, value }));
    } else {
      this.pendingStorageWrites[key] = value;
    }
  };

  /**
   * 身份恢复完成后按最终状态刷新写入和删除操作。
   */
  private flushPendingStorage = () => {
    Object.keys(this.pendingStorageWrites).forEach((key) => {
      niceTry(() =>
        storage?.set({ key, value: this.pendingStorageWrites[key] })
      );
    });
    Object.keys(this.pendingStorageDeletes).forEach((key) => {
      niceTry(() => storage?.delete({ key }));
    });
    this.pendingStorageWrites = {};
    this.pendingStorageDeletes = {};
  };

  // SDK 上层依赖同步存储语义，这里通过启动时预加载的内存镜像兼容。
  getStorageSync = (key: string) => {
    const value = this.storageCache[key];
    if (isObject(value) && value.expiredAt) {
      if (value.expiredAt < Date.now()) {
        this.removeStorageSync(key);
        return '';
      }
      return value.value;
    }
    return value;
  };

  setStorageSync = (key: string, value: any, expiredAt?: string | number) => {
    this.writeStorage(key, expiredAt ? { value, expiredAt } : value);
  };

  setStorage = (key: string, value: any) => {
    this.writeStorage(key, value);
  };

  removeStorageSync = (key: string) => {
    delete this.storageCache[key];
    delete this.pendingStorageWrites[key];
    if (this.storageWritable) {
      niceTry(() => storage?.delete({ key }));
    } else {
      this.pendingStorageDeletes[key] = true;
    }
  };

  /**
   * 网络相关
   */
  // 获取网络类型
  getNetworkType = async (): Promise<{
    networkType: string;
  }> => {
    await this.ensureRuntimeReady();
    const self = this;
    return await new Promise((resolve) => {
      network?.getType({
        success: (res) => {
          self.network = res;
          resolve(res);
        },
        fail: () => {
          self.network = { __gioFailed: true };
          resolve(self.network as any);
        }
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
    await this.ensureRuntimeReady();
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
        fail: () => {
          self.systemInfo = { __gioFailed: true };
          resolve(self.systemInfo as any);
        }
      });
    });
  };

  // 监听网络变更
  setNetworkStatusListener = () => {
    network.subscribe({
      callback: (data) => {
        if (data.type) {
          if (!this.network || typeof this.network !== 'object') {
            this.network = {};
          }
          this.network.networkType = data.type;
        }
      }
    });
  };
}

export default QuickApp;
