// GioMarketing 重构版适配3.8+小程序SDK的弹窗SDK
const getGlobal = () => {
  try {
    return $global;
  } catch (error) {
    return global;
  }
};

getGlobal().gTouchVersion = __GTOUCH_VERSION__;

const consoleText = (msg, type) => {
  const styles = {
    info: 'color: #3B82F6;',
    error: 'color: #EF4444;',
    warn: 'color: #F59E0B;',
    success: 'color: #10B981;'
  };
  console.log(`%c[GrowingIO]：${msg}`, styles[type] || '');
};

const getGrowingIO = () => {
  const app = getApp({ allowDefault: true });
  return (
    (typeof app.__gio__ === 'function' ? app.__gio__() : app.__gio__) ||
    (typeof getGlobal().__gio__ === 'function'
      ? getGlobal().__gio__()
      : getGlobal().__gio__) ||
    {}
  );
};

/**
 * ---当前持久化存取数据---
 */

// 用户信息存取
const userSpace = 'push-user-status';
// 用户信息有效期50天
const ud = 50 * 24 * 3600 * 1000;
// 事件信息有效期24小时
const ed = 24 * 3600 * 1000;
class PopupUserStore {
  constructor(growingIO) {
    this.getStorageSync = growingIO.minipInstance.getStorageSync;
    this.setStorageSync = growingIO.minipInstance.setStorageSync;
  }

  get = (key, cs1) => {
    const v =
      this.getStorageSync(`${userSpace}#${key}${cs1 ? '#' + cs1 : ''}`) || {};
    const vd = key === 'userAttrs' ? ud : ed;
    if (Date.now() <= v.startAt + vd) {
      return v.value;
    } else {
      // 超时重置数据
      this.set(key, 0, cs1);
      return 0;
    }
  };

  set = (key, value, cs1) => {
    const now = new Date();
    now.setHours(0);
    now.setMinutes(0);
    now.setSeconds(0);
    this.setStorageSync(`${userSpace}#${key}${cs1 ? '#' + cs1 : ''}`, {
      startAt: now.getTime(),
      value
    });
  };
}

// 弹窗信息存取
const pushSpace = 'push-status';
class PopupStore {
  constructor(growingIO) {
    this.getStorageSync = growingIO.minipInstance.getStorageSync;
    this.setStorageSync = growingIO.minipInstance.setStorageSync;
  }

  get = (popId, cs1) => {
    const v = this.getStorageSync(`#${pushSpace}#${popId}#${cs1 || ''}`) || {};
    const dv = {
      showTimes: 0,
      showDate: Date.now(),
      recommendIdx: 0,
      recommendDate: null
    };
    let nv = {};
    if (v) {
      nv = { ...dv, ...v };
    } else {
      nv = dv;
    }
    this.set(popId, cs1, nv);
    return nv;
  };

  set = (popId, cs1, value) => {
    this.setStorageSync(`#${pushSpace}#${popId}#${cs1 || ''}`, value);
  };
}

/**
 * ---处理工具方法---
 */

const format = (s) => {
  if (typeof s === 'boolean') {
    return s;
  } else if (typeof s === 'string') {
    return s === 't' ? true : false;
  }
};

// 表达式形如 (t && t) || (f && f) || (f || t)，同一维度下，op是相同的
const parseBoolExpr = function (expression) {
  if (expression === 't') return true;
  if (expression === 'f') return false;
  // 转换为一种友好的格式，更易处理
  expression = '(' + expression.replace(/&+/g, '&').replace(/\|+/g, '|') + ')';

  const stack = [];
  for (let i = 0; i < expression.length; i++) {
    stack.push(expression[i]);
    let cur;
    let op;
    let exprs = [];
    while (expression[i] === ')' && cur !== '(') {
      cur = stack.pop();
      if (cur === void 0) break;
      if (['&', '|'].includes(cur)) {
        op = cur;
      } else if (['t', 'f', true, false].includes(cur)) {
        exprs.push(cur);
      }
    }
    if (op && exprs.length) {
      // eslint-disable-next-line
      const res = exprs.reduce((p, c) => {
        const _prev = format(p);
        const _cur = format(c);
        if (op === '&') {
          return _prev && _cur;
        }
        if (op === '|') {
          return _prev || _cur;
        }
      }, format(exprs[0]));
      stack.push(res);
    }
  }
  return stack.pop();
};

