/**
 * 名称：uniapp代理插件
 * 用途：用于重写uniapp框架下的创建App/Page/Component方法实现代理Hook；并获取uniapp框架下的自定义方法真实方法名获取。
 */
import { UNIAPP_FUNC_REG } from '@@/constants/regex';
import { GrowingIOType } from '@@/types/growingIO';

const ONCE = '~'; // 用于标记一次性事件
const CUSTOM = '^'; // 用于标记自定义事件

let ut: any;

class GioUniAppAdapter {
  public pluginVersion: string; // 插件版本号
  private uniVue: any; // UniApp框架的Vue实例
  private exposedNames: Record<string, string>; // 存储<script setup>中暴露的方法名映射

  constructor(public growingIO: GrowingIOType) {
    this.pluginVersion = '__PLUGIN_VERSION__'; // 插件版本占位符，会在构建时替换
    ut = this.growingIO.utils; // 初始化工具类
    this.uniVue = this.growingIO?.vdsConfig?.uniVue; // 获取UniApp的Vue实例
    this.exposedNames = {}; // 初始化方法名映射对象
  }

  /**
   * 主入口，根据Vue版本进行不同处理
   * 针对Vue2和Vue3采用不同的代理策略
   */
  main = (): void => {
    // 插件挂载时可能还没取到Vue实例
    if (!this.uniVue) {
      this.uniVue = this.growingIO?.vdsConfig?.uniVue;
    }
    console.log('Vue version: ', this.uniVue.version);

    // 提取主版本号
    const mainVersion = Number(ut.head(ut.split(this.uniVue.version, '.')));
    switch (mainVersion) {
      case 2:
        this.uniVue2Proxy();
        break;
      case 3:
        this.uniVue3Proxy(this.uniVue);
        break;
      default:
        // 不支持的版本
        ut.consoleText('不支持的Vue版本，请使用 Vue2 或 Vue3!', 'error');
        break;
    }
  };

  /**
   * 获取自定义真实的方法名
   * 用于将框架编译后的方法名映射回用户定义的原始方法名
   * @param eventName 事件名称
   * @param e 事件对象
   * @returns 真实的方法名
   */
  getHandlerName = (eventName: string, e: any): string => {
    if (eventName === '__e') {
      // 内置事件，需要从事件对象提取真实方法名
      return this.getEventHandlerNameFromE(e);
    } else if (!ut.isEmpty(this.exposedNames)) {
      // 从exposedNames中查找映射关系
      return this.exposedNames[eventName] ?? eventName;
    } else {
      // 无需映射，直接返回
      return eventName;
    }
  };

  /**
   * 从事件对象中获取处理函数的真实名称
   * 处理UniApp特有的事件机制，提取事件处理函数的原始名称
   * @param e 事件对象
   * @returns 处理函数的真实名称
   */
  private getEventHandlerNameFromE = (e: any): string => {
    let methodName = '__e'; // 默认方法名
    const { type, currentTarget, target } = e;
    const dataSet = currentTarget?.dataset || target?.dataset;

    // 无数据集时直接返回
    if (!dataSet) {
      return methodName;
    }

    // 获取事件选项
    const eventOpts = dataSet.eventOpts || dataSet['event-opts'];
    if (!eventOpts) {
      return methodName;
    }

    // 事件类型匹配函数
    // 处理regionchange等特殊事件类型
    const matchedEventType = (eventType: string, optType: string) =>
      eventType === optType ||
      (optType === 'regionchange' &&
        (eventType === 'begin' || eventType === 'end'));

    // 遍历事件选项查找匹配的方法名
    eventOpts.forEach((o: any[]) => {
      let eType = ut.head(o); // 获取事件类型
      const isCustom = eType.charAt(0) === CUSTOM;
      eType = isCustom ? eType.slice(1) : type; // 处理自定义事件
      const isOnce = eType.charAt(0) === ONCE;
      eType = isOnce ? eType.slice(1) : type; // 处理一次性事件
      const eArray = ut.last(o); // 获取事件处理数组

      // 找到匹配的事件类型
      if (matchedEventType(type, eType)) {
        methodName = ut.head(ut.head(eArray)); // 提取方法名
      }
    });

    return methodName;
  };

  /**
   * Vue2专用代理实现
   * 处理Vue2下的特殊情况，主要是生命周期和事件处理
   * Vue2的生命周期有时会异步执行，需要特殊处理
   */
  uniVue2Proxy = (): void => {
    const {
      dataStore: { eventHooks }
    } = this.growingIO;
    // 重写生命周期回调，vue2中会被处理成异步方法导致时序错位
    this.overrideLifeFcEffectsFn(eventHooks);
    // 初始化原生钩子
    eventHooks.nativeGrowing();
  };

