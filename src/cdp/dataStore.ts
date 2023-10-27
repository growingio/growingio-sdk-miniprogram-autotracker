import BaseDataStore from '@@/core/dataStore';
import { GrowingIOType } from '@@/types/growingIO';
import { forEach, head, isEmpty } from '@@/utils/glodash';

class DataStore extends BaseDataStore {
  public trackTimers; // 事件时长计时器
  constructor(public growingIO: GrowingIOType) {
    super(growingIO);
    this.trackTimers = {};
  }
  // 事件的格式转换(同时移除无值的字段)
  eventConverter = (event: any) => {
    const { vdsConfig, dataStore, uploader } = this.growingIO;
    // 开启数据采集时才会处理事件、累计全局计数并将合成的事件提交到请求队列
    if (vdsConfig.dataCollect) {
      event.globalSequenceId = dataStore.gsid;
      event.eventSequenceId = dataStore.esid[event.eventType] || 1;
      const convertedEvent: any = {};
      forEach(event, (v: any, k: string) => {
        /**
         * cdp环境下字段的转换
         */
        // 无埋点element的转换
        if (k === 'element') {
          const target: object = head(v) ?? {};
          forEach(target, (ev: any, ek: string) => {
            // 判断属性是否存在，同时忽略无值属性（放入convertedEvent中）
            if (!isEmpty(ev) || ev === 0) {
              convertedEvent[ek] = ev;
            }
          });
        } else if (!isEmpty(v) || v === 0) {
          // 判断属性是否存在，同时忽略无值属性
          convertedEvent[k] = v;
        }
      });
      // 全局事件计数加1
      this.growingIO.dataStore.gsid += 1;
      // 请求事件计数加1
      this.growingIO.dataStore.esid = {
        ...this.growingIO.dataStore.esid,
        [convertedEvent.eventType]:
          (this.growingIO.dataStore.esid[convertedEvent.eventType] || 1) + 1
      };
      this.growingIO.emitter.emit('onComposeAfter', {
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
      dataStore: {
        eventContextBuilder,
        eventInterceptor,
        eventHooks: { currentPage }
      }
    } = this.growingIO;
    const uri = (updateResult?.path || '').split('?');
    const event = {
      eventType: 'CUSTOM',
      eventName: '$mp_on_share',
      pageShowTimestamp: currentPage.time,
      attributes: {
        $from: originResult.from,
        $target: originResult?.target?.id,
        $share_title: updateResult?.title,
        $share_path: head(uri),
        $share_query: uri[1],
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
      dataStore: {
        eventContextBuilder,
        eventInterceptor,
        eventHooks: { currentPage }
      }
    } = this.growingIO;
    const uri = (updateResult?.path || '').split('?');
    const event = {
      eventType: 'CUSTOM',
      eventName: '$mp_share_timeline',
      pageShowTimestamp: currentPage.time,
      attributes: {
        $target: originResult?.target?.id,
        $share_title: updateResult?.title,
        $share_path: head(uri),
        $share_query: uri[1],
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
      dataStore: {
        eventContextBuilder,
        eventInterceptor,
        eventHooks: { currentPage }
      }
    } = this.growingIO;
    const uri = (updateResult?.path || '').split('?');
    const event = {
      eventType: 'CUSTOM',
      eventName: '$mp_add_favorites',
      pageShowTimestamp: currentPage.time,
      attributes: {
        $share_title: updateResult?.title,
        $share_path: head(uri),
        $share_query: uri[1]
      },
      ...eventContextBuilder()
    };
    eventInterceptor(event);
  };
}

export default DataStore;