// 转化时间
const formatDate = (d) => {
  const year = d.substr(0, 4);
  const month = d.substr(4, 2);
  const day = d.substr(6, 2);
  return new Date(`${year}-${month}-${day}`).getTime();
};

const initialState = {
  // 是否请求成功过弹窗接口数据
  isRequested: false,
  // 获取弹窗数据重试计数
  retryTimes: 0,
  // 是否是预览
  isPreview: false,
  // 是否正在消费事件
  isConsuming: false,
  // 从接口获取的按更新时间排序后的原始数据
  originData: [],
  // 从接口获取的触发条件
  triggerConditions: [],
  // 未处理事件队列
  unResolvedEvents: [],
  // 弹窗渲染队列
  renderQueue: [],
  // 是否正在渲染
  isRendering: false,
  // 渲染回调(组件方法)
  renderFn: undefined
};

let ut;
class GioMarketing {
  constructor() {
    consoleText('GioMarketing 初始化中...', 'info');
    this.growingIO = getGrowingIO();
    const { emitter, utils } = this.growingIO;
    ut = utils ?? {};
    this.baseURL = '';
    if (!this.growingIO || !this.growingIO.gioSDKInitialized) {
      consoleText(
        '未集成或未初始化加载 Gio小程序SDK! GioMarketing 加载失败！',
        'error'
      );
    } else {
      // 初始化弹窗两个store
      this.popupUserStore = new PopupUserStore(this.growingIO);
      this.popupStore = new PopupStore(this.growingIO);
      // 生成获取弹窗的请求基础地址
      this.getBaseURL();
      if (emitter) {
        // 事件监听，存储来自SDK的用户属性和自定义事件
        emitter.on('onComposeAfter', ({ composedEvent }) =>
          this.persistentEvents(composedEvent)
        );
        // 登录用户id监听，修改后要重新拉取弹窗信息
        emitter.on('USERID_UPDATE', ({ newUserId }) => {
          if (newUserId) {
            this.activateInit();
          } else {
            this.popupUserStore.set('bcs', 0);
          }
        });
      }
      // 初始化弹窗组件参数
      ut.keys(initialState).forEach((k) => {
        this[k] = initialState[k];
      });
    }
  }

  static getSingleton() {
    if (!this.singleton) {
      this.singleton = new GioMarketing();
    }
    return this.singleton;
  }

  getBaseURL = () => {
    const { vdsConfig, gioEnvironment } = this.growingIO;
    let { projectId, gtouchHost, scheme } = vdsConfig;
    if (gioEnvironment === 'saas') {
      this.baseURL = `https://messages.growingio.com/v3/${projectId}/notifications`;
    } else {
      if (!gtouchHost || !ut.isString(gtouchHost)) {
        consoleText(
          '如果您需要使用触达功能，请在 Gio小程序SDK 中配置 gtouchHost!',
          'info'
        );
      } else {
        // 协议头处理
        if (scheme) {
          if (!ut.endsWith(ut.toString(scheme), '://')) {
            scheme = `${scheme}://`;
          }
        } else {
          scheme = 'https://';
        }
        // host处理
        if (ut.startsWith(gtouchHost, 'http')) {
          gtouchHost = gtouchHost.substring(
            gtouchHost.indexOf('://') +
              (ut.endsWith(ut.toString(scheme), '://') ? 4 : 1)
          );
        }
        this.baseURL = `${scheme}${gtouchHost}/marketing/automation/v3/${projectId}/notifications`;
      }
    }
  };

