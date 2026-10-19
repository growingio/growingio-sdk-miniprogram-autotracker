import {
  forEach,
  isArray,
  isEmpty,
  isFunction,
  isNil,
  isObject,
  keys,
  toString,
  typeOf,
  unset
} from '@@/utils/glodash';
import {
  callError,
  consoleText,
  eventNameValidate,
  getDynamicAttributes,
  getGlobal,
  getPlainPlatform,
  guid,
  limitObject,
  niceCallback,
  niceTry,
  qsParse
} from '@@/utils/tools';
import { emitSafely } from '@@/utils/safeEmitter';
import { ALLOW_SET_OPTIONS, DEFAULT_SETTINGS } from '@@/constants/config';
import { DataStoreType, OriginOptions } from '@@/types/dataStore';
import { FRAMEWORKS, PLATFORMTYPES } from '@@/types/platforms';
import { GrowingIOType } from '@@/types/growingIO';
import { MinipInstanceType } from '@@/types/minipInstance';
import { PluginsType } from '@@/types/plugins';
import { UploaderType } from '@@/types/uploader';
import { UserStoreType } from '@@/types/userStore';
import { verifyId } from '@@/utils/verifiers';
import * as glodash from '@@/utils/glodash';
import * as tools from '@@/utils/tools';
import DataStore from './dataStore';
import mitt from 'mitt';
import platformConfig from '__GIO_PLATFORM_CONFIG__';
import PlatformInstance from '__GIO_PLATFORM_INSTANCE__';
import Plugins from '__GIO_PLUGIN_INSTANCE__';
import qs from 'querystringify';
import Uploader from './uploader';
import UserStore from '@@/core/userStore';
import EMIT_MSG from '@@/constants/emitMsg';

// SDK全局参数 版本号、小程序平台、框架名称、运行环境 均由打包工具替换写入
const sdkVersion: any = '__SDK_VERSION__';
const gioPlatform: any = '__GIO_PLATFORM__';
const gioFramework: any = '__GIO_FRAMEWORK__';

class GrowingIO implements GrowingIOType {
  public utils: any;
  public emitter: any;
  public gioPlatform: PLATFORMTYPES;
  public gioFramework: FRAMEWORKS;
  public sdkVersion: string;
  public inPlugin: boolean;
  public platformConfig: any;
  public gioSDKInitialized: boolean;
  public vdsConfig: OriginOptions;
  public minipInstance: MinipInstanceType;
  public userStore: UserStoreType;
  public dataStore: DataStoreType;
  public plugins: PluginsType;
  public uploader: UploaderType;
  // 当前主SDK的trackingId，用于区分事件归属。
  public trackingId: string;
  public subInstance: any;
  private _identified: boolean;
  constructor() {
    this.gioSDKInitialized = false;
    this.utils = { ...glodash, ...tools, qs };
    this.emitter = mitt();
    // 小程序平台
    this.gioPlatform =
      gioPlatform === 'framework' ? getPlainPlatform() : gioPlatform;
    // 框架
    this.gioFramework = gioFramework;
    // sdk版本号
    this.sdkVersion = sdkVersion;
    // 是否在小程序插件中
    try {
      // 没有getApp方法或没有App方法的认为在插件中
      if (
        this.gioPlatform === 'quickapp' ||
        (isFunction(getApp) && isFunction(App))
      ) {
        this.inPlugin = false;
      } else {
        this.inPlugin = true;
      }
    } catch (error) {
      this.inPlugin = true;
    }
    if (this.inPlugin) {
      consoleText('未检测到小程序实例，自动切换为插件模式!', 'info');
    }
    // 小程序实例配置
    this.platformConfig = platformConfig;
    // 小程序实例
    this.minipInstance = new PlatformInstance(this);
    // 数据中心实例
    this.dataStore = new DataStore(this);
    // 用户实例
    this.userStore = new UserStore(this);
    // 初始化请求逻辑
    this.uploader = new Uploader(this);
    // 插件管理实例
    this.plugins = new Plugins(this);
    // 加载内置插件
    this.plugins.innerPluginInit();
  }

