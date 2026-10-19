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
  isObject,
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
import { EventHooksType, PageContext } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import EMIT_MSG from '@@/constants/emitMsg';
import EventContextBuilder from './eventContextBuilder';
import EventHooks from './eventHooks';
import { emitSafely } from '@@/utils/safeEmitter';

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
  public eventContextBuilder: (
    trackingId: string,
    params?: any,
    executeAttributes?: boolean,
    pageContext?: PageContext
  ) => any;
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
  // 内存拥有入口生命周期；持久化只负责重启恢复，不能重新激活已消费的来源。
  private originalSources: Record<string, { source: any; generation: number }> = {};
  private originalSourceGeneration = 0;

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
    // session更新要补发当前页面的visit和page
    this.growingIO.emitter.on(
      EMIT_MSG.SESSIONID_UPDATE,
      ({ oldSessionId, trackingId }) => {
        if (oldSessionId) {
          // App 热进入的会话切换必须使用本次同步入口。此时 uni-app 的页面栈
          // 可能仍属于旧页面，鸿蒙场景下还可能带整段编码路由；其他内部会话
          // 更新才读取当前页面快照。path/query/referralPage 保持同一来源。
          const entry = this.eventHooks.appEffects.sessionEntry;
          const { path, query } =
            entry || this.eventHooks.currentPage.getPageContext(trackingId);
          if (!path) {
            // 个别（说的就是你：淘宝）小程序场景值不一样后台拉起时可能args中会没有path和query，直接取上一个最后发送的page中的值
            const lastPage = this.lastPageEvent[trackingId];
            this.sendVisit(trackingId, {
              path: lastPage.path,
              query: lastPage.query
            });
          } else {
            this.sendVisit(trackingId, entry || { path, query });
          }
          // 页面显示以后触发切session要补发page，离开页面到页面加载显示完成前的切session不补发，由onshow生命周期触发
          if (!this.eventHooks.currentPage.lifeBeforeShow) {
            this.sendPage(trackingId);
          }
        }
      }
    );
  }

  /**
   * 获取存储key
   * @param {string} trackingId - 实例 ID
   * @param {StorageKeyType} name - 存储键名
   * @returns {string} - 完整的存储键
   */
  getStorageKey = (trackingId: string, name: StorageKeyType) => {
    const { inPlugin } = this.growingIO;
    return `${trackingId === this.growingIO.trackingId ? '' : trackingId}${
      STORAGE_KEYS[inPlugin ? 'plugin_' + name : name]
    }`;
  };

  /**
   * 获取 gsid (Global Sequence ID)
   * @param {string} trackingId - 实例 ID
   * @returns {number} - gsid 值
   */
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

  /**
   * 设置 gsid
   * @param {string} trackingId - 实例 ID
   * @param {any} value - gsid 值
   */
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

  /**
   * 获取场景值
   */
  get scene() {
    return this._scene;
  }

  /**
   * 设置场景值
   * @param {any} v - 场景值
   */
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

  /**
   * 初始化 gsid
   * @param {string} trackingId - 实例 ID
   */
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

  /**
   * 在存储中同步 gsid 信息
   */
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

  /**
   * 将持久化来源收敛为 VISIT 允许覆盖的字段。
   *
   * originalSource 位于 VISIT 合成链路的最后一层，如果直接展开存储对象，宿主代码误写、
   * 历史版本残留或存储损坏都可能覆盖 eventType、trackingId、sessionId 等内部字段。
   * 因此这里既是类型校验，也是字段白名单；path 不合法时整条来源都视为无效。
   * @param {any} origins - 未校验的来源数据
   * @returns {any} - 可安全合入 VISIT 的来源字段
   */
  private normalizeOriginalSource = (origins: any) => {
    if (!isObject(origins) || !isString(origins.path) || !origins.path) {
      return {};
    }
    const source: any = {
      path: origins.path,
      // path 与 query 必须成组保存。旧数据没有 query 时显式补空，避免补发 VISIT
      // 借用当前页面的 query，生成并不存在的跨页面组合。
      query: isString(origins.query) ? origins.query : '',
      referralPage: isString(origins.referralPage)
        ? origins.referralPage
        : ''
    };
    // 初次 App.onShow 时动态标题通常尚未产生；只有存储中确实存在字符串标题时才覆盖，
    // 否则继续使用 VISIT 页面上下文已经解析出的静态标题。
    if (isString(origins.title)) {
      source.title = origins.title;
    }
    return source;
  };

  /**
   * 保存初始来源信息
   * @param {string} trackingId - 实例 ID
   * @param {any} origins - 来源信息
   */
  setOriginalSource = (trackingId: string, origins: any) => {
    const { minipInstance } = this.growingIO;
    const source = this.normalizeOriginalSource(origins);
    if (isEmpty(source)) {
      this.removeOriginalSource(trackingId);
      return;
    }
    const storageKey = this.getStorageKey(trackingId, 'originalSource');
    this.originalSources[trackingId] = {
      source,
      generation: ++this.originalSourceGeneration
    };
    niceTry(() => minipInstance.setStorageSync(storageKey, JSON.stringify(source)));
  };

  /**
   * 删除尚未被 VISIT 消费的初始来源。
   * 删除逻辑集中在 DataStore，避免 App、Uploader 和平台适配器各自拼接存储 key。
   * @param {string} trackingId - 实例 ID
   */
  removeOriginalSource = (trackingId: string) => {
    const storageKey = this.getStorageKey(trackingId, 'originalSource');
    this.originalSources[trackingId] = {
      source: {},
      generation: ++this.originalSourceGeneration
    };
    niceTry(() => this.growingIO.minipInstance.removeStorageSync(storageKey));
  };

  /**
   * 获取初始来源信息
   * @param {string} trackingId - 实例 ID
   * @returns {any} - 来源信息
   */
  getOriginalSource = (trackingId: string) => {
    const { minipInstance } = this.growingIO;
    const storageKey = this.getStorageKey(trackingId, 'originalSource');
    if (has(this.originalSources, trackingId)) {
      return { ...this.originalSources[trackingId].source };
    }
    let storedSource: any;
    try {
      storedSource = minipInstance.getStorageSync(storageKey);
    } catch (error) {
      // 未恢复和确实为空不同；恢复失败不能伪造一次成功读取。
      return {};
    }
    const source = this.normalizeOriginalSource(
      niceTry(() => JSON.parse(storedSource))
    );
    // 对无法解析或不符合当前结构的数据做一次物理清理，防止每次构建 VISIT 都重复读取，
    // 更不能让旧格式数据在后续版本中重新变成有效覆盖项。
    if (storedSource && isEmpty(source)) {
      this.removeOriginalSource(trackingId);
    } else {
      this.originalSources[trackingId] = {
        source,
        generation: ++this.originalSourceGeneration
      };
    }
    return { ...source };
  };

  /** Capture ownership when a VISIT is created, before queues or storage can change. */
  private bindOriginalSource = (event: any) => {
    if (event.eventType !== 'VISIT' || event.originalSourceId !== undefined) return;
    const source = this.getOriginalSource(event.trackingId);
    const sessionId = this.growingIO.userStore?.getSessionSnapshot?.(event.trackingId);
    if (
      source.path && event.path === source.path &&
      (event.query || '') === source.query &&
      (!sessionId || event.sessionId === sessionId)
    ) {
      event.originalSourceId = this.originalSources[event.trackingId].generation;
    }
  };

  /** Only the VISIT that captured the active entry may consume it. */
  consumeOriginalSource = (trackingId: string, events: EXTEND_EVENT[]) => {
    const entry = this.originalSources[trackingId];
    if (entry?.source.path && events.some((event) =>
      event.eventType === 'VISIT' && event.originalSourceId === entry.generation
    )) {
      this.removeOriginalSource(trackingId);
    }
  };

  /**
   * 更新未消费的来源标题，保持 master4.0 的路径匹配规则。
   * 来源属于未来构建 VISIT 时的覆盖值，不补写已创建的事件和请求队列。
   */
  updateOriginalSourceTitle = (
    trackingId: string,
    path: string,
    title: any
  ) => {
    const originalSource = this.getOriginalSource(trackingId);
    if (
      isEmpty(originalSource) ||
      originalSource.path !== path ||
      !isString(title)
    ) {
      return false;
    }
    const source = { ...originalSource, title };
    // 更新标题不改变入口代次，已绑定的 VISIT 仍可消费自己的来源。
    this.originalSources[trackingId].source = source;
    niceTry(() =>
      this.growingIO.minipInstance.setStorageSync(
        this.getStorageKey(trackingId, 'originalSource'),
        JSON.stringify(source)
      )
    );
    return true;
  };

  /**
   * 获取采集实例配置内容
   * @param {string} trackingId - 实例 ID
   * @returns {any} - 配置内容
   */
  // ? 多实例插件会重写该方法
  // eslint-disable-next-line
  getTrackerVds = (trackingId: string): any =>
    this.growingIO.trackingId === trackingId
      ? { ...this.growingIO.vdsConfig }
      : undefined;

  /**
   * 初始化实例的配置项
   * @param {any} options - 配置项
   * @returns {any} - 初始化后的配置项
   */
  // ?多实例插件会重写该方法
  initTrackerOptions = (options: any) => {
    const trackerOptions = this.initOptions(options);
    trackerOptions.trackingId = options.trackingId;
    this.growingIO.trackingId = options.trackingId;
    this.growingIO.vdsConfig = trackerOptions;
    return trackerOptions;
  };

  /**
   * 初始化实例的 hooker
   * @param {OriginOptions} vdsConfig - 配置项
   */
  // ?多实例插件会重写该方法
  initTrackerHooker = (vdsConfig: OriginOptions) => {
    const { platformConfig, inPlugin, minipInstance, plugins } = this.growingIO;
    const { uniVue, taro, mpx, mpvue } = vdsConfig;
    this.validateTrackerFramework(vdsConfig);

    // 如果是使用全量版本时，当前小程序不是框架的，要允许原生的hook
    if (!(uniVue || taro || mpvue || minipInstance.platform === 'quickapp')) {
      platformConfig.canHook = true;
    }
    // 初始化核心钩子（重写全局）
    if (!inPlugin || ['tbp', 'jdp'].includes(minipInstance.platform)) {
      this.eventHooks.initEventHooks();
    } else {
      this.eventHooks.initOriginalValue();
    }
    if (!(uniVue || taro || mpvue || mpx) && !inPlugin) {
      const appAlreadyCreated = niceTry(
        () => isFunction(getApp) && !!getApp()
      );
      if (appAlreadyCreated) {
        // 原生 hook 只能包装此后注册的 App/Page/Component。此处不强制失败，
        // 因为手动 track 仍可用；但必须让接入方知道初始化已晚于 App 注册。
        consoleText(
          '检测到 App 已创建：请将 gdp(\'init\') 放在 App() 注册之前，否则自动事件可能缺失。',
          'warn'
        );
      }
    }
    // 适配失败向初始化准备阶段传播，由 GrowingIO 统一回滚采集资格。
    if (uniVue) {
      plugins.gioUniAppAdapter.main();
    }
    if (taro) {
      plugins.gioTaroAdapter.main();
    }
    if (mpvue) {
      plugins.gioMpvueAdapter.main();
    }
    if (mpx) {
      plugins.gioMpxAdapter.main();
    }
    return true;
  };

  /** 框架对象和适配器必须在身份清理、全局钩子安装之前检查。 */
  validateTrackerFramework = ({ uniVue, taro, mpvue, mpx }: OriginOptions) => {
    const { plugins } = this.growingIO;
    if (uniVue) {
      if (!(uniVue as any).version) {
        throw new Error('未获取到有效的 uni-app Vue 实例');
      }
      if (!isFunction(plugins?.gioUniAppAdapter?.main)) {
        throw new Error('当前构建未包含 uni-app 框架适配器');
      }
    }
    if (taro) {
      if (!taro.Current && !taro.createComponent) {
        throw new Error('未获取到受支持的 Taro 实例');
      }
      if (!isFunction(plugins?.gioTaroAdapter?.main)) {
        throw new Error('当前构建未包含 Taro 框架适配器');
      }
    }
    if (mpvue) {
      if (!isFunction(mpvue.mixin)) {
        throw new Error('未获取到支持 mixin 的 mpvue 实例');
      }
      if (!isFunction(plugins?.gioMpvueAdapter?.main)) {
        throw new Error('当前构建未包含 mpvue 框架适配器');
      }
    }
    if (mpx) {
      if (!isFunction(mpx.injectMixins)) {
        throw new Error('未获取到支持 injectMixins 的 MPX 实例');
      }
      if (!isFunction(plugins?.gioMpxAdapter?.main)) {
        throw new Error('当前构建未包含 MPX 框架适配器');
      }
    }
  };

  /**
   * 初始化全局配置
   * @param {OriginOptions} userOptions - 用户配置
   * @returns {any} - 初始化后的全局配置
   */
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
    }
    // enableIdMapping 是旧配置名，兼容时只表达“显式开启 idMapping”。
    // 这里不能把 userKey 清理写进上面的兼容分支里：
    // 1. enableIdMapping=true 时，最终语义是强制开启 idMapping；
    // 2. 真正需要清理 userKey 的是“最终没有开启 idMapping”的场景；
    // 3. 如果把清理逻辑塞回兼容分支，就会再次出现分支可达性和语义不一致的问题。
    // 所以这里统一根据兼容后的最终值判断，避免历史 userKey 被继续带到上报数据中。
    unset(configs, 'enableIdMapping');
    // 请求超时时长设置的合法区间校验，值小于等于0ms认为不合法，改回5秒，浏览器默认有2分钟的上限
    if (isNaN(Number(configs.requestTimeout)) || configs.requestTimeout <= 0) {
      configs.requestTimeout = 5000;
    }

    // 历史接入允许只传域名，继续自动补 https；同时在本地尽早拒绝空值、
    // 错误协议和无法拼接 collect 路径的地址，避免 init 成功后所有请求才失败。
    const normalizedServerUrl = this.normalizeServerUrl(configs.serverUrl);
    if (!normalizedServerUrl) {
      throw new Error('serverUrl 必须是有效的 HTTP(S) 域名或基础地址');
    }
    configs.serverUrl = normalizedServerUrl;

    // 淘宝云转发依赖淘宝专属适配器。非淘宝包保留这些配置不会产生可用传输，
    // 因此直接拒绝初始化，避免事件进入永远无法发送的分支。
    const isPrimaryTracker =
      !this.growingIO.trackingId || this.growingIO.trackingId === trackingId;
    if (
      isPrimaryTracker &&
      (configs.tbConfig?.cloudFuncSend || configs.tbConfig?.cloudAppId) &&
      this.growingIO.minipInstance.platform !== 'tbp'
    ) {
      throw new Error('tbConfig 云转发仅支持淘宝小程序构建');
    }

    // 曝光比例不在合法范围内改回默认值
    if (configs.impressionScale < 0 || configs.impressionScale > 1) {
      configs.impressionScale = 0;
    }

    // keepAlive有效时长不在合法范围内改回默认值
    if (configs.keepAlive < 0 || configs.keepAlive > 60 * 24) {
      configs.keepAlive = 5;
    }

    // session有效时长不在合法范围内改回默认值
    if (configs.sessionExpires < 1 || configs.sessionExpires > 60 * 24) {
      // -1为默认不超时切session
      configs.sessionExpires = -1;
    }

    if (isPrimaryTracker) {
      this.validateTrackerFramework(configs);
      // 子实例会忽略 pluginMode，不能让该配置改变主实例的运行模式。
      if (configs.pluginMode) {
        this.growingIO.inPlugin = true;
      }
    }
    // 所有校验成功之后才清理旧 userKey，失败的接入配置不能修改持久身份。
    if (!configs.idMapping) {
      this.growingIO.userStore.setUserKey(trackingId, '');
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

  /**
   * 全局配置修改
   * @param {string} trackingId - 实例 ID
   * @param {string} k - 配置键名
   * @param {any} v - 配置值
   * @returns {boolean} - 是否修改成功
   */
  setOption = (trackingId: string, k: string, v: any) => {
    const { userStore, emitter } = this.growingIO;
    // gdp('setOption') 是公开入口。内部状态（例如 identify 关闭 forceLogin）
    // 不能再借用该入口，否则业务可误改发送器内部开关造成全量积压或丢数。
    if (!has(ALLOW_SET_OPTIONS, k)) {
      callError(`setOption > ${k}`);
      return false;
    }
    const trackerVds = this.getTrackerVds(trackingId);
    const prevConfig = { ...trackerVds };
    // 对 ignoreFields 进行过滤，只允许 IGNORE_PARAMS 中的字段
    if (k === 'ignoreFields') {
      v = v.filter((o: string) => IGNORE_PARAMS.includes(o));
    }
    if (k === 'serverUrl') {
      v = this.normalizeServerUrl(v);
      if (!v) {
        callError('setOption > serverUrl');
        return false;
      }
    }
    this.updateVdsConfig(trackingId, { ...trackerVds, [k]: v });
    // 从关闭到打开dataCollect时补发visit和page
    if (k === 'dataCollect' && prevConfig.dataCollect !== v && v) {
      // 更新session
      userStore.setSessionId(trackingId);
    }
    // 配置项有变更要全局广播
    emitSafely(emitter, EMIT_MSG.OPTION_CHANGE, {
      trackingId,
      optionName: k,
      optionValue: v
    });
    return true;
  };

  /**
   * 供 SDK 内部修改非公开配置，不暴露给 gdp 的 setOption 分发路径。
   * 目前仅 identify 用它关闭 forceLogin，避免放宽公开白名单。
   */
  setInternalOption = (trackingId: string, k: string, v: any) => {
    const trackerVds = this.getTrackerVds(trackingId);
    this.updateVdsConfig(trackingId, { ...trackerVds, [k]: v });
    emitSafely(this.growingIO.emitter, EMIT_MSG.OPTION_CHANGE, {
      trackingId,
      optionName: k,
      optionValue: v
    });
    return true;
  };

  /**
   * 不依赖 URL 全局对象：部分旧小程序运行时没有完整实现。
   * 接受历史上的“仅域名”写法，统一为不含尾随斜杠的 HTTP(S) 基础地址。
   */
  normalizeServerUrl = (serverUrl: any) => {
    if (typeOf(serverUrl) !== 'string') return '';
    let normalized = serverUrl.trim();
    if (!normalized) return '';
    if (!/^https?:\/\//i.test(normalized)) {
      // 已经带协议但不是 HTTP(S) 时不能再拼 https，否则会生成
      // https://ftp://... 这类表面合法、实际必然失败的地址。
      if (/^[a-z][a-z\d+.-]*:\/\//i.test(normalized)) return '';
      normalized = `https://${normalized}`;
    }
    normalized = normalized.replace(/^https?:\/\//i, (protocol) =>
      protocol.toLowerCase()
    );
    normalized = normalized.replace(/\/+$/, '');
    return /^https?:\/\/[^\s/?#]+(?:\/[^\s?#]*)?$/i.test(normalized)
      ? normalized
      : '';
  };

  /**
   * 获取全局配置
   * @param {string} trackingId - 实例 ID
   * @param {string} [k] - 配置键名
   * @returns {any} - 配置值
   */
  getOption = (trackingId: string, k?: string) => {
    const trackerVds = this.getTrackerVds(trackingId);
    if (k && has(this.growingIO.vdsConfig, k)) {
      if (has(trackerVds, k)) {
        return trackerVds[k];
      } else {
        return this.growingIO.vdsConfig[k];
      }
    } else if (isEmpty(k)) {
      return trackerVds;
    } else {
      callError(`getOption > ${k}`);
      return undefined;
    }
  };

  /**
   * 根据实例更新内存和存储中的 vds 配置项值
   * @param {string} trackingId - 实例 ID
   * @param {any} vds - 配置项
   */
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

  /**
   * 修改分享跳出判断值
   * @param {boolean} [v] - 设置的值
   */
  toggleShareOut = (v?: boolean) => {
    if (isBoolean(v)) {
      this.shareOut = v;
    } else {
      this.shareOut = !this.shareOut;
    }
  };

  /**
   * 手动调用 visit 事件的方法
   * @param {string} trackingId - 实例 ID
   * @param {any} [props] - 属性
   */
  sendVisit = (trackingId: string, props?: any) => {
    (this.eventHooks.appEffects as any).buildVisitEvent(trackingId, props);
  };

  /**
   * 手动调用 page 事件的方法
   * @param {string} trackingId - 实例 ID
   * @param {any} [props] - 属性
   */
  sendPage = (trackingId: string, props?: any) => {
    (this.eventHooks.pageEffects as any).buildPageEvent(trackingId, props);
  };

  /**
   * 事件的格式转换(同时移除无值的字段)
   * @param {EXTEND_EVENT} event - 事件对象
   */
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
      emitSafely(this.growingIO.emitter, EMIT_MSG.ON_COMPOSE_AFTER, {
        composedEvent: convertedEvent
      });
      // 提交请求队列
      const committedEvent = { ...convertedEvent, requestId: guid() };
      uploader.commitRequest(committedEvent);
    }
  };

  /**
   * 事件重组
   * @param {any} e - 原始事件
   * @returns {any} - 重组后的事件
   */
  eventRefactor = (e: any) => {
    // 与 4.3.0 起及 master4.0 的既有规则一致：释放拦截队列时重读 title，
    // path/query/timestamp 沿用原事件；已转换的请求与 forceLogin 队列不再重组。
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

  /**
   * 事件拦截器（有的通用维度字段需要异步获取，为了防止事件在通用维度还没返回之前就发出去）
   * 一般只有最开始的个别事件会被拦住
   * @param {any} event - 事件对象
   */
  eventInterceptor = (event: any) => {
    this.bindOriginalSource(event);
    const { systemInfo, network } = this.growingIO.minipInstance;
    if (isEmpty(systemInfo) || isEmpty(network)) {
      // 没有通用维度字段，直接拦截存下来
      this.interceptEvents.push(event);
    } else if (!isEmpty(this.interceptEvents)) {
      // 有通用维度字段了，且有被拦截的事件，放一起重新添加通用维度字段再提交转换
      this.releaseInterceptedEvents(event);
    } else {
      // 有通用维度字段了，也没有有被拦截的事件，直接提交转换
      this.eventConverter(event);
    }
  };

  /** Swap ownership before conversion: synchronous observers can enqueue a new batch. */
  private releaseInterceptedEvents = (event?: any) => {
    const pendingEvents = this.interceptEvents;
    this.interceptEvents = [];
    if (event) pendingEvents.push(event);
    pendingEvents.forEach((pending: any) => {
      this.eventConverter(this.eventRefactor(pending));
    });
  };

  /**
   * 系统信息异步获取完后对拦截队列进行检查，防止事件被卡住
   */
  eventReleaseInspector = () => {
    const {
      minipInstance: { systemInfo, network }
    } = this.growingIO;
    if (!isEmpty(systemInfo) && !isEmpty(network) && !isEmpty(this.interceptEvents)) {
      this.releaseInterceptedEvents();
    }
  };

  /**
   * 构建应用/页面转发分享事件
   * @param {string} trackingId - 实例 ID
   * @param {any} args - 参数
   */
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
      $from: originResult?.from,
      $target: originResult?.target?.id,
      $share_title: updateResult?.title,
      $share_path: head(uri),
      $share_query: uri[1],
      ...updateResult?.attributes
    });
    eventInterceptor(event);
  };

  /**
   * 构建朋友圈分享事件
   * @param {string} trackingId - 实例 ID
   * @param {any} args - 参数
   */
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

  /**
   * 构建添加收藏事件
   * @param {string} trackingId - 实例 ID
   * @param {any} args - 参数
   */
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

  /**
   * 需要对所有 trackingId 执行的逻辑
   * @param {Function} callback - 回调函数
   */
  trackersExecute = (callback: (trackingId: string) => any) => {
    this.initializedTrackingIds.forEach((trackingId: string) => {
      if (typeOf(callback) === 'function') {
        callback(trackingId);
      }
    });
  };
}

export default DataStore;
