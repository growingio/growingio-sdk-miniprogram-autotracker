import { IMP_EVENTNAME_REG } from '@@/constants/regex';
import {
  compact,
  find,
  forEach,
  formatDate,
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
  typeOf,
  unset
} from '@@/utils/glodash';

// 控制台打印提示信息，包含错误、警告和信息3种形式
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

// 失败提示
export const callError = (fn: string, type = true, msg = '参数不合法') =>
  consoleText(`${type ? '调用' : '设置'} ${fn} 失败，${msg}!`, 'warn');

// 优化过的try...catch包裹体
export const niceTry = (fn: Function) => {
  try {
    return fn();
  } catch (e) {
    return undefined;
  }
};

// 封装过的调用callback的方法
export const niceCallback = (cb: Function, cbv?: any) => {
  if (isFunction(cb)) {
    try {
      cb(cbv);
    } catch (error) {
      consoleText(`回调执行失败！${error}`, 'error');
    }
  }
};

// 限制处理字符串
export const limitString = (s: string) => {
  return isString(s) ? s.trim().substring(0, 100) : s;
};

// 埋点事件名校验
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

// 获取动态属性的值
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

// 生成uuid
export const guid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const getScreenHeight = (info) => {
  if (info.pixelRatio) {
    return Math.round(info.screenHeight * info.pixelRatio);
  }
  return info.screenHeight;
};

export const getScreenWidth = (info) => {
  if (info.pixelRatio) {
    return Math.round(info.screenWidth * info.pixelRatio);
  }
  return info.screenWidth;
};

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

// 比较两个正式的版本号，v1>v2返回1，v1<v2返回-1，v1=v2返回0
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

// 获取vue的主版本号
export const getVueVersion = (vue) => {
  if (vue) {
    const mv = Number(head(split(vue.version, '.')));
    return Number.isNaN(mv) ? 0 : mv;
  } else {
    return 0;
  }
};

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

export const normalPath = (path: string): string => {
  if (isString(path)) {
    return path.startsWith('/') ? path : `/${path}`;
  } else {
    return '';
  }
};

// 判断是否为Taro3环境
export const isTaro3 = (taro: any): boolean => {
  const { Current, createComponent } = taro;
  if (taro && Current && !createComponent) {
    return true;
  } else {
    return false;
  }
};

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

// 在框架下自动获取当前平台值
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

// 获取当前分包在全局中的key值
export const getSubKeys = (app: any) => {
  return keys(app)
    .filter((o) => o.indexOf('__sub') > -1 && o.indexOf('gio__') > -1)
    .sort();
};

// 获取app实例
export const getAppInst = () => {
  let app = niceTry(() => getApp({ allowDefault: true }));
  // 阿里小程序中不支持getApp提前调用，所以只能把gio实例存在global当中
  // 获取不到app实例的一律把gio实例存在global当中
  if (!app) {
    app = getGlobal();
  }
  return app;
};

export const getGlobal = () => {
  return (
    niceTry(() => niceTry(() => niceTry(() => $global) ?? global) ?? window) ??
    globalThis
  );
};

// Object参数限制
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

// 批量获取存储中的数据，减少性能影响
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

// 批量存储数据，减少性能影响
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

// 将参数对象转为参数字符串
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

// 解析参数
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

// 将字符串转为hash
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

export const getExtraData = (data: any) => {
  if (isString(data)) {
    return niceTry(() => JSON.parse(data)) ?? {};
  } else {
    return data ?? {};
  }
};

// 获取额外的启动参数并合并进query
export const getLaunchQuery = (originQuery: any = {}, data: any = {}) => {
  const validData = {};
  const extraData = getExtraData(data);
  keys(extraData).forEach((k: string) => {
    // 排除掉新版圈选用的标记字段
    if (
      k !== 'gdpCircleRoomCollectUrl' &&
      ['string', 'number', 'boolean'].includes(typeOf(extraData[k]))
    ) {
      validData[k] = extraData[k];
    }
  });
  unset(originQuery, 'gdpCircleRoomCollectUrl');
  return Object.assign({}, validData, originQuery);
};
