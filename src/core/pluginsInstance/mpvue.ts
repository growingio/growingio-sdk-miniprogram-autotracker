// mpvue环境下的plugins实例，添加mpvue适配插件
import { GrowingIOType } from '@@/types/growingIO';
import BasePlugins from './base';
import gioMpvueAdapter from '@@/adapters/gioMpvueAdapter';

class Plugins extends BasePlugins {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.pluginsContext = {
      plugins: { gioMpvueAdapter }
    };
  }
}

export default Plugins;
