// uniapp环境下的plugins实例，添加uniapp适配插件
import { GrowingIOType } from '@@/types/growingIO';
import BasePlugins from './base';
import gioUniAppAdapter from '@@/adapters/gioUniAppAdapter';

class Plugins extends BasePlugins {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.pluginsContext = {
      plugins: { gioUniAppAdapter }
    };
  }
}

export default Plugins;
