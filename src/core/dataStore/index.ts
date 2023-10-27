import {
  CDP_SETTING,
  DEFAULT_SETTING,
  EXTRA_INFO_PARAMS,
  IGNORE_PARAMS,
  SAAS_SETTING
} from '@@/constants/config';
import { DataStoreType, OriginOptions } from '@@/types/dataStore';
import { EventHooksType } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import {
  has,
  isArray,
  isBoolean,
  isEmpty,
  isEqual,
  isNil,
  isObject,
  isString,
  keys,
  toString,
  typeOf
} from '@@/utils/glodash';
import {
  batchSetStorageSync,
  consoleText,
  getAppInst,
  getSubKeys
} from '@@/utils/tools';

import EventContextBuilder from './eventContextBuilder';
import EventHooks from './eventHooks';

class DataStore implements DataStoreType {
  readonly ALLOW_SETTING = Object.assign(
    {},
    DEFAULT_SETTING,
    this.growingIO.gioEnvironment === 'saas' ? SAAS_SETTING : CDP_SETTING
  );
  readonly allowOptKeys = keys(this.ALLOW_SETTING);
  public esidStorageName: string;
  public _esid: any;
  public gsidStorageName: string;
  public _gsid: number;
  public _stid: number; // 用于判断每发送10个事件，往本地存储里同步一次esid和gsid，减少存储的读写操作。
  public eventHooks: EventHooksType;
  // 来源场景值
  public _scene: number | string;
  // 上次来源场景值
  public lastScene: number | string;
  // 是否是分享弹窗导致的跳出页面
  public shareOut: boolean;
  // 上次小程序关闭时间
  public lastCloseTime: number;
  // 保活时间(两次打开小程序间隔算为一次访问的时间)
  public keepAlive: number;
  // 事件通用属性构建方法
  public eventContextBuilder: (params?: any) => any;
  // 事件格式转换
  public eventConverter: (event: any) => void;
  // 上一个访问事件，保存最近的一次visit事件，存储一些设备系统信息，避免多次重新获取
  public lastVisitEvent: any;
  // 上一个页面事件，便于下一个Page事件获取数据
  public lastPageEvent: any;
  // 由客户设置的位置信息
  public locationData: any;
  // 埋点事件通用属性
  public generalProps: any;
  // 被拦截的事件
  public interceptEvents: any;

  constructor(public growingIO: GrowingIOType) {
    // esid初始化
    this.esidStorageName = '_growing_esid_';
    this.gsidStorageName = '_growing_gsid_';
    this.initStorageInfo();
    this.eventContextBuilder = new EventContextBuilder(this.growingIO).main;
    this.eventHooks = new EventHooks(this.growingIO);
    this.shareOut = false;
    this.lastVisitEvent = {};
    this.lastPageEvent = {};
    this.locationData = {};
    this.generalProps = {};
    this.interceptEvents = [];
    // visit、page事件监听
    this.growingIO.emitter.on('onComposeAfter', ({ composedEvent }) => {
      if (composedEvent.eventType === 'VISIT' || composedEvent.t === 'vst') {
        this.lastVisitEvent = composedEvent;
      }
      if (composedEvent.eventType === 'PAGE' || composedEvent.t === 'page') {
        this.lastPageEvent = composedEvent;
      }
    });
  }

  // @ts-ignore
  get esid() {
    const app = getAppInst();
    const sKeys = getSubKeys(app);
    // 分包中esid存到app中
    return !isEmpty(sKeys) && app.gio_esid ? app.gio_esid : this._esid;
  }

  set esid(obj: any) {
    const eid = {};
    keys(obj).forEach((k) => {
      eid[k] = Number.isNaN(obj[k]) || obj[k] >= 1e9 || obj[k] < 1 ? 1 : obj[k];
    });
    if (!isEqual(eid, this._esid)) {
      this._esid = eid;
      // 在全局app中存一份esid给分包用
      const app = getAppInst();
      app.gio_esid = this._esid;
    }
  }

  // @ts-ignore
  get gsid() {
    const app = getAppInst();
    const sKeys = getSubKeys(app);
    return !isEmpty(sKeys) && app.gio_gsid ? app.gio_gsid : this._gsid;
  }

  // @ts-ignore
  set gsid(v: any) {
    const newV = Number.parseInt(v, 10);
    if (Number.isNaN(newV) || v >= 1e9 || v < 1) {
      this._gsid = 1;
    } else {
      this._gsid = v;
    }
    // 在全局app中存一份gsid给分包用
    const app = getAppInst();
    app.gio_gsid = this._gsid;
    // _gsid每自增10次（即每发送10个事件）时，往本地存储里同步一次esid和gsid
    if (this._gsid - this._stid >= 10) {
      this.saveStorageInfo();
    }
  }

  get scene() {
    return this._scene;
  }

  set scene(v: any) {
    const prevScene = this._scene;
    this._scene = v;
    if (prevScene !== this._scene) {
      this.growingIO.emitter.emit('SCENE_UPDATE', {
        newScene: v,
        oldScene: prevScene
      });
    }
  }

