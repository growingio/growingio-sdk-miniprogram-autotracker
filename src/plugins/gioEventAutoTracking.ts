/**
 * 名称：无埋点插件
 * 用途：用于提供无埋点的事件构建方法。
 */
import { ID_REG, SWAN_XID_REG, TARO_XID_REG } from '@@/constants/regex';
import { EventTarget } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import { consoleText, isTaro3 } from '@@/utils/tools';
import EMIT_MSG from '@@/constants/emitMsg';

let ut;
class GioEventAutoTracking {
  private prevEvent: any;
  constructor(public growingIO: GrowingIOType) {
    ut = this.growingIO.utils;
    this.prevEvent = {};
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
        dataStore: { eventContextBuilder, eventInterceptor }
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
      eventInterceptor(event);
    }
  };

  // 构建tab菜单点击事件
  buildTabClickEvent = (trackingId: string, tabItem: any) => {
    const {
      dataStore: { eventContextBuilder, eventInterceptor }
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
        dataStore: { eventContextBuilder, eventInterceptor }
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
      eventInterceptor(event);
    }
  };
}

export default { name: 'gioEventAutoTracking', method: GioEventAutoTracking };
