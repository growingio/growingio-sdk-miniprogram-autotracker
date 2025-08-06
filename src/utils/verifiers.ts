/**
 * 代码中一些通用的或者业务上的校验器
 */
import { consoleText } from '@@/utils/tools';
import { GrowingIOType } from '@@/types/growingIO';
import { isNumber, isString, toString } from '@@/utils/glodash';

/**
 * 一些id的合法性校验
 * @param id // 只允许数字和字符串，不允许为空字符串、0、负数、短横线字符串null,undefined
 */

export const verifyId = (o: string | number) =>
  ((isString(o) && (o as string).length > 0) ||
    (isNumber(o) && (o as number) > 0)) &&
  !['-', 'null', 'undefined'].includes(o as string);

/**
 * 初始化时的一些合法性校验
 */

export const initialCheck = (growingIO: GrowingIOType, args: any) => {
  // ?重复初始化由init方法内部判断
  const projectId = toString(args[0]);
  const dataSourceId = toString(args[1]);
  // 参数为空校验
  const userOptions = (args.length === 4 ? args[3] : args[2]) || {};
  if (!projectId || !dataSourceId) {
    consoleText(
      'SDK初始化失败，请使用 gdp("init", "您的GrowingIO项目 accountId", "您项目的 dataSourceId", "您的小程序 AppId（可选）", options: { serverUrl: "您的数据上报地址" }); 进行初始化!',
      'error'
    );
    return false;
  }
  const gioSDKInitialized = growingIO.dataStore.initializedTrackingIds.some(
    (tid: string, index: number) => {
      const vds =
        index === 0 ? growingIO.vdsConfig : growingIO.subInstance[tid];
      return vds.projectId === projectId && vds.dataSourceId === dataSourceId;
    }
  );
  if (gioSDKInitialized) {
    consoleText('SDK初始化失败，重复初始化，请检查初始化参数!', 'error');
    return false;
  }
  return {
    projectId,
    dataSourceId,
    appId: toString(args.length === 4 ? args[2] : ''),
    userOptions
  };
};
