import { ATTRIBUTES_CORRESPOND, EVENTS_CORRESPOND } from '@@/constants/actions';
import BaseDataStore from '@@/core/dataStore';
import { GrowingIOType } from '@@/types/growingIO';
import { forEach, head, isEmpty } from '@@/utils/glodash';

class DataStore extends BaseDataStore {
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
  }
  // 事件的格式转换(同时移除无值的字段)
  eventConverter = (event) => {
    const { vdsConfig, dataStore, uploader } = this.growingIO;
    // 开启数据采集时才会处理事件、累计全局计数并将合成的事件提交到请求队列
    if (vdsConfig.dataCollect) {
      event.globalSequenceId = dataStore.gsid;
      const convertedEvent: any = {};
      forEach(event, (v: any, k: string) => {
        /**
         * saas环境下字段的转换
         */
        // 判断属性是否存在，同时忽略无值属性
        if (ATTRIBUTES_CORRESPOND[k] && (!isEmpty(v) || v === 0)) {
          // event key值转换（例：eventType -> t）
          convertedEvent[ATTRIBUTES_CORRESPOND[k]] = v;
          // eventType的转换（例：VISIT -> vst）
          if (k === 'eventType') {
            convertedEvent.t = EVENTS_CORRESPOND[v] || v;
          }
        }
        // 无埋点element的转换
        if (k === 'element') {
          const element = {};
          const target: object = head(v) ?? {};
          forEach(target, (iv: any, ik: string) => {
            // 判断属性是否存在，同时忽略无值属性
            if (ATTRIBUTES_CORRESPOND[ik] && (!isEmpty(iv) || iv === 0)) {
              // element key值转换（例：xpath -> x）
              element[ATTRIBUTES_CORRESPOND[ik]] = iv;
            }
          });
          convertedEvent.e = [element];
        }
      });
      // 全局事件计数加1
      this.growingIO.dataStore.gsid += 1;
      // saas只需要全局事件计数，请求事件计数不使用
      this.growingIO?.emitter.emit('onComposeAfter', {
        composedEvent: convertedEvent
      });
      // 提交请求队列
      uploader.commitRequest(convertedEvent);
    }
  };

  // 构建应用/页面转发分享事件
  buildAppMessageEvent = (args: any) => {
    const originResult = args[0];
    let updateResult;
    if (args.length >= 2) {
      updateResult = args[1];
    } else if (args.length === 1) {
      updateResult = originResult;
    }
    const {
      dataStore: { eventContextBuilder, eventInterceptor, eventHooks }
    } = this.growingIO;
    const event = {
      eventType: 'CUSTOM',
      eventName: 'onShareAppMessage',
      pageShowTimestamp: eventHooks.currentPage.time,
      attributes: {
        ...originResult,
        target: originResult?.target?.id,
        title: updateResult?.title,
        path: updateResult?.path || '',
        ...updateResult?.attributes
      },
      ...eventContextBuilder()
    };
    eventInterceptor(event);
  };

  // 构建朋友圈分享事件
  buildTimelineEvent = (args: any) => {
    const originResult = args[0];
    let updateResult;
    if (args.length >= 2) {
      updateResult = args[1];
    } else if (args.length === 1) {
      updateResult = originResult;
    }
    const {
      dataStore: { eventContextBuilder, eventInterceptor, eventHooks }
    } = this.growingIO;
    const event = {
      eventType: 'CUSTOM',
      eventName: 'onShareTimeline',
      pageShowTimestamp: eventHooks.currentPage.time,
      attributes: {
        ...originResult,
        target: originResult?.target?.id,
        title: updateResult?.title,
        path: updateResult?.path || '',
        ...updateResult?.attributes
      },
      ...eventContextBuilder()
    };
    eventInterceptor(event);
  };

  // 构建添加收藏事件
  buildAddFavorites = (args: any) => {
    const originResult = args[0];
    let updateResult;
    if (args.length >= 2) {
      updateResult = args[1];
    } else if (args.length === 1) {
      updateResult = originResult;
    }
    const {
      dataStore: { eventContextBuilder, eventInterceptor, eventHooks }
    } = this.growingIO;
    const event = {
      eventType: 'CUSTOM',
      eventName: 'onAddToFavorites',
      pageShowTimestamp: eventHooks.currentPage.time,
      attributes: {
        ...originResult,
        title: updateResult?.title,
        path: updateResult?.path || ''
      },
      ...eventContextBuilder()
    };
    eventInterceptor(event);
  };
}

export default DataStore;
