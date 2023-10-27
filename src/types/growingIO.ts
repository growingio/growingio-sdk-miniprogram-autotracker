import { DataStoreType, OriginOptions } from '@@/types/dataStore';
import { MinipInstanceType } from '@@/types/minipInstance';
import { FRAMEWORKS, PLATFORMTYPES } from '@@/types/platforms';
import { PluginsType } from '@@/types/plugins';
import { UploaderType } from '@@/types/uploader';
import { UserStoreType } from '@@/types/userStore';

export interface GrowingIOType {
  // 小程序平台
  gioPlatform: PLATFORMTYPES;
  // 标记当前小程序是什么框架
  gioFramework: FRAMEWORKS;
  // 环境
  gioEnvironment: 'saas' | 'cdp';
  // sdk版本号
  sdkVersion: string;
  // 是否在小程序插件中标识
  inPlugin: boolean;
  // 分包在全局中的实例key值
  subKey?: string;
  // 小程序实例配置
  platformConfig: any;
  // sdk初始化标识
  gioSDKInitialized: boolean;
  // 所有配置项
  vdsConfig: OriginOptions;
  // 小程序实例
  minipInstance: MinipInstanceType;
  // 用户管理实例
  userStore: UserStoreType;
  // 数据管理实例
  dataStore: DataStoreType;
  // 插件管理实例
  plugins: PluginsType;
  // 上传组件实例
  uploader: UploaderType;
  // 无埋点插件实例
  eventTracking?: any;
  // 埋点插件实例
  customTracking?: any;
  // taro3中存储完整的页面节点信息
  taro3VMs?: any;
  // remax中存储页面中自定义方法信息
  remaxVMs?: any;
  // 分享数据
  shareAppMessage?: any;
  // 初始化方法
  init: (args: any) => void;
  // 注册插件
  registerPlugins?: (path?: string) => void;
  // 数据上报开关（兼容性保留，后续迭代可能会移除，建议使用setOption）
  setDataCollect: (v: boolean) => void;
  // 无埋点数据开关（兼容性保留，后续迭代可能会移除，建议使用setOption）
  setAutotrack: (v: boolean) => void;
  // 运行中修改配置
  setOption: (optionKey: string, value: any) => void;
  // 运行中获取配置
  getOption: (optionKey?: string) => any;
  // 创建自定义埋点事件
  track?: (
    name: string,
    properties: { [key: string]: string },
    items?: { key: string; id: string; attributes?: { [key: string]: string } }
  ) => void;
  // 设置登录用户Id
  setUserId?: (userId: string, userKey?: string) => void;
  // 清除登录用户Id
  clearUserId?: () => void;
  // 设置openId作为uid
  identify?: (openId: string, unionId?: string) => void;
  // 访问用户变量事件
  setVisitor?: (properties: { [key: string]: string }) => void;
  // 用户变量事件
  setUser?: (properties: { [key: string]: string }) => void;
  // 页面级变量事件
  setPage?: (properties: { [key: string]: string }) => void;
  // 变量转化事件
  setEvar?: (properties: { [key: string]: string }) => void;
  // 修改scheme方法
  setTrackerScheme?: (scheme: 'http' | 'https') => void;
  // 修改host方法
  setTrackerHost?: (host: string) => void;
  // 发送用户变量
  setUserAttributes?: (userAttributes: any) => void;
  // 手动设置位置信息
  setLocation?: (latitude: number, longitude: number) => void;
  // 初始化回调
  initCallback?: () => void;
  // 错误提示
  callError?: (fn: string, type?: boolean, msg?: string) => void;
  // 工具类
  utils?: any;
  // 事件补发逻辑
  reissueLogic?: (prevId: string, userId: string, gioId?: string) => void;
  // 事件通用维度组装
  eventContextBuilder?: (updateTime?: boolean) => any;
  // 事件转换
  eventConverter?: (event: any) => void;
  // 事件拦截器
  eventInterceptor?: (event: any) => void;
  // 设置埋点通用属性
  setGeneralProps?: (properties: any) => void;
  // 清除已设置的埋点通用属性
  clearGeneralProps?: (properties: string[] | undefined) => void;
  // 手动更新曝光监听
  updateImpression?: (collect?: any) => void;

  emitter: {
    emit?: (msg: string, args?: any) => void;
    on?: (msg: string, method: (args?: any) => any) => void;
    once?: (msg: string, method: (args?: any) => any) => void;
    off?: (msg: string, method: (args?: any) => any) => void;
  };

  App?: any;
  Page?: any;
  Component?: any;
  Behavior?: any;
  GioApp?: any;
  GioPage?: any;
  GioComponent?: any;
  GioBehavior?: any;
}