  debugLog = (t) => {
    if (this.growingIO.vdsConfig.debug) {
      console.log('[GrowingIO Debug]:', JSON.stringify(t, null, 2));
    }
  };

  /**
   * 一些初始化的逻辑
   */

  // 激活一些初始化逻辑
  activateInit = () => {
    this.saveOriginData([]);
    this.isRequested = false;
    const previewStatus = this.previewVerify();
    if (!ut.isEmpty(previewStatus)) {
      this.isPreview = true;
      this.getPreviewMarketingData(previewStatus);
    } else {
      this.getMarketingData();
      // 定时半小时重新获取一次弹窗数据
      clearTimeout(this.t);
      this.t = null;
      this.t = setTimeout(() => {
        this.activateInit();
        clearTimeout(this.t);
      }, 30 * 60 * 1000);
    }
  };

  // 根据当前页面的参数判断是否为预览
  previewVerify = () => {
    const pageQeury = ut.qs.parse(
      this.growingIO.dataStore.eventHooks.currentPage.query || ''
    );
    if (pageQeury && pageQeury.scene && pageQeury.scene.gioMessageId) {
      const T_ENUM = {
        s: 'splash',
        pw: 'popupWindow',
        p: 'push',
        b: 'banner',
        ab: 'abTest'
      };
      return {
        messageId: pageQeury.scene.gioMessageId,
        msgType: T_ENUM[pageQeury.scene.mt || '']
      };
    } else {
      return {};
    }
  };

  // 销毁（恢复弹窗实例到初始状态）弹窗实例
  destroy = () => {
    ut.keys(initialState).forEach((k) => {
      this[k] = initialState[k];
    });
    this.growingIO.emitter.all.clear();
  };

  /**
   * ---用户信息及事件存储相关---
   */

  // 持久化存储事件(用户相关及自定义事件)
  persistentEvents = (evt) => {
    const type = evt.t || evt.eventType;
    switch (type) {
      case 'vst':
      case 'vstr':
      case 'ppl':
      case 'VISIT':
      case 'LOGIN_USER_ATTRIBUTES':
        this.userVariable(evt);
        break;
      case 'cstm':
      case 'CUSTOM': {
        if (this.isRequested) {
          // 弹窗数据请求完成
          if (
            !ut.isEmpty(this.originData) &&
            !ut.isEmpty(this.triggerConditions) &&
            this.triggerConditions.includes(evt.n || evt.eventName)
          ) {
            // 有进行中的弹窗且当前埋点事件名符合弹窗条件存下来消费
            this.cstmVariable(evt);
            this.consumeUnResolvedEvents(evt);
          }
          // 没有进行中的弹窗时不做任何处理
        } else {
          // 弹窗数据请求未完成时，埋点事件一律存下防止丢数
          this.cstmVariable(evt);
          this.unResolvedEvents.push(evt);
        }
        break;
      }
      default:
        break;
    }
  };

  // 用户属性存储
  userVariable = (evt) => {
    const { userId } = this.growingIO.userStore;
    const vars = evt.var || evt.attributes;
    const existingData = this.popupUserStore.get('userAttrs', userId) || [];
    let newData = [...existingData];
    if (!ut.isEmpty(vars)) {
      ut.keys(vars).forEach((vk) => {
        const idx = existingData.findIndex((item) => item.key === vk);
        if (idx !== -1) {
          newData[idx].value = vars[vk];
        } else {
          newData.push({ key: vk, value: vars[vk] });
        }
      });
      this.popupUserStore.set('userAttrs', newData, userId);
    }
  };

