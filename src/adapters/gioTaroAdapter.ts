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

  // 主入口，版本判断
  main = () => {
    const { taro, taroVue } = this.growingIO.vdsConfig;
    const { Current, createComponent } = taro;
    const isTaro2 = !Current && createComponent;
    const isTaro3 = Current && !createComponent;
    this.taro = taro;
    if (isTaro2) {
      // taro2
      this.taroVersion = '2';
      this.proxyTaro2(this.taro);
      ut.consoleText('Taro version 2', 'info');
    } else if (isTaro3) {
      // taro3
      this.taroVersion = '3';
      this.taroVue = taroVue;
      if (this.taroVue) {
        const mainVersion = Number(
          ut.head(ut.split(this.taroVue.version, '.'))
        );
        this.taroVueVersion = mainVersion;
        ut.consoleText(`Taro version 3, Vue version ${mainVersion}`, 'info');
      } else {
        ut.consoleText('Taro version 3', 'info');
      }
      this.proxyTaro3();
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
  proxyTaro3 = () => {
    const self = this;
    const {
      dataStore: { eventHooks },
      minipInstance
    } = this.growingIO;
    // hook app
    eventHooks.nativeGrowing(['App']);
    // taro3vue2走单独的hook逻辑
    if (this.taroVueVersion === 2) {
      eventHooks.nativeGrowing(['Page']);
      this.taro3Vue2Proxy();
      return;
    }
    if (this.taroVueVersion === 3) {
      this.proxyTaro3vue3();
    }
    // taro3react / taro3vue3走监听hook逻辑
    const originCall = self.taro?.hooks?.call;
    if (originCall) {
      self.defineProperty(self.taro.hooks, 'call', function (...args) {
        const argsArray = Array.from(args);
        // 根据taro消息直接触发页面生命周期
        if (argsArray[0] === 'getLifecycle') {
          const lifetime = argsArray[2];
          if (
            eventHooks.pageHandlers.includes(lifetime) &&
            !CUSTOM_HOOK_EVENTS.includes(lifetime)
          ) {
            // hook方法也会执行第一次进入小程序时的AppOnShow导致先出发第一个页面onShow的bug。这里用一个变量标记当前的生命周期是否在App中
            if (lifetime === 'onLoad' && self.inAppLifecycle) {
              self.inAppLifecycle = false;
            }
            // 有路由地址的才是页面的生命周期（支付宝在ApponShow时也会拿到，所以要再判标记）
            const page = minipInstance.getCurrentPage();
            if (page.route && !self.inAppLifecycle) {
              ut.niceTry(() =>
                eventHooks.pageEffects.main(page, lifetime, argsArray[1])
              );
            }
          }
        }
        let result = originCall.apply(this, argsArray);
        // 分享和添加收藏事件走hook逻辑
        if (argsArray[0] === 'modifyPageObject') {
          const pageObject = argsArray[1];
          CUSTOM_HOOK_EVENTS.forEach((k) => {
            if (pageObject[k]) {
              pageObject[k] = eventHooks.lifeFcEffects(
                k,
                ut.isFunction(pageObject[k]) ? pageObject[k] : () => {},
                'Page'
              );
            }
          });
        }
        // 无埋点事件
        if (argsArray[0] === 'dispatchTaroEvent') {
          const taroEvent = argsArray[1];
          const taroElement = argsArray[2];
          const actionEffects =
            self.growingIO.plugins?.gioEventAutoTracking?.main;
          if (
            ut.isFunction(actionEffects) &&
            eventHooks.actionEventTypes.includes(taroEvent.type)
          ) {
            const { currentTarget, target, detail } = taroEvent.mpEvent;
            // taro本身会给所有节点添加id，id一致说明是触发事件的节点
            if (target.id === currentTarget.id) {
              // 尝试获取真实的方法名
              try {
                let originHandler = ut.head(
                  taroElement.__handlers[taroEvent.type]
                );
                // 一定要有对应的事件
                if (originHandler) {
                  if (originHandler.oldHandler) {
                    originHandler = originHandler.oldHandler;
                  }
                  let funcName = '';
                  if (self.taroVue) {
                    // vue3
                    funcName = self.taro3vue3GetFuncName(
                      originHandler,
                      taroElement
                    );
                  } else {
                    // react --- @tarojs/runtime 3.6.x会有一个随机名的对象存储点击事件优先获取，其他版本直接取originHandler
                    funcName = self.taro3reactGetFuncName(
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
            }
          }
        }
        return result;
      });
    } else {
      ut.consoleText('Taro3实例获取失败，请检查初始化逻辑!', 'warn');
      eventHooks.nativeGrowing(['Page']);
    }
  };

  // 保存vue3下使用setup写法的function component的导出方法名
  proxyTaro3vue3 = () => {
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

  // taro3react获取方法名
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

  // taro3vue3获取方法名
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

  // 无法获取的方法名
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

  // taro3使用vue2的代理
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
