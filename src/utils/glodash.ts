export const isNil = (o: any): boolean =>
  ['undefined', 'null'].includes(typeOf(o));

export const isString = (o: any): boolean => typeOf(o) === 'string';

export const isNaN = (value: any) => toString(Number(value)) === 'NaN';

export const isNumber = (o: any): boolean => typeOf(o) === 'number';

export const isBoolean = (o: any): boolean => typeOf(o) === 'boolean';

export const isObject = (o: any): boolean =>
  Object.prototype.toString.call(o) === '[object Object]' && !isNil(o);

export const isRegExp = (o: any): boolean =>
  Object.prototype.toString.call(o) === '[object RegExp]';

export const isFunction = (o: any): boolean =>
  ['function', 'asyncfunction'].includes(typeOf(o));

export const isArray = (o: any): boolean =>
  Array.isArray(o) && typeOf(o) === 'array';

export const isDate = (o: any): boolean => typeOf(o) === 'date';

// Number
/**
 * 格式化数字，四舍五入取指定小数点后位数
 * @param o number 需要被格式化的数字
 * @param n number 指定格式化位数
 * @returns number
 */
export const fixed = (o: any, n?: number): number => {
  if (isNumber(o)) {
    return Number(o.toFixed(isNumber(n) ? n : 2));
  } else if (isString(o) && toString(Number(o)) !== 'NaN') {
    return Number(Number(o).toFixed(isNumber(n) ? n : 2));
  } else {
    return o;
  }
};

// Array
/**
 * 获取数组第一个元素（类数组无法使用，例：arguments）
 * @param o array
 * @returns target | undefined
 */
export const head = (o: any): any => {
  try {
    return Array.from(o)[0];
  } catch (error) {
    return undefined;
  }
};

/**
 * 获取数组最后一个元素
 * @param o array
 * @returns target | undefined
 */
export const last = (o: any): any => {
  try {
    const ar = Array.from(o);
    return ar[ar.length - 1];
  } catch (error) {
    return undefined;
  }
};

/**
 * 移除数组前n个元素，默认1
 * @param o array
 * @param n ?number
 * @returns new array
 */
export const drop = (o: any, n = 1): any =>
  isArray(o) && isNumber(n) ? o.slice(n > 0 ? n : 1, o.length) : o;

/**
 * 移除数组符合条件的元素
 * @param o array
 * @param fn function，需返回条件
 * @returns new array
 */
export const dropWhile = (o: any, fn: (currentValue: any) => boolean): any => {
  if (isArray(o)) {
    return o.filter((c: any) => !fn(c));
  } else {
    return o;
  }
};

/**
 * 移除数组中非法数据（undefined、null、0、{}、[]、false）
 * @param o array
 * @returns new array
 */
export const compact = (o: any, ignoreZero = false): any => {
  if (isArray(o)) {
    let resIndex = 0;
    const result: any = [];
    for (const value of o) {
      if (value && !isEmpty(value)) {
        result[resIndex++] = value;
      }
      if (ignoreZero && value === 0) {
        result[resIndex++] = value;
      }
    }
    return result;
  } else {
    return o;
  }
};

/**
 * 查找数组中符合条件的元素
 * @param o array
 * @param fn function，需返回条件
 * @returns target | undefined
 */
export const find = (o: any, fn: (currentValue: any) => any): any => {
  if (isArray(o)) {
    const i = o.findIndex(fn);
    return i >= 0 ? o[i] : undefined;
  } else {
    return undefined;
  }
};

/**
 * 判断两个数组中的元素是否一致
 * @param a array1
 * @param b array2
 * @returns boolean
 */
export const isEqualArray = (a: any, b: any): boolean => {
  if (!isArray(a) || !isArray(b) || a.length !== b.length) {
    return false;
  } else {
    return a.every((o, i) => o === b[i]);
  }
};

// String
/**
 * 将undefined和null以外的数据转为字符串
 * @param o any
 * @returns '' | string
 */
export const toString = (o: any): string => (isNil(o) ? '' : `${o}`);

/**
 * 将字符串按指定分隔符分隔为数组
 * @param s string
 * @param separator 分隔符
 * @returns array
 */
export const split = (s: any, separator?: string): string[] | any =>
  typeOf(s) === 'string' ? s.split(separator) : s;

/**
 * 将字符串第一个字符转为小写
 * @param s string
 * @returns string
 */
export const lowerFirst = (s: any): string | any => {
  if (isString(s)) {
    const sa = split(s, '');
    return `${(head(sa) as string).toLowerCase()}${drop(sa).join('')}`;
  } else {
    return s;
  }
};

/**
 * 将字符串第一个字符转为大写
 * @param s string
 * @returns string
 */
export const upperFirst = (s: any): string | any => {
  if (isString(s)) {
    const sa = split(s, '');
    return `${(head(sa) as string).toUpperCase()}${drop(sa).join('')}`;
  } else {
    return s;
  }
};

/**
 * 判断字符串是否以指定字符开头
 * @param s string
 * @param target string
 * @returns boolean
 */
export const startsWith = (s: string, target: string): boolean => {
  if (!isString(s)) {
    s = toString(s);
  }
  return s.slice(0, target.length) === target;
};

/**
 * 判断字符串是否以指定字符结尾
 * @param s string
 * @param target string
 * @returns boolean
 */
export const endsWith = (s: string, target: string): boolean => {
  const { length } = s;
  let position = length;
  if (position > length) {
    position = length;
  }
  const end = position;
  position -= target.length;
  return position >= 0 && s.slice(position, end) === target;
};

