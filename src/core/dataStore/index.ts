import {
  ALLOW_SET_OPTIONS,
  DEFAULT_SETTINGS,
  EXTRA_INFO_PARAMS,
  IGNORE_PARAMS,
  STORAGE_KEYS
} from '@@/constants/config';
import {
  forEach,
  has,
  head,
  isArray,
  isBoolean,
  isEmpty,
  isFunction,
  isString,
  keys,
  typeOf,
  unset
} from '@@/utils/glodash';
import {
  batchSetStorageSync,
  callError,
  consoleText,
  getGlobal,
  guid,
  limitObject,
  niceTry
} from '@@/utils/tools';
import {
  DataStoreType,
  OriginOptions,
  StorageKeyType
} from '@@/types/dataStore';
import { EXTEND_EVENT } from '@@/types/base';
import { EventHooksType } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import EMIT_MSG from '@@/constants/emitMsg';
import EventContextBuilder from './eventContextBuilder';
import EventHooks from './eventHooks';

class DataStore implements DataStoreType {
  readonly ALLOW_SETTING_KEYS = keys(DEFAULT_SETTINGS);
  public _gsid: any;
  public _stid: any; // 用于判断每发送10个事件，往本地存储里同步一次gsid，减少存储的读写操作。
  public eventHooks: EventHooksType;
  // 来源场景值
  public _scene: number | string;
  // 上次来源场景值
  public lastScene: number | string;
  // 是否是分享弹窗导致的跳出页面
  public shareOut: boolean;
  // 上次小程序关闭时间
  public lastCloseTime: number;
  // 事件通用属性构建方法
  public eventContextBuilder: (trackingId: string, params?: any) => any;
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
  // 记录已初始化的trackingId，以帮助判断是否再更新sessionId时是否需要发送事件
  public initializedTrackingIds: string[];

  constructor(public growingIO: GrowingIOType) {
    this.initializedTrackingIds = [];
    this.eventContextBuilder = new EventContextBuilder(this.growingIO).main;
    this.eventHooks = new EventHooks(this.growingIO);
    this.shareOut = false;
    this._gsid = {};
    this._stid = {};
    this.lastVisitEvent = {};
    this.lastPageEvent = {};
    this.locationData = {};
    this.generalProps = {};
    this.trackTimers = {};
    this.interceptEvents = [];
    const { emitter, minipInstance } = this.growingIO;
    // sdk初始化完成记录trackingId
    emitter.on(EMIT_MSG.SDK_INITIALIZED, ({ trackingId: initTrackingId }) => {
      this.initializedTrackingIds.push(initTrackingId);
      this.initStorageInfo(initTrackingId);
    });
    // visit、page事件监听
    emitter.on(
      EMIT_MSG.ON_COMMIT_REQUEST,
      ({ eventData: event, trackingId }) => {
        if (event.eventType === 'VISIT') {
          this.lastVisitEvent[trackingId] = event;
        }
        if (event.eventType === 'PAGE') {
          this.lastPageEvent[trackingId] = event;
        }
      }
    );
    // 小程序切后台把所有还在计时中的计时器记一次时长
    if (isFunction(minipInstance.minip?.onAppHide)) {
      minipInstance.minip.onAppHide(() => {
        this.trackersExecute((trackingId: string) => {
          const timers = this.trackTimers[trackingId];
          forEach(timers, (timer: any) => {
            if (timer.start) {
              timer.leng = timer.leng + (+Date.now() - timer.start);
            }
          });
        });
      });
    }
    // 小程序切前台把所有还在计时中的计时器重置开始时间
    if (isFunction(minipInstance.minip?.onAppShow)) {
      minipInstance.minip.onAppShow(() => {
        this.trackersExecute((trackingId: string) => {
          const timers = this.trackTimers[trackingId];
          forEach(timers, (timer: any) => {
            if (timer.start) {
              timer.start = +Date.now();
            }
          });
        });
      });
    }
    // 关闭数据采集时要移除所有的计时器
    emitter.on(EMIT_MSG.OPTION_CHANGE, ({ optionName, optionValue }) => {
      if (optionName === 'dataCollect' && optionValue === false) {
        this.trackersExecute((trackingId: string) => {
          this.growingIO.clearTrackTimer(trackingId);
        });
      }
    });
  }

  // 获取存储key
  getStorageKey = (trackingId: string, name: StorageKeyType) => {
    const { inPlugin } = this.growingIO;
    return `${trackingId === this.growingIO.trackingId ? '' : trackingId}${
      STORAGE_KEYS[inPlugin ? 'plugin_' + name : name]
    }`;
  };

