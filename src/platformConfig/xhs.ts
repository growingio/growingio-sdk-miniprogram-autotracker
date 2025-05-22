import BaseConfig from './base';

const XHSConfig = {
  ...BaseConfig,
  pageHandlers: [
    ...BaseConfig.pageHandlers,
    'onShareChat',
    'onCopyUrl',
    'onShareAppMessage',
    'onShareTimeline'
  ],
  shareEventTypes: [...BaseConfig.shareEventTypes, 'onShareChat', 'onCopyUrl'],
  listeners: {
    ...BaseConfig.listeners,
    page: {
      ...BaseConfig.listeners.page,
      shareTime: 'onShareTimeline',
      shareChat: 'onShareChat',
      copyUrl: 'onCopyUrl'
    }
  },
  name: 'XiaoHongShu',
  platform: 'xhsp',
  scnPrefix: 'xhs_'
};

export default XHSConfig;