  // 自定义事件存储
  cstmVariable = (evt) => {
    const { userId } = this.growingIO.userStore;
    const vars = evt.var || evt.attributes;
    const existingData = this.popupUserStore.get('triggerAttrs', userId) || [];
    this.popupUserStore.set(
      'triggerAttrs',
      [
        ...existingData,
        {
          key: evt.n || evt.eventName,
          value: '',
          event_variable: vars
            ? ut.keys(vars).map((key) => ({
                key,
                value: vars[key]
              }))
            : []
        }
      ],
      userId
    );
  };

  // 持久化更新分群数据
  persistentGroupingData = ({ bu, bcs }) => {
    this.popupUserStore.set('bu', bu);
    this.popupUserStore.set('bcs', bcs);
  };

  /**
   * ---数据请求相关---
   */

  // 处理生成请求地址
  generateURL = () => {
    const {
      vdsConfig: { appId },
      userStore: { uid, userId, gioId }
    } = this.growingIO;
    const po = {
      bu: this.popupUserStore.get('bu'),
      bcs: this.popupUserStore.get('bcs'),
      u: uid,
      cs: userId,
      gioId
    };
    let url = `${this.baseURL}?url_scheme=${appId}&enableRecommend=1`;
    ut.keys(po).forEach((k) => (url += po[k] ? `&${k}=${po[k]}` : ''));
    return url;
  };

  // 获取弹窗数据（接口调用）
  getMarketingData = () => {
    const { request } = this.growingIO.minipInstance;
    request({
      url: this.generateURL(),
      header: {
        'X-Timezone': ((new Date().toString() || '').match(/GMT\+[0-9]+/g) ||
          [])[0]
      },
      success: ({ data, statusCode }) => {
        if (statusCode === 200 && !ut.isEmpty(data)) {
          this.persistentGroupingData(data.idMappings || {});
          this.isPreview = !!data.previewStatus;
          if (this.isPreview) {
            // 预览状态
            this.getPreviewMarketingData(data.previewStatus);
          } else {
            // 正式状态
            this.saveOriginData(data.popupWindows);
          }
          this.isRequested = true;
          this.consumeUnResolvedEvents();
        }
      },
      fail: () => {
        // 失败重试，最多一共请求3次
        this.retryTimes += 1;
        if (this.retryTimes < 3) {
          this.getMarketingData();
        } else {
          this.isRequested = true;
          ut.consoleText('获取弹窗数据失败！', 'error');
        }
      },
      timeout: 5000
    });
  };

  // 获取预览弹窗数据（接口调用）
  getPreviewMarketingData = ({ messageId, msgType }) => {
    const {
      vdsConfig: { appId },
      gioEnvironment,
      minipInstance: { request }
    } = this.growingIO;
    request({
      url: `${
        this.baseURL
      }/preview?url_scheme=${appId}&message_id=${messageId}&msgType=${msgType}${
        gioEnvironment === 'cdp' ? '&enableRecommend=1' : ''
      }`,
      success: ({ data, statusCode }) => {
        if (statusCode === 200 && !ut.isEmpty(data)) {
          this.persistentGroupingData(data.idMappings || {});
          this.isRequested = true;
        }
      },
      fail: () => {
        // 失败重试，最多一共请求3次
        this.retryTimes += 1;
        if (this.retryTimes < 3) {
          this.getPreviewMarketingData({ messageId, msgType });
        } else {
          this.isRequested = true;
          ut.consoleText('获取弹窗数据失败！', 'error');
        }
      },
      timeout: 5000
    });
  };

  /**
   * ---弹窗校验相关---
   */

  // 校验线上弹窗
  verifyOnline = (popupItem, event) => {
    const { userId } = this.growingIO.userStore;
    return (
      this.validAbNeedShow(popupItem) &&
      this.validTimeRange(popupItem) &&
      this.validTimes(popupItem, userId) &&
      this.validTriggerCd(popupItem, userId) &&
      this.validUserFilter(popupItem) &&
      this.validTriggerFilter(popupItem, event)
    );
  };