  /**
   * 重写生命周期效果函数
   * 解决Vue2中页面生命周期异步执行导致的问题
   * 对Page类型的生命周期使用setTimeout延迟执行，保证执行顺序正确
   * @param eventHooks 事件钩子对象
   */
  private overrideLifeFcEffectsFn = (eventHooks: any): void => {
    const originFunc = eventHooks.lifeFcEffectsFn;
    eventHooks.lifeFcEffectsFn = function (...args) {
      // 对Page类型的生命周期特殊处理
      if (args[2] === 'Page') {
        // 使用setTimeout延迟执行，保证在正确的时机执行
        setTimeout(() => {
          return originFunc.apply(this, args);
        }, 0);
      } else {
        // 非Page类型直接执行原函数
        return originFunc.apply(this, args);
      }
    };
  };

  /**
   * Vue3代理实现
   * 为Vue3框架添加GrowingIO的代理逻辑
   * @param vue Vue3实例
   */
  uniVue3Proxy = (vue: any): void => {
    const {
      dataStore: { eventHooks },
      minipInstance
    } = this.growingIO;

    // 重写对象遍历逻辑，优先hook methods最后才是原生
    this.overrideObjectTraverse(eventHooks);

    // 初始化原生钩子
    eventHooks.nativeGrowing();

    // 重写getPageTitle方法，确保在Vue组件中能正确获取页面标题
    this.overrideGetPageTitle(minipInstance);

    // 添加Vue混入，实现组件方法的代理
    this.addVueMixin(vue, eventHooks);
  };

  /**
   * 重写对象遍历逻辑
   * 确保按照正确的优先级遍历对象属性
   * @param eventHooks 事件钩子对象
   */
  private overrideObjectTraverse = (eventHooks: any): void => {
    eventHooks.objectTraverse = (target: any, fn: any) => {
      // 先处理methods，因为这里包含了大部分自定义方法
      if (ut.has(target, 'methods')) {
        Object.getOwnPropertyNames(target.methods).forEach((k: string) => {
          fn(k, target.methods);
        });
      }

      // 处理lifetimes，组件生命周期方法
      if (ut.has(target, 'lifetimes')) {
        Object.getOwnPropertyNames(target.lifetimes).forEach((k: string) => {
          fn(k, target.lifetimes);
        });
      }

      // 处理pageLifetimes，页面生命周期方法
      if (ut.has(target, 'pageLifetimes')) {
        Object.getOwnPropertyNames(target.pageLifetimes).forEach(
          (k: string) => {
            fn(k, target.pageLifetimes);
          }
        );
      }

      // 最后处理其他属性，确保不重复处理
      Object.getOwnPropertyNames(target).forEach((k: string) => {
        if (
          !ut.niceTry(
            () =>
              !target?.methods[k] &&
              !target?.lifetimes[k] &&
              !target?.pageLifetimes[k]
          )
        ) {
          fn(k, target);
        }
      });
    };
  };

  /**
   * 重写getPageTitle方法
   * 确保能正确获取Vue组件中定义的页面标题
   * @param minipInstance 小程序实例
   */
  private overrideGetPageTitle = (minipInstance: any): void => {
    const originGetter = minipInstance.getPageTitle; // 保存原始getter
    minipInstance.getPageTitle = function (...args) {
      // 获取当前页面实例
      let pageInstance = !ut.isEmpty(args[0])
        ? args[0]
        : minipInstance.getCurrentPage();

      // 检查是否为页面组件且有路由信息
      if (
        pageInstance?.$vm?.mpType === 'page' &&
        pageInstance?.$vm?.__route__
      ) {
        // 优先使用组件中定义的gioPageTitle
        const vmTitle = pageInstance?.$vm?.gioPageTitle;
        return vmTitle ? vmTitle : originGetter.apply(this, args);
      } else {
        // 回退到原始实现
        return originGetter.apply(this, args);
      }
    };
  };

  /**
   * 添加Vue混入
   * 注入GrowingIO的代理逻辑到Vue组件生命周期中
   * @param vue Vue实例
   * @param eventHooks 事件钩子对象
   */
  private addVueMixin = (vue: any, eventHooks: any): void => {
    const self = this;

    vue.mixin({
      // 组件挂载前的钩子
      beforeMount() {
        // 代理普通方法
        self.proxyMethods(this, eventHooks);

        // 代理exposed方法（script setup中暴露的方法）
        self.proxyExposedMethods(this, eventHooks);

        // 使用emit监听组件事件hook
        self.proxyEmit(this, eventHooks);
      },

      // 组件更新时的钩子
      updated() {
        // 更新时重新代理exposed方法，确保动态添加的方法也被代理
        self.proxyExposedMethods(this, eventHooks);
      }
    });
  };

