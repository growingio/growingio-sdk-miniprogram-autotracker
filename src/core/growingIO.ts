import { allowOptions, OPTIONS_ENUM } from '@@/constants/config';
import Plugins from '@@/core/plugins';
import UserStore from '@@/core/userStore';
import { DataStoreType, OriginOptions } from '@@/types/dataStore';
import { GrowingIOType } from '@@/types/growingIO';
import { MinipInstanceType } from '@@/types/minipInstance';
import { FRAMEWORKS, PLATFORMTYPES } from '@@/types/platforms';
import { PluginsType } from '@@/types/plugins';
import { UploaderType } from '@@/types/uploader';
import { UserStoreType } from '@@/types/userStore';
import * as glodash from '@@/utils/glodash';
import {
  isArray,
  isEmpty,
  isFunction,
  isObject,
  keys,
  unset
} from '@@/utils/glodash';
import {
  consoleText,
  limitObject,
  getAppInst,
  getPlainPlatform
} from '@@/utils/tools';
import * as tools from '@@/utils/tools';
import platformConfig from '__GIO_PLATFORM_CONFIG__';
import PlatformInstance from '__GIO_PLATFORM_INSTANCE__';
import mitt from 'mitt';
import qs from 'querystringify';

// SDK全局参数 版本号、小程序平台、框架名称、运行环境 均由打包工具替换写入
const sdkVersion: any = '__SDK_VERSION__';
const gioPlatform: any = '__GIO_PLATFORM__';
const gioFramework: any = '__GIO_FRAMEWORK__';
const gioEnvironment: any = '__GIO_ENVIRONMENT__';

class GrowingIO implements GrowingIOType {
  public utils: any;
  public emitter: any;
  public gioPlatform: PLATFORMTYPES;
  public gioEnvironment: 'saas' | 'cdp';
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
    // 环境
    this.gioEnvironment = gioEnvironment;
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
    // 用户实例
    this.userStore = new UserStore(this);
    // 插件管理实例
    this.plugins = new Plugins(this);
    // 加载内置插件
    this.plugins.innerPluginInit();
    // 数据管理实例和上传实例均在各自环境中继承实现
  }

  // SDK初始化方法
  init = (args: any) => {
    consoleText('Gio小程序SDK 初始化中...', 'info');
    // 初始化全局配置
    this.dataStore.initOptions(args);
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
    // @ts-ignore
    this?.initCallback();
    // 广播SDK初始化完成
    this.emitter.emit('SDK_INITIALIZED', this);
    consoleText('Gio小程序SDK 初始化完成！', 'success');
    if (this.vdsConfig.forceLogin) {
      consoleText(
        'forceLogin已开启，请调用 identify 方法设置 openId 以继续上报!',
        'info'
      );
    }
    // 在插件或小部件中手动触发visit
    if (this.inPlugin) {
      this.dataStore.sendVisit();
    }
    return true;
  };

  // 数据上报开关（兼容性保留，后续迭代可能会移除，建议使用setOption，删除时记得删除constans->config中配置）
  setDataCollect = (v: boolean) => {
    this.setOption('dataCollect', !!v);
    this.notRecommended();
  };

  // 无埋点数据开关（兼容性保留，后续迭代可能会移除，建议使用setOption，删除时记得删除constans->config中配置）
  setAutotrack = (v: boolean) => {
    this.setOption('autotrack', !!v);
    this.notRecommended();
  };

  // debug开关（兼容性保留，后续迭代可能会移除，建议使用setOption，删除时记得删除constans->config中配置）
  enableDebug = (v: boolean) => {
    this.setOption('debug', !!v);
    this.notRecommended();
  };

  // 运行中修改配置
  setOption = (k: string, v: any) => {
    if (allowOptions.includes(k)) {
      const r = this.dataStore.setOption(k, v);
      if (r && OPTIONS_ENUM[k]) {
        consoleText(`已${v ? '开启' : '关闭'}${OPTIONS_ENUM[k]}`, 'info');
      }
      return r;
    } else {
      consoleText(`不存在可修改的配置项：${k}，请检查后重试!`, 'warn');
      return false;
    }
  };

  // 获取匿名用户id
  getDeviceId = () => this.userStore.uid;

  // 运行中获取配置
  getOption = (k?: string) => this.dataStore.getOption(k);

  // 获取打通信息
  getGioInfo = () => {
    const { uid, userId, userKey, sessionId, gioId } = this.userStore;
    const {
      projectId,
      appId,
      dataSourceId,
      dataCollect,
      enableIdMapping,
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
    if (this.gioEnvironment === 'cdp') {
      infos.giodatacollect = dataCollect;
      infos.giodatasourceid = dataSourceId;
      infos.gioid = gioId || '';
      if (enableIdMapping) {
        infos.giouserkey = userKey;
      }
      if (!isEmpty(extraParams)) {
        extraParams.forEach((o) => {
          if (!ignoreFields.includes(o)) {
            infos[`gio${o}`] = this.dataStore.lastVisitEvent[o];
          }
        });
      }
    }
    return qs.stringify(infos);
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
      this.dataStore.sendVisit();
    }
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
      this.callError('setGeneralProps');
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

  // 手动更新曝光监听
  updateImpression = () => {
    consoleText(
      '当前未集成半自动浏览插件，请集成插件后再调用 updateImpression!',
      'warn'
    );
  };

  // 创建自定义埋点事件 saas/cdp各自实现
  // track = (name: string, properties: { [key: string]: string }) => {};

  // 设置登录用户Id  saas/cdp各自实现
  // setUserId = (userId: string) => {};

  // 清除登录用户Id saas/cdp各自实现
  // clearUserId = () => {};

  // 不建议提示
  notRecommended = () =>
    consoleText(
      "不推荐的方法使用，建议使用 gio('setOption', [optionName], [value])!", //eslint-disable-line
      'info'
    );

  // 失败提示
  callError = (fn: string, type = true, msg = '参数不合法') =>
    consoleText(`${type ? '调用' : '设置'} ${fn} 失败，${msg}!`, 'warn');
}

export default GrowingIO;