  // 校验预览弹窗
  verifyPreview = (popupItem, event) =>
    this.validAbNeedShow(popupItem) &&
    this.validTriggerFilter(popupItem, event);

  validAbNeedShow(popupItem) {
    const res = !(popupItem.abTest && popupItem.abTest.ctrlGroup);
    this.debugLog(`${popupItem.name} validAbNeedShow ${res}`);
    return res;
  }

  validTimeRange(popupItem) {
    const now = Date.now();
    const res =
      (popupItem.rule.startAt || 0) <= now &&
      now < (popupItem.rule.endAt || now + 1);
    this.debugLog(`${popupItem.name} validTimeRange ${res}`);
    return res;
  }

  validTimes(popupItem, cs1) {
    const showTimes = this.popupStore.get(popupItem.id, cs1).showTimes;
    const res = showTimes < popupItem.rule.limit;
    this.debugLog(`${popupItem.name} validTimes ${res}`);
    return res;
  }

  validTriggerCd(popupItem, cs1) {
    const showDate = this.popupStore.get(popupItem.id, cs1).showDate;
    const res = showDate < Date.now();
    this.debugLog(`${popupItem.name} validTriggerCd  ${res}`);
    return res;
  }

  validUserFilter(popupItem) {
    let res;
    if (
      !popupItem.rule.filters ||
      !popupItem.rule.filters.expr ||
      !popupItem.rule.filters.exprs ||
      !popupItem.rule.filters.exprs.length
    ) {
      res = true;
    } else {
      const filterMaps = this.getUserFilterMaps(popupItem.rule.filters.exprs);
      const boolExpr = this.getBoolExprs(
        filterMaps,
        popupItem.rule.filters.expr
      );
      res = parseBoolExpr(boolExpr);
    }
    this.debugLog(`${popupItem.name} validUserFilter ${res}`);
    return res;
  }

  validTriggerFilter(popupItem, event) {
    let res;
    if (
      !popupItem.rule.triggerFilter ||
      !popupItem.rule.triggerFilter.conditionExpr ||
      !popupItem.rule.triggerFilter.conditions ||
      !popupItem.rule.triggerFilter.conditions.length
    ) {
      res = true;
    } else {
      const filterMaps = this.getTriggerFilterMaps(
        event,
        popupItem.rule.triggerFilter.conditions
      );
      const boolExpr = this.getBoolExprs(
        filterMaps,
        popupItem.rule.triggerFilter.conditionExpr
      );
      res = parseBoolExpr(boolExpr);
    }
    this.debugLog(`${popupItem.name} validTriggerFilter ${res}`);
    return res;
  }

  // 合并用户属性，取最新的
  mergeUserAttrs(arr) {
    let obj = {};
    arr.forEach((item) => {
      obj[item.key] = item;
    });
    return Object.values(obj);
  }

  // 得出每一条用户属性的结果
  getUserFilterMaps(exprs) {
    const { userId } = this.growingIO.userStore;
    const userAttrs = this.mergeUserAttrs(
      this.popupUserStore.get('userAttrs', userId) || []
    );
    return exprs.map((item) => ({
      symbol: item.symbol,
      result: userAttrs.some(this.validUserFilterExpression.bind(this, item))
        ? 't'
        : 'f'
    }));
  }

  // 得出每一条事件属性的结果
  getTriggerFilterMaps(event, exprs) {
    const { userId } = this.growingIO.userStore;
    const localAttrs = this.popupUserStore.get('triggerAttrs', userId) || [];
    const key = event.eventName || event.n;
    return exprs.map((item) => {
      const triggerAttrs = localAttrs.filter((t) => t.key === item.key);
      return {
        symbol: item.alias,
        result:
          key === item.key &&
          triggerAttrs.length &&
          this.validTriggerFilterExpression(item, triggerAttrs)
            ? 't'
            : 'f'
      };
    });
  }

