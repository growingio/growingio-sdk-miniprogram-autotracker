import { getPlainPlatform } from '@@/utils/tools';

import JingDong from './jd';
import KuaiShou from './ks';
import Alipay from './my';
import QQ from './qq';
import Baidu from './swan';
import Bytedance from './tt';
import Weixin from './wx';

const plainPlatform = getPlainPlatform();
const INST = {
  wx: Weixin,
  swan: Baidu,
  my: Alipay,
  qq: QQ,
  tt: Bytedance,
  ks: KuaiShou,
  jd: JingDong
};

export default INST[plainPlatform];
