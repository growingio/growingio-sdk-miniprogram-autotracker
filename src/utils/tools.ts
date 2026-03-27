import { IMP_EVENTNAME_REG } from '@@/constants/regex';
import {
  compact,
  find,
  forEach,
  formatDate,
  has,
  head,
  isArray,
  isDate,
  isEmpty,
  isFunction,
  isNil,
  isObject,
  isString,
  keys,
  split,
  startsWith,
  toString,
  unset
} from '@@/utils/glodash';

/**
 * 控制台打印提示信息，包含错误、警告和信息3种形式
 * @param {string} msg - 打印的信息内容
 * @param {'info' | 'success' | 'error' | 'warn'} [type] - 打印的类型
 */
export const consoleText = (
  msg: string,
  type?: 'info' | 'success' | 'error' | 'warn'
) => {
  const styles = {
    info: 'color: #3B82F6;',
    error: 'color: #EF4444',
    warn: 'color: #F59E0B',
    success: 'color: #10B981'
  };
  console.log(`%c[GrowingIO]：${msg}`, styles[type] || '');
};

/**
 * 失败提示
 * @param {string} fn - 方法名或属性名
 * @param {boolean} [type=true] - true 为调用失败，false 为设置失败
 * @param {string} [msg='参数不合法'] - 错误信息
 */
export const callError = (fn: string, type = true, msg = '参数不合法') =>
  consoleText(`${type ? '调用' : '设置'} ${fn} 失败，${msg}!`, 'warn');

/**
 * 优化过的try...catch包裹体
 * @param {Function} fn - 需要执行的函数
 * @returns {any} - 执行结果或 undefined
 */
export const niceTry = (fn: Function) => {
  try {
    return fn();
  } catch (e) {
    return undefined;
  }
};

/**
 * 封装过的调用callback的方法
 * @param {Function} cb - 回调函数
 * @param {any} [cbv] - 回调函数的参数
 */
export const niceCallback = (cb: Function, cbv?: any) => {
  if (isFunction(cb)) {
    try {
      cb(cbv);
    } catch (error) {
      consoleText(`回调执行失败！${error}`, 'error');
    }
  }
};

/**
 * 限制处理字符串，去除首尾空格并截取前100个字符
 * @param {string} s - 需要处理的字符串
 * @returns {string} - 处理后的字符串
 */
export const limitString = (s: string) => {
  return isString(s) ? s.trim().substring(0, 100) : s;
};

/**
 * 埋点事件名校验
 * @param {string} eventName - 事件名
 * @param {Function} callback - 校验通过后的回调
 * @returns {any} - 回调执行结果或 false
 */
export const eventNameValidate = (eventName: string, callback: () => void) => {
  if (
    isString(eventName) &&
    !isEmpty(eventName) &&
    eventName.match(IMP_EVENTNAME_REG)
  ) {
    return callback();
  } else {
    consoleText(
      '事件名格式不正确，只能包含数字、字母和下划线，且不能以数字开头，字符总长度不能超过100!',
      'error'
    );
    return false;
  }
};

/**
 * 获取动态属性的值
 * @param {any} properties - 属性对象
 * @returns {any} - 处理后的属性对象
 */
export const getDynamicAttributes = (properties: any) => {
  if (!isNil(properties)) {
    keys(properties).forEach((k: string) => {
      if (isFunction(properties[k])) {
        properties[k] = niceTry(() => properties[k]());
      } else if (isObject(properties[k])) {
        unset(properties, k);
      } else if (!isArray(properties[k])) {
        properties[k] = toString(properties[k]);
      }
    });
  }
  return properties;
};

/**
 * 生成 UUID
 * @returns {string} - 生成的 UUID
 */
export const guid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * 获取屏幕高度
 * @param {any} info - 系统信息对象
 * @returns {number} - 屏幕高度
 */
export const getScreenHeight = (info) => {
  if (info.pixelRatio) {
    return Math.round(info.screenHeight * info.pixelRatio);
  }
  return info.screenHeight;
};

/**
 * 获取屏幕宽度
 * @param {any} info - 系统信息对象
 * @returns {number} - 屏幕宽度
 */
export const getScreenWidth = (info) => {
  if (info.pixelRatio) {
    return Math.round(info.screenWidth * info.pixelRatio);
  }
  return info.screenWidth;
};

/**
 * 获取操作系统名称
 * @param {any} system - 系统名称字符串
 * @param {string} configName - 配置名称前缀
 * @returns {string} - 格式化后的操作系统名称
 */