  // @ts-ignore
  getGsid = (trackingId: string) => {
    let gsid = Number(this._gsid[trackingId]);
    if (Number.isNaN(gsid) || gsid >= 1e9 || gsid < 1) {
      this.setGsid(trackingId, 1);
      return 1;
    } else {
      return gsid;
    }
  };

  // @ts-ignore
  setGsid = (trackingId: string, value: any) => {
    let gsid = Number(value);
    if (Number.isNaN(gsid) || gsid >= 1e9 || gsid < 1) {
      gsid = 1;
    }
    this._gsid[trackingId] = gsid;
    // _gsid每自增10次（即每发送10个事件）时，往本地存储里同步一次gsid
    if (this._gsid[trackingId] - this._stid[trackingId] >= 10) {
      this.saveStorageInfo();
    }
  };

  get scene() {
    return this._scene;
  }

  set scene(v: any) {
    const prevScene = this._scene;
    this._scene = v;
    if (prevScene !== this._scene) {
      this.growingIO.emitter.emit(EMIT_MSG.SCENE_UPDATE, {
        newScene: v,
        oldScene: prevScene
      });
    }
  }

  // 初始化gsid
  initStorageInfo = (trackingId: string) => {
    const { minipInstance } = this.growingIO;
    const oriGsid = minipInstance.getStorageSync(
      this.getStorageKey(trackingId, 'gsid')
    );
    let gsid = Number(oriGsid);
    if (Number.isNaN(gsid) || gsid >= 1e9 || gsid < 1) {
      gsid = 1;
    }
    this._gsid[trackingId] = gsid;
    this._stid[trackingId] = gsid;
    // 存储中的gsid不合法时要往存储写一次
    if (gsid !== oriGsid) {
      minipInstance.setStorageSync(
        this.getStorageKey(trackingId, 'gsid'),
        gsid
      );
    }
  };

  // 在存储中同步gsid信息
  saveStorageInfo = () => {
    const { minipInstance } = this.growingIO;
    this._stid = { ...this._gsid };
    batchSetStorageSync(
      minipInstance,
      this.initializedTrackingIds.map((trackingId: string) => ({
        key: this.getStorageKey(trackingId, 'gsid'),
        value: this._gsid[trackingId]
      }))
    );
  };

  // 保存初始来源信息
  setOriginalSource = (trackingId: string, origins: any) => {
    const { minipInstance } = this.growingIO;
    minipInstance.setStorageSync(
      this.getStorageKey(trackingId, 'originalSource'),
      JSON.stringify(origins)
    );
  };

  // 获取初始来源信息
  getOriginalSource = (trackingId: string) => {
    const { minipInstance } = this.growingIO;
    return (
      niceTry(() =>
        JSON.parse(
          minipInstance.getStorageSync(
            this.getStorageKey(trackingId, 'originalSource')
          )
        )
      ) ?? {}
    );
  };

  // 获取采集实例配置内容 //? 多实例插件会重写该方法
  // eslint-disable-next-line
  getTrackerVds = (trackingId: string): any =>
    this.growingIO.trackingId === trackingId
      ? { ...this.growingIO.vdsConfig }
      : undefined;

  // 初始化实例的配置项 // ?多实例插件会重写该方法
  initTrackerOptions = (options: any) => {
    const trackerOptions = this.initOptions(options);
    trackerOptions.trackingId = options.trackingId;
    this.growingIO.trackingId = options.trackingId;
    this.growingIO.vdsConfig = trackerOptions;
    return trackerOptions;
  };

