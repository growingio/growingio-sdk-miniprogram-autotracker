import { PlatformConfigType } from '@@/types/platforms';
import { niceTry } from '@@/utils/tools';

const Config: PlatformConfigType = {
  scnPrefix: '',
  appHandlers: ['onLaunch', 'onShow', 'onHide', 'onError', 'onPageNotFound'],
  pageHandlers: [
    'onLoad',
    'onShow',
    'onReady',
    'onHide',
    'onUnload',
    'onShareAppMessage',
    'onTabItemTap'
  ],
  actionEventTypes: [
    'onclick',
    'tap',
    'onTap',
    'longpress',
    'longTap',
    'blur',
    'change',
    'onChange',
    'submit',
    'confirm',
    'getuserinfo',
    'getphonenumber',
    'contact'
  ],
  originalApp: niceTry(() => App),
  originalPage: niceTry(() => Page),
  originalComponent: niceTry(() => Component),
  originalBehavior: niceTry(() => Behavior),
  canHook: true,
  hooks: {
    App: true,
    Page: true,
    Component: true,
    Behavior: true
  },
  listeners: {
    app: {
      appLaunch: 'onLaunch',
      appShow: 'onShow',
      appClose: 'onHide'
    },
    page: {
      pageLoad: 'onLoad',
      pageShow: 'onShow',
      pageReady: 'onReady',
      pageHide: 'onHide',
      pageUnload: 'onUnload',
      tabTap: 'onTabItemTap',
      shareApp: 'onShareAppMessage'
    },
    actions: {
      click: [
        'onclick',
        'tap',
        'longpress',
        'longTap',
        'getuserinfo',
        'getphonenumber',
        'contact'
      ],
      change: ['blur', 'change', 'confirm'],
      submit: ['submit']
    }
  }
};

export default Config;
