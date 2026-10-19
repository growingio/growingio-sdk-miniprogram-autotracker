/**
 * 名称：Taro代理插件
 * 用途：用于重写Taro框架下的创建App/Page/Component方法实现代理Hook；并获取Taro框架下的自定义方法真实方法名获取。
 * 注意：测试taro3react时，微信要用react18测试，支付宝要用react17测试。
 */
import {
  TARO_EVENT_PROPS_REG,
  TARO_EVENT_REACT_FUNC1_REG,
  TARO_EVENT_REACT_FUNC2_REG,
  TARO_EVENT_VUE_FUNC1_REG,
  TARO_EVENT_VUE_FUNC2_REG,
  TARO_EVENT_VUE_FUNC3_REG
} from '@@/constants/regex';
import { GrowingIOType } from '@@/types/growingIO';
import EMIT_MSG from '@@/constants/emitMsg';

let ut;
/** 事件类型到 React 回调属性名的映射，用于从 Taro 元素上反查业务事件处理器 */
const HANDLER = {
  tap: 'onClick',
  longpress: 'onLongPress'
};
/** 重复 hook 标记：挂在 hooks.call 包装函数上，避免热更新或插件重复注册时二次包装 */
const TARO3_CALL_HOOKED = '__gioTaro3CallHooked__';

/**
 * 单个 Taro 原生页面实例的生命周期状态。
 *
 * Taro3 的 createPageConfig 在 mount 回调中才真正执行 onLoad 并 resolve(hasLoaded)，
 * 而原生 onShow/onReady 可能先于该回调到达，因此需要一个状态机把提前到达的开始事件
 * 暂存（pending），等 mount 完成后按序回放，才能保证 PAGE 能拿到 onLoad 阶段设置的
 * 属性、标题与 query。
 */
type TaroPageState = {
  /** mount 回调是否已执行（onLoad 与 hasLoaded 是否已完成），false 表示 onShow/onReady 需要排队 */
  loaded: boolean;
  /** onLoad 的 PAGE 是否已被通用内核接受（未被 50ms 去重吞掉），决定之后是否需要补发 onLoadEnd */
  loadHandled: boolean;
  /** 暂存 onLoad 的原始参数，用于在 mount 完成后补发 onLoadEnd */
  loadArgs: any[];
  /** 被延迟的 onShow/onReady 开始事件，mount 完成后按入队顺序执行 */
  pending: Array<() => void>;
  /** 属于本次原生挂载的运行时实例；卸载时移除回调归属索引。 */
  runtimeInstances: Set<object>;
};

class GioTaroAdapter {
  /** 插件版本号，由构建时替换 __PLUGIN_VERSION__ 占位符 */
  public pluginVersion: string;
  /** Taro 大版本号：'2' | '3'，未识别时为空字符串 */
  public taroVersion: string;
  /** Taro 运行时实例（@tarojs/runtime） */
  private taro: any;
  /** Taro3 下的 Vue 实例，如果不为空说明当前项目是基于 Vue 的 Taro3 */
  private taroVue: any;
  /** Taro3 下 Vue 的大版本号（2 或 3），react 项目下为 undefined */
  private taroVueVersion: number;
  /** Vue3 setup 语法下，页面路径 -> { 导出方法名: 实际方法名 } 的映射，用于还原事件名 */
  private exposedNames: any;
  /**
   * 已包装过生命周期的原生 Page 配置对象集合。
   * 用 WeakSet 是为了在页面卸载后能随对象被 GC 回收，且天然去重（同一 pageObject 只包装一次）。
   */
  private taro3PageObjects: WeakSet<object>;
  /** 按原生页面实例索引的生命周期状态机，见 TaroPageState */
  private taroPageStates = new WeakMap<object, TaroPageState>();
  private taroRuntimePages = new WeakMap<
    object,
    { page: any; state: TaroPageState }
  >();
  /** 已被包装过 mount 的 Taro App 实例，避免同一 App 重复包装 */
  private taroMountApps = new WeakSet<object>();
  /**
   * 等待 mount 回调的页面：$taroPath -> 原生页面实例。
   *
   * 存在的必要性：同路由重进时，新页面的 onLoad 可能在旧页面的卸载回调中同步触发，
   * 此时核心同步作用域里还是旧页面；由于无法借用该作用域来识别新页面，
   * 只能按 $taroPath 建立索引，等 mount 回调真正执行时再匹配到正确的页面实例。
   */
  private pendingTaroMounts = new Map<string, any>();

  constructor(public growingIO: GrowingIOType) {
    this.pluginVersion = '__PLUGIN_VERSION__';
    const { utils, emitter, minipInstance } = this.growingIO;
    ut = utils;
    this.exposedNames = {};
    this.taro3PageObjects = new WeakSet();

    /*
     * Taro3 曝光采集入口。
     *
     * 为什么挂在生命周期"结束"事件（onShowEnd/onReadyEnd）上：
     * Taro3 的页面节点（TaroElement）要到原生生命周期跑完、框架提交渲染后才挂到 document 上，
     * 在 onShow/onReady 开始时遍历 document 取不到节点，也就拿不到 dataset。
     *
     * 为什么用 setTimeout 而不是立即执行：
     * Taro3 虽然不走原生 Page 配置，但依然会在框架内部调用原生生命周期；这里再让出一个宏任务，
     * 确保 Taro 侧的渲染提交（prepareMountList）已经完成。
     *
     * 为什么必须校验 page === minipInstance.getCurrentPage()：
     * 快速跳页时 A 页的 onShowEnd 可能晚于 B 页的 onShow 到达，若不加校验会把 A 页的曝光
     * 错误注册到当前栈顶的 B 页上（isInitImpression 会记在错误的 page 对象上）。
     */
    emitter.on(EMIT_MSG.MINIP_LIFECYCLE, ({ event, params }) => {
      if (['Page onShowEnd', 'Page onReadyEnd'].includes(event)) {
        if (this.taro && this.taroVersion === '3') {
          const page = params?.page ?? params?.instance;
          // Taro3 开发时需要等原生生命周期结束后才能取到节点。
          // 只能初始化触发生命周期的页面，避免快速跳页时把 A 页的曝光注册到 B 页。
          setTimeout(() => {
            if (page && page === minipInstance.getCurrentPage()) {
              ut.niceTry(() => {
                this.saveFullPage(document.body);
                minipInstance.initImpression(page);
              });
            }
          }, 0);
        }
      }
    });
  }