  // 初始化esid和gsid
  initStorageInfo = () => {
    const { minipInstance } = this.growingIO;
    const app = getAppInst();
    // esid
    let eid = app.gio_esid
      ? app.gio_esid
      : minipInstance.getStorageSync(this.esidStorageName);
    eid = isObject(eid) && !isNil(eid) ? eid : {};
    this._esid = {};
    keys(eid).forEach((k) => {
      this._esid[k] =
        Number.isNaN(Number(eid[k])) || eid[k] >= 1e9 || eid[k] < 1
          ? 1
          : eid[k];
    });
    if (!isEqual(eid, this._esid)) {
      minipInstance.setStorageSync(this.esidStorageName, this._esid);
    }
    // gsid
    const gid = app.gio_gsid
      ? app.gio_gsid
      : Number.parseInt(minipInstance.getStorageSync(this.gsidStorageName), 10);
    this._gsid = Number.isNaN(gid) || gid >= 1e9 || gid < 1 ? 1 : gid;
    // 初始化时同步stid
    this._stid = this._gsid;
    if (gid !== this._gsid) {
      minipInstance.setStorageSync(this.gsidStorageName, this._gsid);
    }
  };

  // 退出小程序时在存储中同步esid和gsid信息
  saveStorageInfo = () => {
    const { minipInstance } = this.growingIO;
    this._stid = this._gsid;
    batchSetStorageSync(minipInstance, [
      { key: this.esidStorageName, value: this._esid },
      { key: this.gsidStorageName, value: this._gsid }
    ]);
  };

  // 初始化全局配置
  initOptions = (userOptions: OriginOptions) => {
    const { projectId, dataSourceId, appId } = userOptions;
    const vdsConfig: any = {};
    // 只处理允许的配置项，之外用户的配置项无视
    this.allowOptKeys.forEach((k) => {
      // 配置项值不存在或类型不合法时置为默认值
      const altp = this.ALLOW_SETTING[k].type;
      const invalid = isArray(altp)
        ? !altp.includes(typeOf(userOptions[k]))
        : typeOf(userOptions[k]) !== this.ALLOW_SETTING[k].type;
      if (invalid) {
        vdsConfig[k] = this.ALLOW_SETTING[k].default;
      } else if (k === 'ignoreFields') {
        vdsConfig.ignoreFields = userOptions.ignoreFields.filter((o) =>
          IGNORE_PARAMS.includes(o)
        );
      } else if (k === 'extraParams') {
        vdsConfig.extraParams = userOptions.extraParams.filter((o) =>
          EXTRA_INFO_PARAMS.includes(o)
        );
      } else {
        vdsConfig[k] = userOptions[k];
      }
    });
    // 发送间隔不允许设置为小数，如果是小数则取整
    vdsConfig.uploadInterval = Math.round(vdsConfig.uploadInterval);
    // 设置发送间隔小于0或者大于2秒的都认为不合法，改回1秒
    if (
      // saas不能设置，所以给默认值1000
      Number.isNaN(vdsConfig.uploadInterval) ||
      vdsConfig.uploadInterval < 0 ||
      vdsConfig.uploadInterval > 2000
    ) {
      vdsConfig.uploadInterval = 1000;
    }
    this.growingIO.vdsConfig = {
      ...vdsConfig,
      projectId,
      dataSourceId,
      appId,
      // 补充性能默认值
      performance: {
        monitor: vdsConfig.performance?.monitor ?? true,
        exception: vdsConfig.performance?.exception ?? true,
        network: vdsConfig.performance?.network ?? false
      }
    };
    this.keepAlive = vdsConfig.keepAlive;
    // 初始化配置提示
    if (!vdsConfig.dataCollect) {
      consoleText('已关闭数据采集', 'info');
    }
    if (!vdsConfig.autotrack) {
      consoleText('已关闭无埋点', 'info');
    }
    // 小程序插件(小部件)中自动关闭无埋点，因为小程序插件(小部件)中获取不到path
    if (this.growingIO.inPlugin) {
      this.growingIO.vdsConfig.autotrack = false;
    }
    const { cml, uniVue, wepy, taro, remax } = vdsConfig;
    // 如果是使用全量版本时，当前小程序不是框架的，要允许原生的hook
    if (
      this.growingIO.gioFramework === 'full' &&
      !(cml || uniVue || wepy || taro || remax)
    ) {
      this.growingIO.platformConfig.canHook = true;
    }
    // 初始化核心钩子（重写全局）
    if (!this.growingIO.inPlugin) {
      this.eventHooks.initEventHooks();
    }
    /** 第三方框架重写 */
    const { plugins } = this.growingIO;
    // chameleon
    if (cml) {
      plugins?.gioChameleonAdapter?.main();
    }
    // uni-app
    if (uniVue) {
      plugins?.gioUniAppAdapter?.main();
    }
    // wepy
    if (wepy) {
      plugins?.gioWepyAdapter?.main();
    }
    // taro
    if (taro) {
      plugins?.gioTaroAdapter?.main();
    }
    // remax
    if (remax) {
      plugins?.gioRemaxAdapter?.main();
    }
  };