  /**
   * SDK初始化方法
   * @param {any} options - 初始化参数
   * @returns {boolean} - 初始化结果
   */
  init = (options: any) => {
    const trackingId = options?.trackingId;
    const globalContext = getGlobal();
    const previous = {
      trackingId: this.trackingId,
      vdsConfig: this.vdsConfig,
      initialized: this.gioSDKInitialized,
      inPlugin: this.inPlugin,
      canHook: this.platformConfig.canHook,
      subConfig: this.subInstance?.[trackingId],
      globalConfig: globalContext.vdsConfig,
      globalSubInstances: globalContext.vdsConfig?.subInstance,
      globalSubConfig: globalContext.vdsConfig?.subInstance?.[trackingId]
    };
    const wasTrackerInitialized =
      this.dataStore.initializedTrackingIds.includes(trackingId);
    let vdsConfig: OriginOptions;
    try {
      // 多实例等扩展需要在准备配置前安装核心行为，失败仍属于未提交初始化。
      this.emitter.emit(EMIT_MSG.ON_SDK_INITIALIZE_BEFORE, { options });
      consoleText('Gio小程序SDK 初始化中...', 'info');
      // 框架包可能被误放入不支持的平台。构造阶段保持安全，初始化阶段明确失败，
      // 避免 SDK 抛异常影响宿主应用，同时也不误上报不完整数据。
      if (this.platformConfig?.supported === false) {
        throw new Error(
          `当前 ${this.gioFramework} SDK 不支持 ${
            this.gioPlatform || '未知'
          } 平台，已停止初始化!`
        );
      }
      if (
        options.trackingId &&
        this.dataStore.initializedTrackingIds.includes(options.trackingId)
      ) {
        throw new Error(`已存在实例 ${options.trackingId}，请勿重复初始化!`);
      }
      if (this.trackingId && !this.plugins.gioMultipleInstances) {
        throw new Error('您正在尝试初始化另一个实例，请集成多实例插件后重试!');
      }
      // 初始化实例配置
      vdsConfig = this.dataStore.initTrackerOptions(options);
      // 配置已备好，适配器可据此准备身份继承等扩展；此时尚未取得采集资格。
      emitSafely(this.emitter, EMIT_MSG.OPTION_INITIALIZED, vdsConfig);
      // 初始化实例hooker
      if (!this.dataStore.initTrackerHooker(vdsConfig)) {
        throw new Error('SDK 框架适配初始化失败，已停止采集以避免假成功');
      }
      // 存储和身份是核心准备步骤，不能依赖可被观察者打断的完成广播。
      this.dataStore.initStorageInfo(trackingId);
      if (this.gioPlatform !== 'quickapp') {
        this.userStore.initUserInfo(trackingId);
      }
    } catch (error) {
      // 只回滚本次尚未成功的实例。子实例初始化失败不能关闭已成功的主实例，
      // 也不能把半初始化配置留在子实例集合中，影响之后的重试和事件广播。
      if (
        !wasTrackerInitialized &&
        !this.dataStore.initializedTrackingIds.includes(trackingId)
      ) {
        this.gioSDKInitialized = !!previous.initialized;
        this.trackingId = previous.trackingId;
        this.vdsConfig = previous.vdsConfig;
        this.inPlugin = previous.inPlugin;
        this.platformConfig.canHook = previous.canHook;
        if (this.subInstance) {
          if (previous.subConfig === undefined) {
            unset(this.subInstance, trackingId);
          } else {
            this.subInstance[trackingId] = previous.subConfig;
          }
        }
        globalContext.vdsConfig = previous.globalConfig;
        if (previous.globalConfig) {
          if (previous.globalSubInstances) {
            if (previous.globalSubConfig === undefined) {
              unset(previous.globalSubInstances, trackingId);
            } else {
              previous.globalSubInstances[trackingId] =
                previous.globalSubConfig;
            }
            previous.globalConfig.subInstance = previous.globalSubInstances;
          } else {
            unset(previous.globalConfig, 'subInstance');
          }
        }
      }
      consoleText(error, 'error');
      return false;
    }

    // 一次提交采集资格。SDK 完成通知与首次事件失败不能撤销成功。
    this.dataStore.initializedTrackingIds.push(trackingId);
    this.gioSDKInitialized = true;
    emitSafely(this.emitter, EMIT_MSG.SDK_INITIALIZED, vdsConfig);
    niceTry(() => {
      if (!this.trackingId || this.trackingId === trackingId) {
        // 使用函数避免 Page.data 深拷贝 SDK 对象时遇到循环引用。
        globalContext.__gio__ = () => this;
      }
    });
    niceTry(() => consoleText('Gio小程序SDK 初始化完成！', 'success'));
    if (this.inPlugin && this.minipInstance.platform !== 'tbp') {
      niceTry(() => this.dataStore.sendVisit(vdsConfig.trackingId));
    }
    if (this.vdsConfig.forceLogin) {
      niceTry(() =>
        consoleText(
          'forceLogin已开启，请调用 identify 方法设置 openId 以继续上报!',
          'info'
        )
      );
    }
    return true;
  };

