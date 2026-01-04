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
const HANDLER = {
  tap: 'onClick',
  longpress: 'onLongPress'
};
const CUSTOM_HOOK_EVENTS = [
  'onShareAppMessage',
  'onShareTimeline',
  'onAddToFavorites',
  'onTabItemTap'
];

class GioTaroAdapter {
  public pluginVersion: string;
  public taroVersion: string;
  private taro: any;
  private taroVue: any;
  private taroVueVersion: number;
  private exposedNames: any;
  private inAppLifecycle: boolean;

  constructor(public growingIO: GrowingIOType) {
    this.pluginVersion = '__PLUGIN_VERSION__';
    const { utils, emitter, minipInstance } = this.growingIO;
    ut = utils;
    this.exposedNames = {};
    this.inAppLifecycle = true;

    emitter.on(EMIT_MSG.MINIP_LIFECYCLE, ({ event }) => {
      if (['Page onShow', 'Page onReady'].includes(event)) {
        if (this.taro && this.taroVersion === '3') {
          // 提前存储页面节点信息用来获取dataset
          this.saveFullPage(document.body);
          // taro3开发时要等onready才能取到节点，所以补充做一次曝光监听
          setTimeout(
            () => minipInstance.initImpression(minipInstance.getCurrentPage()),
            0
          );
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
   * @param {any} taro Taro实例
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
   * @description 对Taro2组件进行埋点注入
   * @param {any} ComponentRef 组件引用
   * @param {boolean} isPage 是否为页面
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
   * @description 处理Taro3的Hook逻辑
   */
  proxyTaro3 = () => {
    const { eventHooks } = this.growingIO.dataStore;
    // hook app
    eventHooks.nativeGrowing(['App']);

    // taro3vue2走单独的hook逻辑
    if (this.taroVueVersion === 2) {
      eventHooks.nativeGrowing(['Page']);
      this.taro3Vue2Proxy();
      return;
    }

    if (this.taroVueVersion === 3) {
      this.taro3vue3Proxy();
    }

    // 新版本taro3react和taro3vue3的生命周期走监听hook逻辑
    if (this.taro?.hooks?.call) {
      this.hookTaro3Call();
    } else {
      // 低版本taro3react走dispatchEvent
      this.taro3ReactProxy();
      eventHooks.nativeGrowing(['Page']);
    }
  };

  /**
   * Hook Taro3 hooks.call
   * @description 重写hooks.call以拦截事件
   */
  hookTaro3Call = () => {
    const self = this;
    const originCall = this.taro.hooks.call;

    this.defineProperty(this.taro.hooks, 'call', function (...args) {
      const argsArray = Array.from(args);
      const [msgType] = argsArray;

      // 1. 处理生命周期
      if (msgType === 'getLifecycle') {
        self.handleTaro3Lifecycle(argsArray);
      }

      const result = originCall.apply(this, argsArray);

      // 2. 处理 modifyPageObject (分享、收藏等)
      if (msgType === 'modifyPageObject') {
        self.handleTaro3PageObject(argsArray[1]);
      }

      // 3. 处理 dispatchTaroEvent (无埋点事件)
      if (msgType === 'dispatchTaroEvent') {
        self.handleTaro3DispatchEvent(argsArray[1], argsArray[2]);
      }

      return result;
    });
  };

  /**
   * 处理Taro3生命周期
   * @description 拦截并处理生命周期事件
   * @param {any[]} argsArray 参数数组
   */
  handleTaro3Lifecycle = (argsArray: any[]) => {
    const {
      minipInstance,
      dataStore: { eventHooks }
    } = this.growingIO;
    const lifetime = argsArray[2];

    if (
      eventHooks.pageHandlers.includes(lifetime) &&
      !CUSTOM_HOOK_EVENTS.includes(lifetime)
    ) {
      // hook方法也会执行第一次进入小程序时的AppOnShow导致先出发第一个页面onShow的bug。这里用一个变量标记当前的生命周期是否在App中
      if (lifetime === 'onLoad' && this.inAppLifecycle) {
        this.inAppLifecycle = false;
      }
      // 有路由地址的才是页面的生命周期（支付宝在ApponShow时也会拿到，所以要再判标记）
      const page = minipInstance.getCurrentPage();
      if (page.route && !this.inAppLifecycle) {
        ut.niceTry(() =>
          eventHooks.pageEffects.main(page, lifetime, argsArray[1])
        );
      }
    }
  };

  /**
   * 处理Taro3页面对象修改
   * @description 拦截modifyPageObject消息，处理分享等事件
   * @param {any} pageObject 页面对象
   */
  handleTaro3PageObject = (pageObject: any) => {
    const { eventHooks } = this.growingIO.dataStore;
    CUSTOM_HOOK_EVENTS.forEach((k) => {
      if (pageObject[k]) {
        pageObject[k] = eventHooks.lifeFcEffects(
          k,
          ut.isFunction(pageObject[k]) ? pageObject[k] : () => {},
          'Page'
        );
      }
    });
  };

  /**
   * 处理Taro3事件分发
   * @description 拦截dispatchTaroEvent消息，处理点击等用户行为
   * @param {any} taroEvent Taro事件对象
   * @param {any} taroElement Taro元素对象
   */
  handleTaro3DispatchEvent = (taroEvent: any, taroElement: any) => {
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
   * @param {any} taroEvent
   * @param {any} taroElement
   * @param {Function} actionEffects
   * @param {any} currentTarget
   * @param {any} detail
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
      let originHandler = ut.head(taroElement.__handlers[taroEvent.type]);
      // 一定要有对应的事件
      if (originHandler) {
        if (originHandler.oldHandler) {
          originHandler = originHandler.oldHandler;
        }

        let funcName = '';
        if (this.taroVue) {
          // vue3
          funcName = this.taro3vue3GetFuncName(originHandler, taroElement);
        } else {
          // react --- @tarojs/runtime 3.6.x会有一个随机名的对象存储点击事件优先获取，其他版本直接取originHandler
          funcName = this.taro3reactGetFuncName(
            originHandler,
            taroEvent,
            taroElement
          );
        }

        // 构建无埋点事件
        actionEffects(
          {
            ...taroEvent.mpEvent,
            currentTarget: {
              ...currentTarget,
              detail,
              dataset: {
                ...currentTarget.dataset,
                ...taroElement.dataset
              }
            }
          },
          funcName
        );
      }
    } catch (error) {
      ut.consoleText('Error: ' + error, 'error');
    }
  };

  /**
   * Taro3 React 代理 (低版本)
   * @description 针对不支持hooks.call的低版本Taro3，使用defineProperty拦截dispatchEvent
   */
  taro3ReactProxy = () => {
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
        return dispatchEvent.apply(this, arguments);
      };
    };
    Object.defineProperty(taroNode, 'dispatchEvent', {
      value: proxyDispatchEvent(taroNode.dispatchEvent),
      enumerable: false,
      configurable: true
    });
  };

  /**
   * Taro3 Vue3 代理
   * @description 保存vue3下使用setup写法的function component的导出方法名
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
   * @param {any} originHandler 原始处理函数
   * @param {any} taroEvent Taro事件对象
   * @param {any} taroElement Taro元素对象
   * @returns {string} 方法名
   */
  taro3reactGetFuncName = (
    originHandler: any,
    taroEvent: any,
    taroElement: any
  ) => {
    const propsKey = ut
      .keys(taroElement)
      .find((key) => TARO_EVENT_PROPS_REG.test(key));
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
      // class component匿名引用方法
      let funcName = ut
        .head(`${propsHandler}`.match(TARO_EVENT_REACT_FUNC1_REG))
        ?.replace('return ', '')
        ?.replace('(', '');

      if (funcName) {
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
      return this.getAnonymousFunc(taroElement);
    }
  };

  /**
   * 获取 Taro3 Vue3 方法名
   * @description 解析 Vue3 组件中的事件处理函数名
   * @param {any} originHandler 原始处理函数
   * @param {any} taroElement Taro元素对象
   * @returns {string} 方法名
   */
  taro3vue3GetFuncName = (originHandler: any, taroElement: any) => {
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
        preFuncName = '';
      }

      // 能获取到方法名
      if (preFuncName) {
        let funcName =
          preFuncName.indexOf('.') > -1
            ? ut.head(ut.drop(ut.split(preFuncName, '.')))
            : preFuncName;
        let path = '';
        if (taroElement?._root?.uid) {
          path = ut.head(ut.split(taroElement._root.uid, '?'));
        } else {
          path = this.growingIO.dataStore.eventHooks.currentPage.getPagePath();
        }
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
      return originHandler.value.name;
    } else {
      return this.getAnonymousFunc(taroElement);
    }
  };

  /**
   * 生成匿名方法名
   * @description 当无法获取真实方法名时，生成一个唯一的匿名方法名
   * @param {any} taroElement Taro元素对象
   * @returns {string} 匿名方法名
   */
  getAnonymousFunc = (taroElement: any) => {
    const path = this.growingIO.dataStore.eventHooks.currentPage.getPagePath();
    const paths = path.split('/');
    const idx = paths.findIndex((v) => v.indexOf('page') > -1) + 1;
    const pageName = idx && paths[idx] ? paths[idx] : ut.last(paths);
    return `${pageName}_Func${
      ut.startsWith(taroElement.uid, '_')
        ? taroElement.uid
        : '_' + taroElement.uid
    }`;
  };

  /**
   * Taro3 Vue2 代理
   * @description Taro3使用Vue2时的代理逻辑
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
   * @param {string} name 方法名
   * @param {any} method 原始方法
   * @returns {Function} 包装后的方法
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
   * @param {any} target 目标对象
   * @param {string} key 属性名
   * @param {any} value 属性值
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
   * @see https://taro-docs.jd.com/taro/docs/react-overall#dataset
   * @param {any} body 页面 body 节点
   */
  saveFullPage = (body: any) => {
    const pageTraverse = (tEle: any) => {
      tEle.forEach((cEle: any) => {
        if (cEle?.ctx?.route) {
          if (!this.growingIO.taro3VMs) {
            this.growingIO.taro3VMs = {};
          }
          this.growingIO.taro3VMs[cEle.ctx.route] = cEle;
        } else if (ut.isArray(cEle.childNodes)) {
          pageTraverse(cEle.childNodes);
        }
      });
    };
    pageTraverse(body.childNodes);
  };
}

export default { name: 'gioTaroAdapter', method: GioTaroAdapter };
