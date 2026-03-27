import { EventTarget } from './base';

/**
 * 无埋点事件自动追踪类型接口
 * @interface GioEventAutoTrackingType
 */
export default interface GioEventAutoTrackingType {
  /**
   * 主入口函数
   * @param {EventTarget} event 事件对象
   * @param {string} eventName 事件名称
   */
  main: (event: EventTarget, eventName: string) => void;
  /**
   * 获取节点 XPath
   * @param {EventTarget} e 事件对象
   * @param {string} eventName 事件名称
   * @returns {string} XPath 字符串
   */
  getNodeXpath: (e: EventTarget, eventName: string) => string;
  /**
   * 构建点击事件
   * @param {EventTarget} e 事件对象
   * @param {string} eventName 事件名称
   */
  buildClickEvent: (e: EventTarget, eventName: string) => void;
  /**
   * 构建 Tab 点击事件
   * @param {any} tabItem Tab 项信息
   */
  buildTabClickEvent: (tabItem: any) => void;
  /**
   * 构建改变事件
   * @param {EventTarget} e 事件对象
   * @param {string} eventName 事件名称
   */
  buildChangeEvent: (e: EventTarget, eventName: string) => void;
  /**
   * 构建提交事件
   * @param {EventTarget} e 事件对象
   * @param {string} eventName 事件名称
   */
  buildSubmitEvent: (e: EventTarget, eventName: string) => void;
}
