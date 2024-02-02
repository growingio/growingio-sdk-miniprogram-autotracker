import { GrowingIOType } from '@@/types/growingIO';

import BaseImplements from './base';

class Weixin extends BaseImplements {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.hookSetTitle();
  }
}

export default Weixin;
