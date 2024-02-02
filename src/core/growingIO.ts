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
  getAppInst,
  getPlainPlatform,
  guid,
  limitObject
} from '@@/utils/tools';
import { ALLOWED_MODIFY_OPTIONS } from '@@/constants/config';
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
import Plugins from '@@/core/plugins';
import qs from 'querystringify';
import Uploader from './uploader';
import UserStore from '@@/core/userStore';

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
    // 插件管理实例
    this.plugins = new Plugins(this);
    // 加载内置插件
    this.plugins.innerPluginInit();
    // 数据管理实例和上传实例均在各自环境中继承实现
  }

  // 手动注册插件
  registerPlugins = (plugins: any) => {
    this.plugins.pluginItems = [...this.plugins.pluginItems, ...plugins];
    this.plugins.installAll(plugins);
  };

  // SDK初始化方法
  init = (args: any) => {
    consoleText('Gio小程序SDK 初始化中...', 'info');
    // 初始化全局配置
    this.dataStore.initOptions(args);
    // 广播基础配置初始化完成
    this.emitter?.emit('OPTION_INITIALIZED', this);
    // 标记SDK已初始化完成
    this.gioSDKInitialized = true;
    // 初始化完成后把实例注入到小程序全局
    // ?注意不要轻易修改实例挂载的地方(这里指app)，会影响分包插件和运营SDK的实例取值
    if (!this.vdsConfig.subpackage) {
      const app = getAppInst();
      // 直接挂载对象，存在问题：Page.data 触发深拷贝 存在循环引用会导致死循环
      app.__gio__ = () => {
        return this;
      };
    }
    // 初始化请求逻辑
    this.uploader = new Uploader(this);
    // 没有开启IDMapping的时候要把userKey清掉，防止之前有数被带到上报数据里
    if (!this.vdsConfig.idMapping) {
      this.userStore.userKey = '';
    }
    // 广播SDK初始化完成
    this.emitter.emit('SDK_INITIALIZED', this);
    consoleText('Gio小程序SDK 初始化完成！', 'success');
    if (this.vdsConfig.forceLogin) {
      consoleText(
        'forceLogin已开启，请调用 identify 方法设置 openId 以继续上报!',
        'info'
      );
    }
    // 在插件中手动触发visit
    if (this.inPlugin && this.minipInstance.platform !== 'tbp') {
      this.dataStore.sendVisit();
    }
    return true;
  };

  // 运行中获取配置
  getOption = (k?: string) => this.dataStore.getOption(k);

  // 运行中修改配置
  setOption = (k: string, v: any) => {
    if (keys(ALLOWED_MODIFY_OPTIONS).includes(k)) {
      const r = this.dataStore.setOption(k, v);
      if (r && ALLOWED_MODIFY_OPTIONS[k]) {
        consoleText(
          `已${v ? '开启' : '关闭'}${ALLOWED_MODIFY_OPTIONS[k]}`,
          'info'
        );
      }
      return r;
    } else {
      consoleText(`不存在可修改的配置项：${k}，请检查后重试!`, 'warn');
      return false;
    }
  };

  // 获取设备ID（匿名用户ID）
  getDeviceId = () => this.userStore.uid;

  // 设置设备ID，一般为openId
  identify = (assignmentId: string | number) => {
    if (this.vdsConfig.forceLogin) {
      if (!verifyId(assignmentId)) {
        callError('identify');
        return;
      }
      // 截取长度
      const asId = toString(assignmentId).slice(0, 1000);
      // 在之后的请求中使用assignmentId作为uid(deviceId)使用
      this.userStore.uid = asId;
      // 为已积压的请求使用assignmentId全部赋值deviceId
      this.uploader.hoardingQueue.forEach(
        (o, i) => (this.uploader.hoardingQueue[i].deviceId = asId)
      );
      this.dataStore.setOption('forceLogin', false);
      // 发送积压队列中的请求
      this.uploader.initiateRequest(true);
    } else {
      callError('identify', !1, 'forceLogin未开启');
    }
  };

  // 设置登录用户Id
  setUserId = (userId: string | number, userKey?: string) => {
    if (verifyId(userId)) {
      // 切换userId要重设session补发visit
      const prevId = this.userStore.gioId;
      userId = toString(userId).slice(0, 1000);
      userKey = toString(userKey).slice(0, 1000);
      this.userStore.userId = userId;
      if (this.vdsConfig.idMapping) {
        this.userStore.userKey = isNil(userKey) ? '' : userKey;
      }
      // 切换userId时重置session并补发visit
      if (prevId && prevId !== userId) {
        this.userStore.sessionId = '';
        const { path, query, settedTitle } =
          this.dataStore.eventHooks.currentPage;
        // 重新获取页面title，防止切换配置前修改了title没取到
        this.dataStore.eventHooks.currentPage.title =
          settedTitle[path] ||
          this.minipInstance.getPageTitle(this.minipInstance.getCurrentPage());
        // visit取当前页面值
        this.dataStore.sendVisit({ path, query });
      }
    } else {
      callError('setUserId');
    }
  };

  // 清除登录用户Id
  clearUserId = () => {
    this.userStore.userId = undefined;
    this.userStore.userKey = undefined;
  };

  // 发送用户属性
  setUserAttributes = (userAttributes: any) => {
    if (!isEmpty(userAttributes) && isObject(userAttributes)) {
      this.plugins?.gioCustomTracking?.buildUserAttributesEvent(userAttributes);
    } else {
      callError('setUserAttributes');
    }
  };

  // 自定义埋点事件
  track = (name: string, properties: { [key: string]: string | string[] }) => {
    const customEvent =
      this.plugins?.gioCustomTracking?.buildCustomEvent || function () {};
    customEvent(name, {
      ...this.dataStore.generalProps,
      ...(isObject(properties) && !isEmpty(properties) ? properties : {})
    });
  };

  // 初始化事件计时器
  trackTimerStart = (eventName: string) => {
    if (this.vdsConfig.dataCollect) {
      return eventNameValidate(eventName, () => {
        const timerId = guid();
        this.dataStore.trackTimers[timerId] = {
          eventName,
          leng: 0,
          start: +Date.now()
        };
        return timerId;
      });
    }
    return false;
  };

  // 暂停事件计时器
  trackTimerPause = (timerId: string) => {
    if (timerId && this.dataStore.trackTimers[timerId]) {
      const tracker = this.dataStore.trackTimers[timerId];
      if (tracker.start) {
        tracker.leng = tracker.leng + (+Date.now() - tracker.start);
      }
      tracker.start = 0;
      return true;
    }
    return false;
  };

  // 恢复事件计时器
  trackTimerResume = (timerId: string) => {
    if (timerId && this.dataStore.trackTimers[timerId]) {
      const tracker = this.dataStore.trackTimers[timerId];
      if (tracker.start === 0) {
        tracker.start = +Date.now();
      }
      return true;
    }
    return false;
  };

  // 停止事件计时器并上报事件
  trackTimerEnd = (timerId: string, attributes: any) => {
    if (this.vdsConfig.dataCollect) {
      const maxEnd = 60 * 60 * 24 * 1000;
      if (timerId && this.dataStore.trackTimers[timerId]) {
        const tracker = this.dataStore.trackTimers[timerId];
        if (tracker.start !== 0) {
          const shortCut = +Date.now() - tracker.start;
          tracker.leng = shortCut > 0 ? tracker.leng + shortCut : 0;
        }
        // 要直接构建custom事件，不要去调用埋点插件的方法，万一插件没有加载就发不出去了
        const { eventContextBuilder, eventInterceptor } = this.dataStore;
        const event = {
          eventType: 'CUSTOM',
          eventName: tracker.eventName,
          attributes: limitObject({
            ...attributes,
            event_duration: tracker.leng > maxEnd ? 0 : tracker.leng / 1000
          }),
          ...eventContextBuilder(),
          customEventType: 0
        };
        eventInterceptor(event);
        this.removeTimer(timerId);
        return true;
      } else {
        consoleText('未查找到对应的计时器，请检查!', 'error');
        return false;
      }
    }
    return false;
  };

  // 移除事件计时器
  removeTimer = (timerId: string) => {
    if (timerId && this.dataStore.trackTimers[timerId]) {
      delete this.dataStore.trackTimers[timerId];
      return true;
    }
    return false;
  };

  // 清除所有事件计时器
  clearTrackTimer = () => {
    this.dataStore.trackTimers = {};
  };

  // 设置埋点事件的通用属性（即每个埋点事件都会带上的属性值）
  setGeneralProps = (properties: any) => {
    if (isObject(properties) && !isEmpty(properties)) {
      this.dataStore.generalProps = {
        ...this.dataStore.generalProps,
        ...properties
      };
      keys(this.dataStore.generalProps).forEach((k: string) => {
        if ([undefined, null].includes(this.dataStore.generalProps[k])) {
          this.dataStore.generalProps[k] = '';
        }
      });
    } else {
      callError('setGeneralProps');
    }
  };

  // 清空已设置的埋点事件的通用属性
  clearGeneralProps = (properties: string[] | undefined) => {
    if (isArray(properties) && !isEmpty(properties)) {
      properties.forEach((prop: string) => {
        unset(this.dataStore.generalProps, prop);
      });
    } else {
      this.dataStore.generalProps = {};
    }
  };

  // 设置页面属性
  setPageAttributes = (properties: any) => {
    const { currentPage } = this.dataStore.eventHooks;
    // 这个currentPath一般认为是在onLoad中获取的当前小程序页面的path，此时SDK还没有parse，保存的还是上一个页面的信息
    const currentPath = this.minipInstance.getCurrentPath();
    if (['onLoad', 'attached'].includes(currentPage.currentLifecycle)) {
      currentPage.pageProps[currentPath] = limitObject(properties);
    }
  };

  // 手动更新曝光监听（该方法会在曝光插件加载时被重写）
  updateImpression = () => {
    consoleText(
      '当前未集成半自动浏览插件，请集成插件后再调用 updateImpression!',
      'warn'
    );
  };

  // 手动获取位置信息补发visit上报
  setLocation = (latitude: number, longitude: number) => {
    const nld = { latitude, longitude };
    const ld = this.dataStore.locationData;
    const verifyLT = (o: number) => o >= -180 && o <= 180;
    if (
      verifyLT(latitude) &&
      verifyLT(longitude) &&
      (ld.latitude !== latitude || ld.longitude !== longitude)
    ) {
      this.dataStore.locationData = nld;
    }
  };

  // 获取打通信息
  getGioInfo = () => {
    const { uid, userId, userKey, sessionId } = this.userStore;
    const {
      projectId,
      appId,
      dataSourceId,
      dataCollect,
      idMapping,
      extraParams,
      ignoreFields
    } = this.vdsConfig;
    const infos: any = {
      gioappid: appId,
      giocs1: userId || '',
      gioplatform: this.platformConfig.platform,
      gioprojectid: projectId,
      gios: sessionId,
      giou: uid
    };
    infos.giodatacollect = dataCollect;
    infos.giodatasourceid = dataSourceId;
    if (idMapping) {
      infos.giouserkey = userKey;
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
