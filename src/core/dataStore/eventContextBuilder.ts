import { GrowingIOType } from '@@/types/growingIO';
import { getOS, getScreenHeight, getScreenWidth } from '@@/utils/tools';
import { isEmpty, unset } from '@@/utils/glodash';

class EventContextBuilder {
  constructor(public growingIO: GrowingIOType) {}

  // 通用字段组装
  main = (params?: any) => {
    const {
      sdkVersion,
      vdsConfig,
      platformConfig,
      minipInstance,
      userStore,
      dataStore: { scene, eventHooks, locationData, lastVisitEvent }
    } = this.growingIO;
    const { systemInfo = {}, network = {} } = minipInstance;
    const { brand, model, platform, language, version } = systemInfo;
    // 事件主要内容组装
    const context: any = {
      appChannel: `scn:${scene || 'NA'}`,
      appVersion: vdsConfig.version,
      dataSourceId: vdsConfig.dataSourceId,
      deviceBrand: brand,
      deviceId: userStore.uid,
      deviceModel: model,
      deviceType: getOS(platform, platformConfig.name),
      domain: vdsConfig.appId,
      language: language,
      latitude: locationData?.latitude,
      longitude: locationData?.longitude,
      networkState: network?.networkType || network?.type || network?.subtype,
      operatingSystem: getOS(platform, platformConfig.name),
      path: eventHooks.currentPage?.path
        ? eventHooks.currentPage?.path
        : lastVisitEvent.path, // 如果页面中的path取不到，说明页面没初始化，还在app的生命周期中（appOnLoad/appOnShow），需要拿visit的path补上
      platform: platformConfig.platform,
      platformVersion: platformConfig.name + (version ? ` ${version}` : ''),
      query: eventHooks.currentPage?.path
        ? eventHooks.currentPage?.query
        : lastVisitEvent.query, // 如果页面中的path取不到，说明页面没初始化，还在app的生命周期中（appOnLoad/appOnShow），需要拿visit的query补上
      screenHeight: getScreenHeight(systemInfo),
      screenWidth: getScreenWidth(systemInfo),
      sdkVersion,
      sessionId: userStore.sessionId,
      title:
        eventHooks.currentPage?.title ||
        minipInstance.getPageTitle(minipInstance.getCurrentPage()),
      timestamp: Date.now(),
      timezoneOffset: new Date().getTimezoneOffset(),
      userId: userStore.userId
    };
    if (vdsConfig.idMapping) {
      context.userKey = userStore.userKey;
    }
    if (!isEmpty(vdsConfig.ignoreFields)) {
      vdsConfig.ignoreFields.forEach((o) => {
        unset(context, o);
      });
    }
    // 此时可能存在数据为空的字段，在数据组装完成后由转换方法移除空值字段
    if (!isEmpty(params)) {
      return { ...context, ...params };
    }
    return context;
  };
}

export default EventContextBuilder;