  /**
   * 插件入口方法
   * @description 版本判断与代理分发
   */
  main = () => {
    this.initTaroInstance();
    if (this.taroVersion) {
      this.proxyTaro();
    } else {
      ut.consoleText('未获取到Taro实例或不支持的Taro版本，请检查!', 'error');
    }
  };

  /**
   * 初始化Taro实例和版本
   * @description 获取Taro实例并判断版本
   */
  initTaroInstance = () => {
    const { taro, taroVue } = this.growingIO.vdsConfig;
    const { Current, createComponent } = taro;
    const isTaro2 = !Current && createComponent;
    const isTaro3 = Current && !createComponent;

    this.taro = taro;
    if (isTaro2) {
      this.taroVersion = '2';
      ut.consoleText('Taro version 2', 'info');
    } else if (isTaro3) {
      this.taroVersion = '3';
      this.taroVue = taroVue;
      if (this.taroVue) {
        this.taroVueVersion = Number(
          ut.head(ut.split(this.taroVue.version, '.'))
        );
        ut.consoleText(
          `Taro version 3, Vue version ${this.taroVueVersion}`,
          'info'
        );
      } else {
        ut.consoleText('Taro version 3', 'info');
      }
    }
  };

  /**
   * 执行代理
   * @description 根据Taro版本执行对应的代理逻辑
   */
  proxyTaro = () => {
    if (this.taroVersion === '2') {
      this.proxyTaro2(this.taro);
    } else if (this.taroVersion === '3') {
      this.proxyTaro3();
    }
  };

  /**
   * 代理Taro2
   * @description 代理Taro2的createApp和createComponent
   * @param {any} taro - Taro实例
   */
  proxyTaro2 = (taro: any) => {
    const { createApp: originApp, createComponent: originComponent } = taro;

    if (originApp) {
      taro.createApp = (AppClass) => {
        const AppRef = originApp(AppClass);
        this.growingIO.dataStore.eventHooks.appOverriding(AppRef);
        return AppRef;
      };
    }

    if (originComponent) {
      taro.createComponent = (ComponentClass, isPage) => {
        const ComponentRef = originComponent(ComponentClass, isPage);
        this.injectTaro2Component(ComponentRef, isPage);
        return ComponentRef;
      };
    }
  };

  /**
   * 注入Taro2组件
   * @description Taro2 的组件生命周期/方法在编译产物中的位置因平台而异，
   * 因此按平台分别对 ComponentRef 本身或 ComponentRef.methods 做注入。
   * @param {any} ComponentRef - 组件引用
   * @param {boolean} isPage - 是否为页面
   */
  injectTaro2Component = (ComponentRef: any, isPage: boolean) => {
    const targetType = isPage ? 'page' : 'component';
    const hookName = `${targetType}Overriding`;
    const { gioPlatform, dataStore } = this.growingIO;
    const hook = dataStore.eventHooks[hookName];

    // wx/qq: hook methods
    // my/tt/jd: hook ComponentRef
    // swan: hook both
    const useMethods = ['wx', 'qq', 'swan'].includes(gioPlatform);
    const useRef = ['my', 'tt', 'jd', 'swan'].includes(gioPlatform);

    if (useRef) hook(ComponentRef);
    if (useMethods) hook(ComponentRef.methods);
  };

  /**
   * 代理Taro3
   * @description 处理Taro3的Hook逻辑，按 Vue 版本与 Taro 版本选择不同的接入点
   */
  proxyTaro3 = () => {
    const { eventHooks } = this.growingIO.dataStore;
    // hook app
    eventHooks.nativeGrowing(['App']);

    // taro3vue2走单独的hook逻辑
    // Vue2 的页面生命周期会落到原生 Page 配置上，因此直接对原生 Page 做注入
    if (this.taroVueVersion === 2) {
      eventHooks.nativeGrowing(['Page']);
      this.taro3Vue2Proxy();
      return;
    }

    if (this.taroVueVersion === 3) {
      // Vue3 需要在挂载阶段记录 defineExpose 的方法名映射，用于还原事件名
      this.taro3vue3Proxy();
    }

    // 新版本taro3react和taro3vue3的生命周期走监听hook逻辑
    if (this.taro?.hooks?.call) {
      this.hookTaro3Call();
    } else {
      // 低版本taro3react走dispatchEvent：没有 hooks.call 入口，只能退化为原生 Page 注入
      this.taro3ReactProxy();
      eventHooks.nativeGrowing(['Page']);
    }
  };

