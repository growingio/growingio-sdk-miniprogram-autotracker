import { PlatformConfigType } from '@@/types/platforms';
import { niceTry } from '@@/utils/tools';

const Config: PlatformConfigType = {
  scnPrefix: '',
  appHandlers: [
    'onLaunch',
    'onShow',
    'onHide',
    'onError', // 实际sdk不会执行，但需要写在hook里，防止被归为自定义事件
    'onPageNotFound', // 实际sdk不会执行，但需要写在hook里，防止被归为自定义事件
    'onUnhandledRejection', // 实际sdk不会执行，但需要写在hook里，防止被归为自定义事件
    'onThemeChange' // 实际sdk不会执行，但需要写在hook里，防止被归为自定义事件
  ],
  pageHandlers: [
    'onLoad',
    'onShow',
    'onReady',
    'onHide',
    'onShareAppMessage',
    'onTabItemTap',
    'onUnload', // 实际sdk不会执行，但需要写在hook里，防止被归为自定义事件
    'onPullDownRefresh', // 实际sdk不会执行，但需要写在hook里，防止被归为自定义事件
    'onReachBottom', // 实际sdk不会执行，但需要写在hook里，防止被归为自定义事件
    'onResize' // 实际sdk不会执行，但需要写在hook里，防止被归为自定义事件
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
    'contact',
    'mouseup'
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
        'contact',
        'mouseup'
      ],
      change: ['blur', 'change', 'confirm'],
      submit: ['submit']
    }
  }
};

export default Config;
