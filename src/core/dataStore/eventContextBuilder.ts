import { GrowingIOType } from '@@/types/growingIO';
import {
  getDynamicAttributes,
  getOS,
  getScreenHeight,
  getScreenWidth,
  limitObject
} from '@@/utils/tools';
import { isEmpty, unset } from '@@/utils/glodash';

class EventContextBuilder {
  constructor(public growingIO: GrowingIOType) {}

  // 通用字段组装
  main = (trackingId: string, params?: any, executeAttributes = true) => {
    // 预置事件或者默认就是发给主实例的事件不需要传trackingId
    if (!trackingId) {
      trackingId = this.growingIO.trackingId;
    }
    const {
      sdkVersion,
      platformConfig,
      minipInstance,
      userStore,
      dataStore,
      dataStore: {
        scene,
        eventHooks: { currentPage },
        generalProps
      }
    } = this.growingIO;
    const { version, dataSourceId, appId, idMapping, ignoreFields } =
      dataStore.getTrackerVds(trackingId);
    const locationData = dataStore.locationData[trackingId];
    const { systemInfo = {}, network = {} } = minipInstance;
    const { brand, model, platform, language } = systemInfo;
    const pagePath = currentPage.getPagePath();
    // 事件主要内容组装
    const context: any = {
      appChannel: `scn:${scene || 'NA'}`,
      appVersion: version,
      dataSourceId: dataSourceId,
      deviceBrand: brand,
      deviceId: userStore.getUid(),
      deviceModel: model,
      deviceType: getOS(platform, platformConfig.name),
      domain: appId,
      language: language,
      latitude: locationData?.latitude,
      longitude: locationData?.longitude,
      networkState:
        network?.networkType?.result ||
        network?.networkType ||
        network?.type ||
        network?.subtype,
      operatingSystem: getOS(platform, platformConfig.name),
      path: pagePath, // 如果页面中的path取不到，说明页面没初始化
      platform: platformConfig.platform,
      platformVersion:
        platformConfig.name +
        (systemInfo.version ? ` ${systemInfo.version}` : ''),
      query: pagePath ? currentPage.getPageQuery() : '', // 如果页面中的path取不到，说明页面没初始化
      screenHeight: getScreenHeight(systemInfo),
      screenWidth: getScreenWidth(systemInfo),
      sdkVersion,
      sessionId: userStore.getSessionId(trackingId),
      title: currentPage.getPageTitle(),
      timestamp: Date.now(),
      timezoneOffset: new Date().getTimezoneOffset(),
      userId: userStore.getUserId(trackingId)
    };
    if (idMapping) {
      context.userKey = userStore.getUserKey(trackingId);
    }
    // 全局属性
    if (executeAttributes && !isEmpty(generalProps[trackingId])) {
      context.attributes = { ...generalProps[trackingId] };
    }
    // 属性格式化
    if (!isEmpty(context.attributes)) {
      context.attributes = limitObject(
        getDynamicAttributes({ ...context.attributes })
      );
    }
    if (!isEmpty(ignoreFields)) {
      ignoreFields.forEach((o) => {
        unset(context, o);
      });
    }
    // 此时可能存在数据为空的字段，在数据组装完成后由转换方法移除空值字段
    if (!isEmpty(params)) {
      return { ...context, ...params, trackingId };
    } else {
      return { ...context, trackingId };
    }
  };
}

export default EventContextBuilder;
