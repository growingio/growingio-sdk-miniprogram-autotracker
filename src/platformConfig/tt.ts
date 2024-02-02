import BaseConfig from './base';

const TTConfig = {
  ...BaseConfig,
  listeners: { ...BaseConfig.listeners },
  name: 'Bytedance',
  platform: 'bytedance',
  scnPrefix: 'bytedance_'
};

export default TTConfig;
