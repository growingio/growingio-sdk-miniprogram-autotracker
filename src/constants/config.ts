export const PLATFORMTYPES = ['wx', 'my', 'swan', 'qq', 'tt', 'quickapp'];

// SDK系统的默认配置项
export const DEFAULT_SETTING = {
  // 无埋点开关
  autotrack: { type: 'boolean', default: true },
  // Cameleon框架实例
  cml: { type: 'object', default: false },
  // 数据采集开关
  dataCollect: { type: 'boolean', default: true },
  // 调试开关
  debug: { type: 'boolean', default: false },
  // 分享跟踪开关
  followShare: { type: 'boolean', default: true },
  // 强制登录开关
  forceLogin: { type: 'boolean', default: false },
  // 分包标记开关
  subpackage: { type: 'boolean', default: false },
  // 访问间隔时长
  keepAlive: { type: 'number', default: 300000 },
  // remax框架实例
  remax: { type: ['object', 'module'], default: false },
  // taro框架实例
  taro: { type: ['object', 'module'], default: false },
  // taroVue实例
  taroVue: { type: ['object', 'function'], default: false },
  // 淘宝小程序配置项
  tbConfig: {
    type: 'object',
    default: {
      cloudFuncSend: false,
      cloudFuncName: 'httpTunnel',
      cloudFuncHandler: 'main',
      cloudAppId: undefined,
      path: undefined
    }
  },
  // uniappVue实例
  uniVue: { type: ['object', 'function'], default: false },
  // 小程序应用版本
  version: { type: 'string', default: '1.0.0' },
  // wepy框架实例
  wepy: { type: 'function', default: false }
};

// CDP的默认配置项
export const CDP_SETTING = {
  // 数据加密开关
  compress: { type: 'boolean', default: true },
  // 多身份用户上报开关
  enableIdMapping: { type: 'boolean', default: false },
  // 打通内嵌页额外参数
  extraParams: { type: 'array', default: [] },
  // 弹窗拉取数据host
  gtouchHost: { type: 'string', default: 'cdp.growingio.com' },
  // 数据上报地址
  host: { type: 'string', default: 'napi.growingio.com' }, // 默认为新saas的上报地址
  // 忽略上报字段
  ignoreFields: { type: 'array', default: [] },
  // 网络协议
  scheme: { type: 'string', default: 'https' },
  // 上报间隔
  uploadInterval: { type: 'number', default: 1000 },
  // 性能监控配置项
  performance: { type: 'object', default: { monitor: true, exception: true } }
};

// Saas的默认配置项
export const SAAS_SETTING = {};

// 通过gio(xxxx)允许调用的通用方法
export const uniHandlers = [
  'clearUserId',
  'enableDebug', // 兼容性保留，后续迭代可能会移除
  'getGioInfo',
  'getOption',
  'identify',
  'init',
  'setAutotrack', // 兼容性保留，后续迭代可能会移除
  'setDataCollect', // 兼容性保留，后续迭代可能会移除
  'setOption',
  'setUserId',
  'track',
  'setLocation', // 手动设置位置信息（2022/4/29新增api，原getLocation废弃）
  'setGeneralProps', // 设置埋点通用属性
  'clearGeneralProps', // 移除埋点通用属性
  'setPageAttributes', // 设置页面属性
  'updateImpression' // 手动更新曝光监听
];

// saas中通过gio(xxxx)允许调用的方法
export const SaasHandlers = [
  ...uniHandlers,
  'setEvar',
  'setPage',
  'setUser',
  'setVisitor'
];

// cdp中通过gio(xxxx)允许调用的方法
export const CdpHandlers = [
  ...uniHandlers,
  'setTrackerHost', // 兼容性保留，后续迭代可能会移除
  'setTrackerScheme', // 兼容性保留，后续迭代可能会移除
  'setUserAttributes', // 兼容性保留，后续迭代可能会移除
  'registerPlugins', // 手动注册插件
  'getDeviceId', // 获取deviceId（uId）（2022/5/13新增api）
  'trackTimerStart', // 初始化事件计时器
  'trackTimerPause', // 暂停事件计时器
  'trackTimerResume', // 恢复事件计时器
  'trackTimerEnd', // 停止事件计时器并上报事件
  'removeTimer', // 移除事件计时器
  'clearTrackTimer' // 清除所有事件计时器
];

// 允许通过setOption修改的配置项
export const allowOptions = [
  'autotrack',
  'dataCollect',
  'debug',
  'host',
  'scheme'
];

// 允许通过setOption修改的配置项枚举
export const OPTIONS_ENUM = {
  autotrack: '无埋点',
  dataCollect: '数据采集',
  debug: '调试模式'
};

// 已废弃方法
export const deprecatedHandlers = [
  'setConfig', // 重构时废弃，原因：太多的客户以为是修改配置的接口导致用错
  'collectImp', // 重构时废弃，原因：重构时在页面onShow/onReady是自动注册
  'setPlatformProfile', // 重构时废弃，原因：使用setUserAttributes代替
  'getLocation' // 2022/4/29废弃，原因：https://developers.weixin.qq.com/community/develop/doc/000e8ccb5ac498318cbd26c495bc01 ；https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.getLocation.html
];

// 允许忽略的上报字段
export const IGNORE_PARAMS = [
  'deviceBrand',
  'deviceModel',
  'deviceType',
  'networkState',
  'screenHeight',
  'screenWidth',
  'operatingSystem'
];

// cdp中额外打通的字段
export const EXTRA_INFO_PARAMS: string[] = [
  ...IGNORE_PARAMS,
  'appChannel',
  'language',
  'platformVersion'
];