  /**
   * Hook Taro3 的 hooks.call
   *
   * @description Taro3 的运行时把框架内部通信统一收敛到 hooks.call 这一个入口，
   * 因此重写它即可同时拦截"页面配置生成"和"Taro 事件分发"两条链路。
   * 目前只关心两类消息：
   *   - modifyPageObject：Taro 生成原生 Page 配置后回调，用于挂载页面生命周期包装
   *   - dispatchTaroEvent：Taro 元素派发事件后回调，用于无埋点点击采集
   *
   * 重写采用"先执行原方法、再处理采集"的顺序：
   * 采集代码不会插在框架主流程中间，即使出错也只影响埋点，不影响业务页面渲染。
   */
  hookTaro3Call = () => {
    // 幂等保护：热更新或插件重复注册时，避免在已包装的函数上再包一层
    if (this.taro.hooks.call[TARO3_CALL_HOOKED]) {
      return;
    }

    const self = this;
    const originCall = this.taro.hooks.call;

    const wrappedCall = function (...args) {
      const argsArray = Array.from(args);
      const [msgType] = argsArray;
      const result = originCall.apply(this, argsArray);

      // hasLoaded.then 中的业务回调已经离开原生包装器的同步作用域。
      // 这里只为回调绑定原生 owner；PAGE 仍只由 modifyPageObject 链路产生。
      if (msgType === 'getLifecycle') {
        return (
          ut.niceTry(() =>
            self.bindTaroLifecycleCallbacks(result, argsArray[1])
          ) ?? result
        );
      }

      // Taro 只会在页面实例注册后才通过 getLifecycle 取得 React/Vue 回调。
      // 纯函数页面没有 Taro 生命周期 Hook 时不会注册实例，不能从这里采集 Page。
      // 页面生命周期统一在 modifyPageObject 提供的原生 Page 配置上处理。
      if (msgType === 'modifyPageObject') {
        ut.niceTry(() => self.handleTaro3PageObject(argsArray[1]));
      }

      if (msgType === 'dispatchTaroEvent') {
        ut.niceTry(() =>
          self.handleTaro3DispatchEvent(argsArray[1], argsArray[2])
        );
      }

      return result;
    };
    // 标记放在包装函数自身而非 hooks 上，无需额外字段即可做幂等判断
    this.defineProperty(wrappedCall, TARO3_CALL_HOOKED, true);
    this.defineProperty(this.taro.hooks, 'call', wrappedCall);
  };

  private bindTaroLifecycleCallbacks = (result: any, instance: any) => {
    if (!instance || !['object', 'function'].includes(typeof instance))
      return result;
    const page = this.getTaroContextPage();
    const state = page && this.taroPageStates.get(page);
    let owner = this.taroRuntimePages.get(instance);
    if (
      state &&
      (!ut.isFunction(this.taro.getPageInstance) ||
        this.taro.getPageInstance(page.$taroPath) === instance)
    ) {
      const scopedOwner = { page, state };
      if (!state.loaded || !owner || owner.state === state) {
        state.runtimeInstances.add(instance);
        this.taroRuntimePages.set(instance, scopedOwner);
      }
      owner = scopedOwner;
    }
    if (!owner) return result;
    const adapter = this;
    const bind = (callback: any) => {
      if (!ut.isFunction(callback)) return callback;
      // 捕获本次 owner，后续实例重用或卸载不会让已返回的旧回调借用新页。
      return function (...args) {
        if (!adapter.growingIO.gioSDKInitialized)
          return callback.apply(this, args);
        return adapter.withPageContext(owner.page, () =>
          callback.apply(this, args)
        );
      };
    };
    return Array.isArray(result) ? result.map(bind) : bind(result);
  };

  /**
   * 处理 Taro3 页面对象修改
   *
   * @description Taro3 在 createPageConfig 里生成原生 Page 配置对象后，会通过
   * modifyPageObject 消息交给各插件处理，这是"页面对象可见"的唯一可靠时机。
   *
   * 之所以不遍历 Taro 的 eh 等内部事件表，而是包装已存在的生命周期函数：
   *   1. eh 属于 Taro 内部实现，不同版本结构不稳定；
   *   2. 生命周期是页面级的，直接在 pageObject 上包装，天然覆盖"页面自身没有任何
   *      React/Taro Hook"的纯函数页面——这类页面不会注册页面实例，Taro 也就不会
   *      调用 getLifecycle，从那条链路根本采集不到 PAGE。
   *
   * 只包装 pageObject 上已经存在的生命周期：Taro 只为业务真正声明的生命周期生成函数，
   * 凭空补齐会向框架注入不存在的生命周期，改变 Taro 的行为。
   *
   * @param {any} pageObject - Taro 生成的原生 Page 配置对象（会被原地修改）
   */
  handleTaro3PageObject = (pageObject: any) => {
    const { eventHooks } = this.growingIO.dataStore;
    if (!pageObject || typeof pageObject !== 'object') {
      return;
    }
    // 同一 pageObject 可能因热更新/多次 createPageConfig 重复进入，包装一次即可
    if (this.taro3PageObjects.has(pageObject)) {
      return;
    }
    this.taro3PageObjects.add(pageObject);
    // 让通用内核准备好每个页面生命周期的默认回调（defPageCbs），pageEffects.main 依赖它
    eventHooks.setPageEffectCbs();
    const adapter = this;

    eventHooks.pageHandlers.forEach((lifecycleName: string) => {
      const original = pageObject[lifecycleName];
      if (!ut.isFunction(original)) {
        return;
      }
      // 必须用 function 而非箭头函数：生命周期由小程序以 page 为 this 调用，
      // 箭头函数会丢失原生 this，导致业务回调内的 this.setData 等失效。
      pageObject[lifecycleName] = function (...args) {
        return adapter.runTaroPageLifecycle(
          this,
          lifecycleName,
          original,
          args
        );
      };
    });
  };

