import { GrowingIOType } from '@@/types/growingIO';
import { isArray, isEmpty, isFunction, toString } from '@@/utils/glodash';
import EMIT_MSG from '@@/constants/emitMsg';

export default class Exception {
  private minipInst: any;
  // 监听标记，防止重复监听或者内存泄露
  private listenerSet = false;
  // 缓存队列，防止SDK初始化之前的报错丢掉或发不出去
  private cacheQueue: any[];
  private buildErrorEvent: (attributes: any) => void;
  constructor(public growingIO: GrowingIOType) {
    this.minipInst = this.growingIO.minipInstance.minip;
    this.cacheQueue = [];
    // 上报方法
    this.buildErrorEvent = (attributes: any) =>
      this.growingIO.plugins.gioPerformance?.buildPerfEvent(
        'apm_system_error',
        attributes
      );
    // 进入页面时初始化各种错误的监听
    this.setListeners();
    this.hookNavigate();
    // app从后台拉起时开始监听（第一次见进入时会根据listenerSet判断不会重复监听）
    if (isFunction(this.minipInst?.onAppShow)) {
      this.minipInst?.onAppShow(this.setListeners);
    }
    // app切后台或关闭小程序时把监听移除，防止内存泄露
    if (isFunction(this.minipInst?.onAppHide)) {
      this.minipInst?.onAppHide(() => {
        if (this.minipInst.canIUse('offError')) {
          this.minipInst.offError();
        }
        if (this.minipInst.canIUse('offUnhandledRejection')) {
          this.minipInst.offUnhandledRejection();
        }
        if (this.minipInst.canIUse('offLazyLoadError')) {
          this.minipInst.offLazyLoadError();
        }
        this.listenerSet = false;
      });
    }
    this.growingIO.emitter.on(EMIT_MSG.SDK_INITIALIZED, () => {
      if (!isEmpty(this.cacheQueue)) {
        this.cacheQueue.forEach((c: any) => {
          this.buildErrorEvent(c);
        });
      }
    });
  }

  // 设置错误监听
  setListeners = () => {
    if (!this.listenerSet) {
      // 监听小程序错误事件。如脚本错误或 API 调用报错等。
      if (this.minipInst.canIUse('onError')) {
        this.minipInst?.onError((errorString: string) => {
          this.errorParse(errorString);
        });
      }
      // 监听未处理的 Promise 拒绝事件。
      if (this.minipInst.canIUse('onUnhandledRejection')) {
        this.minipInst?.onUnhandledRejection((rejectError: any) => {
          // 普通的promise reject
          if (rejectError.reason.stack) {
            this.errorParse(
              rejectError.reason.stack,
              rejectError.reason.message
            );
          }
        });
      }
      // 监听异步组件加载失败
      if (this.minipInst.canIUse('onLazyLoadError')) {
        this.minipInst?.onLazyLoadError((error: any) => {
          this.buildErrorEvent({
            error_type: error.errMsg,
            error_content: toString(error.subpackage)
          });
        });
      }
    }
    this.listenerSet = true;
  };

  // hook跳转方法获取跳转错误
  hookNavigate = () => {
    const self = this;
    [
      'switchTab',
      'reLaunch',
      'redirectTo',
      'navigateTo',
      'navigateBack'
    ].forEach((reqKey: string) => {
      const originNavigate = this.minipInst[reqKey];
      Object.defineProperty(this.minipInst, reqKey, {
        writable: true,
        enumerable: true,
        configurable: true,
        value: function (...args: any[]) {
          const options: any = args[0] ?? {};
          const originFail = options?.fail;
          const fail = function (result: any) {
            self.growingIO.plugins.gioPerformance?.buildPerfEvent('Error', {
              error_type: `${reqKey} Error`,
              error_content: result.errMsg
            });
            if (typeof originFail === 'function') {
              return originFail(result);
            }
          };
          return originNavigate.call(this, {
            ...options,
            fail
          });
        }
      });
    });
  };

  // 解析普通错误堆栈
  errorParse = (errorString: string, msg?: string) => {
    // 按分行截取为堆栈数组
    const stacks = errorString.split('\n');
    let title: string, // 错误标题
      content: string; // 错误的第一行堆栈
    if (stacks.length) {
      stacks.find((v, i) => {
        const matcher = v.match(/at (.*?) \((.*):(\d{1,}):(\d{1,})\)/);
        if (isArray(matcher)) {
          title = stacks[i - 1];
          content = v.trim();
          return matcher.length;
        }
      });
      if (!title) {
        title = stacks[0];
      }
      if (!content) {
        content = stacks[1];
      }
    } else {
      title = msg || 'Error';
      content = errorString.substring(0, 100);
    }
    this.buildErrorEvent({
      error_type: msg || title,
      error_content: content
    });
  };
}
