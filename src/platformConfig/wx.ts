import BaseConfig from './base';

const WXConfig = {
  ...BaseConfig,
  listeners: { ...BaseConfig.listeners },
  name: 'Weixin',
  platform: 'MinP'
};
WXConfig.pageHandlers = [
  ...BaseConfig.pageHandlers,
  'onShareTimeline',
  'onAddToFavorites'
];
WXConfig.listeners.page = {
  ...BaseConfig.listeners.page,
  shareTime: 'onShareTimeline',
  addFavorites: 'onAddToFavorites'
};

export default WXConfig;