  /**
   * 执行一次页面生命周期的采集（SDK side effect）并返回是否被接受
   *
   * @description 单独抽出来是为了让所有调用点都满足两个约束：
   *   1. 包在 withPageContext 内，保证 PAGE 的 path/query/属性取自当前页面；
   *   2. 用 ut.niceTry 隔离异常，采集失败不能阻断 Taro 的业务生命周期。
   * 返回值会被第 3 点使用：pageEffects.main 返回 false 表示这条生命周期被 50ms 去重
   * 吞掉了（Taro 重复注入等），此时不应再补发对应的 xxxEnd，否则会凭空造出半条生命周期。
   *
   * @returns {boolean} 采集是否真正发生（未被去重丢弃）
   */
  // SDK effects 与业务执行分开隔离，采集异常不能阻断 Taro 挂载。
  runTaroPageEffects = (page: any, name: string, args: any[]) =>
    ut.niceTry(() =>
      this.withPageContext(page, () =>
        this.growingIO.dataStore.eventHooks.pageEffects.main(
          page,
          name,
          args
        )
      )
    ) as boolean;

  /**
   * 补发 Page 生命周期的结束事件（Page onShowEnd / onLoadEnd ...）
   *
   * @description 通用内核的 pageEffects.main 只广播 `Page onShow` / `Page onReady` 这类"开始"事件，
   * End 事件原本由 lifeFcEffects 在原生 Page 包装链路里广播。Taro3 生命周期走的是
   * hooks.call / 自建包装，不经过 lifeFcEffects，所以这里必须手工补发。
   *
   * 重要性：APM 的发送门槛依赖 onReadyEnd，热启动依赖 onShowEnd，
   * 缺少 End 会导致 APM 一直等不到门槛、事件永远发不出去。
   */
  emitTaroPageEnd = (page: any, name: string, args: any[]) =>
    ut.niceTry(() =>
      this.withPageContext(page, () =>
        this.growingIO.emitter.emit(EMIT_MSG.MINIP_LIFECYCLE, {
          event: `Page ${name}End`,
          timestamp: Date.now(),
          params: { page, instance: page, arguments: args }
        })
      )
    );

  /**
   * 单个页面生命周期的统一处理入口
   *
   * @description 按生命周期类型分流，处理顺序遵循一条主线：
   *   先采集（runTaroPageEffects）→ 再执行业务原生回调 → 最后补发 End 事件。
   * 这样 End 的时间戳晚于业务回调，APM 统计的耗时才包含业务执行时间。
   *
   * @param {any} page - 原生页面实例（由调用方以 this 传入）
   * @param {string} name - 生命周期名，如 onLoad / onShow / onReady / onUnload
   * @param {Function} original - 被包装的原始生命周期函数
   * @param {any[]} args - 生命周期参数
   * @returns {any} 原始生命周期的返回值，必须原样透传给小程序
   */
  runTaroPageLifecycle = (page: any, name: string, original, args: any[]) => {
    if (!this.growingIO.gioSDKInitialized) return original.apply(page, args);
    const { eventHooks } = this.growingIO.dataStore;
    if (this.growingIO.platformConfig.shareEventTypes.includes(name)) {
      /*
       * 分享类生命周期（onShareAppMessage/onShareTimeline/onAddToFavorites）
       * 与其他生命周期差异较大：它们的返回值会被小程序当作分享内容使用，必须原样返回，
       * 且通用内核的 lifeFcEffects 内部已经会执行一次业务回调并处理异步/Promise 结果。
       * 因此这里先用业务回调拿一次结果，再复用 lifeFcEffects 的结果处理逻辑：
       * 传 `() => result` 作为方法，避免业务回调被重复执行两次。
       */
      const result = this.withPageContext(page, () =>
        original.apply(page, args)
      );
      return (
        ut.niceTry(() =>
          this.withPageContext(page, () =>
            eventHooks
              .lifeFcEffects(name, () => result, 'Page')
              .apply(page, args)
          )
        ) ?? result
      );
    }

    if (name === 'onLoad') {
      /*
       * onLoad 是页面生命周期的起点，也是异步挂载的起点。
       *
       * Taro 的 createPageConfig 流程是：原生 onLoad → 渲染 → mount 回调中执行 onLoad 逻辑
       * 并 resolve(hasLoaded) → 提交渲染 → 之后才轮到 onShow/onReady。
       * 也就是说"原生 onLoad"早于"页面数据就绪"，属性、标题、query 都可能在之后才设置。
       * 因此这里先建立状态机并 hook 住 mount（hookTaroPageMount），把 onShow/onReady
       * 推迟到 mount 完成后再采集。
       */
      const state: TaroPageState = {
        loaded: false,
        loadHandled: false,
        loadArgs: args,
        pending: [],
        runtimeInstances: new Set()
      };
      this.taroPageStates.set(page, state);
      ut.niceTry(() => this.hookTaroPageMount());
      // 先采集 onLoad（此时能拿到同步 onLoad 参数），再执行业务回调
      state.loadHandled = !!this.runTaroPageEffects(page, name, args);
      const result = this.withPageContext(page, () =>
        original.apply(page, args)
      );
      // 同路由重进可能要等前一个实例卸载后才调用 mount，此时同步上下文已结束。
      // 按 $taroPath 登记，供 mount 回调在自己的执行时机里匹配回这个页面实例。
      if (!state.loaded && page.$taroPath) {
        this.pendingTaroMounts.set(page.$taroPath, page);
      }
      return result;
    }

    const state = this.taroPageStates.get(page);
    if (name === 'onShow' || name === 'onReady') {
      /*
       * onShow/onReady 是 PAGE 事件的主要来源，但要分两种情况：
       *
       * (a) state 存在且 mount 未完成：此时业务页面还没渲染，直接采集会得到不完整的
       *     属性/标题。先把这次开始事件压入 pending，仅执行原始业务回调（不能让业务的
       *     onShow 被延迟，否则页面交互会卡住），等 mount 回调里再回放采集与 End。
       *
       * (b) mount 已完成（或取不到 state）：按常规顺序"先采集、再业务、最后 End"。
       *
       * End 事件统一用 Promise.resolve().then 延后一个微任务：
       * Taro 在 hasLoaded.then 回调里还会执行 onShow/onReady 相关的同步业务逻辑，
       * 把 End 排在微任务队列里，能保证它的时间戳晚于这些业务回调，
       * APM 统计到的页面耗时才是完整的。
       */
      const begin = () => {
        const handled = this.runTaroPageEffects(page, name, args);
        // Taro hasLoaded.then 的回调已入队；结束事件排在其同步业务回调之后。
        Promise.resolve().then(() => {
          if (handled) this.emitTaroPageEnd(page, name, args);
        });
      };
      if (state && !state.loaded) {
        state.pending.push(begin);
        try {
          return original.apply(page, args);
        } catch (error) {
          // 业务回调抛错说明这次生命周期提前中断，需要把排队的采集任务撤回，
          // 否则 mount 完成后会为一个已失败的 onShow 补发 PAGE 与 End 事件。
          state.pending = state.pending.filter((pending) => pending !== begin);
          throw error;
        }
      }
      const handled = this.runTaroPageEffects(page, name, args);
      const result = this.withPageContext(page, () =>
        original.apply(page, args)
      );
      Promise.resolve().then(() => {
        if (handled) this.emitTaroPageEnd(page, name, args);
      });
      return result;
    }

    /*
     * 其余生命周期（onHide/onUnload/onTabItemTap/onPullDownRefresh 等）
     * 同步执行即可：先采集，再业务，最后 End。
     * 用 try/finally 保证 onUnload 的清理一定会执行——即使业务回调抛错，
     * 也要清掉状态机与待挂载索引，否则同路由再次进入时会取到已卸载实例的旧状态。
     */
    const handled = this.runTaroPageEffects(page, name, args);
    try {
      const result = this.withPageContext(page, () =>
        original.apply(page, args)
      );
      if (handled) this.emitTaroPageEnd(page, name, args);
      return result;
    } finally {
      if (name === 'onUnload') {
        const state = this.taroPageStates.get(page);
        state?.runtimeInstances.forEach((instance) => {
          if (this.taroRuntimePages.get(instance)?.state === state) {
            this.taroRuntimePages.delete(instance);
          }
        });
        this.taroPageStates.delete(page);
        this.pendingTaroMounts.delete(page.$taroPath);
      }
    }
  };