  // 初始化实例的hooker // ?多实例插件会重写该方法
  initTrackerHooker = (vdsConfig: OriginOptions) => {
    const { platformConfig, inPlugin, minipInstance, plugins } = this.growingIO;
    const { uniVue, taro } = vdsConfig;
    // 如果是使用全量版本时，当前小程序不是框架的，要允许原生的hook
    if (!(uniVue || taro || minipInstance.platform === 'quickapp')) {
      platformConfig.canHook = true;
    }
    // 初始化核心钩子（重写全局）
    if (!inPlugin || ['tbp', 'jdp'].includes(minipInstance.platform)) {
      this.eventHooks.initEventHooks();
    } else {
      this.eventHooks.initOriginalValue();
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

  // 初始化全局配置
  initOptions = (userOptions: OriginOptions) => {
    const { projectId, dataSourceId, appId, trackingId } = userOptions;
    const configs: any = {};
    // 只处理允许的配置项，之外用户的配置项无视
    this.ALLOW_SETTING_KEYS.forEach((k) => {
      // 配置项值不存在或类型不合法时置为默认值
      const altp = DEFAULT_SETTINGS[k].type;
      const invalid = isArray(altp)
        ? !altp.includes(typeOf(userOptions[k]))
        : typeOf(userOptions[k]) !== DEFAULT_SETTINGS[k].type;
      if (invalid) {
        configs[k] = DEFAULT_SETTINGS[k].default;
      } else if (k === 'ignoreFields') {
        configs.ignoreFields = userOptions.ignoreFields.filter((o) =>
          IGNORE_PARAMS.includes(o)
        );
      } else if (k === 'extraParams') {
        configs.extraParams = userOptions.extraParams.filter((o) =>
          EXTRA_INFO_PARAMS.includes(o)
        );
      } else {
        configs[k] = userOptions[k];
        // 数据采集和无埋点采集关闭时给提示
        if (['dataCollect', 'autotrack'].includes(k) && !configs[k]) {
          consoleText(`已关闭${ALLOW_SET_OPTIONS[k]}`, 'info');
        }
      }
    });
    // 发送间隔不允许设置为小数，如果是小数则取整
    configs.uploadInterval = Math.round(configs.uploadInterval);
    // 设置发送间隔小于0或者大于3秒的都认为不合法，改回1秒
    if (
      Number.isNaN(configs.uploadInterval) ||
      configs.uploadInterval < 0 ||
      configs.uploadInterval > 3000
    ) {
      configs.uploadInterval = 1000;
    }
    // idMapping配置项兼容处理
    if (configs.enableIdMapping && !configs.idMapping) {
      configs.idMapping = true;
      // 没有开启IDMapping的时候要把userKey清掉，防止之前有数被带到上报数据里
      if (!configs.idMapping) {
        this.growingIO.userStore.setUserKey(trackingId, '');
      }
    }
    unset(configs, 'enableIdMapping');
    // 是否开启强制插件模式
    if (configs.pluginMode) {
      this.growingIO.inPlugin = true;
    }
    // 请求超时时长设置的合法区间校验，值小于等于0ms认为不合法，改回5秒，浏览器默认有2分钟的上限
    if (isNaN(Number(configs.requestTimeout)) || configs.requestTimeout <= 0) {
      configs.requestTimeout = 5000;
    }

    return {
      ...configs,
      projectId,
      dataSourceId,
      appId,
      trackingId,
      // 补充性能默认值
      performance: {
        monitor: configs.performance?.monitor ?? true,
        exception: configs.performance?.exception ?? true,
        network: configs.performance?.network ?? false
      }
    };
  };

  // 全局配置修改
  setOption = (trackingId: string, k: string, v: any) => {
    const { userStore, emitter } = this.growingIO;
    const trakerVds = this.getTrackerVds(trackingId);
    // 检查 k
    const validKey = isString(k) && this.ALLOW_SETTING_KEYS.includes(k);
    const validValue = validKey && typeof v === DEFAULT_SETTINGS[k]?.type;
    if (validKey && validValue) {
      const prevConfig = { ...trakerVds };
      this.updateVdsConfig(trackingId, { ...trakerVds, [k]: v });
      // 从关闭到打开dataCollect时补发visit和page
      if (k === 'dataCollect' && prevConfig.dataCollect !== v && v) {
        // 更新session
        userStore.setSessionId(trackingId);
        // 重发visit/page
        this.sendVisit(trackingId);
        this.sendPage(trackingId);
      }
      // 配置项有变更要全局广播
      emitter.emit(EMIT_MSG.OPTION_CHANGE, { optionName: k, optionValue: v });
      return true;
    } else {
      callError(`setOption > ${k}`);
      return false;
    }
  };

  // 获取全局配置
  getOption = (trackingId: string, k?: string) => {
    const trakerVds = this.getTrackerVds(trackingId);
    if (k && has(this.growingIO.vdsConfig, k)) {
      if (has(trakerVds, k)) {
        return trakerVds[k];
      } else {
        return this.growingIO.vdsConfig[k];
      }
    } else if (isEmpty(k)) {
      return trakerVds;
    } else {
      callError(`getOption > ${k}`);
      return undefined;
    }
  };

  // 根据实例更新内存和存储中的vds配置项值
  updateVdsConfig = (trackingId: string, vds: any) => {
    if (trackingId === this.growingIO.trackingId) {
      this.growingIO.vdsConfig = { ...this.growingIO.vdsConfig, ...vds };
      getGlobal().vdsConfig = this.growingIO.vdsConfig;
    } else {
      this.growingIO.subInstance[trackingId] = {
        ...this.growingIO.subInstance[trackingId],
        ...vds
      };
      getGlobal().vdsConfig.subInstance[trackingId] =
        this.growingIO.subInstance[trackingId];
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
  sendVisit = (trackingId: string, props?: any) => {
    (this.eventHooks.appEffects as any).buildVisitEvent(trackingId, props);
  };

  // 手动调用page事件的方法
  sendPage = (trackingId: string, props?: any) => {
    (this.eventHooks.pageEffects as any).buildPageEvent(trackingId, props);
  };

  // 事件的格式转换(同时移除无值的字段)
  eventConverter = (event: EXTEND_EVENT) => {
    const { dataStore, uploader } = this.growingIO;
    const { dataCollect } = this.getTrackerVds(event.trackingId);
    // 开启数据采集时才会处理事件、累计全局计数并将合成的事件提交到请求队列
    if (dataCollect) {
      //? 在4.0中用户属性事件和关闭事件不再带eventSequenceId字段
      if (!['LOGIN_USER_ATTRIBUTES', 'APP_CLOSED'].includes(event.eventType)) {
        //? 在4.0中event.eventSequenceId（esid）的值实际为全局的事件id，即值是globalSequenceId（gsid）为了保持向下兼容不做更名，会涉及存储
        event.eventSequenceId = dataStore.getGsid(event.trackingId);
        // 全局事件计数加1
        dataStore.setGsid(event.trackingId, event.eventSequenceId + 1);
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
      this.growingIO.emitter.emit(EMIT_MSG.ON_COMPOSE_AFTER, {
        composedEvent: convertedEvent
      });
      // 提交请求队列
      uploader.commitRequest({ ...convertedEvent, requestId: guid() });
    }
  };

  // 事件重组
  eventRefactor = (e: any) => {
    // 有的事件的path和query不能再用页面的值，所以直接使用事件中已有的值
    const ne = {
      ...e,
      ...this.eventContextBuilder(e.trackingId, {
        path: e.path,
        query: e.query,
        // page事件需要使用事件中原有的时间戳，其他事件也要用原来的时间戳保证事件的准确性
        timestamp: e.timestamp
      })
    };
    // 防止事件原有的属性被通用属性直接覆盖
    ne.attributes = {
      ...(ne.attributes ?? {}),
      ...(e.attributes ?? {})
    };
    return ne;
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
        this.eventConverter(this.eventRefactor(e));
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
        this.eventConverter(this.eventRefactor(e));
      });
      this.interceptEvents = [];
    }
  };

  // 构建应用/页面转发分享事件
  buildAppMessageEvent = (trackingId: string, args: any) => {
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
      ...eventContextBuilder(trackingId)
    };
    event.attributes = limitObject({
      ...(event.attributes ?? {}),
      $from: originResult.from,
      $target: originResult?.target?.id,
      $share_title: updateResult?.title,
      $share_path: head(uri),
      $share_query: uri[1],
      ...updateResult?.attributes
    });
    eventInterceptor(event);
  };

  // 构建朋友圈分享事件
  buildTimelineEvent = (trackingId: string, args: any) => {
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
      ...eventContextBuilder(trackingId)
    };
    event.attributes = limitObject({
      ...(event.attributes ?? {}),
      $target: originResult?.target?.id,
      $share_title: updateResult?.title,
      $share_path: head(uri),
      $share_query: uri[1],
      ...updateResult?.attributes
    });
    eventInterceptor(event);
  };

  // 构建添加收藏事件
  buildAddFavorites = (trackingId: string, args: any) => {
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
      ...eventContextBuilder(trackingId)
    };
    event.attributes = limitObject({
      ...(event.attributes ?? {}),
      $share_title: updateResult?.title,
      $share_path: head(uri),
      $share_query: uri[1]
    });
    eventInterceptor(event);
  };

  // 需要对所有trackingId执行的逻辑
  trackersExecute = (callback: (trackingId: string) => any) => {
    this.initializedTrackingIds.forEach((trackingId: string) => {
      if (typeOf(callback) === 'function') {
        callback(trackingId);
      }
    });
  };
}

export default DataStore;
