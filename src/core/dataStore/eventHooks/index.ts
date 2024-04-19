import { EventHooksType, MinipPageType } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import { has, isArray, isFunction, typeOf, unset } from '@@/utils/glodash';
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

  // 生命周期方法effects
  lifeFcEffects = (eventName: string, method: any, cType: 'App' | 'Page') => {
    const self = this;
    if (['onShareTimeline', 'onAddToFavorites'].includes(eventName)) {
      // onShareTimeline和onAddToFavorites不能异步执行，单独处理
      return function (...args) {
        let result = method.apply(this, args);
        if (
          eventName === 'onShareTimeline' &&
          self.growingIO.vdsConfig.followShare
        ) {
          result = self.currentPage.updateTimelineResult(result ?? {});
        }
        if (eventName === 'onAddToFavorites') {
          result = self.currentPage.updateAddFavoritesResult(result ?? {});
        }
        const argsArray = Array.prototype.slice.call(args);
        if (result) {
          argsArray.push(result);
        }
        // 执行effects
        self[`def${cType}Cbs`][eventName].apply(this, argsArray);
        return result;
      };
    } else {
      // 其他生命周期可以异步执行
      return async function (...args) {
        let result;
        try {
          // 分享处理
          if (eventName === 'onShareAppMessage') {
            // 先执行分享的生命周期拿到分享数据
            // 与基础库保持一致，没有返回值时默认使用{}
            result = (await method.apply(this, args)) ?? {};
            if (typeOf(result.promise) === 'promise') {
              const f = async function () {
                let sRes = result;
                return new Promise((resolve) => {
                  // 如果3秒后result.promise没有返回结果，则返回的是默认的result值
                  // https://developers.weixin.qq.com/miniprogram/dev/reference/api/Page.html#onShareAppMessage-Object-object
                  let t = setTimeout(() => {
                    resolve({ ...sRes });
                    clearTimeout(t);
                    t = undefined;
                  }, 3000);
                  result.promise.then((res) => {
                    sRes = res;
                    resolve({ ...sRes });
                    clearTimeout(t);
                    t = undefined;
                  });
                });
              };
              result = { ...result, ...((await f()) as any) };
              unset(result, 'promise');
            }
            if (self.growingIO.vdsConfig.followShare) {
              result = self.currentPage.updateAppMessageResult(result ?? {});
            }
          }
          const argsArray = Array.prototype.slice.call(args);
          if (result) {
            argsArray.push(result);
          }
          // 执行effects
          self[`def${cType}Cbs`][eventName].apply(this, argsArray);
        } catch (error) {
          consoleText(error, 'error');
        }
        // 执行分享之外的生命周期函数
        if (eventName !== 'onShareAppMessage') {
          result = method.apply(this, args);
        }
        self.growingIO.emitter.emit(EMIT_MSG.MINIP_LIFECYCLE, {
          event: `${cType} ${eventName}End`,
          timestamp: Date.now(),
          params: { instance: this, arguments: Array.from(args) }
        });
        return result;
      };
    }
  };

  // 自定义方法effects
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

  growingApp = (app: any) => this.originalApp(this.appOverriding(app));

  growingPage = (page: any) => this.originalPage(this.pageOverriding(page));

  growingComponent = (component: any) =>
    this.originalComponent(this.componentOverriding(component));

  growingBehavior = (behavior: any) =>
    this.originalBehavior(this.componentOverriding(behavior));

  nativeGrowing = (
    designated: string[] = ['App', 'Page', 'Component', 'Behavior']
  ) => {
    const self = this;
    const { platformConfig } = this.growingIO;
    const platformHooks = platformConfig.hooks;
    this.setAppEffectCbs();
    this.setPageEffectCbs();
    if (designated.includes('App')) {
      try {
        // 重写App
        if (platformHooks.App && !this.appHooked) {
          this.originalApp = App || global.App || function () {};
          App = function (...args) {
            return self.growingApp(args[0]);
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
          this.originalPage = Page || global.Page || function () {};
          Page = function (...args) {
            return self.growingPage(args[0]);
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
          this.originalComponent =
            Component || global.Component || function () {};
          Component = function (...args) {
            return self.growingComponent(args[0]);
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
          this.originalBehavior = Behavior || global.Behavior || function () {};
          Behavior = function (...args) {
            return self.growingBehavior(args[0]);
          };
          this.behaviorHooked = true;
        }
      } catch (error) {
        // 部分小程序不存在Behavior
      }
    }
  };

  // 初始化无埋点
  initEventHooks = () => {
    const self = this;
    const { platformConfig, gioPlatform } = this.growingIO;
    if (platformConfig.canHook) {
      this.nativeGrowing();
      getGlobal().GioApp = niceTry(() => App ?? window.GioApp);
      getGlobal().GioPage = niceTry(() => Page ?? window.GioPage);
      getGlobal().GioComponent = niceTry(
        () => Component ?? window.GioComponent
      );
      getGlobal().GioBehavior = niceTry(() => Behavior);
    } else if (gioPlatform === 'quickapp') {
      window.GioApp = function (...args) {
        return self.appOverriding(args[0]);
      };
      window.GioPage = function (...args) {
        return self.pageOverriding(args[0]);
      };
      window.GioComponent = function (...args) {
        return self.pageOverriding(args[0]);
      };
    }
  };
}

export default EventHooks;
