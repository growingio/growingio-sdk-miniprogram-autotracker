/**
 * 平台类型定义
 * @typedef {'MinP' | 'alip' | 'tbp' | 'baidup' | 'qq' | 'bytedance' | 'kuaishoup' | 'jdp' | 'xhsp' | 'quickapp'} PLATFORMS
 */
export type PLATFORMS =
  | 'MinP'
  | 'alip'
  | 'tbp'
  | 'baidup'
  | 'qq'
  | 'bytedance'
  | 'kuaishoup'
  | 'jdp'
  | 'xhsp'
  | 'quickapp';

/**
 * 平台缩写类型定义
 * @typedef {'wx' | 'my' | 'tb' | 'swan' | 'qq' | 'tt' | 'ks' | 'jd' | 'xhs' | 'quickapp'} PLATFORMTYPES
 */
export type PLATFORMTYPES =
  | 'wx'
  | 'my'
  | 'tb'
  | 'swan'
  | 'qq'
  | 'tt'
  | 'ks'
  | 'jd'
  | 'xhs'
  | 'quickapp';

/**
 * 框架类型定义
 * @typedef {'taro' | 'uniapp' | 'full'} FRAMEWORKS
 */
export type FRAMEWORKS = 'taro' | 'uniapp' | 'full';

/**
 * 平台配置接口
 * @interface PlatformConfigType
 */
export interface PlatformConfigType {
  /** 平台名称 */
  name?: string;
  /** 平台类型 */
  platform?: PLATFORMS;
  /** 场景值前缀 */
  scnPrefix?: string;
  /** App 生命周期处理函数名列表 */
  appHandlers?: string[];
  /** Page 生命周期处理函数名列表 */
  pageHandlers?: string[];
  /** 分享事件类型列表 */
  shareEventTypes?: string[];
  /** 动作事件类型列表 */
  actionEventTypes?: string[];
  /** 是否需要 Hook 各类构造器 */
  hooks?: {
    App: boolean;
    Page: boolean;
    Component: boolean;
    Behavior: boolean;
  };
  /** 是否可以 Hook */
  canHook: boolean;
  /** 生命周期监听器配置 */
  listeners?: {
    app: {
      appLaunch: string;
      appShow: string;
      appClose: string;
    };
    page: {
      pageLoad: string;
      pageShow: string;
      pageReady: string;
      pageHide: string;
      pageUnload: string;
      tabTap: string;
      shareApp: string;
      shareTime?: string;
      addFavorites?: string;
    };
    actions: {
      click: string[];
      change: string[];
      submit: string[];
    };
  };
}
