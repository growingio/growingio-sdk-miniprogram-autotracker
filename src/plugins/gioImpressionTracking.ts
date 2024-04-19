/**
 * 名称：半自动浏览埋点插件
 * 用途：用于提供半自动浏览埋点事件的自动注册、参数检验构建和创建事件方法。
 */
import { IMP_DATA_REG } from '@@/constants/regex';
import { GrowingIOType } from '@@/types/growingIO';
import {
  compact,
  isArray,
  isEmpty,
  isEqualArray,
  isString,
  toString
} from '@@/utils/glodash';
import { eventNameValidate, hashCode, niceTry } from '@@/utils/tools';
import EMIT_MSG from '@@/constants/emitMsg';

let ut;
class GioImpressionTracking {
  public observerIds: any;
  public rects: any;
  public pageImpObserver: any;
  public componentImpObserver: any;
  public pageQueryTarget: any;
  public componentQueryTarget: any;
  public sentImps: any;
  constructor(public growingIO: GrowingIOType) {
    ut = this.growingIO.utils;
    this.observerIds = {};
    this.rects = {};
    this.sentImps = {};
    const { emitter, minipInstance } = this.growingIO;
    this.growingIO.updateImpression = (collect: any) => {
      if (!collect) {
        collect = minipInstance.getCurrentPage();
      }
      minipInstance.initImpression(collect);
    };
    emitter.on(EMIT_MSG.MINIP_LIFECYCLE, ({ event, params }) => {
      const { minipInstance } = this.growingIO;
      if (event === 'Page onShowEnd') {
        const page = minipInstance.getCurrentPage();
        this.traverseListen(page);
      }
      if (['Page onHide', 'Page onUnload'].includes(event)) {
        // 页面隐藏时销毁曝光监听
        const route = params.page.route;
        const observers = Object.values(this.observerIds[route] ?? {});
        observers.forEach((o: any) => o.disconnect());
      }
    });
  }

  // 遍历页面中的自定义组件进行监听
  traverseListen = (target: any) => {
    const { minipInstance } = this.growingIO;
    if (ut.isFunction(target?.selectAllComponents)) {
      const selects = target?.selectAllComponents(
        '.growing_collect_imp_component'
      );
      if (!ut.isEmpty(selects)) {
        selects.forEach((s) => {
          this.traverseListen(s);
        });
      }
    }
    minipInstance.initImpression(target);
  };

  // 判断是否为相同的监听节点
  // 这个方法中的hashCode和isEqualArray要直接引入使用，否则可能会在jd/my/tb小程序中出现找不到的情况（运行时机问题）
  isEqualRects = (rs: any[], route: string, nodeId: string) => {
    const controlGroup = ((this.rects[route] ?? {})[nodeId] ?? []).map((o) =>
      hashCode(JSON.stringify(o))
    );
    const comparisonGroup = (rs ?? []).map((o) => hashCode(JSON.stringify(o)));
    return isEqualArray(controlGroup, comparisonGroup);
  };

  // 获取nodeId
  getNodeId = (collectTarget: any) => {
    const { gioPlatform } = this.growingIO;
    switch (gioPlatform) {
      case 'wx':
      case 'qq':
      case 'ks':
      case 'jd':
        return collectTarget.__wxExparserNodeId__; // wx page/component
      case 'my':
      case 'tb':
        return collectTarget.$page
          ? `${collectTarget.$page.$id}-${collectTarget.$id}` //my component
          : collectTarget.$id; // my page
      case 'swan':
        return collectTarget.route
          ? toString(hashCode(collectTarget.route)) // swan page
          : collectTarget.nodeId; // swan component
      case 'tt':
        return collectTarget.route
          ? toString(hashCode(collectTarget.route)) // swan page
          : collectTarget.__nodeId__; // swan component
      default:
        break;
    }
  };

