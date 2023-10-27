// GioBanner 重构版适配3.8+小程序SDK的资源位SDK
const getGlobal = () => {
  try {
    return $global;
  } catch (error) {
    return global;
  }
};

getGlobal().gTouchVersion = '__GTOUCH_VERSION__';

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
class BannerUserStore {
  constructor(growingIO) {
    this.getStorageSync = growingIO.minipInstance.getStorageSync;
    this.setStorageSync = growingIO.minipInstance.setStorageSync;
  }

  get = (key, cs1) => {
    const v =
      this.getStorageSync(`${userSpace}#${key}${cs1 ? '#' + cs1 : ''}`) || {};
    if (Date.now() <= v.startAt + ud) {
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

// 资源位信息存取
const pushSpace = 'gio-banner';
class BannerStore {
  constructor(growingIO) {
    this.getStorageSync = growingIO.minipInstance.getStorageSync;
    this.setStorageSync = growingIO.minipInstance.setStorageSync;
  }

  get = (bannerKey, cs1) =>
    this.getStorageSync(`#${pushSpace}#${bannerKey}#${cs1 || ''}`) || [];

  set = (bannerKey, cs1, value) => {
    this.setStorageSync(`#${pushSpace}#${bannerKey}#${cs1 || ''}`, value);
  };
}

const defaultData = {
  id: 'default',
  content: '',
  name: 'default',
  rule: {
    target: ''
  }
};

const initialState = {
  // 资源位唯一标识
  bannerKey: '',
  // 获取资源位数据重试计数
  retryTimes: 0,
  // 从接口获取的按更新时间排序后的原始数据
  originData: [],
  // 记录已曝光图片
  trackedImg: [],
  // 渲染回调(组件方法)
  renderFn: undefined
};

let ut;
class GioBanner {
  constructor() {
    consoleText('GioBanner 初始化中...', 'info');
    this.growingIO = getGrowingIO();
    const { emitter, utils } = this.growingIO;
    ut = utils ?? {};
    this.baseURL = '';
    if (!this.growingIO || !this.growingIO.gioSDKInitialized) {
      consoleText(
        '未集成或未初始化加载 Gio小程序SDK! GioBanner 加载失败！',
        'error'
      );
    } else {
      this.bannerUserStore = new BannerUserStore(this.growingIO);
      this.bannerStore = new BannerStore(this.growingIO);
      // 生成获取弹窗的请求基础地址
      this.getBaseUrl();
      if (emitter) {
        // 登录用户id监听，修改后要重新拉取弹窗信息
        emitter.on('USERID_UPDATE', ({ newUserId }) => {
          if (newUserId) {
            this.activateInit();
          } else {
            this.bannerUserStore.set('bcs', 0);
          }
        });
      }
      // 初始化banner参数
      ut.keys(initialState).forEach((k) => {
        this[k] = initialState[k];
      });
    }
  }

  static getSingleton = () => {
    if (!this.singleton) {
      this.singleton = new GioBanner();
    }
    return this.singleton;
  };

  getBaseUrl = () => {
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
          if (!ut.endsWith(toString(scheme), '://')) {
            scheme = `${scheme}://`;
          }
        } else {
          scheme = 'https://';
        }
        // host处理
        if (ut.startsWith(gtouchHost, 'http')) {
          gtouchHost = gtouchHost.substring(
            gtouchHost.indexOf('://') +
              (ut.endsWith(toString(scheme), '://') ? 4 : 1)
          );
        }
        this.baseURL = `${scheme}${gtouchHost}/marketing/automation/v3/${projectId}/notifications`;
      }
    }
  };

  /**
   * 一些初始化的逻辑
   */

  // 激活一些初始化逻辑
  activateInit = () => {
    this.saveOriginData([]);
    this.getBannerData();
    // 定时半小时重新获取一次资源位数据
    clearTimeout(this.t);
    this.t = null;
    this.t = setTimeout(() => {
      this.activateInit();
      clearTimeout(this.t);
    }, 30 * 60 * 1000);
  };

  // 销毁（恢复资源位实例到初始状态）资源位实例
  destroy = () => {
    ut.keys(initialState).forEach((k) => {
      this[k] = initialState[k];
    });
    this.growingIO.emitter.all.clear();
  };

  /**
   * ---用户信息及事件存储相关---
   */

  // 持久化更新分群数据
  persistentGroupingData = ({ bu, bcs }) => {
    this.bannerUserStore.set('bu', bu);
    this.bannerUserStore.set('bcs', bcs);
  };

