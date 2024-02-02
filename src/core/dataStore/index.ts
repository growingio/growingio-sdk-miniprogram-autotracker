import {
  DEFAULT_SETTINGS,
  EXTRA_INFO_PARAMS,
  IGNORE_PARAMS
} from '@@/constants/config';
import {
  forEach,
  has,
  head,
  isArray,
  isBoolean,
  isEmpty,
  isFunction,
  isNil,
  isString,
  keys,
  toString,
  typeOf,
  unset
} from '@@/utils/glodash';
import {
  batchSetStorageSync,
  callError,
  consoleText,
  getAppInst,
  getSubKeys,
  guid,
  niceTry
} from '@@/utils/tools';
import { DataStoreType, OriginOptions } from '@@/types/dataStore';
import { EventHooksType } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import EventContextBuilder from './eventContextBuilder';
import EventHooks from './eventHooks';

class DataStore implements DataStoreType {
  readonly ALLOW_SETTING_KEYS = keys(DEFAULT_SETTINGS);
  public gsidStorageName = '_growing_gsid_';
  public originalSourceName = 'gdp_original_source';
  public _gsid: number;
  public _stid: number; // 用于判断每发送10个事件，往本地存储里同步一次gsid，减少存储的读写操作。
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
  // 上一个访问事件，保存最近的一次visit事件，存储一些设备系统信息，避免多次重新获取
  public lastVisitEvent: any;
  // 上一个页面事件，便于下一个Page事件获取数据
  public lastPageEvent: any;
  // 由客户设置的位置信息
  public locationData: any;
  // 埋点事件通用属性
  public generalProps: any;
  // 事件时长计时器
  public trackTimers: any;
  // 被拦截的事件
  public interceptEvents: any;

