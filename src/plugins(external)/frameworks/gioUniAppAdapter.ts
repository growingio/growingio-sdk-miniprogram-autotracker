/**
 * 名称：uni-app代理插件
 * 用途：用于重写uni-app框架下的创建App/Page/Component方法实现代理Hook；并获取uni-app框架下的自定义方法真实方法名获取。
 */
import { GrowingIOType } from '@@/types/growingIO';

const ONCE = '~';
const CUSTOM = '^';
let ut;
class GioUniAppAdapter {
  private uniVue: any;
  private exposedNames: any;
  constructor(public growingIO: GrowingIOType) {
    ut = this.growingIO.utils;
    this.uniVue = this.growingIO?.vdsConfig?.uniVue;
    this.exposedNames = {};
  }

  // 主入口，版本判断
  main = () => {
    // 插件挂载时可能还没取到
    if (!this.uniVue) {
      this.uniVue = this.growingIO?.vdsConfig?.uniVue;
    }
    console.log('Vue version: ', this.uniVue.version);
    if (this.growingIO?.vdsConfig?.subpackage) return false;
    const mainVersion = Number.parseInt(
      ut.head(ut.split(this.uniVue.version, '.')),
      10
    );
    switch (mainVersion) {
      case 2:
        this.uniVue2Proxy(this.uniVue);
        break;
      case 3:
        this.uniVue3Proxy(this.uniVue);
        break;
      default:
        ut.consoleText('不支持的Vue版本，请使用 Vue2 或 Vue3!', 'error');
        break;
    }
  };

  // 获取自定义真实的方法名
  getHandlerName = (eventName: string, e: any) => {
    if (eventName === '__e') {
      let methodName = '__e';
      const { type, currentTarget, target } = e;
      const dataSet = currentTarget?.dataset || target?.dataset;
      if (dataSet) {
        const eventOpts = dataSet.eventOpts || dataSet['event-opts'];
        const matchedEventType = (eventType: string, optType: string) =>
          eventType === optType ||
          (optType === 'regionchange' &&
            (eventType === 'begin' || eventType === 'end'));
        if (eventOpts) {
          eventOpts.forEach((o: any[]) => {
            let eType = ut.head(o);
            const isCustom = eType.charAt(0) === CUSTOM;
            eType = isCustom ? eType.slice(1) : type;
            const isOnce = eType.charAt(0) === ONCE;
            eType = isOnce ? eType.slice(1) : type;
            const eArray = ut.last(o);
            if (matchedEventType(type, eType)) {
              methodName = ut.head(ut.head(eArray));
            }
          });
        }
      }
      return methodName;
    } else if (!ut.isEmpty(this.exposedNames)) {
      return this.exposedNames[eventName] ?? eventName;
    } else {
      return eventName;
    }
  };

  // vue2代理
  uniVue2Proxy = (vue: any) => {
    const {
      dataStore: { eventHooks },
      gioPlatform,
      minipInstance
    } = this.growingIO;
    // 百度要特殊处理，直接重写会导致复写两次
    if (gioPlatform === 'swan') {
      App = function (...args) {
        return eventHooks.growingApp(args[0]);
      };
    } else {
      eventHooks.nativeGrowing();
    }
    /**
     * 注意：在字节小程序中，uniapp的表现会不一致，beforeMount会晚于小程序onShow执行；
     * 页面中如果没有onShow方法的定义，会无法触发SDK的onShow进而没有Page事件，让客户在页面中补一个空的onShow即可。
     */
    vue.mixin({
      beforeMount() {
        if (this.mpType === 'page') {
          eventHooks.pageOverriding(this.$scope);
          // 需要单独处理getPageTitle，防止在vue中onShow里拿的是错误的
          const self = this;
          const originGetter = minipInstance.getPageTitle;
          minipInstance.getPageTitle = function (...args) {
            const cPath = self.$scope.route;
            const vmTitle =
              cPath === eventHooks.currentPage.path
                ? self.$scope?.$vm?._data?.gioPageTitle
                : undefined;
            return vmTitle ? vmTitle : originGetter.apply(this, args);
          };
        }
      }
    });
  };

  // vue3代理
  uniVue3Proxy = (vue: any) => {
    const {
      dataStore: { eventHooks },
      minipInstance
    } = this.growingIO;
    eventHooks.nativeGrowing();
    // 需要单独处理getPageTitle，防止在vue中onShow里拿的是错误的
    const originGetter = minipInstance.getPageTitle;
    minipInstance.getPageTitle = function (...args) {
      let pageInstance = !ut.isEmpty(args[0])
        ? args[0]
        : minipInstance.getCurrentPage();
      if (
        pageInstance?.$vm?.mpType === 'page' &&
        pageInstance?.$vm?.__route__
      ) {
        const vmTitle = pageInstance?.$vm?.gioPageTitle;
        return vmTitle ? vmTitle : originGetter.apply(this, args);
      } else {
        return originGetter.apply(this, args);
      }
    };
    const self = this;
    vue.mixin({
      beforeMount() {
        const proxyMethods = (name: string, method: any) => {
          if (
            ut.isFunction(method) &&
            !eventHooks.pageHandlers.includes(name)
          ) {
            return function (...args) {
              return eventHooks.customFcEffects(name, method).apply(this, args);
            };
          } else {
            return method;
          }
        };
        // hook逻辑
        const transferMethods = (origin, target) =>
          ut.keys(origin).forEach((k: string) => {
            Object.defineProperty(target, k, {
              value: proxyMethods(k, target[k]),
              configurable: true,
              writable: true
            });
          });
        // 对传统普通事件hook，如果methods存在，说明有传统写法定义自定义的方法
        const methods = this.$options.methods;
        if (methods) {
          transferMethods(methods, this);
        }
        // 对setup中定义的事件hook
        const setupState = this?._?.setupState;
        if (setupState) {
          transferMethods(setupState, setupState);
        }
        // 对<script setup>写法的事件hook，编译时会匿名，需要配合expose
        const exposed = this?._?.exposed;
        self.exposedNames = {};
        if (exposed) {
          // 保存exposed供<script setup>写法的事件查找真实的事件名
          const exposedKeys = ut.keys(exposed);
          exposedKeys.forEach((k) => {
            if (ut.isFunction(exposed[k])) {
              self.exposedNames[exposed[k].name] = k;
            }
          });
          // 只能取到编译后的名称，需要从exposedNames中映射
          const methodKeys = ut
            .keys(this.$scope)
            .filter(
              (k) => /^e[0-9]+$/.test(k) && ut.isFunction(this.$scope[k])
            );
          methodKeys.forEach((k, i) => {
            const originFunc = this.$scope[k].value;
            const customName = self.splicingMethodName(
              originFunc.name,
              k,
              exposedKeys[i]
            );
            this.$scope[k].value = eventHooks.customFcEffects(
              customName,
              originFunc
            );
          });
        }
        // 使用emit监听组件事件hook
        const tEmit = this._.emit;
        this._.emit = function (...args) {
          (() =>
            eventHooks.customFcEffects(args[0], () => {}).apply(this, args))();
          return tEmit.apply(this, args);
        };
      }
    });
  };

  splicingMethodName = (originName, traversalName, exposedName) => {
    if (originName) {
      return originName;
    } else if (exposedName) {
      return `${traversalName}#${exposedName}`;
    } else {
      return traversalName;
    }
  };
}

export default { name: 'gioUniAppAdapter', method: GioUniAppAdapter };