  /**
   * 代理普通方法
   * 处理传统Vue选项式API和组合式API中定义的方法
   * @param instance Vue组件实例
   * @param eventHooks 事件钩子对象
   */
  private proxyMethods = (instance: any, eventHooks: any): void => {
    // 代理单个方法的函数
    const proxyMethodFn = (name: string, method: any) => {
      // 只代理非页面生命周期的函数方法
      if (ut.isFunction(method) && !eventHooks.pageHandlers.includes(name)) {
        return function (...args) {
          // 使用customFcEffects包装方法，实现事件追踪
          return eventHooks.customFcEffects(name, method).apply(this, args);
        };
      } else {
        return method;
      }
    };

    // 对象属性转移函数，将源对象的方法代理后赋值给目标对象
    const transferMethods = (origin, target) =>
      ut.keys(origin).forEach((k: string) => {
        if (ut.isFunction(target[k])) {
          Object.defineProperty(target, k, {
            value: proxyMethodFn(k, target[k]),
            configurable: true,
            writable: true
          });
        }
      });

    // 处理传统选项式API中的methods
    const methods = instance.$options.methods;
    if (methods) {
      transferMethods(methods, instance);
    }

    // 处理组合式API中的setup返回值
    const setupState = instance?._?.setupState;
    if (setupState) {
      transferMethods(setupState, setupState);
    }
  };

  /**
   * 代理exposed方法
   * 处理<script setup>中使用defineExpose暴露的方法
   * @param instance Vue组件实例
   * @param eventHooks 事件钩子对象
   */
  private proxyExposedMethods = (instance: any, eventHooks: any): void => {
    // 获取组件暴露的方法
    const exposed = instance?._?.exposed;
    this.exposedNames = {}; // 重置映射

    // 无exposed时直接返回
    if (!exposed) {
      return;
    }

    // 保存exposed供<script setup>写法的事件查找真实的事件名
    const exposedKeys = ut.keys(exposed);
    exposedKeys.forEach((k) => {
      if (ut.isFunction(exposed[k])) {
        // 建立函数名到暴露属性名的映射
        this.exposedNames[exposed[k].name] = k;
      }
    });

    // 获取编译后的方法列表
    // 使用正则匹配UniApp编译生成的方法名
    const methodKeys = ut
      .keys(instance.$scope)
      .filter(
        (k) => UNIAPP_FUNC_REG.test(k) && ut.isFunction(instance.$scope[k])
      );

    // 遍历方法进行代理
    methodKeys.forEach((k, i) => {
      const originFunc = instance.$scope[k].value;

      // 在updated中避免重复hook，通过_GIO_HOOKED_标记判断
      if (instance._.updated && originFunc._GIO_HOOKED_) {
        return;
      }

      // 获取自定义方法名
      const customName = this.splicingMethodName(
        originFunc.name,
        k,
        exposedKeys[i]
      );

      // 使用customFcEffects包装方法
      instance.$scope[k].value = eventHooks.customFcEffects(
        customName,
        originFunc
      );

      // 标记已hook过的方法，避免重复处理
      instance.$scope[k].value._GIO_HOOKED_ = true;
    });
  };

  /**
   * 代理emit方法
   * 监听组件通过emit触发的事件
   * @param instance Vue组件实例
   * @param eventHooks 事件钩子对象
   */
  private proxyEmit = (instance: any, eventHooks: any): void => {
    const tEmit = instance._.emit; // 保存原始emit方法
    instance._.emit = function (...args) {
      // 使用自执行函数触发事件追踪，传入空函数作为handler
      (() => eventHooks.customFcEffects(args[0], () => {}).apply(this, args))();
      // 调用原始emit方法
      return tEmit.apply(this, args);
    };
  };

  /**
   * 拼接方法名称
   * 根据不同情况组合出最终的方法名
   * @param originName 原始名称
   * @param traversalName 遍历得到的名称
   * @param exposedName 暴露的名称
   * @returns 最终使用的方法名
   */
  splicingMethodName = (
    originName: string,
    traversalName: string,
    exposedName: string
  ): string => {
    if (originName) {
      // 优先使用原始名称
      return originName;
    } else if (exposedName) {
      // 其次使用遍历名称和暴露名称的组合
      return `${traversalName}#${exposedName}`;
    } else {
      // 最后使用遍历名称
      return traversalName;
    }
  };
}

export default { name: 'gioUniAppAdapter', method: GioUniAppAdapter };
