/**
 * 代码中一些通用的或者业务上的校验器
 */
import { GrowingIOType } from '@@/types/growingIO';
import { compact, isNumber, isObject, isString, last } from '@@/utils/glodash';
import { consoleText } from '@@/utils/tools';

/**
 * 一些id的合法性校验
 * @param id // 只允许数字和字符串，不允许为空字符串、0、负数
 */

export const verifyId = (o: string | number) =>
  (isString(o) && (o as string).length > 0) ||
  (isNumber(o) && (o as number) > 0);

/**
 * 初始化时的一些合法性校验
 */

export const initPreCheck = (growingIO: GrowingIOType) => {
  // 重复初始化校验
  if (growingIO.vdsConfig || growingIO.gioSDKInitialized) {
    consoleText(
      'SDK重复初始化，请检查是否重复加载SDK或接入其他平台SDK导致冲突!',
      'warn'
    );
    return false;
  }
  return true;
};

// saas环境下参数为空校验
export const saasParamsEmptyCheck = (args: any) => {
  if (!compact(args)) {
    consoleText(
      'SDK初始化失败，请使用 gio("init", "您的GrowingIO项目 accountId", "你的应用 AppId", options); 进行初始化!',
      'error'
    );
    return false;
  }
  return true;
};

// cdp环境下参数为空校验
export const cdpParamsEmptyCheck = (args: any) => {
  if (!compact(args)) {
    consoleText(
      'SDK初始化失败，请使用 gdp("init", "您的GrowingIO项目 accountId", "您项目的 dataSourceId", "你的应用 AppId", options); 进行初始化!',
      'error'
    );
    return false;
  }
  return true;
};

// 基础共用参数校验（projectId、userOptions）
export const paramsBaseCheck = (args: any) => {
  const projectId: string = args[0];
  let userOptions: object = last(args);
  // 参数校验（projectId）
  if (!verifyId(projectId)) {
    consoleText('SDK初始化失败，accountId 参数不合法!', 'error');
    return false;
  }
  // 参数校验（userOptions）
  if (!isObject(userOptions) || !userOptions) {
    userOptions = {};
  }
  return { projectId, userOptions };
};

// cdp环境下额外的参数校验（校验dataSourceId、AppId和配置中的host）
export const cdpParamExtraCheck = (args: any) => {
  // 参数校验（dataSourceId）仅在cdp环境下校验
  const dataSourceId: string = args[1];
  let appId: any = args[2];
  const cdpOptions: any = last(args);
  if (!dataSourceId || !isString(dataSourceId)) {
    consoleText('SDK初始化失败，dataSourceId 参数不合法!', 'error');
    return false;
  }
  if (!verifyId(appId)) {
    consoleText('SDK初始化失败，appId 参数不合法!', 'error');
    return false;
  }
  return { dataSourceId, appId, cdpOptions };
};

// saas环境下额外的参数校验（其实只校验AppId）
export const saasPramsExtraCheck = (args: any) => {
  let appId = args[1];
  if (!verifyId(appId)) {
    consoleText('SDK初始化失败，appId 参数不合法!', 'error');
    return false;
  }
  return { appId };
};
