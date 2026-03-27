import { EVENT, EXTEND_EVENT } from './base';

/**
 * 上传组件类型接口
 * @interface UploaderType
 */
export interface UploaderType {
  /** 因 forceLogin 配置积压的事件请求队列 */
  hoardingQueue: any;
  /** 请求队列 */
  requestQueue: any;
  /** 请求限制最大数 */
  requestLimit: number;
  /** 请求重试限制最大数 */
  retryLimit: number;
  /** 请求重试的原请求 id */
  retryIds: any;
  /** 请求中的请求数 */
  requestingNum: number;
  /**
   * 获取积压列表
   * @param {string} trackingId 跟踪器 ID
   * @returns {EXTEND_EVENT[]} 事件列表
   */
  getHoardingQueue: (trackingId: string) => EXTEND_EVENT[];
  /**
   * 获取请求列表
   * @param {string} trackingId 跟踪器 ID
   * @returns {EXTEND_EVENT[]} 事件列表
   */
  getRequestQueue: (trackingId: string) => EXTEND_EVENT[];
  /**
   * 提交请求至队列
   * @param {EXTEND_EVENT} commitData 提交的数据
   */
  commitRequest: (commitData: EXTEND_EVENT) => void;
  /**
   * 初始化请求
   * @param {string} trackingId 跟踪器 ID
   * @param {boolean} [forceSend] 是否强制发送
   */
  initiateRequest: (trackingId: string, forceSend?: boolean) => void;
  /**
   * 发送事件
   * @param {EXTEND_EVENT[]} eventsQueue 事件队列
   * @param {EVENT[]} requestData 请求数据
   */
  sendEvent: (eventsQueue: EXTEND_EVENT[], requestData: EVENT[]) => void;
  /**
   * 请求错误回调
   * @param {EXTEND_EVENT} event 事件
   */
  requestFailFn: (event: EXTEND_EVENT) => void;
  /**
   * 生成上报地址
   * @param {string} trackingId 跟踪器 ID
   */
  generateURL: (trackingId: string) => void;
}