  /**
   * 包装 Taro App 的 mount 回调
   *
   * @description Taro createPageConfig 的 mount 回调执行 onLoad、resolve(hasLoaded)，再提交渲染。
   * 回调返回时同步补齐待处理的 Page 开始事件，随后排队的 onShow/onReady 才会执行。
   * 不向 onLoad 塞入第二个参数：Taro 会把它当作预渲染处理器并跳过原生 setData。
   *
   * 匹配页面实例时的优先级：
   *   1. pendingTaroMounts[$taroPath] —— 同路由重进等"栈上下文已失效"的场景；
   *   2. 当前上下文页面且 $taroPath 一致 —— 常规同步场景。
   * 之所以不能直接用 contextPage：旧页卸载回调中可能立即开始新页挂载，此时栈顶还是旧页。
   */
  hookTaroPageMount = () => {
    const app = this.taro.Current?.app;
    if (!app || !ut.isFunction(app.mount) || this.taroMountApps.has(app))
      return;
    const original = app.mount;
    const adapter = this;
    app.mount = function (...args) {
      const contextPage = adapter.getTaroContextPage();
      // 旧页卸载回调内可能立即开始新页挂载，必须按实例路径匹配，不能借用旧页上下文。
      const page =
        adapter.pendingTaroMounts.get(args[1]) ??
        (contextPage?.$taroPath === args[1] ? contextPage : undefined);
      const state = page && adapter.taroPageStates.get(page);
      // mount 的最后一个参数是框架传入的回调，包装它即可在"挂载完成"这一时刻被通知
      const callback = args[args.length - 1];
      if (state && !state.loaded && ut.isFunction(callback)) {
        args[args.length - 1] = function (...callbackArgs) {
          // 在页面上文内执行回调，保证 Taro 内部由此触发的属性/标题设置能被正确归属
          const result = adapter.withPageContext(page, () =>
            callback.apply(this, callbackArgs)
          );
          adapter.pendingTaroMounts.delete(page.$taroPath);
          // 二次校验：回调执行期间页面可能已被卸载并重建，状态对象被换掉时不能再回放
          if (adapter.taroPageStates.get(page) === state) {
            state.loaded = true;
            // onLoad 的 PAGE 已被接受过才补发 onLoadEnd，否则会发出一条孤儿结束事件
            if (state.loadHandled)
              adapter.emitTaroPageEnd(page, 'onLoad', state.loadArgs);
            // 一次性取出全部待处理任务，避免回放过程中新增任务被重复执行
            const pending = state.pending.splice(0);
            pending.forEach((begin) => begin());
          }
          return result;
        };
      }
      return original.apply(this, args);
    };
    this.taroMountApps.add(app);
  };

  /** Taro 只提供调度时点，页面来源由核心的同一个同步作用域管理。 */
  withPageContext = <T>(page: any, callback: () => T): T =>
    this.growingIO.dataStore.eventHooks.currentPage.withPageContext(
      page,
      callback
    );

  getTaroContextPage = () =>
    this.growingIO.dataStore.eventHooks.currentPage.getContextPage();

  getTaroPagePath = (page: any) =>
    this.growingIO.dataStore.eventHooks.currentPage.getPageIdentityPath(page);