  /**
   * 需要校验实例的方法执行
   * @param {string} trackingId - 实例 ID
   * @param {string} handler - 方法名
   * @param {any} args - 参数
   * @returns {any} - 执行结果
   */
  handlerDistribute = (trackingId: string, handler: string, args: any) => {
    const { initializedTrackingIds, getTrackerVds } = this.dataStore;
    const trackerVds = getTrackerVds(trackingId);
    if (trackerVds && initializedTrackingIds.includes(trackingId)) {
      return this[handler](trackingId, ...args);
    } else {
      consoleText(`不存在实例：${trackingId}，请检查!`, 'warn');
    }
  };

  /**
   * 手动注册插件
   * @param {any} plugins - 插件列表
   */
  registerPlugins = (plugins: any) => {
    this.plugins.pluginItems = [...this.plugins.pluginItems, ...plugins];
    this.plugins.installAll(plugins);
  };

  /**
   * 获取所有已注册插件
   * @returns {any[]} - 插件列表
   */
  getPlugins = () => this.plugins.pluginItems;

  /**
   * 获取设备ID（匿名用户ID）
   * @returns {string} - 设备ID
   */
  getDeviceId = () => this.userStore.getUid();

  /**
   * 运行中获取配置
   * @param {string} trackingId - 实例 ID
   * @param {string} [k] - 配置键名
   * @returns {any} - 配置值
   */
  getOption = (trackingId: string, k?: string) =>
    this.dataStore.getOption(trackingId, k);

  /**
   * 运行中修改配置
   * @param {string} trackingId - 实例 ID
   * @param {string} k - 配置键名
   * @param {any} v - 配置值
   * @returns {boolean} - 是否修改成功
   */
  setOption = (trackingId: string, k: string, v: any) => {
    if (keys(ALLOW_SET_OPTIONS).includes(k)) {
      if (typeOf(v) === DEFAULT_SETTINGS[k]?.type) {
        if (!this.dataStore.setOption(trackingId, k, v)) {
          return false;
        }
        consoleText(`已修改${ALLOW_SET_OPTIONS[k]}: ${v}`, 'info');
        return true;
      } else {
        consoleText(`参数格式不正确：${v}，请检查后重试!`, 'error');
        return false;
      }
    } else {
      consoleText(`不存在可修改的配置项：${k}，请检查后重试!`, 'error');
      return false;
    }
  };

  /**
   * 设置页面属性
   * @param {string} trackingId - 实例 ID
   * @param {any} properties - 页面属性对象
   * @returns {boolean} - 是否设置成功
   */
  setPageAttributes = (trackingId: string, properties: any) => {
    if (isObject(properties) && !isEmpty(properties)) {
      const { currentPage } = this.dataStore.eventHooks;
      const path = currentPage.getPagePath();
      if (isEmpty(currentPage.pageProps[trackingId])) {
        currentPage.pageProps[trackingId] = {};
      }
      if (isEmpty(currentPage.pageProps[trackingId][path])) {
        currentPage.pageProps[trackingId][path] = {};
      }
      // 结果合并，动态属性不作处理
      if (!isEmpty(properties)) {
        forEach(properties, (v, k) => {
          if (
            !isFunction(currentPage.pageProps[trackingId][path][k]) ||
            isFunction(v)
          ) {
            currentPage.pageProps[trackingId][path][k] = v;
          }
        });
      }
      return true;
    } else {
      callError('setPageAttributes');
      return false;
    }
  };