  /**
   * ---数据请求相关---
   */

  // 处理生成请求地址
  generateURL = () => {
    const {
      vdsConfig: { appId },
      userStore: { uid, userId }
    } = this.growingIO;
    const bu = this.bannerUserStore.get('bu');
    const bcs = this.bannerUserStore.get('bcs');
    let url = `${this.baseURL}?url_scheme=${appId}`;
    url += bu ? `&bu=${bu}` : uid ? `&u=${uid}` : '';
    url += bcs ? `&bcs=${bcs}` : userId ? `&cs=${userId}` : '';
    return url;
  };

  // 获取资源位数据（接口调用）
  getBannerData = (fn) => {
    const { request } = this.growingIO.minipInstance;
    if (!fn) {
      this.abnormalRender();
    }
    request({
      url: this.generateURL(),
      header: {
        'X-Timezone': ((new Date().toString() || '').match(/GMT\+[0-9]+/g) ||
          [])[0]
      },
      success: ({ data, statusCode }) => {
        if (statusCode === 200 && !ut.isEmpty(data)) {
          this.persistentGroupingData(data.idMappings || {});
          this.saveOriginData(data.banners);
          if (ut.isFunction(fn)) {
            fn(this.originData);
          }
        }
      },
      fail: () => {
        // 失败重试，最多一共请求3次
        this.retryTimes += 1;
        if (this.retryTimes < 3) {
          this.getBannerData();
        } else if (!fn) {
          this.abnormalRender('error');
        }
      },
      timeout: 5000
    });
  };

  /**
   * 资源位业务相关
   */

  // 保存资源位原始数据
  saveOriginData = (banners) => {
    if (ut.isArray(banners) && !ut.isEmpty(banners)) {
      const originData = banners.find((b) => b.key === this.bannerKey);
      if (!ut.isEmpty(originData) && !ut.isArray(originData.messages)) {
        const validItems = (originData.messages || [])
          // 先过滤在生效时间内的数据
          .filter((o) => this.verifyTimeRange(o))
          // 按序号排序
          .sort((a, b) => this.verifySorter(a, b))
          // 过滤重复序号
          .filter((o, i, t) => t.indexOf(o) === i);
        originData.messages = validItems;
      }
      this.originData = originData ?? {};
      if (this.renderFn && !ut.isEmpty(this.originData)) {
        this.renderFn(this.originData.messages);
        const { userId } = this.growingIO.userStore;
        this.bannerStore.set(this.bannerKey, userId, this.originData.messages);
      }
    }
  };

  // 校验过滤在生效时间内项
  verifyTimeRange = (item) => {
    const now = Date.now();
    return (
      (item.rule.startAt || 0) <= now && now < (item.rule.endAt || now + 1)
    );
  };

  // 根据条件排序
  verifySorter(a, b) {
    if (a.index !== b.index) {
      return a.index - b.index;
    }
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return b.updateAt - a.updateAt;
  }

  // 非正常渲染（占位、错误）
  abnormalRender = (type = 'default') => {
    const { userId } = this.growingIO.userStore;
    const localData = this.bannerStore.get(this.bannerKey, userId);
    // 优先取本地缓存的数据渲染
    if (this.renderFn) {
      if (!ut.isEmpty(localData)) {
        this.renderFn(localData);
      } else {
        this.renderFn([
          {
            ...defaultData,
            id: 'gioDefault',
            name: 'gioDefault',
            content:
              (type === 'default'
                ? this.placeholderDrawable
                : this.errorReplaceDrawable) || ''
          }
        ]);
      }
    }
  };

  // 生成埋点参数
  gatherTrackParams = (message) => {
    return {
      in_app_message_name: message.name,
      gio_message_type: 'banner',
      gio_message_id: message.id,
      gio_message_index: message.index,
      gio_campaign_key: this.bannerKey
    };
  };

  // 切换图片事件
  handleChange = (e) => {
    let current;
    if (ut.has(e.detail, 'current')) {
      current = e.detail.current;
    } else {
      current = e.target.dataset.current;
    }
    if (ut.isNumber(current)) {
      if (!this.trackedImg.includes(current) && this.originData?.messages) {
        const swipeItem = this.originData.messages[current];
        this.growingIO.track(
          'in_app_message_imp',
          this.gatherTrackParams(swipeItem)
        );
        this.trackedImg.push(current);
      }
    }
  };

