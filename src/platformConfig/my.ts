import BaseConfig from './base';

const MyConfig = {
  ...BaseConfig,
  listeners: { ...BaseConfig.listeners },
  name: 'Alipay',
  platform: 'alip',
  scnPrefix: 'alip_',
  shareEventTypes: ['onShareAppMessage'],
  hooks: {
    ...BaseConfig?.hooks,
    Behavior: false
  }
};

export default MyConfig;
