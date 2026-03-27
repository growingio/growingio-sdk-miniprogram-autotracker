// mpx环境下的plugins实例，添加mpx适配插件
import { GrowingIOType } from '@@/types/growingIO';
import BasePlugins from './base';
import gioMpxAdapter from '@@/adapters/gioMpxAdapter';

class Plugins extends BasePlugins {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.pluginsContext = {
      plugins: { gioMpxAdapter }
    };
  }
}

export default Plugins;
