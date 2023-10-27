export const SAAS_ACTIONS = [
  'page',
  'vst',
  'cstm',
  'clck',
  'lngprss',
  'vstr',
  'pvar',
  'evar',
  'ppl',
  'sbmt',
  'chng',
  'cls'
];

export const CDP_ACTIONS = [
  'VISIT',
  'PAGE',
  'CUSTOM',
  'VISITOR_ATTRIBUTES',
  'LOGIN_USER_ATTRIBUTES',
  'APP_CLOSED',
  'VIEW_CLICK',
  'VIEW_CHANGE',
  'FORM_SUBMIT'
];

export const EVENTS_CORRESPOND = {
  VISIT: 'vst',
  PAGE: 'page',
  CUSTOM: 'cstm',
  VISITOR_ATTRIBUTES: '',
  LOGIN_USER_ATTRIBUTES: '',
  APP_CLOSED: 'cls',
  VIEW_CLICK: 'clck',
  VIEW_CHANGE: 'chng',
  FORM_SUBMIT: 'sbmt'
};

export const ATTRIBUTES_CORRESPOND = {
  appChannel: 'ch',
  appVersion: 'cv',
  attributes: 'var',
  dataSourceId: undefined,
  deviceBrand: 'db',
  deviceId: 'u',
  deviceModel: 'dm',
  domain: 'd',
  element: 'e',
  eventName: 'n',
  eventType: 't',
  // !saas中全局事件计数字段名字叫esid，但是实际值是SDK中的gsid
  globalSequenceId: 'esid',
  hyperlink: 'h',
  index: 'idx',
  language: 'l',
  latitude: 'lat',
  longitude: 'lng',
  networkState: 'nt',
  operatingSystem: 'os',
  pageShowTimestamp: 'ptm',
  path: 'p',
  platform: 'b',
  platformVersion: 'osv',
  properties: 'var',
  query: 'q',
  referralPage: 'rp',
  screenHeight: 'sh',
  screenWidth: 'sw',
  sdkVersion: 'av',
  sessionId: 's',
  textValue: 'v',
  timestamp: 'tm',
  title: 'tl',
  userId: 'cs1',
  userKey: undefined,
  xpath: 'x'
};