  // 获取到可监听节点后校验节点信息
  rectobserve = (rect, collectTarget, optionKey) => {
    const { gioPlatform } = this.growingIO;
    if (
      (gioPlatform === 'tt' && collectTarget.__nodeId__) ||
      (gioPlatform === 'ks' && collectTarget.is)
    ) {
      // 字节和快手小程序页面监听时可以拿到自定义组件一次性完成监听，所以组件的节点实例不再处理
      return false;
    }
    const nodeId = this.getNodeId(collectTarget);
    const page = collectTarget.route
      ? collectTarget
      : this.growingIO.minipInstance.getCurrentPage();
    // 监听的目标页面和上一次的不一致，或者监听的组件或页面的监听已经被注销时，可以继续生成新的监听
    let observerNeedNew = false;
    if (page.route) {
      const isEqualRects = this.isEqualRects(rect, page.route, nodeId);
      const disconnect = ut.get(
        this.observerIds,
        `${page.route}.${nodeId}._disconnected`
      );
      observerNeedNew = !isEqualRects || disconnect !== false;
    }
    if (
      ut.isArray(rect) &&
      !ut.isEmpty(rect) &&
      !ut.isNil(rect[0]) &&
      observerNeedNew
    ) {
      if (ut.isEmpty(this.rects[page.route])) {
        this.rects[page.route] = {};
      }
      this.rects[page.route][nodeId] = rect;
      this.creatObserver(collectTarget, optionKey);
    }
  };

  // swan、my中optionKey为'selectAll'，其他为'observeAll'，不含快应用
  main = (collectTarget: any, optionKey: 'observeAll' | 'selectAll') => {
    const { gioPlatform } = this.growingIO;
    // 页面中存在曝光标记的节点才监听
    // 有route字段的是页面，没有的是组件内部
    const query = collectTarget.route
      ? this.growingIO.minipInstance.minip?.createSelectorQuery()
      : this.growingIO.minipInstance.minip
          ?.createSelectorQuery()
          .in(collectTarget);
    if (['ks', 'qq'].includes(gioPlatform)) {
      query
        .selectAll('.growing_collect_imp')
        .boundingClientRect(([rect = []]) => {
          rect = ut.isArray(rect) ? rect : [rect];
          if (!isEmpty(rect)) {
            this.rectobserve(rect, collectTarget, optionKey);
          }
        });
      query.exec();
    } else {
      query.selectAll('.growing_collect_imp').boundingClientRect();
      query.exec(([rect]) => {
        if (!isEmpty(rect)) {
          this.rectobserve(rect, collectTarget, optionKey);
        }
      });
    }
  };

  // 创建监听
  creatObserver = (
    collectTarget: any,
    optionKey: 'observeAll' | 'selectAll'
  ) => {
    const { gioPlatform, minipInstance } = this.growingIO;
    // 初始化监听对象
    const observerOption = { [optionKey]: true };
    if (
      ['tb', 'my'].includes(gioPlatform) &&
      ut.compareVersion(my.SDKVersion, '2.7.0') >= -1
    ) {
      observerOption.dataset = true;
    }
    const nodeId = this.getNodeId(collectTarget);
    let page = collectTarget;
    // uniapp是组件和页面一体，所以要分两次尝试监听；原生是组件和页面互相独立，按类型监听
    // 自定义组件是不能直接在页面上被拿到，所以直接监听页面不会监听到自定义组件
    if (
      collectTarget.isComponent ||
      !collectTarget.route ||
      collectTarget.mpType === 'component'
    ) {
      page = minipInstance.getCurrentPage();
    }
    if (!this.observerIds[page.route]) {
      this.observerIds[page.route] = {};
    }
    // 存在组件id一致的监听时要先移除监听，防止重复监听重复触发
    const originObserver = this.observerIds[page.route][nodeId];
    if (originObserver && !originObserver._disconnected) {
      originObserver.disconnect();
    }
    // 创建一个新的监听
    let observer = ['swan', 'jd'].includes(gioPlatform)
      ? minipInstance.minip?.createIntersectionObserver(
          collectTarget,
          observerOption
        )
      : collectTarget.createIntersectionObserver(observerOption);
    observer = observer.relativeToViewport();
    // 不管原先是否创建过，直接覆盖（obeserverId会更新）
    this.observerIds[page.route][nodeId] = observer;
    // 添加监听回调
    this.targetObserve(observer, page);
  };

