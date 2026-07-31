import { niceTry, getPlainPlatform } from '@@/utils/tools';

import XHSConfig from './xhs';
import JDConfig from './jd';
import KSConfig from './ks';
import MyConfig from './my';
import QQConfig from './qq';
import SwanConfig from './swan';
import TTConfig from './tt';
import WXConfig from './wx';
import BaseConfig from './base';

const plainPlatform = getPlainPlatform();
// 未知平台仍提供完整配置形状，保证 SDK 模块加载和实例构造不崩溃；
// supported=false 会在 init 阶段明确拒绝初始化，不会进入采集链路。
const UnsupportedFrameworkConfig = {
  ...BaseConfig,
  name: 'UnsupportedFrameworkPlatform',
  canHook: false,
  supported: false,
  hooks: {
    App: false,
    Page: false,
    Component: false,
    Behavior: false
  }
};

const FrameworkConfig =
  niceTry(() => {
    // 这里只声明框架工具链实际能够生成的目标平台。淘宝小程序不在这些框架的
    // 输出范围内，不能复用支付宝配置伪装成“已支持”。
    const INST = {
      xhs: XHSConfig,
      jd: JDConfig,
      ks: KSConfig,
      my: MyConfig,
      qq: QQConfig,
      swan: SwanConfig,
      tt: TTConfig,
      wx: WXConfig
    };
    const targetConfig = INST[plainPlatform];
    return targetConfig
      ? { ...targetConfig, canHook: false }
      : UnsupportedFrameworkConfig;
  }) || UnsupportedFrameworkConfig;

export default FrameworkConfig;
