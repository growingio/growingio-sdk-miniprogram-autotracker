// SDK系统的默认配置项
export const DEFAULT_SETTINGS = {
  // 是否开启无埋点
  autotrack: { type: 'boolean', default: true },
  // 是否开启加密压缩
  compress: { type: 'boolean', default: true },
  // 是否开启数据采集
  dataCollect: { type: 'boolean', default: true },
  // 是否开启调试模式
  debug: { type: 'boolean', default: false },
  // 是否开启
  idMapping: { type: 'boolean', default: false },
  enableIdMapping: { type: 'boolean', default: false },
  // 与内嵌页打通时额外的信息参数
  extraParams: { type: 'array', default: [] },
  // 是否开启分享跟踪
  followShare: { type: 'boolean', default: true },
  // 是否开启强制登录；多实例时仅主实例生效(其他实例无条件服从主实例)
  forceLogin: { type: 'boolean', default: false },
  // 或略上报字段
  ignoreFields: { type: 'array', default: [] },
  // 是否开启强制插件模式
  pluginMode: { type: 'boolean', default: false },
  // 是否使用原始来源信息作为访问事件的参数上报
  originalSource: { type: 'boolean', default: true },
  // session保活时长（5分钟）
  keepAlive: { type: 'number', default: 300000 },
  // 性能采集配置
  performance: { type: 'object', default: { monitor: true, exception: true } },
  // 数据上报域名
  serverUrl: { type: 'string', default: 'https://napi.growingio.com' },
  // 请求超时时长
  requestTimeout: { type: 'number', default: 5000 },
  // taro框架实例
  taro: { type: ['object', 'module'], default: false },
  // taro框架vue实例
  taroVue: { type: ['object', 'function'], default: false },
  // 淘宝小程序/小部件配置
  tbConfig: {
    type: 'object',
    default: {
      cloud: undefined,
      cloudFuncSend: false,
      cloudFuncName: 'httpTunnel',
      cloudFuncHandler: 'main',
      cloudAppId: undefined,
      path: undefined
    }
  },
  // 是否自动采集页面访问事件
  trackPage: { type: 'boolean', default: true },
  // uniapp vue实例
  uniVue: { type: ['object', 'function'], default: false },
  // 上报间隔（1秒）
  uploadInterval: { type: 'number', default: 1000 },
  // 小程序应用版本
  version: { type: 'string', default: '1.0.0' }
};

// 不管实例直接调用的方法
export const DIRECT_HANDLERS = [
  'getPlugins', // 获取所有已加载插件
  'getDeviceId', // 获取设备id
  'updateImpression' // 手动更新曝光
];

// 多实例的方法
export const INSTANCE_HANDLERS = [
  'clearGeneralProps', // 清除埋点通用属性
  'clearPageAttributes', // 清除页面属性
  'clearTrackTimer', // 清除所有事件计时器
  'clearUserId', // 清除用户id
  'getABTest', // 获取AB实验数据
  'getGioInfo', // 内嵌页打通信息
  'getOption', // 获取当前SDK配置项状态
  'identify', // 强制登录设置设备id
  'removeTimer', // 移除事件计时器
  'sendPage', // 手动发page事件
  'sendVisit', // 手动发visit事件
  'setGeneralProps', // 设置埋点通用属性
  'setLocation', // 手动设置位置信息
  'setOption', // 设置配置项
  'setPageAttributes', // 设置页面属性
  'setUserAttributes', // 设置用户属性
  'setUserId', // 设置用户id
  'track', // 上报埋点
  'trackTimerEnd', // 停止事件计时器并上报事件
  'trackTimerPause', // 暂停事件计时器
  'trackTimerResume', // 恢复事件计时器
  'trackTimerStart' // 初始化事件计时器
];

// 直接调用的通用方法
export const HANDLERS = [
  'init', // 初始化SDK
  'registerPlugins', // 手动注册插件
  ...DIRECT_HANDLERS,
  ...INSTANCE_HANDLERS
];

// 允许通过setOption修改的配置项
export const ALLOW_SET_OPTIONS = {
  autotrack: '无埋点',
  dataCollect: '数据采集',
  debug: '调试模式',
  serverUrl: '数据上报服务地址'
};

// 已废弃方法
export const DEPRECATED_HANDLERS = [
  'enableDebug', // 4.0废弃
  'setAutotrack', // 4.0废弃
  'setDataCollect', // 4.0废弃
  'setTrackerHost', // 4.0废弃
  'setTrackerScheme', // 4.0废弃
  'setConfig', // 3.8重构时废弃，原因：太多的客户以为是修改配置的接口导致用错
  'collectImp', // 3.8重构时废弃，原因：重构时在页面onShow/onReady是自动注册
  'setPlatformProfile', // 3.8重构时废弃，原因：使用setUserAttributes代替
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

// 额外打通的字段
export const EXTRA_INFO_PARAMS: string[] = [
  ...IGNORE_PARAMS,
  'appChannel',
  'language',
  'platformVersion'
];

// 小程序平台
export const PLATFORMTYPES = [
  'wx',
  'my',
  'swan',
  'qq',
  'tt',
  'ks',
  'jd',
  'xhs',
  'quickapp'
];

// 各个需要拼接的在存储中的key后缀
export const STORAGE_KEYS: any = {
  gsid: '_growing_gsid_',
  originalSource: '_gdp_original_source_',
  userId: '_growing_userId_',
  userKey: '_growing_userKey_',
  gioId: '_growing_gioId_',
  plugin_gsid: '_growing_plugin_gsid_',
  plugin_originalSource: '_gdp_plugin_original_source_',
  plugin_userId: '_growing_plugin_userId_',
  plugin_userKey: '_growing_plugin_userKey_',
  plugin_gioId: '_growing_plugin_gioId_'
};
