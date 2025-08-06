/**
 * 名称：无埋点插件
 * 用途：用于提供无埋点的事件构建方法。
 */
import { ID_REG, SWAN_XID_REG, TARO_XID_REG } from '@@/constants/regex';
import { EventTarget } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import { consoleText, getExtraData, isTaro3, niceTry } from '@@/utils/tools';
import EMIT_MSG from '@@/constants/emitMsg';
import { isEmpty } from '@@/utils/glodash';
import qs from 'querystringify';

let ut;
class GioEventAutoTracking {
  public pluginVersion: string;
  private prevEvent: any;
  public circleServerUrl: string;
  public circleOpen = false;
  constructor(public growingIO: GrowingIOType) {
    this.pluginVersion = '__PLUGIN_VERSION__';
    ut = this.growingIO.utils;
    this.prevEvent = {};
    this.listenForLunchEvent();
  }

  main = (e: EventTarget, eventName: string) => {
    const {
      vdsConfig,
      platformConfig,
      plugins,
      emitter,
      trackingId
    }: GrowingIOType = this.growingIO;
    if (
      // 无埋点事件拦截
      !vdsConfig.autotrack ||
      // 无事件名称拦截
      !eventName ||
      // 标记忽略的节点拦截
      ut.get(e, 'currentTarget.dataset.growingIgnore') ||
      ut.get(e, 'target.dataset.growingIgnore') ||
      // 没有标记强制采集且是自动播放的组件（例如轮播、视频播放）事件拦截
      (!ut.get(e, 'target.dataset.growingTrack') &&
        ut.get(e, 'detail.source') === 'autoplay') ||
      // 防止重写页面后可能出现重复的事件
      (e.type === this.prevEvent?.type &&
        // uniapp中后产生事件的时间戳可能比前序的小导致相减为负值，所以要取绝对值保证两个事件不是重复触发即可。事件重复触发是taro才会出现的
        Math.abs(Number(e.timeStamp) - Number(this.prevEvent?.timeStamp)) < 10)
    ) {
      return;
    }
    // taro3多余事件过滤
    if (vdsConfig.taro && [('#eh', 'eh')].includes(eventName)) {
      return;
    }
    this.prevEvent = e;
    // uniapp
    if (vdsConfig.uniVue) {
      eventName = plugins?.gioUniAppAdapter.getHandlerName(eventName, e);
    }
    // 事件逻辑
    if (vdsConfig.debug) {
      console.log('Action：', e.type, Date.now());
    }
    // 向其他插件广播事件
    emitter.emit(EMIT_MSG.ON_COMPOSE_BEFORE, {
      event: eventName,
      params: e ?? {}
    });
    const actionListeners = platformConfig.listeners.actions;
    if (actionListeners.click.includes(e.type)) {
      this.buildClickEvent(trackingId, e, eventName);
    } else if (actionListeners.change.includes(e.type)) {
      this.buildChangeEvent(trackingId, e, eventName);
    }
  };

  // 获取触发节点xpath信息
  getNodeXpath = (e: EventTarget, eventName: string) => {
    const { gioPlatform, vdsConfig } = this.growingIO;
    const target = e.currentTarget || e.target;
    let id = target.id;
    if (
      !id ||
      (gioPlatform === 'swan' && SWAN_XID_REG.test(id)) ||
      (isTaro3(vdsConfig.taro) && TARO_XID_REG.test(id))
    ) {
      id = '';
    }
    return `${id}#${eventName}`;
  };

  // 构建点击事件
  buildClickEvent = (trackingId: string, e: EventTarget, eventName: string) => {
    const xpath = this.getNodeXpath(e, eventName);
    if (xpath) {
      const {
        dataStore: { eventContextBuilder, eventInterceptor, eventHooks }
      } = this.growingIO;
      const target = e.currentTarget || e.target;
      let idx;
      if (ut.has(target?.dataset, 'index') && target?.dataset?.index !== '') {
        const index: any = ut.toString(target.dataset.index);
        if (ID_REG.test(index) && index - 0 > 0 && index - 0 < 2147483647) {
          idx = +index;
        } else {
          consoleText(
            `${target.dataset.index}，index标记应为 大于 0 且小于 2147483647 的整数！`,
            'warn'
          );
        }
      }
      const event = {
        eventType: 'VIEW_CLICK',
        element: [
          {
            xpath,
            index: idx,
            textValue: target?.dataset?.title,
            hyperlink: target?.dataset?.src
          }
        ],
        ...eventContextBuilder(trackingId)
      };
      // 合并页面属性
      event.attributes = eventHooks.currentPage.eventSetPageProps(
        trackingId,
        event
      );
      eventInterceptor(event);
    }
  };

  // 构建tab菜单点击事件
  buildTabClickEvent = (trackingId: string, tabItem: any) => {
    const {
      dataStore: { eventContextBuilder, eventInterceptor, eventHooks }
    } = this.growingIO;
    const event = {
      eventType: 'VIEW_CLICK',
      element: [
        {
          xpath: '#onTabItemTap',
          textValue: tabItem.text,
          index: tabItem.index + 1,
          hyperlink: ut.toString(tabItem.pagePath)
        }
      ],
      ...eventContextBuilder(trackingId)
    };
    // 合并页面属性
    event.attributes = eventHooks.currentPage.eventSetPageProps(
      trackingId,
      event
    );
    eventInterceptor(event);
  };

