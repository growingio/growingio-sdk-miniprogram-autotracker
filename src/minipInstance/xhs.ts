import { GrowingIOType } from '@@/types/growingIO';

import BaseImplements from './base';

class XiaoHongShu extends BaseImplements {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.hookSetTitle();
  }

  // 采集曝光事件
  initImpression = (collectPage: any) => {
    this.growingIO.plugins?.gioImpressionTracking?.main(
      collectPage,
      'selectAll'
    );
  };
}

export default XiaoHongShu;
