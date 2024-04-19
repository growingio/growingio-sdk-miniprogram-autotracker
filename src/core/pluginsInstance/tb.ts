// taobao环境下的plugins实例，添加taobao适配插件
import { GrowingIOType } from '@@/types/growingIO';
import BasePlugins from './base';
import gioTaobaoAdapter from '@@/adapters/gioTaobaoAdapter';

class Plugins extends BasePlugins {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.pluginsContext = {
      plugins: { gioTaobaoAdapter }
    };
  }
}

export default Plugins;
