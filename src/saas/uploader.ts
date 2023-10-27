import BaseUploader from '@@/core/uploader';
import { GrowingIOType } from '@@/types/growingIO';

class Uploader extends BaseUploader {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    let { appId, projectId } = this.growingIO.vdsConfig;
    this.requestURL = `https://wxapi.growingio.com/projects/${projectId}/apps/${appId}/collect`;
  }
}

export default Uploader;
