import { deprecatedHandlers, SaasHandlers } from '@@/constants/config';
import {
  initPreCheck,
  paramsBaseCheck,
  saasParamsEmptyCheck,
  saasPramsExtraCheck
} from '@@/utils/verifiers';
import { drop, isString, toString } from '@@/utils/glodash';
import { consoleText, getGlobal } from '@@/utils/tools';

import GrowingIO from './growingIO';

const gioInstance = new GrowingIO();

const gio = function () {
  const actionName = arguments[0];
  // 判断指令为字符串且配置项中允许调用且实例中存在的方法
  if (
    isString(actionName) &&
    SaasHandlers.includes(actionName) &&
    gioInstance[actionName]
  ) {
    const args = drop(Array.from(arguments));
    // 初始化方法单独处理
    if (actionName === 'init') {
      const preCheckRes = initPreCheck(gioInstance);
      const emptyCheckRes = saasParamsEmptyCheck(args);
      const baseCheckRes = paramsBaseCheck(args);
      const extraCheckRes = saasPramsExtraCheck(args);
      if (preCheckRes && emptyCheckRes && baseCheckRes && extraCheckRes) {
        const { projectId, userOptions } = baseCheckRes;
        const { appId } = extraCheckRes;
        // 快应用必须填写AppId(包名)，SDK无法自动获取
        if (!appId && gioInstance.gioPlatform === 'quickapp') {
          consoleText('请填写AppId(packageName)!', 'error');
          return false;
        }
        return gioInstance.init({ ...userOptions, projectId, appId });
      }
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

getGlobal().gio = gio;
getGlobal().gioEnvironment = 'saas';
getGlobal().gioSDKVersion = gioInstance.sdkVersion;

export default gio;