  /**
   * 清空已设置的页面属性
   * @param {string} trackingId - 实例 ID
   * @param {string[] | undefined} properties - 需要清空的属性名列表，如果不传则清空所有
   * @returns {boolean} - 是否清空成功
   */
  clearPageAttributes = (
    trackingId: string,
    properties: string[] | undefined
  ) => {
    try {
      if (
        !isEmpty(this.dataStore.eventHooks.currentPage.pageProps[trackingId])
      ) {
        const { currentPage } = this.dataStore.eventHooks;
        const path = currentPage.getPagePath();
        if (isArray(properties) && !isEmpty(properties)) {
          properties.forEach((propName: string) => {
            unset(currentPage.pageProps[trackingId][path], propName);
          });
        } else {
          currentPage.pageProps[trackingId][path] = {};
        }
      }
    } catch (error) {
      callError('clearPageAttributes');
      return false;
    }
  };

  /**
   * 手动发送页面浏览事件
   * @param {string} trackingId - 实例 ID
   * @param {any} [props] - 事件属性
   */
  sendPage = (trackingId: string, props?: any) => {
    const { trackPage } = this.dataStore.getTrackerVds(trackingId);
    if (!trackPage) {
      this.dataStore.sendPage(trackingId, props);
    } else {
      consoleText(
        '仅在关闭trackPage时允许调用sendPage，请确认后修改初始化配置项!',
        'error'
      );
    }
  };

  /**
   * 设置设备ID，一般为openId
   * @param {string} trackingId - 实例 ID
   * @param {string | number} assignmentId - 设备ID
   */
  identify = (trackingId: string, assignmentId: string | number) => {
    if (trackingId !== this.trackingId) {
      callError('identify', !1, '子实例不允许调用identify');
      return;
    }
    if (this.vdsConfig.forceLogin) {
      if (!verifyId(assignmentId)) {
        callError('identify');
        return;
      }
      // 截取长度
      const asId = toString(assignmentId).slice(0, 1000);
      this.userStore.runIdentityTransaction(trackingId, () => {
        // 身份通知必须看到已解除 forceLogin 的完整状态。
        this.userStore.setUid(asId);
        this.dataStore.setInternalOption(this.trackingId, 'forceLogin', false);
        this._identified = true;
        // 为已积压的请求使用assignmentId全部赋值deviceId
        this.dataStore.trackersExecute((tid: string) => {
          const hq = this.uploader.getHoardingQueue(tid);
          hq.forEach((o, i) => (hq[i].deviceId = asId));
          this.uploader.initiateRequest(tid, true);
        });
      });
    } else if (this._identified) {
      callError('identify', !1, '请勿重复调用');
    } else {
      callError('identify', !1, 'forceLogin未开启');
    }
  };

  /**
   * 发送用户属性
   * @param {string} trackingId - 实例 ID
   * @param {any} userAttributes - 用户属性对象
   */
  setUserAttributes = (trackingId: string, userAttributes: any) => {
    if (isObject(userAttributes) && !isEmpty(userAttributes)) {
      const { eventContextBuilder, eventInterceptor, lastVisitEvent } =
        this.dataStore;
      const event = {
        eventType: 'LOGIN_USER_ATTRIBUTES',
        ...eventContextBuilder(trackingId)
      };
      event.attributes = limitObject({
        ...(event.attributes ?? {}),
        ...getDynamicAttributes(userAttributes)
      });
      // 该方法很可能被放在在app的onShow中的wx.login异步回调中，
      // 此时页面的path和query可能还没取到，就拿visit事件的path和query补上
      if (!event.path) {
        event.path = lastVisitEvent[trackingId]?.path;
        event.query = lastVisitEvent[trackingId]?.query;
        event.title = lastVisitEvent[trackingId]?.title;
      }
      eventInterceptor(event);
    } else {
      callError('setUserAttributes');
    }
  };

