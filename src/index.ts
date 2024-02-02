import {
  initPreCheck,
  paramExtraCheck,
  paramsBaseCheck,
  paramsEmptyCheck
} from '@@/utils/verifiers';
import { consoleText, getGlobal, niceTry } from '@@/utils/tools';
import { drop, isString, toString } from '@@/utils/glodash';
import { HANDLERS, DEPRECATED_HANDLERS } from '@@/constants/config';
import GrowingIO from './core/growingIO';

const gioInstance: any = new GrowingIO();

const gdp = function () {
  const actionName = arguments[0];
  // 判断指令为字符串且配置项中允许调用且实例中存在的方法
  if (
    isString(actionName) &&
    HANDLERS.includes(actionName) &&
    gioInstance[actionName]
  ) {
    const args = drop(Array.from(arguments));
    // 初始化方法单独处理
    if (actionName === 'init') {
      const preCheckRes = initPreCheck(gioInstance);
      const emptyCheckRes = paramsEmptyCheck(args);
      const baseCheckRes = paramsBaseCheck(args);
      const extraCheckRes = paramExtraCheck(args);
      if (preCheckRes && emptyCheckRes && baseCheckRes && extraCheckRes) {
        const { projectId } = baseCheckRes;
        const { dataSourceId, appId, options } = extraCheckRes;
        return gioInstance.init({
          ...options,
          projectId,
          dataSourceId,
          appId
        });
      }
    } else if (actionName === 'registerPlugins') {
      gioInstance.registerPlugins(args[0]);
    } else if (gioInstance.gioSDKInitialized && gioInstance.vdsConfig) {
      return gioInstance[actionName](...args);
    } else {
      consoleText('SDK未初始化!', 'error');
    }
  } else if (DEPRECATED_HANDLERS.includes(actionName)) {
    consoleText(`方法 ${toString(actionName)} 已被弃用!`, 'warn');
  } else {
    consoleText(`不存在名为 ${toString(actionName)} 的方法调用!`, 'error');
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