export const getOS = (system: any, configName: string) => {
  if (system) {
    const lowsys = system.toLowerCase();
    if (lowsys.indexOf('android') !== -1) {
      return `${configName}-Android`;
    } else if (lowsys.indexOf('ios') !== -1) {
      return `${configName}-iOS`;
    } else if (
      lowsys.indexOf('harmonyos') !== -1 ||
      lowsys.indexOf('ohos') !== -1
    ) {
      return `${configName}-HarmonyOS`;
    } else {
      return `${configName}-${system}`;
    }
  }
};

/**
 * 比较两个正式的版本号
 * @param {string} [v1=''] - 版本号1
 * @param {string} [v2=''] - 版本号2
 * @returns {number} - v1>v2返回1，v1<v2返回-1，v1=v2返回0
 */
export const compareVersion = (v1 = '', v2 = '') => {
  const rpSpace = (s) => s.replace(/\s+/g, '');
  const rpV = (s) => s.replace(/[vV]/g, '');
  const nv1 = rpSpace(rpV(v1));
  const nv2 = rpSpace(rpV(v2));
  const nv1Array = nv1.split('.');
  const nv2Array = nv2.split('.');
  for (let i = 0; i < 3; i++) {
    let na = Number(nv1Array[i]);
    let nb = Number(nv2Array[i]);
    if (na > nb) return 1;
    if (nb > na) return -1;
    if (!isNaN(na) && isNaN(nb)) return 1;
    if (isNaN(na) && !isNaN(nb)) return -1;
  }
  return 0;
};

/**
 * 获取 Vue 的主版本号
 * @param {any} vue - Vue 对象
 * @returns {number} - 主版本号，如果无法获取则返回 0
 */
export const getVueVersion = (vue) => {
  if (vue) {
    const mv = Number(head(split(vue.version, '.')));
    return Number.isNaN(mv) ? 0 : mv;
  } else {
    return 0;
  }
};

/**
 * 分割路径和查询参数
 * @param {string} [fullPath] - 完整路径
 * @returns {[string | undefined, string]} - [路径, 查询参数]
 */
export const splitPath = (fullPath?: string): [string | undefined, string] => {
  if (isString(fullPath)) {
    const idx = fullPath.indexOf('?');
    if (idx !== -1) {
      const path = fullPath.substring(0, idx);
      const query = fullPath.substring(idx + 1);
      return [path, query];
    } else {
      return [fullPath, ''];
    }
  } else {
    return ['', ''];
  }
};

/**
 * 规范化路径，确保以 '/' 开头
 * @param {string} path - 路径
 * @returns {string} - 规范化后的路径
 */
export const normalPath = (path: string): string => {
  if (isString(path)) {
    return path.startsWith('/') ? path : `/${path}`;
  } else {
    return '';
  }
};

/**
 * 判断是否为 Taro3 环境
 * @param {any} taro - Taro 对象
 * @returns {boolean} - 是否为 Taro3 环境
 */
export const isTaro3 = (taro: any): boolean => {
  const { Current, createComponent } = taro;
  if (taro && Current && !createComponent) {
    return true;
  } else {
    return false;
  }
};

/**
 * 获取平台对应的小程序实例
 * @param {string} [platform] - 平台名称
 * @returns {any} - 小程序实例
 */
export const getPlainMinip = (platform?: string) => {
  return niceTry(() => {
    switch (platform) {
      // 指定平台获取实例
      case 'wx':
        return wx;
      case 'my':
      // 淘宝小程序和支付宝小程序共用my对象
      case 'tb':
        return my;
      case 'swan':
        return swan;
      case 'tt':
        return tt;
      case 'qq':
        return qq;
      case 'ks':
        return ks;
      case 'jd':
        return jd;
      case 'xhs':
        return xhs;
      // 第三方框架下自动获取实例
      // 百度等小程序中可能存在封装过的wx对象，因此wx要放在最后判断
      default: {
        let minip;
        if (!minip) minip = niceTry(() => xhs);
        if (!minip) minip = niceTry(() => swan);
        if (!minip) minip = niceTry(() => my);
        if (!minip) minip = niceTry(() => tt);
        if (!minip) minip = niceTry(() => qq);
        if (!minip) minip = niceTry(() => ks);
        if (!minip) minip = niceTry(() => jd);
        if (!minip) minip = niceTry(() => wx);
        return minip;
      }
    }
  });
};

/**
 * 获取平台对应的配置对象
 * @param {string} [platform] - 平台名称
 * @returns {any} - 配置对象
 */
