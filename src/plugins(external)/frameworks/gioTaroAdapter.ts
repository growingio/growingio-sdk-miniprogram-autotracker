/**
 * 名称：Taro代理插件
 * 用途：用于重写Taro框架下的创建App/Page/Component方法实现代理Hook；并获取Taro框架下的自定义方法真实方法名获取。
 * 注意：测试taro3react时，微信要用react18测试，支付宝要用react17测试。
 */
import { GrowingIOType } from '@@/types/growingIO';

let ut;
class GioTaroAdapter {
  private taro: any;
  private vue: any;
  private exposedNames: any;
  private taro3Listeners: any;
  constructor(public growingIO: GrowingIOType) {
    const { utils, vdsConfig, emitter, minipInstance, gioPlatform } =
      this.growingIO;
    ut = utils;
    this.taro = vdsConfig?.taro;
    this.vue = vdsConfig?.taroVue;
    this.exposedNames = {};
    this.taro3Listeners = {};
    emitter.on('minipLifecycle', ({ event }) => {
      if (event === 'Page onReadyEnd') {
        if (this.taro && ut.isTaro3(this.taro)) {
          // 提前存储页面节点信息用来获取dataset
          this.growingIO.plugins?.gioTaroAdapter?.saveFullPage(document.body);
          // taro3开发时要等onready才能取到节点，所以补充做一次曝光监听
          if (!['swan', 'tt'].includes(gioPlatform)) {
            setTimeout(
              () =>
                minipInstance.initImpression(minipInstance.getCurrentPage()),
              0
            );
          }
        }
      }
    });
  }

  // 主入口，版本判断
  main = () => {
    // 插件挂载时可能还没取到
    if (!this.taro) {
      this.taro = this.growingIO?.vdsConfig?.taro;
    }
    if (!this.vue) {
      this.vue = this.growingIO?.vdsConfig?.taroVue;
    }
    const { Current, createComponent } = this.taro;
    if (!Current && createComponent) {
      this.proxyTaro2(this.taro);
    } else if (Current && !createComponent) {
      this.proxyTaro3(this.taro, this.vue);
    } else {
      ut.consoleText('未获取到Taro实例或不支持的Taro版本，请检查!', 'error');
    }
  };

  // 代理taro2
  proxyTaro2 = (taro: any) => {
    const self = this;
    const originApp = taro.createApp;
    const originComponent = taro.createComponent;
    if (originApp) {
      taro.createApp = function (AppClass) {
        const AppRef = originApp(AppClass);
        self.growingIO.dataStore.eventHooks.appOverriding(AppRef);
        return AppRef;
      };
    }
    if (originComponent) {
      taro.createComponent = function (ComponentClass, isPage) {
        const ComponentRef = originComponent(ComponentClass, isPage);
        const targetType = isPage ? 'page' : 'component';
        // wx/qq的生命周期函数和自定义函数都在ComponentRef.methods中
        // my/tt/jd的生命周期函数和自定义函数都在ComponentRef中
        // swan的生命周期函数在ComponentRef.methods中，自定义函数在ComponentRef中
        switch (self.growingIO.gioPlatform) {
          case 'wx':
          case 'qq':
            self.growingIO.dataStore.eventHooks[`${targetType}Overriding`](
              ComponentRef.methods
            );
            break;
          case 'my':
          case 'tt':
          case 'jd':
            self.growingIO.dataStore.eventHooks[`${targetType}Overriding`](
              ComponentRef
            );
            break;
          case 'swan':
            self.growingIO.dataStore.eventHooks[`${targetType}Overriding`](
              ComponentRef
            );
            self.growingIO.dataStore.eventHooks[`${targetType}Overriding`](
              ComponentRef.methods
            );
            break;
          default:
            break;
        }
        return ComponentRef;
      };
    }
  };

  // 代理taro3
  proxyTaro3 = (taro: any, vue?: any) => {
    const { eventHooks } = this.growingIO.dataStore;
    if (vue) {
      console.log('Vue version: ', vue.version);
      const mainVersion = Number.parseInt(
        ut.head(ut.split(vue.version, '.')),
        10
      );
      eventHooks.nativeGrowing();
      if (mainVersion === 2) {
        this.taro3Vue2Proxy(vue);
      } else if (mainVersion === 3) {
        this.taro3Vue3Proxy(vue);
      } else {
        ut.consoleText('不支持的Vue版本，请使用 Vue2 或 Vue3!', 'error');
      }
    } else {
      eventHooks.nativeGrowing(['App']);
      this.taro3ReactProxy(taro);
    }
  };

