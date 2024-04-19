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

const gdp = function () {
  const handlerName = arguments[0];
  let trackingId = 'g0';
  let handler = handlerName;
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
      gioInstance.registerPlugins(args[0]);
    } else if (gioInstance.gioSDKInitialized && gioInstance.vdsConfig) {
      if (INSTANCE_HANDLERS.includes(handler)) {
        return niceTry(() =>
          gioInstance.handlerDistribute(trackingId, handler, args)
        );
      } else {
        return niceTry(() => gioInstance[handler](...args));
      }
    } else {
      consoleText('SDK未初始化!', 'error');
    }
  } else if (DEPRECATED_HANDLERS.includes(handler)) {
    consoleText(`方法 ${toString(handler)} 已被弃用，请移除!`, 'warn');
  } else if (handler === 'canIUse') {
    return HANDLERS.includes(arguments[1]) && !!gioInstance[arguments[1]];
  } else {
    consoleText(`不存在名为 ${toString(handler)} 的方法调用!`, 'error');
  }
};

getGlobal().gdp = gdp;
getGlobal().gioSDKVersion = gioInstance.sdkVersion;

export const GioApp = niceTry(
  () => gioInstance.dataStore.eventHooks.growingApp ?? App
);
export const GioPage = niceTry(
  () => gioInstance.dataStore.eventHooks.growingPage ?? Page
);
export const GioComponent = niceTry(
  () => gioInstance.dataStore.eventHooks.growingComponent ?? Component
);
export const GioBehavior = niceTry(
  () => gioInstance.dataStore.eventHooks.growingBehavior ?? Behavior
);
export default gdp;