  /**
   * 处理Taro3事件分发
   * @description 拦截dispatchTaroEvent消息，处理点击等用户行为
   *
   * 只处理无埋点开启、且事件类型在 actionEventTypes 白名单内的交互事件。
   * 另外用 `target.id === currentTarget.id` 过滤掉冒泡：Taro 会给每个节点都加 id，
   * 两者一致才说明当前元素就是真正被点击的节点，避免父节点重复上报同一次点击。
   *
   * @param {any} taroEvent - Taro事件对象
   * @param {any} taroElement - Taro元素对象
   */
  handleTaro3DispatchEvent = (taroEvent: any, taroElement: any) => {
    if (!this.growingIO.gioSDKInitialized) return;
    const { eventHooks } = this.growingIO.dataStore;
    const actionEffects = this.growingIO.plugins?.gioEventAutoTracking?.main;

    if (
      ut.isFunction(actionEffects) &&
      eventHooks.actionEventTypes.includes(taroEvent.type)
    ) {
      const { currentTarget, target, detail } = taroEvent.mpEvent;
      // taro本身会给所有节点添加id，id一致说明是触发事件的节点
      if (target.id === currentTarget.id) {
        this.processTaro3Event(
          taroEvent,
          taroElement,
          actionEffects,
          currentTarget,
          detail
        );
      }
    }
  };

  /**
   * 处理Taro3具体事件逻辑
   * @description 获取真实方法名并触发埋点
   * @param {any} taroEvent - Taro事件对象
   * @param {any} taroElement - Taro元素对象
   * @param {Function} actionEffects - 埋点处理函数（gioEventAutoTracking.main）
   * @param {any} currentTarget - 当前目标
   * @param {any} detail - 事件详情
   */
  processTaro3Event = (
    taroEvent,
    taroElement,
    actionEffects,
    currentTarget,
    detail
  ) => {
    // 尝试获取真实的方法名
    try {
      // 事件的业务处理器挂在 Taro 元素的 __handlers 上，按事件类型取第一个
      let originHandler = ut.head(taroElement?.__handlers?.[taroEvent.type]);
      // 模板自身也绑定 eh；没有业务处理器时不能凭空生成匿名采集事件。
      if (!originHandler) return;

      /*
       * 解析方法名的优先级：
       *   1. 框架提供的真实方法名解析（React / Vue3 各有一套实现）
       *   2. 解析失败时回退到匿名方法名（页面名 + 元素 uid），保证点击不丢
       * 整个解析过程用 niceTry 包装：解析依赖压缩产物的函数体字符串，本身比较脆弱，
       * 失败应该降级为匿名事件，而不是让这次点击采集整体失败。
       */
      const funcName =
        ut.niceTry(() => {
          // 部分版本会先包一层 oldHandler，需要先剥掉才能拿到业务函数
          if (originHandler.oldHandler) {
            originHandler = originHandler.oldHandler;
          }

          if (this.taroVue) {
            // vue3
            return this.taro3vue3GetFuncName(originHandler, taroElement);
          } else {
            // react --- @tarojs/runtime 3.6.x会有一个随机名的对象存储点击事件优先获取，其他版本直接取originHandler
            return this.taro3reactGetFuncName(
              originHandler,
              taroEvent,
              taroElement
            );
          }
        }) || this.getAnonymousFunc(taroElement);

      actionEffects(
        {
          ...taroEvent.mpEvent,
          currentTarget: {
            ...currentTarget,
            detail,
            dataset: {
              // 合并原生 dataset 与 Taro 元素 dataset，兼容只有其中一方存在的场景
              ...currentTarget.dataset,
              ...taroElement?.dataset
            }
          }
        },
        funcName
      );
    } catch (error) {
      ut.consoleText('Error: ' + error, 'error');
    }
  };

  /**
   * Taro3 React 代理 (低版本)
   * @description 针对不支持hooks.call的低版本Taro3，使用defineProperty拦截dispatchEvent
   *
   * 高版本 Taro3 有 hooks.call 这个统一入口，可以直接拦 dispatchTaroEvent；
   * 低版本没有该入口，只能退而拦截 Taro 元素基类上的 dispatchEvent。
   */
  taro3ReactProxy = () => {
    // TaroElement 的基类：document -> TaroDocument -> TaroNode
    // @ts-ignore
    const taroNode = document.__proto__.__proto__;

    const proxyDispatchEvent = (dispatchEvent: Function) => {
      const self = this;
      const { eventHooks } = this.growingIO.dataStore;
      const actionEffects = self.growingIO.plugins?.gioEventAutoTracking?.main;

      return function () {
        const node = this;
        const taroEvent = arguments[0];

        if (
          ut.isFunction(actionEffects) &&
          eventHooks.actionEventTypes.includes(taroEvent.type)
        ) {
          const { currentTarget, target, detail } = taroEvent.mpEvent;
          // taro本身会给所有节点添加id，id一致说明是触发事件的节点
          if (target.id === currentTarget.id) {
            self.processTaro3Event(
              taroEvent,
              node,
              actionEffects,
              currentTarget,
              detail
            );
          }
        }
        // 先采集再派发：保持原有事件流的返回值与冒泡行为不变
        return dispatchEvent.apply(this, arguments);
      };
    };
    // enumerable: false 避免被遍历/序列化，configurable: true 允许热更新时再次覆盖
    Object.defineProperty(taroNode, 'dispatchEvent', {
      value: proxyDispatchEvent(taroNode.dispatchEvent),
      enumerable: false,
      configurable: true
    });
  };