export const getPlainConfig = (platform?: string) => {
  return niceTry(() => {
    switch (platform) {
      // 指定平台获取实例
      case 'wx':
        return __wxConfig;
      case 'swan':
        return appConfig;
      case 'tt':
        return (
          niceTry(() => __ttConfig) ||
          global?.TMAConfig ||
          globalThis?.TMAConfig
        ); // 可能会拿不到
      case 'qq':
        return __qqConfig;
      case 'ks':
        return __ksConfig; // 新版快手小程序已经拿不到了
      case 'jd':
        return __jdConfig;
      case 'xhs':
        return __MP_APP_JSON_MIGRATION__ ?? __MP_APP_JSON__;
      // 第三方框架下自动获取实例
      default:
        // 支付宝和淘宝不存在可获取的全局对象
        return undefined;
    }
  });
};

/**
 * 获取平台对应的 App Code
 * @param {string} [platform] - 平台名称
 * @returns {any} - App Code
 */
export const getPlainAppCode = (platform?: string) => {
  return niceTry(() => {
    switch (platform) {
      // 指定平台获取实例
      case 'wx':
      case 'qq':
        return __wxAppCode__;
      case 'tt':
        return __allConfig__;
      case 'ks':
        return __module__;
      case 'jd':
        return __jdAppCode__;
      default:
        return undefined;
    }
  });
};

/**
 * 在框架下自动获取当前平台值
 * @returns {string | undefined} - 平台名称
 */
export const getPlainPlatform = () => {
  // 百度等小程序中可能存在封装过的wx对象，因此wx要放在最后判断
  let platform;
  if (!platform && niceTry(() => xhs)) platform = 'xhs';
  if (!platform && niceTry(() => swan)) platform = 'swan';
  if (!platform && niceTry(() => tt)) platform = 'tt';
  if (!platform && niceTry(() => qq)) platform = 'qq';
  if (!platform && niceTry(() => my.tb)) platform = 'tb';
  if (!platform && niceTry(() => my)) platform = 'my';
  if (!platform && niceTry(() => ks)) platform = 'ks';
  if (!platform && niceTry(() => jd)) platform = 'jd';
  if (!platform && niceTry(() => wx)) platform = 'wx';
  if (!platform) {
    const quickappExist = !!find(keys(global), (o) =>
      toString(o).toLowerCase().includes('quickapp')
    );
    if (quickappExist) {
      platform = 'quickapp';
    }
  }
  return platform;
};

/**
 * 获取当前分包在全局中的 key 值
 * @param {any} app - App 实例
 * @returns {string[]} - 分包 key 数组
 */
export const getSubKeys = (app: any) => {
  return keys(app)
    .filter((o) => o.indexOf('__sub') > -1 && o.indexOf('gio__') > -1)
    .sort();
};

/**
 * 获取 App 实例
 * @returns {any} - App 实例
 */
export const getAppInst = () => {
  let app = niceTry(() => getApp({ allowDefault: true }));
  // 阿里小程序中不支持getApp提前调用，所以只能把gio实例存在global当中
  // 获取不到app实例的一律把gio实例存在global当中
  if (!app) {
    app = getGlobal();
  }
  return app;
};

/**
 * 获取全局对象 (global, window, globalThis)
 * @returns {any} - 全局对象
 */
export const getGlobal = () => {
  return (
    niceTry(() => niceTry(() => niceTry(() => $global) ?? global) ?? window) ??
    globalThis
  );
};

/**
 * 限制对象属性的深度和长度
 * @param {any} o - 需要处理的对象
 * @returns {any} - 处理后的对象
 */
export const limitObject = (o: any) => {
  const ob = {};
  if (isObject(o)) {
    // 移除预置的'&&sendTo'字段
    unset(o, '&&sendTo');
    forEach(o, (v, k) => {
      const key = toString(k).slice(0, 100);
      if (isObject(v)) {
        ob[key] = limitObject(v);
      } else if (isArray(v)) {
        ob[key] = compact(v.slice(0, 100), true);
        ob[key] = ob[key].join('||').slice(0, 1000);
      } else if (isDate(v)) {
        ob[key] = formatDate(v);
      } else {
        ob[key] = !isNil(v) ? toString(v).slice(0, 1000) : '';
      }
    });
  }
  return ob;
};

/**
 * 批量获取存储中的数据，减少性能影响
 * @param {any} minipInstance - 小程序实例
 * @param {string[]} keys - 需要获取的 key 列表
 * @returns {any} - 获取的数据列表
 */
