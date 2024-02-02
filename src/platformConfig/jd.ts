import BaseConfig from './base';

const JDConfig = {
  ...BaseConfig,
  listeners: { ...BaseConfig.listeners },
  name: 'JingDong',
  platform: 'jdp',
  scnPrefix: 'jd_'
};

export default JDConfig;
