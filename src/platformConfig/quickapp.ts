const QuickAppConfig = {
  name: 'QuickApp',
  platform: 'quickapp',
  scnPrefix: 'quickapp_',
  appHandlers: ['onCreate', 'onShow', 'onHide', 'onDestroy', 'onError'],
  pageHandlers: [
    'onInit',
    'onReady',
    'onShow',
    'onHide',
    'onDestroy',
    'onMenuPress',
    'onShareAppMessage'
  ],
  actionEventTypes: ['click', 'longpress', 'blur', 'change'],
  canHook: false,
  hooks: {
    App: false,
    Page: false,
    Component: false,
    Behavior: false
  },
  listeners: {
    app: {
      appCreate: 'onCreate',
      appShow: 'onShow',
      appHide: 'onHide',
      appClose: 'onDestroy'
    },
    page: {
      pageLoad: 'onInit',
      pageReady: 'onReady',
      pageShow: 'onShow',
      pageHide: 'onHide',
      pageClose: 'onDestroy',
      menuPress: 'onMenuPress',
      tabTap: undefined,
      shareApp: 'onShareAppMessage'
    },
    actions: {
      click: ['click', 'longpress'],
      change: ['blur', 'change'],
      submit: []
    }
  }
};

export default QuickAppConfig;
