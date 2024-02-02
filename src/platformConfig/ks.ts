import BaseConfig from './base';

const KSConfig = {
  ...BaseConfig,
  listeners: { ...BaseConfig.listeners },
  name: 'KuaiShou',
  platform: 'kuaishoup',
  scnPrefix: 'ks_'
};

export default KSConfig;
