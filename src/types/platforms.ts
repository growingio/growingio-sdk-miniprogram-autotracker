export type PLATFORMS =
  | 'MinP'
  | 'alip'
  | 'baidup'
  | 'qq'
  | 'bytedance'
  | 'kuaishoup'
  | 'jdp'
  | 'quickapp';
export type PLATFORMTYPES =
  | 'wx'
  | 'my'
  | 'swan'
  | 'qq'
  | 'tt'
  | 'ks'
  | 'jd'
  | 'quickapp';

export type FRAMEWORKS =
  | 'chameleon'
  | 'remax'
  | 'taro'
  | 'uniapp'
  | 'wepy'
  | 'full';

export interface PlatformConfigType {
  name?: string;
  platform?: PLATFORMS;
  scnPrefix?: string;
  appHandlers?: string[];
  pageHandlers?: string[];
  actionEventTypes?: string[];
  originalPage?: (any) => any;
  originalApp?: (any) => any;
  originalComponent?: (any) => any;
  originalBehavior?: (any) => any;
  hooks?: {
    App: boolean;
    Page: boolean;
    Component: boolean;
    Behavior: boolean;
  };
  canHook: boolean;
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