export const batchGetStorageSync = (minipInstance: any, keys: string[]) => {
  const batchFunction = () => {
    return minipInstance.minip.batchGetStorageSync(keys);
  };
  const singleFunction = () => {
    return keys.map((key: string) => minipInstance.getStorageSync(key));
  };
  // 优先使用批量接口（目前仅支持wx）
  try {
    if (minipInstance.minip.canIUse('batchGetStorageSync')) {
      return batchFunction();
    } else {
      return singleFunction();
    }
  } catch (error) {
    return singleFunction();
  }
};

/**
 * 批量存储数据，减少性能影响
 * @param {any} minipInstance - 小程序实例
 * @param {any[]} kvList - 键值对列表
 * @returns {any} - 存储操作的结果
 */
export const batchSetStorageSync = (minipInstance: any, kvList: any[]) => {
  const batchFunction = () => {
    return minipInstance.minip.batchSetStorageSync(kvList);
  };
  const singleFunction = () => {
    return kvList.map(({ key, value }: any) =>
      minipInstance.setStorageSync(key, value)
    );
  };
  // 优先使用批量接口（目前仅支持wx）
  try {
    if (minipInstance.minip.canIUse('batchSetStorageSync')) {
      return batchFunction();
    } else {
      return singleFunction();
    }
  } catch (error) {
    return singleFunction();
  }
};

/**
 * 将参数对象转为查询字符串
 * @param {any} query - 参数对象
 * @returns {string} - 查询字符串
 */
export const qsStringify = (query: any) => {
  return keys(query || {})
    .map((key) => {
      if (key) {
        return `${key}=${isNil(query[key]) ? '' : query[key]}`;
      } else {
        return '';
      }
    })
    .join('&');
};

/**
 * 解析查询字符串为对象
 * @param {string} s - 查询字符串
 * @returns {object} - 参数对象
 */
export const qsParse = (s: string) => {
  if (startsWith(s, '?') || startsWith(s, '&')) {
    s = s.slice(1, s.length);
  }
  const qsObject = {};
  s.split('&').forEach((pairs: string) => {
    const pair = pairs.split('=');
    if (pair[0]) {
      qsObject[pair[0]] = pair[1];
    }
  });
  return qsObject;
};

/**
 * 将字符串转为 hash 值
 * @param {string} string - 输入字符串
 * @param {boolean} [abs=false] - 是否取绝对值
 * @returns {number} - hash 值
 */
export const hashCode = (string: string, abs = false) => {
  let hash = 0;
  if (isEmpty(string) || typeof string === 'boolean') {
    return hash;
  }
  let i = 0;
  while (i < string.length) {
    const char = string.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; //Convert to 32bit integer
    i++;
  }
  return abs ? Math.abs(hash) : hash;
};

/**
 * 解析额外数据
 * @param {any} data - 数据
 * @returns {object} - 解析后的对象
 */
export const getExtraData = (data: any) => {
  if (isString(data)) {
    return niceTry(() => JSON.parse(data)) ?? {};
  } else {
    return data ?? {};
  }
};

/**
 * 清理参数中的非法字段
 * @param {any} [originQuery={}] - 原始查询参数，可以是对象或参数字符串
 * @param {any} [extraData={}] - 额外数据，可以是对象或参数字符串
 * @returns {object} - 清理后的纯净参数对象
 */
const dirtyKey = [
  'wxShoppingListScene',
  '$taroTimestamp',
  'gdpCircleRoomCollectUrl'
];
export const getPureParams = (originQuery: any = {}, extraData: any = {}) => {
  // 处理originQuery可能是字符串的情况
  const parsedOriginQuery =
    typeof originQuery === 'string' ? qsParse(originQuery) : originQuery || {};

  // 递归清理函数
  function cleanObject(obj, needCompare) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return obj;
    }

    const result = {};

    keys(obj).forEach((key) => {
      // 检查key是否包含dirtyKey中的任何字符串
      const isKeyDirty = dirtyKey.some((dirty) => key.includes(dirty));
      const isKeyExist = has(parsedOriginQuery, key);

      if (!isKeyDirty && (needCompare ? !isKeyExist : true)) {
        const value = obj[key];

        // 检查value是否是字符串且包含dirtyKey中的任何字符串
        if (typeof value === 'string') {
          const isValueDirty = dirtyKey.some((dirty) => value.includes(dirty));
          if (!isValueDirty) {
            result[key] = value;
          }
        }
        // 如果是数字和布尔值，直接保留，其他类型丢弃
        else if (typeof value === 'number' || typeof value === 'boolean') {
          result[key] = value;
        }
      }
    });

    return result;
  }

  return Object.assign(
    {},
    cleanObject(parsedOriginQuery, false),
    cleanObject(extraData, true)
  );
};
