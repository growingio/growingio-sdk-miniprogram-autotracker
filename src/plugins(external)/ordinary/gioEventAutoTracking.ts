/**
 * 名称：无埋点插件
 * 用途：用于提供无埋点的事件构建方法。
 */
import { EventTarget } from '@@/types/eventHooks';
import { GrowingIOType } from '@@/types/growingIO';
import { isTaro3 } from '@@/utils/tools';

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
    // taro3-react
    if (vdsConfig.taro && [('#eh', 'eh')].includes(eventName)) {
      return;
    }
    // chameleon
    if (
      vdsConfig.cml &&
      ['_cmlEventProxy', 'onclick', 'blurEvent', 'handleDetail'].includes(
        eventName
      )
    ) {
      return;
    }

    this.prevEvent = e;
    // 三方框架处理
    // uni-app
    if (vdsConfig.uniVue) {
      eventName = plugins?.gioUniAppAdapter.getHandlerName(eventName, e);
    }
    // remax
    if (vdsConfig.remax && eventName.indexOf('$$REMAX_METHOD') > -1) {
      eventName = plugins?.gioRemaxAdapter.getHandlerName(eventName);
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
    } else if (actionListeners.submit.includes(e.type)) {
      this.buildSubmitEvent(e, eventName);
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
    if (vdsConfig.octopus) {
      eventName = e.handler;
      if (/^bound .*/.test(eventName)) {
        eventName = eventName.replace('bound ', '');
      }
      if (/^t[0-9]+$/.test(id)) {
        id = '';
      }

      if (id && !eventName) {
        eventName = 'anonymousFunc';
      }
      if (!id && !eventName) {
        return;
      }
    }
    return `${id}#${eventName}`;
  };

  // 构建点击事件
  buildClickEvent = (e: EventTarget, eventName: string) => {
    const xpath = this.getNodeXpath(e, eventName);
    if (xpath) {
      const {
        dataStore: { eventContextBuilder, eventInterceptor, eventHooks },
        gioEnvironment
      } = this.growingIO;
      const target = e.currentTarget || e.target;
      let idx;
      if (ut.has(target?.dataset, 'index') && target?.dataset?.index !== '') {
        idx = Number.parseInt(target.dataset.index as string, 10);
        if (Number.isNaN(idx)) {
          idx = -1;
        }
      }
      const event = {
        eventType:
          gioEnvironment === 'saas' && e.type.includes('long')
            ? 'lngprss'
            : 'VIEW_CLICK',
        pageShowTimestamp: eventHooks.currentPage.time,
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
      dataStore: { eventContextBuilder, eventInterceptor, eventHooks }
    } = this.growingIO;
    const event = {
      eventType: 'VIEW_CLICK',
      pageShowTimestamp: eventHooks.currentPage.time,
      element: [
        {
          xpath: '#onTabItemTap',
          textValue: tabItem.text,
          index: tabItem.index,
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
        dataStore: { eventContextBuilder, eventInterceptor, eventHooks }
      } = this.growingIO;
      const target = e.currentTarget || e.target;
      const event = {
        eventType: 'VIEW_CHANGE',
        pageShowTimestamp: eventHooks.currentPage.time,
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

  // 构建表单提交事件
  buildSubmitEvent = (e: EventTarget, eventName: string) => {
    const xpath = this.getNodeXpath(e, eventName);
    if (xpath) {
      const {
        dataStore: { eventContextBuilder, eventInterceptor, eventHooks }
      } = this.growingIO;
      const event = {
        eventType: 'FORM_SUBMIT',
        pageShowTimestamp: eventHooks.currentPage.time,
        element: [{ xpath }],
        ...eventContextBuilder()
      };
      eventInterceptor(event);
    }
  };
}

export default { name: 'gioEventAutoTracking', method: GioEventAutoTracking };
