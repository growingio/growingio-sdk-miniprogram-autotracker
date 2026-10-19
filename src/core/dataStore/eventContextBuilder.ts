import { GrowingIOType } from '@@/types/growingIO';
import {
  getDynamicAttributes,
  getOS,
  getScreenHeight,
  getScreenWidth,
  limitObject
} from '@@/utils/tools';
import { isEmpty, unset } from '@@/utils/glodash';
import { PageContext } from '@@/types/eventHooks';

class EventContextBuilder {
  constructor(public growingIO: GrowingIOType) {}

  /**
   * 通用字段组装
   * @param {string} trackingId - 实例 ID
   * @param {any} [params] - 额外参数
   * @param {boolean} [executeAttributes=true] - 是否执行属性组装
   * @param {PageContext} [pageContext] - PAGE/VISIT 提前解析好的页面位置；
   *   title 与 master4.0 一样在会话字段获取后统一读取
   * @returns {any} - 组装后的事件上下文
   */
  main = (
    trackingId: string,
    params?: any,
    executeAttributes = true,
    pageContext?: PageContext
  ) => {
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
    // PAGE/VISIT 使用调用方确定的位置；其他事件只解析一次 path/query。
    // 此时不预读标题，会话获取可能同步触发补发事件或业务监听器。
    const resolvedPageContext =
      pageContext ||
      currentPage.getPageContext(trackingId, { resolveTitle: false });
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
      // path 和 query 必须来自同一个 resolvedPageContext；没有 path 说明页面尚未建立，
      // 此时 query 也置空，不能单独从历史事件补一个无归属的 query。
      path: resolvedPageContext.path,
      platform: platformConfig.platform,
      platformVersion:
        platformConfig.name +
        (systemInfo.version ? ` ${systemInfo.version}` : ''),
      query: resolvedPageContext.path ? resolvedPageContext.query : '',
      screenHeight: getScreenHeight(systemInfo),
      screenWidth: getScreenWidth(systemInfo),
      sdkVersion,
      sessionId: userStore.getSessionId(trackingId),
      // master4.0 默认使用主实例的插件占位标题，且在 getSessionId 后读取。
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
