import { CdpHandlers, deprecatedHandlers } from '@@/constants/config';
import {
  cdpParamExtraCheck,
  cdpParamsEmptyCheck,
  initPreCheck,
  paramsBaseCheck
} from '@@/utils/verifiers';
import { drop, isString, toString } from '@@/utils/glodash';
import { consoleText, getGlobal } from '@@/utils/tools';

import GrowingIO from './growingIO';

const gioInstance: any = new GrowingIO();

const gdp = function () {
  const actionName = arguments[0];
  // 判断指令为字符串且配置项中允许调用且实例中存在的方法
  if (
    isString(actionName) &&
    CdpHandlers.includes(actionName) &&
    gioInstance[actionName]
  ) {
    const args = drop(Array.from(arguments));
    // 初始化方法单独处理
    if (actionName === 'init') {
      const preCheckRes = initPreCheck(gioInstance);
      const emptyCheckRes = cdpParamsEmptyCheck(args);
      const baseCheckRes = paramsBaseCheck(args);
      const extraCheckRes = cdpParamExtraCheck(args);
      if (preCheckRes && emptyCheckRes && baseCheckRes && extraCheckRes) {
        const { projectId } = baseCheckRes;
        const { dataSourceId, appId, cdpOptions } = extraCheckRes;
        return gioInstance.init({
          ...cdpOptions,
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
  } else if (deprecatedHandlers.includes(actionName)) {
    consoleText(`方法 ${toString(actionName)} 已被弃用!`, 'warn');
  } else {
    consoleText(`不存在名为 ${toString(actionName)} 的方法调用!`, 'error');
  }
};

getGlobal().gdp = gdp;
getGlobal().gioEnvironment = 'cdp';
getGlobal().gioSDKVersion = gioInstance.sdkVersion;

export default gdp;
