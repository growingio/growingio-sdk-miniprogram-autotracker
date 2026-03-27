import { initialCheck } from '@@/utils/verifiers';
import { consoleText, getGlobal, niceTry } from '@@/utils/tools';
import { drop, isString, toString } from '@@/utils/glodash';
import {
  HANDLERS,
  DEPRECATED_HANDLERS,
  INSTANCE_HANDLERS
} from '@@/constants/config';
import GrowingIO from './core/growingIO';

const gioInstance: any = new GrowingIO();

/**
 * GrowingIO 小程序 SDK 的主入口函数
 * @param {string} handlerName - 要调用的方法名，格式为 "method" 或 "trackingId.method"
 * @returns {any} - 返回方法调用的结果
 */
const gdp = function () {
  const handlerName = arguments[0];
  let trackingId = 'g0';
  let handler = handlerName;
  // 如果方法名包含 "."，则分割为 trackingId 和 handler
  if (handlerName.indexOf('.') > -1) {
    trackingId = handlerName.split('.')[0] ?? 'g0'; // 没有指定trackingId，默认为g0
    handler = handlerName.split('.')[1];
  }
  // 判断指令为字符串且配置项中允许调用且实例中存在的方法
  if (isString(handler) && HANDLERS.includes(handler) && gioInstance[handler]) {
    const args = drop(Array.from(arguments));
    // 初始化方法单独处理
    if (handler === 'init') {
      const initialCheckRes: any = initialCheck(gioInstance, args);
      if (initialCheckRes) {
        const { projectId, dataSourceId, appId, userOptions } = initialCheckRes;
        // 返回初始化结果
        return gioInstance.init({
          ...userOptions,
          projectId,
          dataSourceId,
          appId,
          trackingId
        });
      } else {
        return false;
      }
    } else if (handler === 'registerPlugins') {
      // 注册插件
      gioInstance.registerPlugins(args[0]);
    } else if (gioInstance.gioSDKInitialized && gioInstance.vdsConfig) {
      // 如果 SDK 已初始化且配置存在
      if (INSTANCE_HANDLERS.includes(handler)) {
        // 如果是实例方法，分发到对应的实例
        return niceTry(() =>
          gioInstance.handlerDistribute(trackingId, handler, args)
        );
      } else {
        // 否则直接调用 gioInstance 上的方法
        return niceTry(() => gioInstance[handler](...args));
      }
    } else {
      consoleText('SDK未初始化!', 'error');
    }
  } else if (DEPRECATED_HANDLERS.includes(handler)) {
    consoleText(`方法 ${toString(handler)} 已被弃用，请移除!`, 'warn');
  } else if (handler === 'canIUse') {
    // 检查方法是否可用
    return HANDLERS.includes(arguments[1]) && !!gioInstance[arguments[1]];
  } else {
    consoleText(`不存在名为 ${toString(handler)} 的方法调用!`, 'error');
  }
};

getGlobal().gdp = gdp;
getGlobal().gioSDKVersion = gioInstance.sdkVersion;

const {
  growingApp,
  growingPage,
  growingComponent,
  growingBehavior,
  initOriginalValue
} = gioInstance.dataStore.eventHooks;
initOriginalValue();
export const GioApp = niceTry(() => growingApp ?? App);
export const GioPage = niceTry(() => growingPage ?? Page);
export const GioComponent = niceTry(() => growingComponent ?? Component);
export const GioBehavior = niceTry(() => growingBehavior ?? Behavior);
export default gdp;
