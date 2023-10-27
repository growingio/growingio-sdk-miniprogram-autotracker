import { GrowingIOType } from '@@/types/growingIO';
import { isString } from '@@/utils/glodash';
import { limitString } from '@@/utils/tools';

import BaseImplements from './base';

class Bytedance extends BaseImplements {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.hookSetTitle();
  }
}

export default Bytedance;