  /**
   * Taro3 Vue3 代理
   * @description 保存vue3下使用setup写法的function component的导出方法名
   *
   * 背景：Vue3 的 <script setup> 在编译后，事件处理函数会变成单字母的匿名函数名，
   * 无法从函数体反推出业务方法名。而 defineExpose 导出的方法保留了原始名字，
   * 因此这里在 beforeMount 阶段把"编译后函数名 -> 业务方法名"记录下来，
   * 事件采集时再通过 exposedNames[页面路径] 做一次映射还原。
   */
  taro3vue3Proxy = () => {
    const self = this;
    this.taroVue.mixin({
      beforeMount: function () {
        // 存在tid说明是页面
        if (this._?.props?.tid && !ut.isEmpty(this._.exposed)) {
          const path = ut.head(ut.split(this._.props.tid, '?'));
          const kvs = {};
          ut.keys(this._.exposed).forEach((k) => {
            // 键为编译后的函数名，值为业务方法名
            if (this._.exposed[k].name) {
              kvs[this._.exposed[k].name] = k;
            }
          });
          self.exposedNames[path] = { ...kvs };
        }
      }
    });
  };

  /**
   * 获取 Taro3 React 方法名
   * @description 解析 React 组件中的事件处理函数名
   *
   * 难点在于 React 编译后事件处理器可能被包装多层（invoker / handler / 匿名箭头函数），
   * 因此解析顺序为：props 上取到的真实 handler → 函数体字符串正则反推方法名。
   *
   * @param {any} originHandler - 原始处理函数
   * @param {any} taroEvent - Taro事件对象
   * @param {any} taroElement - Taro元素对象
   * @returns {string} - 方法名
   */
  taro3reactGetFuncName = (
    originHandler: any,
    taroEvent: any,
    taroElement: any
  ) => {
    // Taro 会把 React 事件属性以带前缀的 key 挂在元素上，按正则找出该 key
    const propsKey = ut
      .keys(taroElement)
      .find((key) => TARO_EVENT_PROPS_REG.test(key));
    // 优先取元素属性上的 handler（能拿到业务声明的函数），逐级回退
    const propsHandler =
      ut.niceTry(() => taroElement[propsKey][HANDLER[taroEvent.type]]) ??
      originHandler.oldHandler ??
      originHandler;

    if (propsHandler?.value?.name) {
      return propsHandler?.value?.name;
    } else if (
      propsHandler.name &&
      !['handler', 'invoker'].includes(propsHandler.name)
    ) {
      /*
       * 走到这里说明 propsHandler.name 是框架生成的包装函数名（如 handler/invoker 之外的
       * 匿名包装），需要从函数体字符串里反推业务方法名。
       * 下面两个正则分别对应 class 组件与函数组件的不同编译产物格式。
       */
      // class component匿名引用方法
      let funcName = ut
        .head(`${propsHandler}`.match(TARO_EVENT_REACT_FUNC1_REG))
        ?.replace('return ', '')
        ?.replace('(', '');

      if (funcName) {
        // 形如 this.xxx 的引用，取点号后的真实方法名
        return ut.head(ut.drop(ut.split(funcName, '.'))) ?? propsHandler.name;
      } else {
        //  component匿名引用方法
        funcName = ut
          .head(`${propsHandler}`.match(TARO_EVENT_REACT_FUNC2_REG))
          ?.replace('return ', '')
          ?.replace('(', '');
        return funcName ?? propsHandler.name;
      }
    } else {
      // 完全无法解析时回退匿名方法名
      return this.getAnonymousFunc(taroElement);
    }
  };

  /**
   * 获取 Taro3 Vue3 方法名
   * @description 解析 Vue3 组件中的事件处理函数名
   *
   * 解析路径分三类，优先级由高到低：
   *   1. 使用 emit 监听组件的方法（函数体带明确字符串）
   *   2. 普通引用方法 / 匿名引用方法 / 普通 setup 定义的方法
   *   3. <script setup> + defineExpose 导出的方法（可借 exposedNames 还原）
   * 全部失败则回退匿名方法名。
   *
   * @param {any} originHandler - 原始处理函数
   * @param {any} taroElement - Taro元素对象
   * @returns {string} - 方法名
   */
  taro3vue3GetFuncName = (originHandler: any, taroElement: any) => {
    // 函数体以 function( 开头说明是编译后的包装函数，需要进一步解析
    if (ut.startsWith(`${originHandler.value}`.replace(' ', ''), 'function(')) {
      // 使用emit监听组件的方法
      let preFuncName = ut
        .head(`${originHandler.value}`.match(TARO_EVENT_VUE_FUNC1_REG))
        ?.replace('return ', '');
      try {
        // 使用emit监听组件的方法要优先判断
        if (preFuncName) {
          // dev状态时是单引号
          // eslint-disable-next-line
          if (preFuncName.indexOf("'") > -1) {
            // eslint-disable-next-line
            preFuncName = ut.head(ut.drop(ut.split(preFuncName, "'")));
          } else {
            // build状态时是双引号
            preFuncName = ut.head(ut.drop(ut.split(preFuncName, '"')));
          }
        } else {
          // 普通引用方法/匿名引用方法/普通setup定义的方法
          preFuncName = ut
            .head(`${originHandler.value}`.match(TARO_EVENT_VUE_FUNC2_REG))
            ?.replace('return ', '');
          // script setup定义且匿名引用的方法（需要配合defineExpose导出，否则是一个编译后的匿名单字母函数名）
          if (!preFuncName) {
            preFuncName = ut
              .head(`${originHandler.value}`.match(TARO_EVENT_VUE_FUNC3_REG))
              ?.replace('return ', '');
          }
          // script setup定义普通引用的方法（需要配合defineExpose导出，否则是一个编译后的匿名单字母函数名）
          if (!preFuncName) {
            preFuncName = originHandler.value?.name;
          }
        }
      } catch (error) {
        // 正则解析失败属于预期内的降级场景，继续走匿名方法名兜底
        preFuncName = '';
      }

      // 能获取到方法名
      if (preFuncName) {
        // 形如 a.b 的引用只取末级方法名
        let funcName =
          preFuncName.indexOf('.') > -1
            ? ut.head(ut.drop(ut.split(preFuncName, '.')))
            : preFuncName;
        let path = '';
        if (taroElement?._root?.uid) {
          // 元素所属根节点的 uid 即为页面路径（去掉 query 部分）
          path = ut.head(ut.split(taroElement._root.uid, '?'));
        } else {
          path = this.growingIO.dataStore.eventHooks.currentPage.getPagePath();
        }
        // script setup 场景下用编译后函数名换回业务方法名
        if (this.exposedNames[path]) {
          funcName =
            ut.niceTry(() => this.exposedNames[path][funcName]) ?? funcName;
        }
        return funcName;
      } else {
        // 不能获取方法名，直接构建一个匿名方法名
        return this.getAnonymousFunc(taroElement);
      }
    } else if (originHandler?.value?.name) {
      // 非包装函数（如直接引用 defineExpose 导出的方法），本身带名字
      return originHandler.value.name;
    } else {
      return this.getAnonymousFunc(taroElement);
    }
  };

