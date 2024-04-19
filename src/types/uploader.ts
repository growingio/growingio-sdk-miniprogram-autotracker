import { EVENT, EXTEND_EVENT } from './base';

export interface UploaderType {
  // 因forceLogin配置积压的事件请求队列
  hoardingQueue: any;
  // 请求队列
  requestQueue: any;
  // 请求限制最大数
  requestLimit: number;
  // 请求重试限制最大数
  retryLimit: number;
  // 请求重试的原请求id
  retryIds: any;
  // 请求中的请求数
  requestingNum: number;
  // 获取积压列表
  getHoardingQueue: (trackingId: string) => EXTEND_EVENT[];
  // 获取请求列表
  getRequestQueue: (trackingId: string) => EXTEND_EVENT[];
  // 提交请求至队列
  commitRequest: (commitData: EXTEND_EVENT) => void;
  // 初始化请求
  initiateRequest: (trackingId: string, forceSend?: boolean) => void;
  // 发送事件
  sendEvent: (eventsQueue: EXTEND_EVENT[], requestData: EVENT[]) => void;
  // 请求错误回调
  requestFailFn: (event: EXTEND_EVENT) => void;
  // 生成上报地址
  generateURL: (trackingId: string) => void;
}