  /**
   * 设置登录用户Id
   * @param {string} trackingId - 实例 ID
   * @param {string | number} userId - 用户 ID
   * @param {string} [userKey] - 用户 Key
   */
  setUserId = (
    trackingId: string,
    userId: string | number,
    userKey?: string
  ) => {
    if (verifyId(userId)) {
      // 切换userId要重设session补发visit
      const prevId = this.userStore.getGioId(trackingId);
      const processedUserId = toString(userId).slice(0, 1000);
      userKey = toString(userKey).slice(0, 1000);
      let processedUserKey =
        !isNil(userKey) && toString(userKey).length > 0
          ? toString(userKey).slice(0, 1000)
          : '';
      const { idMapping } = this.dataStore.getTrackerVds(trackingId);
      if (!idMapping && processedUserKey) {
        consoleText('您设置了 userKey ，请初始化开启 idMapping!', 'warn');
        processedUserKey = '';
      }
      this.userStore.runIdentityTransaction(trackingId, () => {
        this.userStore.setUserId(trackingId, processedUserId);
        this.userStore.setUserKey(trackingId, processedUserKey);
        // 切换userId时重置session
        if (prevId && prevId !== processedUserId) {
          this.userStore.setSessionId(trackingId);
        }
      });
    } else {
      callError('setUserId');
    }
  };

  /**
   * 清除登录用户Id
   * @param {string} trackingId - 实例 ID
   */
  clearUserId = (trackingId: string) => {
    this.userStore.runIdentityTransaction(trackingId, () => {
      this.userStore.setUserId(trackingId, undefined);
      this.userStore.setUserKey(trackingId, undefined);
    });
  };

  /**
   * 设置全局通用属性（即每个事件都会带上的属性值）
   * @param {string} trackingId - 实例 ID
   * @param {any} properties - 属性对象
   * @returns {boolean} - 是否设置成功
   */
  setGeneralProps = (trackingId: string, properties: any) => {
    if (isObject(properties) && !isEmpty(properties)) {
      if (isEmpty(this.dataStore.generalProps[trackingId])) {
        this.dataStore.generalProps[trackingId] = {};
      }
      forEach(properties, (v, k) => {
        if (
          !isFunction(this.dataStore.generalProps[trackingId][k]) ||
          isFunction(v)
        ) {
          this.dataStore.generalProps[trackingId][k] = v;
        }
      });
      return true;
    } else {
      callError('setGeneralProps');
      return false;
    }
  };

  /**
   * 清空已设置的全局通用属性
   * @param {string} trackingId - 实例 ID
   * @param {string[] | undefined} properties - 需要清空的属性名列表，如果不传则清空所有
   * @returns {boolean} - 是否清空成功
   */
  clearGeneralProps = (
    trackingId: string,
    properties: string[] | undefined
  ) => {
    try {
      if (!isEmpty(this.dataStore.generalProps[trackingId])) {
        if (isArray(properties) && !isEmpty(properties)) {
          properties.forEach((propName: string) => {
            unset(this.dataStore.generalProps[trackingId], propName);
          });
        } else {
          this.dataStore.generalProps[trackingId] = {};
        }
      }
    } catch (error) {
      callError('clearGeneralProps');
      return false;
    }
  };

  /**
   * 自定义埋点事件
   * @param {string} trackingId - 实例 ID
   * @param {string} eventName - 事件名称
   * @param {object} properties - 事件属性
   */
  track = (
    trackingId: string,
    eventName: string,
    properties: { [key: string]: string | string[] }
  ) => {
    eventNameValidate(eventName, () => {
      const { eventContextBuilder, eventInterceptor } = this.dataStore;
      const event = {
        eventType: 'CUSTOM',
        eventName,
        ...eventContextBuilder(trackingId)
      };
      event.attributes = limitObject({
        ...(event.attributes ?? {}),
        ...getDynamicAttributes({
          ...(isObject(properties) && !isEmpty(properties) ? properties : {})
        })
      });
      // 埋点事件要保留'&&sendTo'字段用于多实例复制发送
      if (
        this.plugins.gioMultipleInstances &&
        properties &&
        properties['&&sendTo']
      ) {
        event['&&sendTo'] = properties['&&sendTo'];
      }
      eventInterceptor(event);
    });
  };