  // 全局配置修改
  setOption = (k: string, v: any) => {
    const { vdsConfig, callError, uploader, emitter } = this.growingIO;
    // 检查 k
    const validKey = isString(k) && this.allowOptKeys.includes(k);
    const validValue = validKey && typeof v === this.ALLOW_SETTING[k]?.type;
    if (validKey && validValue) {
      // 从关闭到打开dataCollect时补发visit和page
      if (
        k === 'dataCollect' &&
        vdsConfig.dataCollect === false &&
        v === true
      ) {
        let t = setTimeout(() => {
          const { path, settedTitle } = this.eventHooks.currentPage;
          // 重新获取页面title，防止切换配置前修改了title没取到
          this.eventHooks.currentPage.title =
            settedTitle[path] ||
            this.growingIO.minipInstance.getPageTitle(
              this.growingIO.minipInstance.getCurrentPage()
            );
          this.sendVisit();
          // 要重设一次页面时间，防止比visit早
          this.eventHooks.currentPage.time = Date.now();
          this.sendPage();
          clearTimeout(t);
          t = null;
        });
      }
      vdsConfig[k] = v;
      // 修改host或者scheme时要重新为cdp生成上报地址
      if (['host', 'scheme'].includes(k)) {
        uploader?.generateURL();
      }
      // 配置项有变更要全局广播
      emitter.emit('OPTION_CHANGE', { optionName: k, optionValue: v });
      return true;
    } else {
      callError(`setOption > ${k}`);
      return false;
    }
  };

  // 获取全局配置
  getOption = (k?: string) => {
    const { vdsConfig, callError } = this.growingIO;
    if (k && has(vdsConfig, toString(k))) {
      return vdsConfig[toString(k)];
    } else if (isNil(k)) {
      return { ...vdsConfig };
    } else {
      callError(`getOption > ${k}`);
      return undefined;
    }
  };

  // 修改分享跳出判断值
  toggleShareOut = (v?: boolean) => {
    if (isBoolean(v)) {
      this.shareOut = v;
    } else {
      this.shareOut = !this.shareOut;
    }
  };

  // 手动调用visit事件的方法
  sendVisit = () => {
    (this.eventHooks.appEffects as any).buildVisitEvent(this.lastVisitEvent);
  };

  // 手动调用page事件的方法
  sendPage = () => {
    (this.eventHooks.pageEffects as any).buildPageEvent();
  };

  // 事件的格式转换（在各自环境中实现）
  // eventConverter = (event) => {};

  // 事件拦截器（有的通用维度字段需要异步获取，为了防止事件在通用维度还没返回之前就发出去）一般只有最开始的个别事件会被拦住
  eventInterceptor = (event: any) => {
    const { systemInfo, network } = this.growingIO.minipInstance;
    if (isEmpty(systemInfo) || isEmpty(network)) {
      // 没有通用维度字段，直接拦截存下来
      this.interceptEvents.push(event);
    } else if (!isEmpty(this.interceptEvents)) {
      // 有通用维度字段了，且有被拦截的事件，放一起重新添加通用维度字段再提交转换
      [...this.interceptEvents, event].forEach((e: any) => {
        // 有的事件的path和query不能再用页面的值，所以直接使用事件中已有的值
        const ne = {
          ...e,
          ...this.eventContextBuilder({
            path: e.path,
            query: e.query,
            // page事件需要使用事件中原有的时间戳，其他事件也要用原来的时间戳保证事件的准确性
            timestamp: e.timestamp
          })
        };
        this.eventConverter(ne);
      });
      this.interceptEvents = [];
    } else {
      // 有通用维度字段了，也没有有被拦截的事件，直接提交转换
      this.eventConverter(event);
    }
  };

  // 系统信息异步获取完后对拦截队列进行检查，防止事件被卡住
  eventReleaseInspector = () => {
    const {
      minipInstance: { systemInfo, network }
    } = this.growingIO;
    if (systemInfo && network && !isEmpty(this.interceptEvents)) {
      [...this.interceptEvents].forEach((e: any) => {
        // 有的事件的path和query不能再用页面的值，所以直接使用事件中已有的值
        const ne = {
          ...e,
          ...this.eventContextBuilder({
            path: e.path,
            query: e.query,
            // page事件需要使用事件中原有的时间戳，其他事件也要用原来的时间戳保证事件的准确性
            timestamp: e.timestamp
          })
        };
        this.eventConverter(ne);
      });
      this.interceptEvents = [];
    }
  };

  // 构建应用/页面转发分享事件（saas/cdp各自实现）
  buildAppMessageEvent = (args: any) => {};

  // 构建朋友圈分享事件（saas/cdp各自实现）
  buildTimelineEvent = (args: any) => {};

  // 构建添加收藏事件（saas/cdp各自实现）
  buildAddFavorites = (args: any) => {};
}

export default DataStore;
