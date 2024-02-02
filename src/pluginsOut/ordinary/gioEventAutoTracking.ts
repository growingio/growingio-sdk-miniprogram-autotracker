/**
 * 名称：无埋点插件
 * 用途：用于提供无埋点的事件构建方法。
 */
import { EventTarget } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import { consoleText, isTaro3 } from '@@/utils/tools';

let ut;
class GioEventAutoTracking {
  private prevEvent: any;
  constructor(public growingIO: GrowingIOType) {
    ut = this.growingIO.utils;
    this.prevEvent = {};
  }

  main = (e: EventTarget, eventName: string) => {
    const { vdsConfig, platformConfig, plugins, emitter }: GrowingIOType =
      this.growingIO;
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
    emitter.emit('onComposeBefore', {
      event: eventName,
      params: e ?? {}
    });
    const actionListeners = platformConfig.listeners.actions;
    if (actionListeners.click.includes(e.type)) {
      this.buildClickEvent(e, eventName);
    } else if (actionListeners.change.includes(e.type)) {
      this.buildChangeEvent(e, eventName);
    }
  };

  // 获取触发节点xpath信息
  getNodeXpath = (e: EventTarget, eventName: string) => {
    const { gioPlatform, vdsConfig } = this.growingIO;
    const target = e.currentTarget || e.target;
    let id = target.id;
    if (
      !id ||
      (gioPlatform === 'swan' && /^_[0-9a-f]+/.test(id)) ||
      (isTaro3(vdsConfig.taro) && /^_n_[0-9]+$/.test(id))
    ) {
      id = '';
    }
    return `${id}#${eventName}`;
  };

  // 构建点击事件
  buildClickEvent = (e: EventTarget, eventName: string) => {
    const xpath = this.getNodeXpath(e, eventName);
    if (xpath) {
      const {
        dataStore: { eventContextBuilder, eventInterceptor }
      } = this.growingIO;
      const target = e.currentTarget || e.target;
      let idx;
      if (ut.has(target?.dataset, 'index') && target?.dataset?.index !== '') {
        const index: any = ut.toString(target.dataset.index);
        if (
          /^\d{1,10}$/.test(index) &&
          index - 0 > 0 &&
          index - 0 < 2147483647
        ) {
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
        ...eventContextBuilder()
      };
      eventInterceptor(event);
    }
  };

  // 构建tab菜单点击事件
  buildTabClickEvent = (tabItem: any) => {
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
      ...eventContextBuilder()
    };
    eventInterceptor(event);
  };

  // 构建表单变化事件
  buildChangeEvent = (e: EventTarget, eventName: string) => {
    const xpath = this.getNodeXpath(e, eventName);
    if (xpath) {
      const {
        dataStore: { eventContextBuilder, eventInterceptor }
      } = this.growingIO;
      const target = e.currentTarget || e.target;
      const event = {
        eventType: 'VIEW_CHANGE',
        element: { xpath },
        ...eventContextBuilder()
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