  /**
   * 初始化事件计时器
   * @param {string} trackingId - 实例 ID
   * @param {string} eventName - 事件名称
   * @returns {string | false} - 计时器 ID 或失败
   */
  trackTimerStart = (trackingId: string, eventName: string) => {
    const { dataCollect } = this.dataStore.getTrackerVds(trackingId);
    if (dataCollect) {
      return eventNameValidate(eventName, () => {
        const timerId = guid();
        if (!this.dataStore.trackTimers[trackingId]) {
          this.dataStore.trackTimers[trackingId] = {};
        }
        this.dataStore.trackTimers[trackingId][timerId] = {
          ended: false,
          eventName,
          leng: 0,
          start: +Date.now()
        };
        return timerId;
      });
    } else {
      consoleText('指定实例未开启数据采集，请检查!', 'error');
    }
    return false;
  };

  /**
   * 暂停事件计时器
   * @param {string} trackingId - 实例 ID
   * @param {string} timerId - 计时器 ID
   * @returns {boolean} - 是否暂停成功
   */
  trackTimerPause = (trackingId: string, timerId: string) => {
    const timers = this.dataStore.trackTimers[trackingId];
    if (timerId && timers && timers[timerId]) {
      const timer = timers[timerId];
      if (timer.ended) {
        return false;
      }
      if (timer.start) {
        timer.leng = timer.leng + (+Date.now() - timer.start);
      }
      timer.start = 0;
      return true;
    }
    return false;
  };

  /**
   * 恢复事件计时器
   * @param {string} trackingId - 实例 ID
   * @param {string} timerId - 计时器 ID
   * @returns {boolean} - 是否恢复成功
   */
  trackTimerResume = (trackingId: string, timerId: string) => {
    const timers = this.dataStore.trackTimers[trackingId];
    if (timerId && timers && timers[timerId]) {
      const timer = timers[timerId];
      if (timer.ended) {
        return false;
      }
      if (timer.start === 0) {
        timer.start = +Date.now();
      }
      return true;
    }
    return false;
  };

  /**
   * 停止事件计时器并上报事件
   * @param {string} trackingId - 实例 ID
   * @param {string} timerId - 计时器 ID
   * @param {any} properties - 事件属性
   * @returns {boolean} - 是否上报成功
   */
  trackTimerEnd = (trackingId: string, timerId: string, properties: any) => {
    const { dataCollect } = this.dataStore.getTrackerVds(trackingId);
    const timers = this.dataStore.trackTimers[trackingId];
    if (timerId && timers && timers[timerId]) {
      const timer = timers[timerId];
      if (timer.ended) {
        consoleText('指定计时器已结束，请勿重复调用!', 'warn');
        return false;
      }
      if (dataCollect) {
        const maxEnd = 60 * 60 * 24 * 1000;
        if (timer.start !== 0) {
          const shortCut = +Date.now() - timer.start;
          timer.leng = shortCut > 0 ? timer.leng + shortCut : 0;
        }
        const { eventContextBuilder, eventInterceptor } = this.dataStore;
        const event = {
          eventType: 'CUSTOM',
          eventName: timer.eventName,
          ...eventContextBuilder(trackingId)
        };
        event.attributes = limitObject({
          ...(event.attributes ?? {}),
          ...getDynamicAttributes({
            ...(isObject(properties) && !isEmpty(properties) ? properties : {}),
            event_duration: timer.leng > maxEnd ? 0 : timer.leng / 1000
          })
        });
        // 埋点事件要保留'&&sendTo'字段用于多实例复制发送
        if (
          this.plugins.gioMultipleInstances &&
          properties &&
          properties['&&sendTo']
        ) {
          event['&&sendTo'] = properties['&&sendTo'];
        }
        eventInterceptor(event);
        timer.ended = true;
        timer.start = 0;
        return true;
      } else {
        consoleText('指定实例未开启数据采集，计时器已停止，请检查!', 'error');
        timer.ended = true;
        timer.start = 0;
        return false;
      }
    } else {
      consoleText('未查询到指定计时器，请检查!', 'error');
      return false;
    }
  };

  /**
   * 移除事件计时器
   * @param {string} trackingId - 实例 ID
   * @param {string} timerId - 计时器 ID
   * @returns {boolean} - 是否移除成功
   */
  removeTimer = (trackingId: string, timerId: string) => {
    const timers = this.dataStore.trackTimers[trackingId];
    if (timerId && timers && timers[timerId]) {
      delete timers[timerId];
      return true;
    } else {
      consoleText('未查询到指定计时器，请检查!', 'error');
      return false;
    }
  };

