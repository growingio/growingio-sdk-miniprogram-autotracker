import { GrowingIOType } from '@@/types/growingIO';
import { SystemInfo } from '@@/types/minipInstance';
import { isEmpty } from '@@/utils/glodash';
import { niceTry } from '@@/utils/tools';

import BaseImplements from './base';

class Weixin extends BaseImplements {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.hookSetTitle();
  }

  // 获取小程序系统信息
  getSystemInfo = async (): Promise<SystemInfo> => {
    // 新基础库拆分了设备、窗口和应用信息 API；每个调用单独兜底，避免其中
    // 一个 API 不可用时连带丢失其他已获取信息。
    const splitSystemInfo = {
      ...(niceTry(() => this.minip?.getDeviceInfo?.()) || {}),
      ...(niceTry(() => this.minip?.getWindowInfo?.()) || {}),
      ...(niceTry(() => this.minip?.getAppBaseInfo?.()) || {})
    };
    // 旧基础库优先使用同步兼容接口，并让新 API 返回值覆盖同名旧字段。
    const legacySystemInfo =
      niceTry(() => this.minip?.getSystemInfoSync?.()) || {};
    const systemInfo = { ...legacySystemInfo, ...splitSystemInfo };
    if (!isEmpty(systemInfo)) {
      this.systemInfo = systemInfo;
      return systemInfo as SystemInfo;
    }

    // 最后回退到异步旧接口；全部不可用时写入失败占位，由上层继续释放事件。
    return await new Promise((resolve) => {
      const fallback = { __gioFailed: true } as any;
      if (!this.minip?.getSystemInfo) {
        this.systemInfo = fallback;
        resolve(fallback);
        return;
      }
      try {
        this.minip.getSystemInfo({
          success: (result: SystemInfo) => {
            this.systemInfo = isEmpty(result) ? fallback : result;
            resolve(this.systemInfo);
          },
          fail: () => {
            this.systemInfo = fallback;
            resolve(fallback);
          }
        });
      } catch (error) {
        this.systemInfo = fallback;
        resolve(fallback);
      }
    });
  };
}

export default Weixin;
