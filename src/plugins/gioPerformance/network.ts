import { GrowingIOType } from '@@/types/growingIO';
import {
  compact,
  forEach,
  isArray,
  isEmpty,
  isNil,
  isRegExp,
  isString,
  unset
} from '@@/utils/glodash';

export default class Network {
  private minipInst: any;
  private excludeRegExp: RegExp | string | any[];
  private gdpRequestURL: string;
  private buildNetworkEvent: (attributes: any) => void;
  constructor(public growingIO: GrowingIOType, public options: any = {}) {
    this.minipInst = this.growingIO.minipInstance.minip;
    this.buildNetworkEvent = (attributes: any) => {
      if (!options.network) {
        return;
      }
      const { duration, url, method, statusCode } = attributes;
      this.growingIO.plugins.gioPerformance?.buildPerfEvent(
        'apm_network_request',
        {
          response_duration: duration,
          request_address: url,
          request_method: method,
          http_code: statusCode
        }
      );
    };

    if (this.options.network?.exclude) {
      this.excludeRegExp = this.options.network.exclude;
    }
    this.hookRequest();
    // 重写生成地址的方法，sdk在性能分析时需要拿到主实例的请求地址做判断用
    const self = this;
    const originFunc = this.growingIO.uploader.generateURL;
    this.growingIO.uploader.generateURL = function () {
      const result = originFunc.apply(this, arguments);
      const trackingId = arguments[0];
      if (trackingId === self.growingIO.trackingId) {
        self.gdpRequestURL = result;
      }
      return result;
    };
  }

  // 检验url是否符合过滤条件
  verifyUrl = (url: string) => {
    // Gio的请求直接过滤
    if (url.indexOf(this.gdpRequestURL) > -1) {
      return true;
    }
    // 正则或字符串域名数组过滤
    if (isArray(this.excludeRegExp)) {
      const verifyResult = compact(
        (this.excludeRegExp as any[]).map((re: RegExp | string) => {
          if (isRegExp(re)) {
            return (re as RegExp).test(url);
          } else if (isString(re)) {
            return url.indexOf(re as string) > -1;
          }
        })
      );
      return !isEmpty(verifyResult);
    } else if (isString(this.excludeRegExp)) {
      // 单个字符串过滤校验
      return url.indexOf(this.excludeRegExp as string) > -1;
    } else if (isRegExp(this.excludeRegExp)) {
      // 单个正则过滤校验
      return (this.excludeRegExp as RegExp).test(url);
    } else {
      return false;
    }
  };

  // 重写request
  hookRequest = () => {
    const self = this;
    ['request', 'downloadFile', 'uploadFile'].forEach((reqKey: string) => {
      const originRequest = this.minipInst[reqKey];
      Object.defineProperty(this.minipInst, reqKey, {
        writable: true,
        enumerable: true,
        configurable: true,
        value: function (...args: any[]) {
          const options: any = args[0];
          const { url } = options;
          // 如果符合过滤条件就直接发请求不做处理
          if (self.verifyUrl(url)) {
            return originRequest.call(this, options);
          }
          let cstmRequestInfo: any = {
            header: options.header || {},
            url: options.url
          };
          switch (reqKey) {
            case 'request':
              const { method } = options;
              cstmRequestInfo = { ...cstmRequestInfo, method };
              break;
            case 'downloadFile':
            case 'uploadFile':
              const { filePath } = options;
              cstmRequestInfo = {
                ...cstmRequestInfo,
                filePath,
                method: reqKey === 'downloadFile' ? 'GET' : 'POST'
              };
              break;
            default:
              break;
          }

          const originFail = options.fail;
          const fail = function (result: any) {
            cstmRequestInfo.endTime = Date.now();
            self.growingIO.plugins.gioPerformance?.buildPerfEvent('Error', {
              error_type: result.errMsg,
              error_content: cstmRequestInfo.url
            });
            if (typeof originFail === 'function') {
              return originFail(result);
            }
          };

          const originSuccess = options.success;
          const success = function (result) {
            cstmRequestInfo.endTime = Date.now();
            self.networkPerfBuilder(result, cstmRequestInfo);
            if (typeof originSuccess === 'function') {
              return originSuccess(result);
            }
          };
          cstmRequestInfo.startTime = Date.now();
          return originRequest.call(this, {
            ...options,
            success,
            fail
          });
        }
      });
    });
  };

  // 请求性能数据组装
  networkPerfBuilder = (requestResult: any, cstmRequestInfo: any) => {
    const { profile = {}, statusCode = 0, errMsg } = requestResult;
    const { url, filePath, method } = cstmRequestInfo;
    const {
      redirectStart,
      redirectEnd,
      fetchStart,
      domainLookUpStart,
      domainLookUpEnd,
      connectStart,
      connectEnd,
      requestStart,
      responseStart,
      responseEnd
    } = profile;
    const p = !isEmpty(profile);
    const networkPerf = {
      url,
      filePath,
      method,
      statusCode,
      message: errMsg,
      // 重定向耗时（重定向没有发生，或者其中一个重定向非同源，则该值为 0）
      redirect: p ? redirectEnd - redirectStart : 0,
      // 缓存耗时
      cache: p ? domainLookUpStart - fetchStart : 0,
      // dns域名解析耗时
      dns: p ? domainLookUpEnd - domainLookUpStart : 0,
      // tcp链接耗时
      tcp: p ? connectEnd - connectStart : 0,
      // 在SSL链接建立好后，从客户端发送至服务端首次响应的耗时
      request: p ? responseStart - requestStart : 0,
      // 从服务端首次响应至数据完全响应完的耗时
      response: p ? responseEnd - responseStart : 0,
      // 请求总耗时
      duration: p
        ? responseEnd - fetchStart
        : cstmRequestInfo.endTime - cstmRequestInfo.startTime
    };
    forEach(
      networkPerf,
      (v, k) => (v === '' || isNil(v)) && unset(networkPerf, k)
    );
    this.buildNetworkEvent(networkPerf);
  };
}
