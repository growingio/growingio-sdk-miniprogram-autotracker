import { EventHooksType, MinipPageType } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import { has, isArray, isEmpty, isFunction, typeOf } from '@@/utils/glodash';
import { consoleText, getGlobal, niceTry } from '@@/utils/tools';

import AppEffects from './appEffects';
import MinipPage from './minipPage';
import PageEffects from './pageEffects';
import EMIT_MSG from '@@/constants/emitMsg';

class EventHooks implements EventHooksType {
  private appHooked: boolean;
  private pageHooked: boolean;
  private componentHooked: boolean;
  private behaviorHooked: boolean;
  public defAppCbs: any;
  public defPageCbs: any;
  public appHandlers: string[];
  public pageHandlers: string[];
  public shareEventTypes: string[];
  public actionEventTypes: string[];
  public originalApp: (any: any) => any;
  public originalPage: (any: any) => any;
  public originalComponent: (any: any) => any;
  public originalBehavior: (any: any) => any;
  public appEffects: any;
  public pageEffects: any;
  public actionEffects: any;
  public currentPage: MinipPageType;

  constructor(public growingIO: GrowingIOType) {
    const config = this.growingIO?.platformConfig;
    this.defAppCbs = {};
    this.defPageCbs = {};
    this.appHandlers = config.appHandlers;
    this.pageHandlers = config.pageHandlers;
    this.shareEventTypes = config.shareEventTypes;
    this.actionEventTypes = config.actionEventTypes;
    this.appEffects = new AppEffects(this.growingIO);
    this.pageEffects = new PageEffects(this.growingIO);
    this.currentPage = new MinipPage(this.growingIO);
  }

  // 判断是否为非构造函数的一个函数
  isNormalFc = (key: string, method: any) => {
    return isFunction(method) && key !== 'constructor';
  };

  // 对象的遍历
  objectTraverse = (target: any, fn: any) => {
    Object.getOwnPropertyNames(target).forEach((k: string) => fn(k, target));
    if (has(target, 'methods')) {
      Object.getOwnPropertyNames(target.methods).forEach((k: string) => {
        if (!target[k]) {
          fn(k, target.methods);
        }
      });
    }
    if (has(target, 'lifetimes')) {
      Object.getOwnPropertyNames(target.lifetimes).forEach((k: string) => {
        if (!target[k]) {
          fn(k, target.lifetimes);
        }
      });
    }
    if (has(target, 'pageLifetimes')) {
      Object.getOwnPropertyNames(target.pageLifetimes).forEach((k: string) => {
        if (!target[k]) {
          fn(k, target.pageLifetimes);
        }
      });
    }
  };

  // 补充生命周期函数
  supLifeFcs = (target: any, type: 'app' | 'page') => {
    if (isArray(this[`${type}Handlers`])) {
      this[`${type}Handlers`].forEach((k: string) => {
        // 除分享以外
        if (
          !isFunction(target[k]) &&
          !['onShareAppMessage', 'onShareTimeline'].includes(k)
        ) {
          target[k] = () => {}; // eslint-disable-line
        }
      });
    }
  };

  /**
   * 执行生命周期回调并广播事件
   */
  lifeFcEffectsFn = (instance, args, cType, eventName, result = undefined) => {
    // 创建参数数组副本
    const argsArray =
      typeOf(args) === 'array' ? Array.prototype.slice.call(args) : [];
    // 如果有结果，添加到参数列表
    if (!isEmpty(result)) {
      argsArray.push(result);
    }

    // 执行effects
    this[`def${cType}Cbs`][eventName].apply(instance, argsArray);

    // 广播生命周期
    this.growingIO.emitter.emit(EMIT_MSG.MINIP_LIFECYCLE, {
      event: `${cType} ${eventName}End`,
      timestamp: Date.now(),
      params: { instance, arguments: Array.from(argsArray) }
    });

    return result;
  };