  // taro3使用react的代理
  taro3ReactProxy = (taroRuntime: any) => {
    // @ts-ignore
    const taroNode = document.__proto__.__proto__;
    const self = this;
    const { eventHooks } = this.growingIO.dataStore;
    // 重写页面生命周期
    const originCall = taroRuntime?.hooks?.call;
    if (originCall) {
      self.defineProperty(taroRuntime.hooks, 'call', function (...args) {
        const argsArray = Array.from(args);
        let result = originCall.apply(this, argsArray);
        if (argsArray[0] === 'modifyPageObject') {
          const pageObject = argsArray[1];
          ut.keys(pageObject).forEach((k) => {
            if (eventHooks.pageHandlers.includes(k)) {
              pageObject[k] = eventHooks.lifeFcEffects(
                k,
                ut.isFunction(pageObject[k]) ? pageObject[k] : () => {},
                'Page'
              );
            }
          });
        }
        return result;
      });
    } else {
      ut.consoleText('Taro3实例获取失败，请检查初始化逻辑!', 'warn');
      eventHooks.nativeGrowing(['Page']);
    }

    // 重写页面自定义方法
    const proxyAddEventListener = (addEventListener) => {
      return function (...args) {
        const originHandler = args[1];
        const handler = self.growingIO.dataStore.eventHooks.customFcEffects(
          originHandler.name,
          originHandler
        );
        self.taro3Listeners[originHandler.name] = handler;
        return addEventListener.apply(this, [args[0], handler, args[2]]);
      };
    };
    const proxyRemoveEventListener = (removeEventListener) => {
      return function (...args) {
        return removeEventListener.apply(this, [
          args[0],
          self.taro3Listeners[args[1].name]
        ]);
      };
    };
    self.defineProperty(
      taroNode,
      'addEventListener',
      proxyAddEventListener(taroNode.addEventListener)
    );
    self.defineProperty(
      taroNode,
      'removeEventListener',
      proxyRemoveEventListener(taroNode.removeEventListener)
    );
  };

  // taro3使用vue2的代理
  taro3Vue2Proxy = (vue: any) => {
    const self = this;
    vue.mixin({
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

  // taro3使用vue3的代理
  taro3Vue3Proxy = (vue: any) => {
    const { eventHooks } = this.growingIO.dataStore;
    const self = this;
    vue.mixin({
      beforeMount: function () {
        // hook逻辑
        const transferMethods = (o) =>
          ut.keys(o).forEach((k: string) => {
            self.defineProperty(this, k, self.proxyMethods(k, this[k]));
          });
        // 对传统methods写法的普通事件hook
        const methods = this.$options.methods;
        if (methods) {
          transferMethods(methods);
        }
        // 对setup中定义的事件hook
        const setupState = this?._?.setupState;
        if (setupState) {
          transferMethods(setupState);
        }
        // 使用emit监听组件点击事件的处理
        const tEmit = this._.emit;
        this._.emit = function (...args) {
          (() =>
            eventHooks.customFcEffects(args[0], () => {}).apply(this, args))();
          return tEmit.apply(this, args);
        };
      },
      mounted() {
        // this._.vnode.el要在mounted中才能获取到
        // 对<script setup>写法的事件hook，编译时会匿名，需要配合expose
        const exposed = this?._?.exposed ?? {};
        self.exposedNames = {};
        if (!ut.isEmpty(exposed)) {
          const nExposed = {};
          // 保存exposed供<script setup>写法的事件查找真实的事件名
          ut.keys(exposed).forEach((k) => {
            if (ut.isFunction(exposed[k])) {
              self.exposedNames[exposed[k].name] = k;
              nExposed[exposed[k].name] = exposed[k];
            }
          });
          // 只能取到编译后的名称，需要从exposedNames中映射
          self.traverseHook(this._.vnode.el, 0);
        }
      }
    });
  };

  // 重写方法
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

  // 重新定义属性
  defineProperty = (target, key, value) => {
    Object.defineProperty(target, key, {
      writable: true,
      enumerable: true,
      configurable: true,
      value
    });
  };

  // 遍历hook节点方法
  traverseHook = (node: any, i: number) => {
    this.veiAutoEventHook(node, i);
    if (node.childNodes && ut.isArray(node.childNodes)) {
      node.childNodes.forEach((n, i) => {
        this.traverseHook(n, i);
      });
    }
  };

  // vue3中查找并重写节点vei对象中的自定义事件
  veiAutoEventHook = (node: any, i: number) => {
    const { eventHooks } = this.growingIO.dataStore;
    if (node._vei) {
      ut.keys(node._vei).forEach((k) => {
        if (eventHooks.actionEventTypes.includes(k)) {
          const func = node._vei[k].value;
          let funcName;
          if (
            (ut.startsWith(`${func}`, 'function ($event)') ||
              ut.startsWith(`${func}`, 'function($event)')) &&
            /return \$setup.[\w]+\(/.test(`${func}`)
          ) {
            // 进入该判断说明客户对方法进行了传参，导致框架编译为匿名函数，此时需要我们处理一下拿到真实的方法名
            const s = `${func}`.match(/return \$setup.[\w]+\(/)[0];
            if (s) {
              funcName = s.replace('return $setup.', '').replace('(', '');
            }
          }
          // 没有获取到方法的情况下，通过exposedNames中存的值尝试匹配，不一定准，因为对象是无序的
          if (!funcName) {
            funcName = `${ut.keys(this.exposedNames)[i]}#${
              Object.values(this.exposedNames)[i]
            }`;
          }
          this.defineProperty(
            node._vei[k],
            'value',
            this.proxyMethods(
              this.exposedNames[func.name] || func.name || funcName,
              func
            )
          );
        }
      });
    }
  };

  // taro3中存储当前页面完整的数据以获取曝光事件中的dataset
  // https://taro-docs.jd.com/taro/docs/react-overall#dataset
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
