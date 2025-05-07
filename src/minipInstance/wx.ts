import { GrowingIOType } from '@@/types/growingIO';
import { SystemInfo } from '@@/types/minipInstance';

import BaseImplements from './base';

class Weixin extends BaseImplements {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.hookSetTitle();
  }

  // 获取小程序系统信息
  getSystemInfo = (): Promise<SystemInfo> => {
    const self = this;
    return new Promise((resolve) => {
      const systemInfo = {
        ...this.minip?.getDeviceInfo(),
        ...this.minip?.getWindowInfo(),
        ...this.minip?.getAppBaseInfo()
      };
      self.systemInfo = systemInfo;
      resolve(systemInfo);
    });
  };
}

export default Weixin;
