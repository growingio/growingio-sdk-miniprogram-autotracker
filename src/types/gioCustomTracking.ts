/**
 * 自定义埋点类型接口
 * @interface GioCustomTrackingType
 */
export interface GioCustomTrackingType {
  /**
   * 构建自定义埋点事件
   * @param {string} name 事件名称
   * @param {Object} properties 事件属性
   */
  buildCustomEvent: (
    name: string,
    properties: { [key: string]: string }
  ) => void;
  /**
   * 构建用户变量事件
   * @param {Object} attributes 用户属性
   */
  buildUserAttributesEvent?: (attributes: { [key: string]: string }) => void;
}