  // 获得布尔表达式
  getBoolExprs(filterMaps, expr) {
    return filterMaps.reduce((prev, cur) => {
      return prev.replace(new RegExp(cur.symbol, 'g'), cur.result);
    }, expr);
  }

  // 校验用户属性表达式
  validUserFilterExpression(expr, userAttr) {
    return (
      userAttr.key === expr.key && this.validExpression(userAttr.value, expr)
    );
  }

  // 校验触发事件表达式
  validTriggerFilterExpression(expr, triggerAttrs) {
    const dimFilters = expr.dimFilters || [];
    const map = {
      count: () => {
        const count = this.validDimFilters(triggerAttrs, dimFilters).length;
        return this.validExpression(count, expr);
      },
      sum: () => {
        const attribute = expr.attribute;
        if (!attribute) {
          return false;
        }
        let sum = 0;
        if (dimFilters.length) {
          const validAttrs = this.validDimFilters(triggerAttrs, dimFilters);
          sum = this.sumAttribute(validAttrs, attribute);
        } else {
          sum = this.sumAttribute(triggerAttrs, attribute);
        }
        return this.validExpression(sum, expr);
      }
    };
    return map[expr.aggregator]() || false;
  }

  // 校验事件级过滤条件dimFilters
  validDimFilters(triggerAttrs, dimFilters = []) {
    if (!dimFilters.length) {
      return triggerAttrs;
    }
    return triggerAttrs.filter((item) => {
      const properties = item.event_variable || [];
      return dimFilters.every((d) =>
        properties.some((p) => this.validExpression(p.value, d))
      );
    });
  }

  // 计算某一attribute的累计数值
  sumAttribute(triggerAttrs, attribute) {
    let sum = 0;
    triggerAttrs.forEach((item) => {
      const properties = item.event_variable || [];
      properties.forEach((p) => {
        if (p.key === attribute) {
          sum += Number(p.value) || 0;
        }
      });
    });
    return sum;
  }

  // 校验本地数据是否满足后端的表达式
  validExpression(localValue, expr) {
    let ruleValues = expr.values;
    if (expr.valueType === 'date') {
      ruleValues = ruleValues.map(formatDate);
      localValue = formatDate(localValue);
    }
    if (expr.op === '==') {
      return localValue == ruleValues[0]; // eslint-disable-line
    }
    if (expr.op === '<') {
      return localValue < ruleValues[0];
    }
    if (expr.op === '>') {
      return localValue > ruleValues[0];
    }
    if (expr.op === '<=') {
      return localValue <= ruleValues[0];
    }
    if (expr.op === '>=') {
      return localValue >= ruleValues[0];
    }
    if (expr.op === '!=') {
      return localValue != ruleValues[0]; // eslint-disable-line
    }
    if (expr.op === 'between') {
      return localValue <= ruleValues[1] && localValue >= ruleValues[0];
    }
    if (expr.op === 'in') {
      return ruleValues.find((item) => item === localValue);
    }
    if (expr.op === 'not in') {
      return !ruleValues.find((item) => item === localValue);
    }
    return false;
  }

  /**
   * 弹窗业务相关
   */

  saveOriginData = (d) => {
    // 排序保存弹窗的原始数据
    this.originData = d.sort((a, b) => b.updateAt - a.updateAt);
    // 获取所有弹窗的触发条件（事件eventId）
    this.originData.forEach((o) => {
      let conditions = [];
      if (o.rule && o.rule.triggerFilter) {
        conditions = o.rule.triggerFilter.conditions ?? [];
      }
      if (!ut.isEmpty(conditions)) {
        conditions.forEach((c) => {
          this.triggerConditions.push(c.key);
        });
      }
    });
    this.triggerConditions = Array.from(
      new Set(ut.compact(this.triggerConditions))
    );
  };

