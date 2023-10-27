import BaseConfig from './base';

const SwanConfig = {
  ...BaseConfig,
  listeners: { ...BaseConfig.listeners },
  name: 'Baidu',
  platform: 'baidup',
  scnPrefix: 'baidup_'
};

export default SwanConfig;
