// taro环境下的plugins实例，添加taro适配插件
import { GrowingIOType } from '@@/types/growingIO';
import BasePlugins from './base';
import gioTaroAdapter from '@@/adapters/gioTaroAdapter';

class Plugins extends BasePlugins {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.pluginsContext = {
      plugins: { gioTaroAdapter }
    };
  }
}

export default Plugins;