  constructor(public growingIO: GrowingIOType) {
    this.initStorageInfo();
    this.eventContextBuilder = new EventContextBuilder(this.growingIO).main;
    this.shareOut = false;
    this.lastVisitEvent = {};
    this.lastPageEvent = {};
    this.locationData = {};
    this.generalProps = {};
    this.trackTimers = {};
    this.interceptEvents = [];
    this.eventHooks = new EventHooks(this.growingIO);
    // visit、page事件监听
    this.growingIO.emitter.on('onComposeAfter', ({ composedEvent }) => {
      if (composedEvent.eventType === 'VISIT' || composedEvent.t === 'vst') {
        this.lastVisitEvent = composedEvent;
      }
      if (composedEvent.eventType === 'PAGE' || composedEvent.t === 'page') {
        this.lastPageEvent = composedEvent;
      }
    });
    // 小程序切后台把所有还在计时中的计时器记一次时长
    if (isFunction(this.growingIO.minipInstance.minip?.onAppHide)) {
      this.growingIO.minipInstance.minip.onAppHide(() => {
        forEach(this.trackTimers, (tracker: any) => {
          if (tracker.start) {
            tracker.leng = tracker.leng + (+Date.now() - tracker.start);
          }
        });
      });
    }

    // 小程序切前台把所有还在计时中的计时器重置开始时间
    if (isFunction(this.growingIO.minipInstance.minip?.onAppShow)) {
      this.growingIO.minipInstance.minip.onAppShow(() => {
        forEach(this.trackTimers, (tracker: any) => {
          if (tracker.start) {
            tracker.start = +Date.now();
          }
        });
      });
    }
    // 关闭数据采集时要移除所有的计时器
    this.growingIO.emitter.on(
      'OPTION_CHANGE',
      ({ optionName, optionValue }) => {
        if (optionName === 'dataCollect' && optionValue === false) {
          this.growingIO.clearTrackTimer();
        }
      }
    );
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
    // _gsid每自增10次（即每发送10个事件）时，往本地存储里同步一次gsid
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

  // 初始化gsid
  initStorageInfo = () => {
    const { minipInstance } = this.growingIO;
    const app = getAppInst();
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

  // 退出小程序时在存储中同步gsid信息
  saveStorageInfo = () => {
    const { minipInstance } = this.growingIO;
    this._stid = this._gsid;
    batchSetStorageSync(minipInstance, [
      { key: this.gsidStorageName, value: this._gsid }
    ]);
  };

  // 保存初始来源信息
  setOriginalSource = ({ path, query }) => {
    const { minipInstance } = this.growingIO;
    if (isNil(this.getOriginalSource())) {
      const originalSource = { path, query, title: '' };
      minipInstance.setStorageSync(
        this.originalSourceName,
        JSON.stringify(originalSource)
      );
    }
  };

  // 获取初始来源信息
  getOriginalSource = () => {
    const { minipInstance } = this.growingIO;
    return niceTry(() =>
      JSON.parse(minipInstance.getStorageSync(this.originalSourceName))
    );
  };

  // 初始化全局配置
  initOptions = (userOptions: OriginOptions) => {
    const { projectId, dataSourceId, appId } = userOptions;
    const vdsConfig: any = {};
    // 只处理允许的配置项，之外用户的配置项无视
    this.ALLOW_SETTING_KEYS.forEach((k) => {
      // 配置项值不存在或类型不合法时置为默认值
      const altp = DEFAULT_SETTINGS[k].type;
      const invalid = isArray(altp)
        ? !altp.includes(typeOf(userOptions[k]))
        : typeOf(userOptions[k]) !== DEFAULT_SETTINGS[k].type;
      if (invalid) {
        vdsConfig[k] = DEFAULT_SETTINGS[k].default;
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
      Number.isNaN(vdsConfig.uploadInterval) ||
      vdsConfig.uploadInterval < 0 ||
      vdsConfig.uploadInterval > 2000
    ) {
      vdsConfig.uploadInterval = 1000;
    }
    // idMapping配置项兼容处理
    if (vdsConfig.enableIdMapping && !vdsConfig.idMapping) {
      vdsConfig.idMapping = true;
    }
    // 是否开启强制插件模式
    if (vdsConfig.pluginMode) {
      this.growingIO.inPlugin = true;
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
    const { plugins, inPlugin, minipInstance } = this.growingIO;
    const { uniVue, taro } = vdsConfig;
    // 如果是使用全量版本时，当前小程序不是框架的，要允许原生的hook
    if (!(uniVue || taro)) {
      this.growingIO.platformConfig.canHook = true;
    }
    // 初始化核心钩子（重写全局）
    if (!inPlugin || ['tbp', 'jdp'].includes(minipInstance.platform)) {
      this.eventHooks.initEventHooks();
    }
    /** 第三方框架重写 */
    // uniapp
    if (uniVue) {
      plugins?.gioUniAppAdapter?.main();
    }
    // taro
    if (taro) {
      plugins?.gioTaroAdapter?.main();
    }
  };

  // 全局配置修改
  setOption = (k: string, v: any) => {
    const { vdsConfig, userStore, uploader, emitter } = this.growingIO;
    // 检查 k
    const validKey = isString(k) && this.ALLOW_SETTING_KEYS.includes(k);
    const validValue = validKey && typeof v === DEFAULT_SETTINGS[k]?.type;
    if (validKey && validValue) {
      // 从关闭到打开dataCollect时补发visit和page
      if (
        k === 'dataCollect' &&
        vdsConfig.dataCollect === false &&
        v === true
      ) {
        let t = setTimeout(() => {
          userStore.sessionId = '';
          const { path, query, settedTitle } = this.eventHooks.currentPage;
          // 重新获取页面title，防止切换配置前修改了title没取到
          this.eventHooks.currentPage.title =
            settedTitle[path] ||
            this.growingIO.minipInstance.getPageTitle(
              this.growingIO.minipInstance.getCurrentPage()
            );
          // visit取当前页面值
          this.sendVisit({ path, query });
          // 要重设一次页面时间，防止比visit早
          this.eventHooks.currentPage.time = Date.now();
          this.sendPage({ path, query });
          clearTimeout(t);
          t = null;
        }, 0);
      }
      vdsConfig[k] = v;
      // 修改serverUrl时要重新生成上报地址
      if (k === 'serverUrl') {
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
    const { vdsConfig } = this.growingIO;
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
  sendVisit = (props?: any) => {
    (this.eventHooks.appEffects as any).buildVisitEvent(
      props ?? this.lastVisitEvent
    );
    // 等visit发完要重置页面时间，确保不会比visit早
    this.eventHooks.currentPage.time = Date.now();
  };

  // 手动调用page事件的方法
  sendPage = (props?: any) => {
    (this.eventHooks.pageEffects as any).buildPageEvent(props);
  };

  // 事件的格式转换(同时移除无值的字段)
  eventConverter = (event: any) => {
    const { vdsConfig, dataStore, uploader } = this.growingIO;
    // 开启数据采集时才会处理事件、累计全局计数并将合成的事件提交到请求队列
    if (vdsConfig.dataCollect) {
      //? 在4.0中用户属性事件和关闭事件不再带eventSequenceId字段
      if (!['LOGIN_USER_ATTRIBUTES', 'APP_CLOSED'].includes(event.eventType)) {
        //? 在4.0中event.eventSequenceId（esid）的值实际为全局的事件id，即值是globalSequenceId（gsid）为了保持向下兼容不做更名，会涉及存储
        event.eventSequenceId = dataStore.gsid;
        // 全局事件计数加1
        this.growingIO.dataStore.gsid += 1;
      }
      const convertedEvent: any = {};
      forEach(event, (v: any, k: string) => {
        /**
         * 字段的转换
         */
        // 无埋点element的转换
        if (k === 'element') {
          const target: object = head(v) ?? {};
          forEach(target, (ev: any, ek: string) => {
            // 判断属性是否存在，同时忽略无值属性（放入convertedEvent中）
            if (!isEmpty(ev) || ev === 0) {
              convertedEvent[ek] = ev;
            }
          });
        } else if (!isEmpty(v) || v === 0) {
          // 判断属性是否存在，同时忽略无值属性
          convertedEvent[k] = v;
        }
      });
      this.growingIO.emitter.emit('onComposeAfter', {
        composedEvent: convertedEvent
      });
      // 提交请求队列
      uploader.commitRequest({ ...convertedEvent, requestId: guid() });
    }
  };

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

  // 构建应用/页面转发分享事件
  buildAppMessageEvent = (args: any) => {
    const originResult = args[0];
    let updateResult;
    if (args.length >= 2) {
      updateResult = args[1];
    } else if (args.length === 1) {
      updateResult = originResult;
    }
    const {
      dataStore: { eventContextBuilder, eventInterceptor }
    } = this.growingIO;
    const uri = (updateResult?.path || '').split('?');
    const event = {
      eventType: 'CUSTOM',
      eventName: '$mp_on_share',
      attributes: {
        $from: originResult.from,
        $target: originResult?.target?.id,
        $share_title: updateResult?.title,
        $share_path: head(uri),
        $share_query: uri[1],
        ...updateResult?.attributes
      },
      ...eventContextBuilder()
    };
    eventInterceptor(event);
  };

  // 构建朋友圈分享事件
  buildTimelineEvent = (args: any) => {
    const originResult = args[0];
    let updateResult;
    if (args.length >= 2) {
      updateResult = args[1];
    } else if (args.length === 1) {
      updateResult = originResult;
    }
    const {
      dataStore: { eventContextBuilder, eventInterceptor }
    } = this.growingIO;
    const uri = (updateResult?.path || '').split('?');
    const event = {
      eventType: 'CUSTOM',
      eventName: '$mp_share_timeline',
      attributes: {
        $target: originResult?.target?.id,
        $share_title: updateResult?.title,
        $share_path: head(uri),
        $share_query: uri[1],
        ...updateResult?.attributes
      },
      ...eventContextBuilder()
    };
    eventInterceptor(event);
  };

  // 构建添加收藏事件
  buildAddFavorites = (args: any) => {
    const originResult = args[0];
    let updateResult;
    if (args.length >= 2) {
      updateResult = args[1];
    } else if (args.length === 1) {
      updateResult = originResult;
    }
    const {
      dataStore: { eventContextBuilder, eventInterceptor }
    } = this.growingIO;
    const uri = (updateResult?.path || '').split('?');
    const event = {
      eventType: 'CUSTOM',
      eventName: '$mp_add_favorites',
      attributes: {
        $share_title: updateResult?.title,
        $share_path: head(uri),
        $share_query: uri[1]
      },
      ...eventContextBuilder()
    };
    eventInterceptor(event);
  };
}

export default DataStore;
