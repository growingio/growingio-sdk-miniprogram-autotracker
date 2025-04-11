import BaseConfig from './base';

const XHSConfig = {
  ...BaseConfig,
  pageHandlers: [...BaseConfig.pageHandlers, 'onShareChat', 'onCopyUrl'],
  shareEventTypes: ['onShareAppMessage', 'onShareChat'],
  listeners: {
    ...BaseConfig.listeners,
    page: {
      ...BaseConfig.listeners.page,
      shareChat: 'onShareChat',
      copyUrl: 'onCopyUrl'
    }
  },
  name: 'XiaoHongShu',
  platform: 'xhsp',
  scnPrefix: 'xhs_'
};

export default XHSConfig;