  // 消费未处理的事件
  consumeUnResolvedEvents = (event) => {
    let evt = {};
    if (!ut.isEmpty(event)) {
      this.unResolvedEvents.push(event);
    }
    if (!ut.isEmpty(this.unResolvedEvents)) {
      evt = this.unResolvedEvents.shift();
    }
    const evtn = evt.n || evt.eventName || '';
    if (
      !ut.isEmpty(evt) &&
      !this.isConsuming &&
      !ut.isEmpty(this.originData) &&
      evtn.indexOf('in_app_message_') !== 0
    ) {
      this.isConsuming = true;
      this.eventVerify(evt);
    }
  };

  // 校验获取符合条件的弹窗数据
  eventVerify = (evt) => {
    const targetPop =
      ut.head(
        this.originData.filter((o) =>
          this.isPreview
            ? this.verifyPreview(o, evt)
            : this.verifyOnline(o, evt)
        )
      ) || {};
    if (!ut.isEmpty(targetPop)) {
      // 弹窗延迟处理
      if (targetPop.rule && (targetPop.rule.triggerDelay || 0) > 0) {
        const t = setTimeout(() => {
          this.pushRenderQueue(targetPop);
          clearTimeout(t);
        }, message.rule.triggerDelay * 1000);
      } else {
        this.pushRenderQueue(targetPop);
      }
    } else {
      this.isConsuming = false;
      this.consumeUnResolvedEvents();
    }
  };

  // 置入渲染队列
  pushRenderQueue = (targetPop) => {
    this.renderQueue.push(targetPop);
    this.dispatchPopRender();
  };

  // 执行渲染队列
  dispatchPopRender = () => {
    this.isRendering = true;
    const m = this.renderQueue.shift();
    if (m && this.renderFn) {
      this.renderFn(m);
    }
  };

  // 从当前消息中读取弹窗目标配置 如果是智能弹窗，则每获取一次就将index加一
  getTargetConfig = (popupItem) => {
    if (!this.isIntelligent(popupItem)) {
      return popupItem.contentMetadata.components[0].config;
    }
    const cs1 = userStorage.get('cs1');
    const recommendDate = popupItem.contentMetadata.components[0].recommendDate;
    const recommendList = popupItem.contentMetadata.components[0].recommendList;
    const record = this.get(popupItem.id, cs1);

    // 日期变化则置为0
    if (recommendDate !== record.recommendDate) {
      record.recommendIdx = 0;
      record.recommendDate = recommendDate;
    }
    const index = record.recommendIdx % recommendList.length;
    const config = recommendList[index];

    // 递增index
    record.recommendIdx = record.recommendIdx + 1;
    this.popupStore.set(popupItem.id, cs1, record);
    return config;
  };

  // 判断是不是智能推荐弹窗
  isIntelligent = (message) => {
    const list = message.contentMetadata.components[0].recommendList;
    return ut.isArray(list) && list.length > 0;
  };

  // 上报弹窗显示事件
  trackImp = (message = {}) => {
    const {
      userStore: { userId },
      track
    } = this.growingIO;

    if (!this.isPreview) {
      track('in_app_message_imp', {
        in_app_message_name: message.name
      });
    }
    // 更新弹窗数据
    const pushState = this.popupStore.get(message.id, userId);
    pushState.showTimes += 1;
    const d = new Date(
      Date.now() + ((message.rule ? message.rule.triggerCd : 0) || 0) * 1000
    );
    d.setHours(0);
    d.setMinutes(0);
    d.setSeconds(0);
    pushState.showDate = d.getTime();
    this.popupStore.set(message.id, userId, pushState);
  };

  // 上报关闭事件
  trackClose = (message = {}) => {
    const { track } = this.growingIO;
    if (!this.isPreview) {
      track('in_app_message_close', {
        in_app_message_name: message.name
      });
    }
    // 关闭弹窗后继续渲染队列
    this.isRendering = false;
    this.dispatchPopRender();
  };

