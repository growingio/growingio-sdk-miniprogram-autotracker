import { getPlainPlatform } from '@@/utils/tools';

import XiaoHongShu from './xhs';
import JingDong from './jd';
import KuaiShou from './ks';
import Alipay from './my';
import QQ from './qq';
import Baidu from './swan';
import Bytedance from './tt';
import Weixin from './wx';
import BaseImplements from './base';

const plainPlatform = getPlainPlatform();
// 与 framework 平台配置保持同一支持边界，避免配置和实例能力不一致。
const INST = {
  wx: Weixin,
  swan: Baidu,
  my: Alipay,
  qq: QQ,
  tt: Bytedance,
  ks: KuaiShou,
  jd: JingDong,
  xhs: XiaoHongShu
};

// 仅承担“可安全构造”的职责；不支持平台会在 GrowingIO.init 中被拒绝。
class UnsupportedFrameworkPlatform extends BaseImplements {}

export const getFrameworkPlatformInstance = (platform: string) =>
  INST[platform] || UnsupportedFrameworkPlatform;

export default getFrameworkPlatformInstance(plainPlatform);