// Object
export const hasOwnProperty = Object.prototype.hasOwnProperty;
/**
 * 判断对象中是否存在指定属性
 * @param o object
 * @param key string
 * @returns boolean
 */
export const has = (o: object, key: string): boolean =>
  !isNil(o) && hasOwnProperty.call(o, key);

/**
 * 获取对象中所有的属性名
 * @param o object
 * @returns array
 */
export const keys = (o: any): string[] => (isObject(o) ? Object.keys(o) : []);

/**
 * 对象遍历
 * @param o object
 * @param fn 遍历回调
 */
export const forEach = (
  o: any,
  fn: (value: any, key: string) => void
): void => {
  keys(o).forEach((k: string) => fn(o[k], k));
};

/**
 * 判断两个对象显式属性与对应值是否相等
 * @param o1 object
 * @param o2 object
 * @returns boolean
 */
export const isEqual = (o1: any, o2: any): boolean => {
  const ks = keys(o1);
  if (!isObject(o1) || !isObject(o2) || ks.length !== keys(o2).length) {
    return false;
  } else {
    return !ks
      .map((k, i) => {
        if (isObject(o1[k])) {
          return isEqual(o1[k], o2[k]);
        } else {
          return o1[k] === o2[k];
        }
      })
      .includes(false);
  }
};

/**
 * 获取对象中指定路径的值
 * @param o object
 * @param path string
 * @param defaultValue any
 * @returns target | defaultValue | undefined
 */
export const get = (o: any, path: string, defaultValue?: any): any => {
  let target = o;
  if (!isObject(o)) return defaultValue;
  const keys = path.split('.');
  keys.forEach((k: string) => {
    if (target) {
      target = target[k];
    } else {
      target = defaultValue;
    }
  });
  return target;
};

/**
 * 移除对象中指定属性
 * @param o object
 * @param targetProp string | string[] | RegExp
 * @returns boolean | boolean[]
 */
export const unset = (
  o: any,
  targetProp: string | string[] | RegExp
): boolean | boolean[] => {
  if (isObject(o)) {
    try {
      if (typeOf(targetProp) === 'string') {
        // 本来要用Reflect.deleteProperty，但是IE不支持，就用delete
        return delete o[targetProp as string];
      } else if (typeOf(targetProp) === 'array') {
        return (targetProp as string[]).map((s) => delete o[s as string]);
      } else if (
        typeOf(targetProp) === 'object' &&
        targetProp.constructor === RegExp
      ) {
        keys(o).forEach((k) => {
          if (targetProp.test(k)) {
            unset(o, k);
          }
        });
      }
    } catch (error) {
      return false;
    }
  } else {
    return false;
  }
};

// Function
/**
 * 节流函数
 * @param callback function 回调函数
 * @param delay number(ms) 默认250
 * @param noTrailing boolean 如果 noTrailing 为 true，则回调将仅delay在调用节流函数时每delay ms执行一次。如果 noTrailing 为 false 或未指定，回调将在最后一次节流函数调用后执行最后一次。
 * @param debounceMode boolean 如果debounceMode为 true，则安排clear在delay ms之后执行。如果debounceMode为 false，则安排callback在delay ms之后执行 。
 * @returns function
 */
export const throttle = (callback, delay = 250, noTrailing, debounceMode?) => {
  let timeoutID;
  let cancelled = false;
  let lastExec = 0;
  function clearExistingTimeout() {
    if (timeoutID) {
      clearTimeout(timeoutID);
    }
  }
  if (typeOf(noTrailing) !== 'boolean') {
    debounceMode = callback;
    callback = noTrailing;
    noTrailing = undefined;
  }
  function wrapper(...arguments_) {
    let self = this;
    let elapsed = Date.now() - lastExec;
    if (cancelled) {
      return;
    }
    function exec() {
      lastExec = Date.now();
      callback.apply(self, arguments_);
    }
    function clear() {
      timeoutID = undefined;
    }
    if (debounceMode && !timeoutID) {
      exec();
    }
    clearExistingTimeout();
    if (debounceMode === undefined && elapsed > delay) {
      exec();
    } else if (noTrailing !== true) {
      timeoutID = setTimeout(
        debounceMode ? clear : exec,
        debounceMode === undefined ? delay - elapsed : delay
      );
    }
  }
  return wrapper;
};

/**
 * 判断目标值是否为空（[]、{}、''、0、false）
 * @param o any
 * @returns boolean
 */
export const isEmpty = (o: any): boolean => {
  if (isArray(o)) {
    return o.length === 0;
  } else if (isObject(o)) {
    return keys(o).length === 0;
  } else {
    return !o;
  }
};

/**
 * 判断类型
 * @param o any
 * @returns string
 */
export const typeOf = (o: any): string => {
  return Object.prototype.toString.call(o).slice(8, -1).toLowerCase();
};

/**
 * 格式化时间
 * @param o any
 * @returns string
 */
export const formatDate = (e) => {
  function t(e) {
    return e < 10 ? '0' + e : e;
  }
  return (
    e.getFullYear() +
    '-' +
    t(e.getMonth() + 1) +
    '-' +
    t(e.getDate()) +
    ' ' +
    t(e.getHours()) +
    ':' +
    t(e.getMinutes()) +
    ':' +
    t(e.getSeconds()) +
    '.' +
    t(e.getMilliseconds())
  );
};
