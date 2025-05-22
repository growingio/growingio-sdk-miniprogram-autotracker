import { niceTry, getPlainPlatform } from '@@/utils/tools';

import XHSConfig from './xhs';
import JDConfig from './jd';
import KSConfig from './ks';
import MyConfig from './my';
import TbConfig from './tb';
import QQConfig from './qq';
import SwanConfig from './swan';
import TTConfig from './tt';
import WXConfig from './wx';

const plainPlatform = getPlainPlatform();
const FrameworkConfig = niceTry(() => {
  const INST = {
    xhs: XHSConfig,
    jd: JDConfig,
    ks: KSConfig,
    my: MyConfig,
    tb: TbConfig,
    qq: QQConfig,
    swan: SwanConfig,
    tt: TTConfig,
    wx: WXConfig
  };
  const targetConfig = INST[plainPlatform];
  targetConfig.canHook = false;
  return targetConfig;
});

export default FrameworkConfig;