  // 弹窗点击
  handleTarget = (message) => {
    const {
      userStore: { userId },
      vdsConfig: { appId },
      track
    } = this.growingIO;
    if (!this.isPreview) {
      // 上报点击事件
      track('in_app_message_cmp_click', {
        in_app_message_name: message.name
      });
    }
    // 非智能弹窗点击后不再弹出
    if (!this.isIntelligent(message)) {
      const pushState = this.popupStore.get(message.id, userId);
      pushState.showTimes += 9999;
      this.popupStore.set(message.id, userId, pushState);
    }
    const target =
      message.targetConfig && message.targetConfig.target
        ? message.targetConfig.target[`growing.${appId}`]
        : undefined;
    if (target) {
      this.navigateDistribute(target);
    }
  };

  // 跳转分发
  navigateDistribute = (target) => {
    const { navigateToMiniProgram, navigateTo } = this.growingIO.minipInstance;
    const URL_REG = /^https?:\/\//;
    const MINP_REG = /^MINP::(.*?)::(.*)/;
    const VALID_ENV = ['develop', 'trial', 'release'];
    // 其他小程序跳转
    if (MINP_REG.test(target)) {
      const [_, appId, path] = target.match(MINP_REG);
      navigateToMiniProgram({
        appId,
        path,
        envVersion: VALID_ENV.includes(this.envVersion)
          ? this.envVersion
          : 'release'
      });
    } else {
      // 网页和小程序内其他页面跳转
      navigateTo({
        url: URL_REG.test(target) ? `${this.h5Page}?url=${target}` : target
      });
    }
  };
}
let gioMarketing;
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    h5Page: {
      type: String,
      value: '/pages/h5/h5'
    },
    envVersion: {
      type: String,
      value: 'release'
    }
  },
  /**
   * 组件的初始数据
   */
  data: {
    message: undefined,
    imageUrl: undefined,
    visible: false
  },
  /**
   * 组件的生命周期
   */
  lifetimes: {
    attached() {
      const growingIO = getGrowingIO();
      if (growingIO.gioSDKInitialized) {
        gioMarketing = GioMarketing.getSingleton();
        // 默认值赋值
        const { envVersion, h5Page } = this.properties;
        gioMarketing.envVersion = envVersion;
        gioMarketing.h5Page = h5Page;
        // 定义渲染方法
        gioMarketing.renderFn = (message) => {
          const targetConfig = gioMarketing.getTargetConfig(message);
          growingIO.minipInstance?.getImageInfo({
            src: targetConfig.src,
            success: (res) => {
              this.setData({
                message: Object.assign({ targetConfig }, message),
                visible: true,
                imageUrl: res.path
              });
              gioMarketing.trackImp(message);
            },
            fail: () => {
              gioMarketing.isRendering = false;
              gioMarketing.dispatchPopRender();
            },
            complete: () => {
              gioMarketing.isConsuming = false;
              gioMarketing.consumeUnResolvedEvents();
            }
          });
        };
        // 手动触发appOpen事件
        const appOpenEvent =
          growingIO.gioEnvironment === 'saas'
            ? {
                t: 'cstm',
                n: 'appOpen'
              }
            : {
                eventType: 'CUSTOM',
                eventName: 'appOpen'
              };
        gioMarketing.persistentEvents(appOpenEvent);
        gioMarketing.activateInit();
        consoleText('GioMarketing 初始化完成!', 'success');
      }
    },
    detached() {
      // 组件销毁时初始化数据
      this.setData({
        message: undefined,
        imageUrl: undefined,
        visible: false
      });
      // 销毁实例
      if (gioMarketing) {
        gioMarketing.destroy();
      }
      this.hideModal();
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    hideModal() {
      this.setData({ visible: false });
    },
    onClose() {
      this.hideModal();
      if (gioMarketing) gioMarketing.trackClose(this.data.message);
    },
    onTapTarget() {
      if (gioMarketing) gioMarketing.handleTarget(this.data.message);
      this.hideModal();
    }
  }
});