  /**
   * 生成匿名方法名
   * @description 当无法获取真实方法名时，生成一个唯一的匿名方法名
   *
   * 命名规则：`{页面名}_Func_{元素uid}`。
   * 用页面名而非完整路径是为了避免事件名过长；uid 用于区分同一页面内的不同元素，
   * 保证同类匿名事件可以被稳定聚合、不会互相混淆。
   *
   * @param {any} taroElement - Taro元素对象
   * @returns {string} - 匿名方法名
   */
  getAnonymousFunc = (taroElement: any) => {
    const path = this.growingIO.dataStore.eventHooks.currentPage.getPagePath();
    const paths = path.split('/');
    // 优先取路径中 page 段的下一级（约定 pages/xxx/index），取不到则用最后一段
    const idx = paths.findIndex((v) => v.indexOf('page') > -1) + 1;
    const pageName = idx && paths[idx] ? paths[idx] : ut.last(paths);
    return `${pageName}_Func${
      // uid 统一补前导下划线，避免出现 xxx_Func1 这类不统一的分隔形式
      ut.startsWith(taroElement.uid, '_')
        ? taroElement.uid
        : '_' + taroElement.uid
    }`;
  };

  /**
   * Taro3 Vue2 代理
   * @description Taro3使用Vue2时的代理逻辑
   *
   * Vue2 的页面生命周期与 methods 走原生 Page 链路（proxyTaro3 中已对 Vue2 调用
   * nativeGrowing(['Page'])），所以这里只处理"无埋点事件的业务方法"：
   * 在 beforeMount 阶段把 methods 与 setup 返回值逐个包装，采集方法名。
   */
  taro3Vue2Proxy = () => {
    const self = this;
    this.taroVue.mixin({
      beforeMount: function () {
        // 对传统methods写法的普通事件hook
        const methods = this.$options.methods;
        ut.keys(methods).forEach((k: string) => {
          self.defineProperty(this, k, self.proxyMethods(k, this[k]));
        });
        // 对setup中定义的事件hook
        const setupState = this._setupState;
        if (!ut.isEmpty(setupState)) {
          ut.keys(setupState).forEach((k: string) => {
            self.defineProperty(
              setupState,
              k,
              self.proxyMethods(k, setupState[k])
            );
          });
        }
      }
    });
  };

  /**
   * 重写 Vue2 方法
   * @description 包装原始方法以注入埋点逻辑
   *
   * 只包装"非页面生命周期"的方法：生命周期名会与 pageHandlers 冲突，
   * 包装后会导致生命周期被当作自定义事件重复采集，因此直接原样返回。
   *
   * @param {string} name - 方法名
   * @param {any} method - 原始方法
   * @returns {Function} - 包装后的方法
   */
  proxyMethods = (name: string, method: any) => {
    const { eventHooks } = this.growingIO.dataStore;
    if (ut.isFunction(method) && !eventHooks.pageHandlers.includes(name)) {
      return function (...args) {
        return eventHooks.customFcEffects(name, method).apply(this, args);
      };
    } else {
      return method;
    }
  };

  /**
   * 定义属性
   * @description Object.defineProperty 的封装
   * 统一 writable/enumerable/configurable 均为 true，便于热更新或重复注册时覆盖。
   * @param {any} target - 目标对象
   * @param {string} key - 属性名
   * @param {any} value - 属性值
   */
  defineProperty = (target, key, value) => {
    Object.defineProperty(target, key, {
      writable: true,
      enumerable: true,
      configurable: true,
      value
    });
  };

  /**
   * 保存页面节点信息
   * @description Taro3中存储当前页面完整的数据以获取曝光事件中的dataset
   *
   * Taro3 的曝光采集需要通过页面根节点上的 TaroElement 拿到 dataset，
   * 这里从 document.body 递归找到带页面路由身份的根节点，按同一页面路径建索引存到
   * growingIO.taro3VMs 上，供曝光插件按页面路径反查元素。
   *
   * @see https://taro-docs.jd.com/taro/docs/react-overall#dataset
   * @param {any} body - 页面 body 节点
   */
  saveFullPage = (body: any) => {
    const pageTraverse = (tEle: any) => {
      tEle.forEach((cEle: any) => {
        const path = this.getTaroPagePath(cEle?.ctx);
        if (path) {
          // 支持 uri/__route__/$taroPath，不依赖 SDK 给宿主页面补写 route。
          if (!this.growingIO.taro3VMs) {
            this.growingIO.taro3VMs = {};
          }
          this.growingIO.taro3VMs[path] = cEle;
        } else if (ut.isArray(cEle.childNodes)) {
          pageTraverse(cEle.childNodes);
        }
      });
    };
    pageTraverse(body.childNodes);
  };
}

export default { name: 'gioTaroAdapter', method: GioTaroAdapter };