  // 给目标节点添加监听回调
  targetObserve = (observerTarget: any, collectPage: any) => {
    const { taro } = this.growingIO.vdsConfig;
    // 监听节点变化
    observerTarget.observe('.growing_collect_imp', (result: any) => {
      if (!ut.isEmpty(result) && result.intersectionRatio > 0) {
        let dataset: any = result.dataset;
        if (taro && ut.isTaro3(taro)) {
          dataset = this.getTaro3Dataset(collectPage.route, result.id);
        }
        const dataProperties = this.getImpressionProperties(dataset);
        // 曝光类型判断，单次曝光的需要有id和gio-imp-type字段
        const sentId = result.id;
        if (sentId) {
          if (dataset.gioImpType === 'once' && ut.has(this.sentImps, sentId)) {
            return;
          } else {
            this.sentImps[sentId] = dataProperties;
          }
        }
        if (dataProperties.eventName) {
          let sendTargets = [];
          if (dataset.gioImpSendto) {
            // 先尝试处理成数组
            sendTargets = compact(
              isArray(dataset.gioImpSendto)
                ? dataset.gioImpSendto
                : niceTry(() => JSON.parse(dataset.gioImpSendto)) || []
            );
            // 在尝试处理字符串
            if (isEmpty(sendTargets)) {
              niceTry(() =>
                dataset.gioImpSendto.split(',').forEach((s: string) => {
                  s = isString(s) && s.trim().replace('[', '').replace(']', '');
                  if (s) {
                    sendTargets.push(s);
                  }
                })
              );
            }
          }
          this.buildImpEvent(dataProperties, sendTargets);
        } else {
          ut.consoleText(
            '曝光事件格式不正确，事件名只能包含数字、字母和下划线，且不以数字开头!',
            'warn'
          );
        }
      }
    });
  };

  // 曝光参数获取
  getImpressionProperties = (dataSet: any) => {
    let data: any = {
      eventName: undefined,
      properties: {}
    };
    if (!dataSet?.gioImpTrack) {
      return data;
    } else {
      data.eventName = dataSet.gioImpTrack;
    }
    if (ut.has(dataSet, 'gioImpAttrs')) {
      // imp写法二
      data.properties = ut.niceTry(() =>
        ut.isObject(dataSet.gioImpAttrs)
          ? dataSet.gioImpAttrs
          : JSON.parse(dataSet.gioImpAttrs)
      );
    } else {
      // imp写法一
      for (const key in dataSet) {
        let normKey;
        const matchArr = key.match(IMP_DATA_REG);
        if (matchArr) {
          normKey = ut.lowerFirst(matchArr[1]);
          if (normKey !== 'track') {
            data.properties[normKey] = dataSet[key];
          }
        }
      }
    }
    // 对参数对象进行限制
    data.properties = ut.limitObject(data.properties);
    // 校验eventName
    const validate = eventNameValidate(data.eventName, () => {
      return data;
    });
    if (!validate) {
      data.eventName = null;
      data = {};
    }
    return data;
  };

  // 获取Taro3节点上的dataset
  getTaro3Dataset = (route: string, targetId: string) => {
    const page = this.growingIO?.taro3VMs[route];
    if (!page) {
      return false;
    }
    let impDataset = {};
    const searchTraverse = (n: any) => {
      n.some((o: any) => {
        if (
          (o.uid === targetId || o.sid === targetId) &&
          o.props?.class.indexOf('growing_collect_imp') > -1 &&
          !ut.isEmpty(o.dataset)
        ) {
          impDataset = o.dataset;
          return true;
        } else if (Array.isArray(o.childNodes)) {
          return searchTraverse(o.childNodes);
        } else {
          return false;
        }
      });
    };
    searchTraverse(page.childNodes);
    return impDataset;
  };

  // 创建半自动曝光事件
  buildImpEvent = (dataProperties: any, sendTargets: string[]) => {
    const { eventName, properties } = dataProperties;
    const {
      trackingId,
      dataStore: { eventContextBuilder, eventConverter },
      plugins
    } = this.growingIO;
    const event = {
      eventType: 'CUSTOM',
      eventName,
      attributes: properties,
      ...eventContextBuilder(trackingId)
    };
    if (plugins.gioMultipleInstances && !isEmpty(sendTargets)) {
      event['&&sendTo'] = sendTargets;
    }
    eventConverter(event);
  };
}

export default { name: 'gioImpressionTracking', method: GioImpressionTracking };
