import { GrowingIOType } from '@@/types/growingIO';
import { isString } from '@@/utils/glodash';
import { limitString, niceTry } from '@@/utils/tools';

import BaseImplements from './base';

class Baidu extends BaseImplements {
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

export default Baidu;
