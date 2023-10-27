export interface UploaderType {
  // 因forceLogin配置积压的事件请求队列
  hoardingQueue: any[];
  // 请求队列
  requestQueue: any[];
  // 请求限制最大数
  requestLimit: number;
  // 请求超时时间(ms)
  requestTimeout: number;
  // 请求重试限制最大数
  retryLimit: number;
  // 请求重试的原请求id
  retryIds: any;
  // 请求中的请求数
  requestingNum: number;
  // 请求地址
  requestURL: string;
  // 提交请求至队列
  commitRequest: (reqData) => void;
  // 发送请求
  initiateRequest: (forceSend?: boolean) => void;
  // 请求错误回调
  requestFailFn: (data) => void;
  // CDP更新/生成新的上报地址方法
  generateURL?: () => void;
}
