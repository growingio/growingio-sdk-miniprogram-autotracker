interface TBConfig {
  cloudFuncSend?: boolean;
  cloudFuncName?: string;
  cloudFuncHandler?: string;
  cloudAppId?: string;
  path?: string;
}
export interface UserOptions {
  autotrack?: boolean;
  cml?: any;
  compress?: boolean;
  dataCollect?: boolean;
  debug?: boolean;
  enableIdMapping?: boolean;
  extraParams?: string[];
  followShare?: boolean;
  forceLogin?: boolean;
  host?: string;
  ignoreFields?: string[];
  keepAlive?: number;
  octopus?: any;
  remax?: boolean;
  scheme?: 'https' | 'http' | string;
  subpackage?: boolean;
  taro?: any;
  taroVue?: any;
  tbConfig?: TBConfig;
  uniVue?: any;
  uploadInterval?: number;
  version?: string;
  wepy?: any;
  performance?: {
    monitor?: boolean;
    exception?: boolean;
    network?: boolean | { exclude?: RegExp | string | any[] };
  };
}

export interface ErrorEventParams {
  key?: string;
  error: string;
  page?: string;
  function?: string;
}

export interface Element {
  x: string;
  v?: string;
  h?: string;
  idx?: number;
  obj?: number;
}

export type SaasEventTypes =
  | 'page'
  | 'vst'
  | 'cstm'
  | 'clck'
  | 'vstr'
  | 'pvar'
  | 'evar'
  | 'ppl'
  | 'sbmt'
  | 'chng'
  | 'cls';

export interface SaasEvent {
  av: string;
  ch: string;
  cs1?: string;
  cv: string;
  d: string;
  db: string;
  dm: string;
  e?: Element[];
  esid: number;
  l: string;
  lat: number;
  lng: number;
  n: string;
  nt: string;
  os: string;
  osv: string;
  p?: string;
  ph?: string;
  ptm: number;
  q?: string;
  rp?: string;
  s: string;
  sh: number;
  sw: number;
  t: SaasEventTypes;
  tl: string;
  tm: number;
  u: string;
  var?: {
    [key: string]: string;
  };
}

export type CdpEventTypes =
  | 'PAGE'
  | 'VISIT'
  | 'CUSTOM'
  | 'VISITOR_ATTRIBUTES'
  | 'LOGIN_USER_ATTRIBUTES'
  | 'APP_CLOSED'
  | 'VIEW_CLICK'
  | 'VIEW_CHANGE'
  | 'FORM_SUBMIT';

export interface CdpEvent {
  appChannel: string;
  appVersion: string;
  attributes?: any;
  dataSourceId: string;
  deviceBrand: string;
  deviceId: string;
  deviceModel: string;
  deviceType: string;
  domain: string;
  eventName: string;
  eventType: CdpEventTypes;
  globalSequenceId: number;
  hyperlink?: string;
  index?: number;
  language: string;
  latitude?: number;
  longitude?: number;
  networkState: string;
  pageShowTimestamp?: number;
  path?: string;
  platform: string;
  platformVersion: string;
  properties?: any;
  query?: string;
  referralPage?: string;
  screenHeight: number;
  screenWidth: number;
  sdkVersion: string;
  sessionId: string;
  textValue?: string;
  timestamp: number;
  title: string;
  userId?: string;
  xpath?: string;
}

export type Actions =
  | 'tap'
  | 'longpress'
  | 'longtap'
  | 'change'
  | 'confirm'
  | 'blur'
  | 'getphonenumber'
  | 'contact'
  | 'submit'
  | 'getuserinfo';

export interface EventTarget {
  type: Actions;
  currentTarget: {
    id: string;
    dataset: {
      index: number | string;
      src: string;
      title: string;
      growingTrack: boolean;
      growingtrack: boolean;
      growingIgnore: boolean;
    };
  };
  target: {
    id: string;
    dataset: {
      index: number | string;
      src: string;
      title: string;
      growingTrack: boolean;
      growingtrack: boolean;
      growingIgnore: boolean;
    };
  };
  detail: any;
  handler: string | undefined;
}