  /**
   * 清除所有事件计时器
   * @param {string} trackingId - 实例 ID
   */
  clearTrackTimer = (trackingId: string) => {
    this.dataStore.trackTimers[trackingId] = {};
  };

  /**
   * 手动获取位置信息补发visit上报
   * @param {string} trackingId - 实例 ID
   * @param {number} latitude - 纬度
   * @param {number} longitude - 经度
   */
  setLocation = (trackingId: string, latitude: number, longitude: number) => {
    if (isEmpty(this.dataStore.locationData[trackingId])) {
      this.dataStore.locationData[trackingId] = {};
    }
    const ld = this.dataStore.locationData[trackingId];
    const verifyLatitude = (o: number) => o >= -90 && o <= 90;
    const verifyLongitude = (o: number) => o >= -180 && o <= 180;
    if (
      verifyLatitude(latitude) &&
      verifyLongitude(longitude) &&
      (ld.latitude !== latitude || ld.longitude !== longitude)
    ) {
      this.dataStore.locationData[trackingId] = { latitude, longitude };
    }
  };

  /**
   * 清除手动设置的位置信息
   * @param {string} trackingId - 实例 ID
   */
  clearLocation = (trackingId: string) => {
    this.dataStore.locationData[trackingId] = {};
  };

  /**
   * 手动更新曝光监听（该方法会在曝光插件加载时被重写）
   */
  updateImpression = () => {
    consoleText(
      'updateImpression 错误! 请集成半自动埋点浏览插件后重试!',
      'error'
    );
  };

  /**
   * 获取 A/B 实验数据
   * @param {string} trackingId - 实例 ID
   * @param {string | number} layerId - 层 ID
   * @param {any} callback - 回调函数
   */
  getABTest = (trackingId: string, layerId: string | number, callback: any) => {
    consoleText('获取ABTest数据错误! 请集成ABTest插件后重试!', 'error');
    niceCallback(callback, {});
  };

  /**
   * 获取打通信息
   * @param {string} trackingId - 实例 ID
   * @returns {string} - 打通信息查询字符串
   */
  getGioInfo = (trackingId: string) => {
    const { getUid, getUserId, getUserKey, getSessionId } = this.userStore;
    const {
      projectId,
      appId,
      dataSourceId,
      dataCollect,
      idMapping,
      extraParams,
      ignoreFields
    } = this.dataStore.getTrackerVds(trackingId);
    // 先确定设备是否首次创建；随后创建的首个 session 才能正确继承该状态。
    const deviceId = getUid();
    const sessionId = getSessionId(trackingId);
    const infos: any = {
      gioappid: appId,
      giocs1: getUserId(trackingId) || '',
      gioplatform: this.platformConfig.platform,
      gioprojectid: projectId,
      gios: sessionId,
      giou: deviceId,
      // 内嵌 Web 的 AB 分流必须继承小程序本次设备创建状态，不能用 H5 自己的设备首次标记。
      gionewdevice: this.userStore.isNewDeviceInSession(trackingId)
    };
    infos.giodatacollect = dataCollect;
    infos.giodatasourceid = dataSourceId;
    if (idMapping) {
      infos.giouserkey = getUserKey(trackingId);
    }
    if (!isEmpty(extraParams)) {
      extraParams.forEach((o) => {
        if (!ignoreFields.includes(o)) {
          infos[`gio${o}`] = (this.dataStore.lastVisitEvent[trackingId] ?? {})[
            o
          ];
        }
      });
    }
    // 只有主实例有可能会带圈选的字段
    if (trackingId === this.trackingId) {
      // 小程序处于圈选状态时，把圈选上报地址带给web
      const { circleServerUrl, circleOpen } =
        this.plugins?.gioEventAutoTracking ?? {};
      if (circleServerUrl && circleOpen) {
        // infos.giocircleserverurl = encodeURIComponent(circleServerUrl);
        const circleParam: any = qsParse(circleServerUrl.split('?')[1]);
        if (circleParam.roomId) {
          infos.giocircleroomid = circleParam.roomId;
        }
      }
    }
    return qs.stringify(infos);
  };
}

export default GrowingIO;
