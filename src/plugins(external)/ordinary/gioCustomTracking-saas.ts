/**
 * 名称：Saas自定义埋点插件
 * 用途：用于提供Saas环境自定义埋点的事件构建方法。
 */
import { GioCustomTrackingType } from '@@/types/gioCustomTracking';
import { GrowingIOType } from '@@/types/growingIO';

let ut;
class GioCustomTracking implements GioCustomTrackingType {
  constructor(public growingIO: GrowingIOType) {
    ut = this.growingIO.utils;
  }

  // 获取动态属性的值
  getDynamicAttributes = (properties: any) => {
    if (!ut.isNil(properties)) {
      ut.keys(properties).forEach((k: string) => {
        if (ut.isFunction(properties[k])) {
          properties[k] = properties[k]();
        } else if (!ut.isArray(properties[k])) {
          properties[k] = ut.toString(properties[k]);
        }
      });
    }
    return properties;
  };

  // 构建自定义埋点事件
  buildCustomEvent = (name: string, properties: { [key: string]: string }) => {
    ut.eventNameValidate(name, () => {
      const {
        dataStore: { eventContextBuilder, eventInterceptor, eventHooks }
      } = this.growingIO;
      const event = {
        eventType: 'CUSTOM',
        eventName: name,
        pageShowTimestamp: eventHooks?.currentPage?.time,
        attributes: ut.limitObject(
          this.getDynamicAttributes(
            ut.isObject(properties) && !ut.isEmpty(properties)
              ? properties
              : undefined
          )
        ),
        ...eventContextBuilder()
      };
      eventInterceptor(event);
    });
  };

  // 构建访问用户变量事件（Saas）
  buildVisitorVariable(properties: { [key: string]: string }) {
    if (ut.isObject(properties) && !ut.isEmpty(properties)) {
      const {
        dataStore: { lastVisitEvent, eventContextBuilder, eventInterceptor }
      } = this.growingIO;
      const event = {
        eventType: 'vstr',
        attributes: ut.limitObject(properties),
        ...eventContextBuilder()
      };
      // 该方法很可能被放在在app的onShow中的wx.login异步回调中，
      // 此时页面的path和query可能还没取到，就拿visit事件的path和query补上
      if (!event.path) {
        event.path = lastVisitEvent.path;
        event.query = lastVisitEvent.query;
        event.title = lastVisitEvent.title;
      }
      eventInterceptor(event);
    }
  }

  // 构建用户变量事件（Saas）
  buildPeopleVariable(properties: { [key: string]: string }) {
    if (
      this.growingIO.userStore.uid &&
      ut.isObject(properties) &&
      !ut.isEmpty(properties)
    ) {
      const {
        dataStore: { lastVisitEvent, eventContextBuilder, eventInterceptor }
      } = this.growingIO;
      const event = {
        eventType: 'ppl',
        properties: ut.limitObject(properties),
        ...eventContextBuilder()
      };
      // 该方法很可能被放在在app的onShow中的wx.login异步回调中，
      // 此时页面的path和query可能还没取到，就拿visit事件的path和query补上
      if (!event.path) {
        event.path = lastVisitEvent.path;
        event.query = lastVisitEvent.query;
        event.title = lastVisitEvent.title;
      }
      eventInterceptor(event);
    }
  }

  // 构建页面级变量事件（Saas）
  buildPageLevelVariable(properties: { [key: string]: string }) {
    if (ut.isObject(properties) && !ut.isEmpty(properties)) {
      const {
        dataStore: { eventContextBuilder, eventInterceptor, eventHooks }
      } = this.growingIO;
      const event = {
        eventType: 'pvar',
        pageShowTimestamp: eventHooks.currentPage.time,
        properties: ut.limitObject(properties),
        ...eventContextBuilder()
      };
      eventInterceptor(event);
    }
  }

  // 构建变量转化事件（Saas）
  buildConversionVariable(properties: { [key: string]: string }) {
    if (ut.isObject(properties) && !ut.isEmpty(properties)) {
      const {
        dataStore: { eventContextBuilder, eventInterceptor }
      } = this.growingIO;
      const event = {
        eventType: 'evar',
        properties: ut.limitObject(properties),
        ...eventContextBuilder()
      };
      eventInterceptor(event);
    }
  }
}

export default { name: 'gioCustomTracking', method: GioCustomTracking };