  // 构建表单变化事件
  buildChangeEvent = (
    trackingId: string,
    e: EventTarget,
    eventName: string
  ) => {
    const xpath = this.getNodeXpath(e, eventName);
    if (xpath) {
      const {
        dataStore: { eventContextBuilder, eventInterceptor, eventHooks }
      } = this.growingIO;
      const target = e.currentTarget || e.target;
      const event = {
        eventType: 'VIEW_CHANGE',
        element: { xpath },
        ...eventContextBuilder(trackingId)
      };
      const ev = ut.get(e, 'detail.value') || ut.get(e, 'target.attr.value');
      if (target?.dataset?.growingTrack || target?.dataset?.growingtrack) {
        if (!ut.isNil(ev)) {
          event.element.textValue = ut.toString(ev);
        }
      }
      event.element = [event.element];
      // 合并页面属性
      event.attributes = eventHooks.currentPage.eventSetPageProps(
        trackingId,
        event
      );
      eventInterceptor(event);
    }
  };

  // --------------------- 以下内容是对新版小程序圈选的支持 ---------------------

  // 监听小程序的onLunch事件
  listenForLunchEvent = () => {
    const { emitter } = this.growingIO;
    emitter.on(EMIT_MSG.MINIP_LIFECYCLE, ({ event, params }) => {
      if (['App onLaunch', 'App onShow'].includes(event)) {
        this.circleInit(params);
      }
    });
  };

  // 抖音小程序获取圈选地址
  getCircleUrlByTT = ({ query }: any) => {
    if (query.q && query.url) {
      const urlFromQ = niceTry(
        () => JSON.parse(query.q)?.gdpCircleRoomCollectUrl
      );
      if (urlFromQ) {
        return urlFromQ;
      } else {
        return (
          niceTry(
            () => qs.parse(query.url.split('?')[1])?.gdpCircleRoomCollectUrl
          ) ?? ''
        );
      }
    }
  };

  // 初始化圈选
  circleInit = (params: any) => {
    const { emitter } = this.growingIO;
    const extraData = getExtraData(
      params.referrerInfo?.extraData || params.query || {}
    );
    // 额外参数中存在gdpCircleRoomCollectUrl，则表示是圈选的跳转，进入圈选状态
    const gdpCircleRoomCollectUrl =
      extraData?.gdpCircleRoomCollectUrl || this.getCircleUrlByTT(params);
    if (gdpCircleRoomCollectUrl) {
      // 圈选初始化
      if (this.circleServerUrl !== gdpCircleRoomCollectUrl) {
        this.circleServerUrl = gdpCircleRoomCollectUrl;
        // 提前移除一次事件发送监听，防止重复监听
        emitter.off(EMIT_MSG.ON_SEND_AFTER, this.collectorSendFn);
        // 添加事件发送监听，用于发送圈选事件
        emitter.on(EMIT_MSG.ON_SEND_AFTER, this.collectorSendFn);
        this.showPromptModal('enter');
      }
      this.circleOpen = true;
    }
  };

  // 数据采集发送监听回调
  collectorSendFn = ({ requestData, trackingId }) => {
    const { uploader } = this.growingIO;
    if (this.circleOpen) {
      // 过滤仅主实例的非CUSTOM事件可以圈选
      const filteredEvents = requestData.filter(
        (e) =>
          e.eventType !== 'CUSTOM' && trackingId === this.growingIO.trackingId
      );
      if (!isEmpty(filteredEvents)) {
        // 同时请求数在3个以下直接发起请求
        if (uploader.requestingNum < uploader.requestLimit) {
          this.circleRequest(filteredEvents);
        } else {
          // 同时有3个请求在发送时，设轮询延时直到请求数在3个以下
          let t = setInterval(() => {
            if (uploader.requestingNum < uploader.requestLimit) {
              this.circleRequest(filteredEvents);
              clearInterval(t);
              t = undefined;
            }
          }, 500);
        }
      }
    }
  };

  // 圈选结束
  circleClose = () => {
    this.circleOpen = false;
    this.circleServerUrl = '';
    this.growingIO.emitter.off(EMIT_MSG.ON_SEND_AFTER, this.collectorSendFn);
  };

  // 展示圈选提示
  showPromptModal = (type: 'enter' | 'error', msg?: string) => {
    this.growingIO.minipInstance.minip.showModal({
      title: 'GrowingIO提示',
      content: type === 'error' ? msg : '您已进入圈选模式',
      showCancel: false
    });
  };

  // 发起圈选请求
  circleRequest = (requestData: any) => {
    const { minipInstance } = this.growingIO;
    minipInstance.request({
      url: this.circleServerUrl,
      header: { 'content-type': 'application/json;charset=UTF-8' },
      method: 'POST',
      data: requestData,
      complete: ({ statusCode, data, errMsg }: any) => {
        if (![200, 204].includes(statusCode) || !data?.success) {
          this.showPromptModal(
            'error',
            data?.message || data || errMsg || '圈选请求失败，请重试!'
          );
          this.circleClose();
        }
      }
    });
    console.log(requestData, '----->circleRequest');
  };
}

export default { name: 'gioEventAutoTracking', method: GioEventAutoTracking };
