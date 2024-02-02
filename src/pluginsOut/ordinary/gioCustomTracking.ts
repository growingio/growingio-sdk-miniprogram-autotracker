/**
 * 名称：自定义埋点插件
 * 用途：用于提供自定义埋点的事件构建方法。
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
        dataStore: { eventContextBuilder, eventInterceptor }
      } = this.growingIO;
      const event = {
        eventType: 'CUSTOM',
        eventName: name,
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

  // 构建用户变量事件
  buildUserAttributesEvent = (attributes: { [key: string]: string }) => {
    const {
      dataStore: { eventContextBuilder, eventInterceptor, lastVisitEvent }
    } = this.growingIO;
    const event = {
      eventType: 'LOGIN_USER_ATTRIBUTES',
      attributes: ut.limitObject(attributes),
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
  };
}

export default { name: 'gioCustomTracking', method: GioCustomTracking };
