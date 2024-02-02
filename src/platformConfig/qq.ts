import BaseConfig from './base';

const QQConfig = {
  ...BaseConfig,
  listeners: { ...BaseConfig.listeners },
  name: 'QQ',
  platform: 'qq',
  scnPrefix: 'qq_'
};
QQConfig.pageHandlers = [...BaseConfig.pageHandlers, 'onAddToFavorites'];
QQConfig.listeners.page.addFavorites = 'onAddToFavorites';

export default QQConfig;