  /**
   * 生命周期方法effects
   */
  lifeFcEffects = (eventName: string, method: any, cType: 'App' | 'Page') => {
    const self = this;

    return function (...args) {
      let result;

      // 分享事件单独处理
      if (self.shareEventTypes.includes(eventName)) {
        // 先执行分享的生命周期拿到分享数据
        const originResult = method.apply(this, args) ?? {};

        // sdk跟踪分享事件时才处理，否则直接返回原结果
        if (!self.growingIO.vdsConfig.followShare) {
          return originResult;
        }
        const isPromiseResult = typeOf(originResult) === 'promise';
        const hasPromiseProperty = typeOf(originResult.promise) === 'promise';
        // 支付宝的promise会被提前处理过，通过以下两个字段判断是否需要自定义promise
        const isSpecialPromise =
          has(originResult, '_result') && has(originResult, '_state');

        // 处理异步分享结果
        if (isPromiseResult || hasPromiseProperty || isSpecialPromise) {
          // 创建处理Promise结果的通用函数
          const handlePromiseResult = (promiseResult = {}) => {
            try {
              // 合并原始结果和Promise结果
              const mergedResult = {
                ...originResult,
                ...promiseResult
              };

              // 更新分享内容
              const updatedResult =
                self.currentPage.updateShareResult(mergedResult);

              // 执行回调
              self.lifeFcEffectsFn(this, args, cType, eventName, updatedResult);
            } catch (error) {
              consoleText(error, 'error');
            }
          };

          // 处理整个返回值是Promise的情况
          if (isPromiseResult) {
            // 如果三秒内不resolve结果，分享会使用原默认参数
            Promise.race([
              originResult,
              new Promise((resolve) => {
                setTimeout(() => {
                  resolve({});
                }, 3000);
              })
            ])
              .then(handlePromiseResult)
              .catch((error) => consoleText(error, 'error'));
          }

          // 处理返回值中包含promise属性的情况
          if (hasPromiseProperty) {
            // 如果三秒内不resolve结果，分享会使用原默认参数
            Promise.race([
              originResult.promise,
              new Promise((resolve) => {
                setTimeout(() => {
                  resolve({});
                }, 3000);
              })
            ])
              .then(handlePromiseResult)
              .catch((error) => consoleText(error, 'error'));
          }

          // 处理支付宝特有的promise
          if (isSpecialPromise) {
            self.growingIO.minipInstance?.handleSharePromise(
              originResult,
              handlePromiseResult
            );
          }

          // 直接返回原分享结果继续执行原逻辑
          result = self.currentPage.updateShareResult(originResult, false);
        } else {
          // 没有异步逻辑，直接更新分享内容执行回调
          result = self.currentPage.updateShareResult(originResult);
          self.lifeFcEffectsFn(this, args, cType, eventName, result);
        }
      } else {
        // 其他生命周期事件：先执行回调，再执行原方法
        self.lifeFcEffectsFn(this, args, cType, eventName);
        result = method.apply(this, args);
      }

      return result;
    };
  };

  /*
   * 自定义方法effects
   */
  customFcEffects = (eventName: string, method: any) => {
    const self = this;
    return function (...args) {
      let result;
      if (
        self.growingIO.vdsConfig.autotrack &&
        self.growingIO.plugins.gioEventAutoTracking
      ) {
        try {
          let event: any = args[0] || {};
          // 有的框架的点击事件传参时需要在最后一个参数加上原生event才能触发SDK的事件
          if (
            !(has(event, 'type') && (event?.currentTarget || event?.target))
          ) {
            event = args[args.length - 1];
          }
          if (
            (event?.currentTarget || event?.target) &&
            self.actionEventTypes.includes(event.type)
          ) {
            // 无埋点事件插件未挂载时进行挂载
            if (!isFunction(self.actionEffects)) {
              self.actionEffects =
                self.growingIO.plugins?.gioEventAutoTracking?.main ||
                function () {}; //eslint-disable-line
            }
            self?.actionEffects(event, eventName);
          }
        } catch (error) {
          consoleText(error, 'error');
        }
      }
      // 执行原逻辑
      result = method.apply(this, args);
      return result;
    };
  };

  // App中方法代理
  appApplyProxy = (eventName: string, method: any) => {
    if (this.appHandlers.includes(eventName)) {
      return this.lifeFcEffects(eventName, method, 'App');
    } else {
      return this.customFcEffects(eventName, method);
    }
  };

  // Page中方法代理
  pageApplyProxy = (eventName: string, method: any) => {
    if (this.pageHandlers.includes(eventName)) {
      return this.lifeFcEffects(eventName, method, 'Page');
    } else {
      return this.customFcEffects(eventName, method);
    }
  };

  // App重写遍历
  appOverriding = (options: any) => {
    this.setAppEffectCbs();
    const fn = (k: string, target: any) => {
      if (this.isNormalFc(k, target[k])) {
        target[k] = this.appApplyProxy(k, target[k]);
      }
    };
    // 补充未定义的生命周期，防止不触发vst和cls事件(vst依赖onShow、cls依赖onHide)
    this.supLifeFcs(options, 'app');
    // 遍历方法，进行重写
    this.objectTraverse(options, fn);
    return options;
  };

  // Page重写遍历
  pageOverriding = (options: any) => {
    this.setPageEffectCbs();
    const fn = (k: string, target: any) => {
      if (this.isNormalFc(k, target[k])) {
        target[k] = this.pageApplyProxy(k, target[k]);
      }
    };
    // 补充未定义的生命周期，防止不触发page事件(page依赖onShow)
    this.supLifeFcs(options, 'page');
    // 遍历方法，进行重写
    this.objectTraverse(options, fn);
    return options;
  };

