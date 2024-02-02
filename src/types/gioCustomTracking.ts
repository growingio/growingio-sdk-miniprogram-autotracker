export interface GioCustomTrackingType {
  // 构建自定义埋点事件
  buildCustomEvent: (
    name: string,
    properties: { [key: string]: string }
  ) => void;
  // 构建用户变量事件
  buildUserAttributesEvent?: (attributes: { [key: string]: string }) => void;
}