  // 图片点击事件
  handleTarget = (e) => {
    const swipeItem = e.target.dataset.message;
    if (!swipeItem || swipeItem.id === 'gioDefault') {
      return;
    }
    this.growingIO.track(
      'in_app_message_cmp_click',
      this.gatherTrackParams(swipeItem)
    );
    if (swipeItem.rule.target) {
      this.navigateDistribute(swipeItem.rule.target);
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

let gioBanner;

// 开放请求API，供用户自渲染
getGlobal().getBannerMessages = (bannerKey) => {
  if (bannerKey) {
    const growingIO = getGrowingIO();
    gioBanner = GioBanner.getSingleton();
    gioBanner.bannerKey = bannerKey;
    if (growingIO.gioSDKInitialized) {
      const api = new Promise((resolve) => {
        gioBanner.getBannerData((bannerData) => {
          if (
            ut.isArray(bannerData.messages) &&
            !ut.isEmpty(bannerData.messages)
          ) {
            resolve({
              ...bannerData,
              messages: bannerData.messages.map((o) => ({
                id: o.id,
                index: o.index,
                name: o.name || '',
                imageUrl: o.content || '',
                summary: o.summary || '',
                params: o.bannerParamConfig || [],
                onShow() {
                  gioBanner.onTrackImp(o);
                },
                onClick() {
                  gioBanner.onClickTarget(o);
                }
              }))
            });
          } else {
            resolve({ ...bannerData, messages: [] });
          }
        });
      });
      consoleText('GioBanner 初始化完成!', 'success');
      return api;
    }
  } else {
    consoleText('GioBanner 初始化失败！请填写 bannerKey!', 'error');
  }
};

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // bannerKey 必填
    bannerKey: String,
    // 是否显示面板指示点
    indicatorDots: {
      type: Boolean,
      value: true
    },
    // 指示点颜色
    indicatorColor: {
      type: String,
      value: 'rgba(0,0,0,0.3)'
    },
    // 当前选中的指示点颜色
    indicatorActiveColor: {
      type: String,
      value: '#000'
    },
    // 是否自动切换
    autoplay: {
      type: Boolean,
      value: true
    },
    // 自动切换时间间隔
    interval: {
      type: Number,
      value: 5000
    },
    // 滑动动画时长
    duration: {
      type: Number,
      value: 500
    },
    // 是否采用衔接滑动
    circular: {
      type: Boolean,
      value: true
    },
    // 滑动方向
    vertical: {
      type: Boolean,
      value: false
    },
    // 前边距
    previousMargin: {
      type: String,
      value: '0px'
    },
    // 后边距
    nextMargin: {
      type: String,
      value: '0px'
    },
    // 切换缓动动画类型
    easingFunction: {
      type: String,
      value: 'default'
    },
    // 默认占位图
    placeholderDrawable: String,
    // 出错时的占位图
    errorReplaceDrawable: String,
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
    banners: undefined
  },
  /**
   * 组件的生命周期
   */
  lifetimes: {
    attached() {
      const growingIO = getGrowingIO();
      if (growingIO.gioSDKInitialized) {
        gioBanner = GioBanner.getSingleton();
        const {
          bannerKey,
          placeholderDrawable,
          errorReplaceDrawable,
          h5Page,
          envVersion
        } = this.properties;
        gioBanner.bannerKey = bannerKey;
        gioBanner.h5Page = h5Page;
        gioBanner.envVersion = envVersion;
        gioBanner.placeholderDrawable = placeholderDrawable;
        gioBanner.errorReplaceDrawable = errorReplaceDrawable;
        gioBanner.renderFn = (banners) => {
          this.setData({ banners });
        };
        if (bannerKey) {
          gioBanner.activateInit();
          consoleText('GioBanner 初始化完成!', 'success');
        } else {
          consoleText('GioBanner 初始化失败！请填写 bannerKey!', 'error');
        }
      }
    },
    detached() {
      // 组件销毁时初始化数据
      this.setData({
        banners: undefined
      });
      // 销毁实例
      if (gioBanner) {
        gioBanner.destroy();
      }
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    onImgLoad(e) {
      // 首张图片的第一次曝光事件
      if (e.target.dataset.current === 0 && gioBanner) {
        gioBanner.handleChange(e);
      }
    },
    onChange(e) {
      if (gioBanner) gioBanner.handleChange(e);
    },
    onTapTarget(e) {
      if (gioBanner) gioBanner.handleTarget(e);
    }
  }
});