  // Component/Behavior重写(重写除构造函数之外的所有方法)
  componentOverriding = (options: any) => {
    this.setPageEffectCbs();
    const fn = (k: string, target: any) => {
      if (this.isNormalFc(k, target[k])) {
        target[k] = this.pageApplyProxy(k, target[k]);
      }
    };
    if (!options.methods) {
      options.methods = {};
    }
    // 补充生命周期方法
    this.supLifeFcs(
      this.growingIO.inPlugin ? options : options.methods,
      'page'
    );
    // 遍历重写方法
    this.objectTraverse(
      this.growingIO.inPlugin ? options : options.methods,
      fn
    );
    return options;
  };

  // 挂载App生命周期的effect方法
  setAppEffectCbs = () => {
    const self = this;
    this.appHandlers.forEach((handlerName: string) => {
      this.defAppCbs[handlerName] = function (...args) {
        self.appEffects.main(handlerName, args);
      };
    });
  };

  // 挂载Page/Component生命周期的effect方法
  setPageEffectCbs = () => {
    const self = this;
    this.pageHandlers.forEach((handlerName: string) => {
      this.defPageCbs[handlerName] = function (...args) {
        self.pageEffects.main(this, handlerName, args);
      };
    });
  };

  growingApp = (app: any) =>
    isFunction(this.originalApp)
      ? this.originalApp(this.appOverriding(app))
      : this.appOverriding(app);

  growingPage = (page: any) =>
    isFunction(this.originalPage)
      ? this.originalPage(this.pageOverriding(page))
      : this.pageOverriding(page);

  growingComponent = (component: any) =>
    isFunction(this.originalComponent)
      ? this.originalComponent(this.componentOverriding(component))
      : this.componentOverriding(component);

  growingBehavior = (behavior: any) =>
    isFunction(this.originalBehavior)
      ? this.originalBehavior(this.componentOverriding(behavior))
      : this.componentOverriding(behavior);

  nativeGrowing = (
    designated: string[] = ['App', 'Page', 'Component', 'Behavior']
  ) => {
    const self = this;
    const { platformConfig } = this.growingIO;
    const platformHooks = platformConfig.hooks;
    if (designated.includes('App')) {
      try {
        // 重写App
        if (platformHooks.App && !this.appHooked) {
          App = function (...args) {
            return self.originalApp(self.appOverriding(args[0]));
          };
          this.appHooked = true;
        }
      } catch (error) {
        // 在插件中可能会不存在App
      }
    }
    if (designated.includes('Page')) {
      try {
        // 重写Page
        if (platformHooks.Page && !this.pageHooked) {
          Page = function (...args) {
            return self.originalPage(self.pageOverriding(args[0]));
          };
          this.pageHooked = true;
        }
      } catch (error) {
        // 在插件中可能会不存在Page
      }
    }
    if (designated.includes('Component')) {
      try {
        // 重写Component
        if (platformHooks.Component && !this.componentHooked) {
          Component = function (...args) {
            return self.originalComponent(self.componentOverriding(args[0]));
          };
          this.componentHooked = true;
        }
      } catch (error) {
        //
      }
    }
    if (designated.includes('Behavior')) {
      try {
        // 重写Behavior
        if (platformHooks.Behavior && !this.behaviorHooked) {
          Behavior = function (...args) {
            return self.originalBehavior(self.componentOverriding(args[0]));
          };
          this.behaviorHooked = true;
        }
      } catch (error) {
        // 部分小程序不存在Behavior
      }
    }
  };

  // 初始化原始值
  initOriginalValue = () => {
    this.setAppEffectCbs();
    this.setPageEffectCbs();
    this.originalApp = niceTry(() => App || global.App);
    this.originalPage = niceTry(() => Page || global.Page);
    this.originalComponent = niceTry(() => Component || global.Component);
    this.originalBehavior = niceTry(() => Behavior || global.Behavior);
  };

  // 初始化事件钩子
  initEventHooks = () => {
    const self = this;
    const { platformConfig, gioPlatform } = this.growingIO;
    this.initOriginalValue();
    if (platformConfig.canHook) {
      this.nativeGrowing();
      getGlobal().GioApp = niceTry(() => App ?? this.originalApp);
      getGlobal().GioPage = niceTry(() => Page ?? this.originalPage);
      getGlobal().GioComponent = niceTry(
        () => Component ?? this.originalComponent
      );
      getGlobal().GioBehavior = niceTry(
        () => Behavior ?? this.originalBehavior
      );
    } else if (gioPlatform === 'quickapp') {
      getGlobal().GioApp = function (...args) {
        return self.appOverriding(args[0]);
      };
      getGlobal().GioPage = function (...args) {
        return self.pageOverriding(args[0]);
      };
      getGlobal().GioComponent = function (...args) {
        return self.pageOverriding(args[0]);
      };
    }
  };
}

export default EventHooks;
