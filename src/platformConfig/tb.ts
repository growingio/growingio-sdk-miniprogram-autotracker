import BaseConfig from './base';

const TbConfig = {
  ...BaseConfig,
  pageHandlers: [
    ...BaseConfig.pageHandlers,
    'onInit',
    'didMount',
    'didUnmount'
  ],
  listeners: {
    ...BaseConfig.listeners,
    page: {
      ...BaseConfig.listeners.page,
      onInit: 'onInit',
      didMount: 'didMount',
      didUnmount: 'didUnmount'
    }
  },
  name: 'Taobao',
  platform: 'tbp',
  scnPrefix: 'tbp_',
  hooks: {
    ...BaseConfig?.hooks,
    Behavior: false
  }
};

export default TbConfig;
