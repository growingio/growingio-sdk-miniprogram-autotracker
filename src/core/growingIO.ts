import {
  isArray,
  isEmpty,
  isFunction,
  isNil,
  isObject,
  keys,
  toString,
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
  niceCallback
} from '@@/utils/tools';
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
  public subKey: string;
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
  constructor() {
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

  // SDK初始化方法
  init = (options: any) => {
    // 初始化实例之前
    this.emitter.emit(EMIT_MSG.ON_SDK_INITIALIZE_BEFORE, { options });
    try {
      consoleText('Gio小程序SDK 初始化中...', 'info');
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
      const vdsConfig = this.dataStore.initTrackerOptions(options);
      // 广播基础配置初始化完成
      this.emitter?.emit(EMIT_MSG.OPTION_INITIALIZED, vdsConfig);
      // 标记SDK已初始化完成
      this.gioSDKInitialized = true;
      // 初始化实例hooker
      this.dataStore.initTrackerHooker(vdsConfig);
      // 手动初始化用户信息
      if (this.gioPlatform !== 'quickapp') {
        this.userStore.initUserInfo(options.trackingId);
      }
      // 广播SDK初始化完成
      this.emitter.emit(EMIT_MSG.SDK_INITIALIZED, vdsConfig);
      // 初始化完成后把实例注入到小程序全局
      if (!this.trackingId || this.trackingId === options.trackingId) {
        // ?直接挂载对象，存在问题：Page.data 触发深拷贝 存在循环引用会导致死循环
        getGlobal().__gio__ = () => this;
      }
      consoleText('Gio小程序SDK 初始化完成！', 'success');
      // 在插件中手动触发visit
      if (this.inPlugin && this.minipInstance.platform !== 'tbp') {
        this.dataStore.sendVisit(vdsConfig.trackingId);
      }
      if (this.vdsConfig.forceLogin) {
        consoleText(
          'forceLogin已开启，请调用 identify 方法设置 openId 以继续上报!',
          'info'
        );
      }
      return true;
    } catch (error) {
      consoleText(error, 'error');
      return false;
    }
  };

  // 需要校验实例的方法执行
  handlerDistribute = (trackingId: string, handler: string, args: any) => {
    const { initializedTrackingIds, getTrackerVds } = this.dataStore;
    const trakerVds = getTrackerVds(trackingId);
    if (trakerVds && initializedTrackingIds.includes(trackingId)) {
      return this[handler](trackingId, ...args);
    } else {
      consoleText(`不存在实例：${trackingId}，请检查!`, 'warn');
    }
  };

  // 手动注册插件
  registerPlugins = (plugins: any) => {
    this.plugins.pluginItems = [...this.plugins.pluginItems, ...plugins];
    this.plugins.installAll(plugins);
  };

  // 获取所有已注册插件
  getPlugins = () => this.plugins.pluginItems;

  // 获取设备ID（匿名用户ID）
  getDeviceId = () => this.userStore.getUid();

  // 运行中获取配置
  getOption = (trackingId: string, k?: string) =>
    this.dataStore.getOption(trackingId, k);

  // 运行中修改配置
  setOption = (trackingId: string, k: string, v: any) => {
    if (keys(ALLOW_SET_OPTIONS).includes(k)) {
      if (typeof v === DEFAULT_SETTINGS[k]?.type) {
        this.dataStore.setOption(trackingId, k, v);
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

  // 设置页面属性
  setPageAttributes = (trackingId: string, properties: any) => {
    const { currentPage } = this.dataStore.eventHooks;
    if (isEmpty(currentPage.pageProps[trackingId])) {
      currentPage.pageProps[trackingId] = {};
    }
    if (!isEmpty(properties)) {
      currentPage.pageProps[trackingId] = {
        ...currentPage.pageProps[trackingId],
        ...limitObject(properties)
      };
    }
  };

  // 手动发page
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

  // 设置设备ID，一般为openId
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
      // 在之后的请求中使用assignmentId作为uid(deviceId)使用
      this.userStore.setUid(asId);
      // 修改forceLogin配置项
      this.dataStore.setOption(this.trackingId, 'forceLogin', false);
      // 为已积压的请求使用assignmentId全部赋值deviceId
      this.dataStore.trackersExecute((tid: string) => {
        const hq = this.uploader.getHoardingQueue(tid);
        hq.forEach((o, i) => (hq[i].deviceId = asId));
        // 发送积压队列中的请求
        this.uploader.initiateRequest(tid, true);
      });
    } else {
      callError('identify', !1, 'forceLogin未开启');
    }
  };

  // 发送用户属性
  setUserAttributes = (trackingId: string, userAttributes: any) => {
    if (!isEmpty(userAttributes) && isObject(userAttributes)) {
      const { eventContextBuilder, eventInterceptor, lastVisitEvent } =
        this.dataStore;
      const event = {
        eventType: 'LOGIN_USER_ATTRIBUTES',
        attributes: limitObject(userAttributes),
        ...eventContextBuilder(trackingId)
      };
      // 该方法很可能被放在在app的onShow中的wx.login异步回调中，
      // 此时页面的path和query可能还没取到，就拿visit事件的path和query补上
      if (!event.path) {
        event.path = lastVisitEvent.path;
        event.query = lastVisitEvent.query;
        event.title = lastVisitEvent.title;
      }
      eventInterceptor(event);
    } else {
      callError('setUserAttributes');
    }
  };

  // 设置登录用户Id
  setUserId = (
    trackingId: string,
    userId: string | number,
    userKey?: string
  ) => {
    if (verifyId(userId)) {
      // 切换userId要重设session补发visit
      const prevId = this.userStore.getGioId(trackingId);
      userId = toString(userId).slice(0, 1000);
      userKey = toString(userKey).slice(0, 1000);
      this.userStore.setUserId(trackingId, userId);
      const { idMapping } = this.dataStore.getTrackerVds(trackingId);
      if (idMapping) {
        this.userStore.setUserKey(trackingId, isNil(userKey) ? '' : userKey);
      }
      // 切换userId时重置session并补发visit
      if (prevId && prevId !== userId) {
        this.userStore.setSessionId(trackingId);
        const { path, query, settedTitle } =
          this.dataStore.eventHooks.currentPage;
        // 重新获取页面title，防止切换配置前修改了title没取到
        this.dataStore.eventHooks.currentPage.title =
          settedTitle[path] ||
          this.minipInstance.getPageTitle(this.minipInstance.getCurrentPage());
        // visit取当前页面值
        this.dataStore.sendVisit(trackingId, { path, query });
      }
    } else {
      callError('setUserId');
    }
  };

  // 清除登录用户Id
  clearUserId = (trackingId: string) => {
    this.userStore.setUserId(trackingId, undefined);
    this.userStore.setUserKey(trackingId, undefined);
  };

  // 设置埋点事件的通用属性（即每个埋点事件都会带上的属性值）
  setGeneralProps = (trackingId: string, properties: any) => {
    if (!isEmpty(properties)) {
      this.dataStore.generalProps[trackingId] = {
        ...(this.dataStore.generalProps[trackingId] ?? {}),
        ...properties
      };
      return true;
    } else {
      callError('setGeneralProps');
      return false;
    }
  };

  // 清空已设置的埋点事件的通用属性
  clearGeneralProps = (
    trackingId: string,
    properties: string[] | undefined
  ) => {
    try {
      if (!isEmpty(this.dataStore.generalProps[trackingId])) {
        // 获取目标tracker的引用
        if (isArray(properties) && !isEmpty(properties)) {
          properties.forEach((propName: string) => {
            unset(this.dataStore.generalProps[trackingId], propName);
          });
        } else {
          this.dataStore.generalProps[trackingId] = {};
        }
      }
    } catch (error) {
      callError('setGeneralProps');
      return false;
    }
  };

  // 自定义埋点事件
  track = (
    trackingId: string,
    name: string,
    properties: { [key: string]: string | string[] }
  ) => {
    eventNameValidate(name, () => {
      const { eventContextBuilder, eventInterceptor, generalProps } =
        this.dataStore;
      const mergedProperties = {
        ...(generalProps[trackingId] ?? {}),
        ...(isObject(properties) && !isEmpty(properties) ? properties : {})
      };
      const event = {
        eventType: 'CUSTOM',
        eventName: name,
        attributes: limitObject(getDynamicAttributes(mergedProperties)),
        ...eventContextBuilder(trackingId)
      };
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

  // 初始化事件计时器
  trackTimerStart = (trackingId: string, eventName: string) => {
    const { dataCollect } = this.dataStore.getTrackerVds(trackingId);
    if (dataCollect) {
      return eventNameValidate(eventName, () => {
        const timerId = guid();
        if (!this.dataStore.trackTimers[trackingId]) {
          this.dataStore.trackTimers[trackingId] = {};
        }
        this.dataStore.trackTimers[trackingId][timerId] = {
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

  // 暂停事件计时器
  trackTimerPause = (trackingId: string, timerId: string) => {
    const timers = this.dataStore.trackTimers[trackingId];
    if (timerId && timers && timers[timerId]) {
      const timer = timers[timerId];
      if (timer.start) {
        timer.leng = timer.leng + (+Date.now() - timer.start);
      }
      timer.start = 0;
      return true;
    }
    return false;
  };

  // 恢复事件计时器
  trackTimerResume = (trackingId: string, timerId: string) => {
    const timers = this.dataStore.trackTimers[trackingId];
    if (timerId && timers && timers[timerId]) {
      const timer = timers[timerId];
      if (timer.start === 0) {
        timer.start = +Date.now();
      }
      return true;
    }
    return false;
  };

  // 停止事件计时器并上报事件
  trackTimerEnd = (trackingId: string, timerId: string, properties: any) => {
    const { dataCollect } = this.dataStore.getTrackerVds(trackingId);
    const timers = this.dataStore.trackTimers[trackingId];
    if (timerId && timers && timers[timerId]) {
      if (dataCollect) {
        const maxEnd = 60 * 60 * 24 * 1000;
        const timer = timers[timerId];
        if (timer.start !== 0) {
          const shortCut = +Date.now() - timer.start;
          timer.leng = shortCut > 0 ? timer.leng + shortCut : 0;
        }
        const { eventContextBuilder, eventInterceptor } = this.dataStore;
        const event = {
          eventType: 'CUSTOM',
          eventName: timer.eventName,
          attributes: limitObject({
            ...properties,
            event_duration: timer.leng > maxEnd ? 0 : timer.leng / 1000
          }),
          ...eventContextBuilder(trackingId)
        };
        // 埋点事件要保留'&&sendTo'字段用于多实例复制发送
        if (
          this.plugins.gioMultipleInstances &&
          properties &&
          properties['&&sendTo']
        ) {
          event['&&sendTo'] = properties['&&sendTo'];
        }
        eventInterceptor(event);
        return true;
      } else {
        consoleText('指定实例未开启数据采集，计时器已移除，请检查!', 'error');
        return false;
      }
      this.removeTimer(trackingId, timerId);
    } else {
      consoleText('未查询到指定计时器，请检查!', 'error');
      return false;
    }
  };

  // 移除事件计时器
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

  // 清除所有事件计时器
  clearTrackTimer = (trackingId: string) => {
    this.dataStore.trackTimers[trackingId] = {};
  };

  // 手动获取位置信息补发visit上报
  setLocation = (trackingId: string, latitude: number, longitude: number) => {
    if (isEmpty(this.dataStore.locationData[trackingId])) {
      this.dataStore.locationData[trackingId] = {};
    }
    const ld = this.dataStore.locationData[trackingId];
    const verifyLT = (o: number) => o >= -180 && o <= 180;
    if (
      verifyLT(latitude) &&
      verifyLT(longitude) &&
      (ld.latitude !== latitude || ld.longitude !== longitude)
    ) {
      this.dataStore.locationData[trackingId] = { latitude, longitude };
    }
  };

  // 手动更新曝光监听（该方法会在曝光插件加载时被重写）
  updateImpression = () => {
    consoleText(
      'updateImpression 错误! 请集成半自动埋点浏览插件后重试!',
      'error'
    );
  };

  // 获取A/B实验数据
  getABTest = (trackingId: string, layerId: string | number, callback: any) => {
    consoleText('获取ABTest数据错误! 请集成ABTest插件后重试!', 'error');
    niceCallback(callback, {});
  };

  // 获取打通信息
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
    const infos: any = {
      gioappid: appId,
      giocs1: getUserId(trackingId) || '',
      gioplatform: this.platformConfig.platform,
      gioprojectid: projectId,
      gios: getSessionId(trackingId),
      giou: getUid()
    };
    infos.giodatacollect = dataCollect;
    infos.giodatasourceid = dataSourceId;
    if (idMapping) {
      infos.giouserkey = getUserKey(trackingId);
    }
    if (!isEmpty(extraParams)) {
      extraParams.forEach((o) => {
        if (!ignoreFields.includes(o)) {
          infos[`gio${o}`] = this.dataStore.lastVisitEvent[o];
        }
      });
    }
    return qs.stringify(infos);
  };
}

export default GrowingIO;
