import BaseUploader from '@@/core/uploader';
import { GrowingIOType } from '@@/types/growingIO';
import { endsWith, startsWith, toString } from '@@/utils/glodash';

class Uploader extends BaseUploader {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.generateURL();
  }

  generateURL = () => {
    let { scheme, host = '', projectId } = this.growingIO.vdsConfig;
    // 协议头处理
    if (scheme && startsWith(scheme, 'http')) {
      if (!endsWith(toString(scheme), '://')) {
        scheme = `${scheme}://`;
      }
    } else {
      scheme = 'https://';
    }
    // host处理
    host = host.replace('http://', '').replace('https://', '');
    this.requestURL = `${scheme}${host}/v3/projects/${projectId}/collect`;
  };
}

export default Uploader;
