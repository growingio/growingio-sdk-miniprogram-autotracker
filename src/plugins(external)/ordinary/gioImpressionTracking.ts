/**
 * 名称：半自动浏览埋点插件
 * 用途：用于提供半自动浏览埋点事件的自动注册、参数检验构建和创建事件方法。
 */
import { GrowingIOType } from '@@/types/growingIO';

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
    this.proxyComponentOverriding();
    const { emitter, minipInstance } = this.growingIO;
    this.growingIO.updateImpression = (collect: any) => {
      if (!collect) {
        collect = minipInstance.getCurrentPage();
      }
      minipInstance.initImpression(collect);
    };
    emitter.on('minipLifecycle', ({ event, params }) => {
      const { minipInstance } = this.growingIO;
      if (event === 'Page onShowEnd') {
        const collect = minipInstance.getCurrentPage();
        // 初始化监听页面曝光埋点
        minipInstance.initImpression(collect);
        // 初始化监听页面中自定义组件曝光埋点
        const collectComponent = collect.selectComponent(
          '.growing_collect_imp_component'
        );
        if (collectComponent) {
          minipInstance.initImpression(collectComponent);
        }
      }
      if (['Page onHide', 'Page onUnload'].includes(event)) {
        // 页面隐藏时销毁曝光监听
        const route = params.page.route;
        const observers = Object.values(this.observerIds[route] ?? {});
        observers.forEach((o: any) => o.disconnect());
      }
    });
  }

  // 重写Component hook的逻辑，添加注册组件曝光逻辑
  proxyComponentOverriding = () => {
    const self = this;
    const originOverrid =
      this.growingIO.dataStore.eventHooks.componentOverriding;
    this.growingIO.dataStore.eventHooks.componentOverriding = function () {
      const options = originOverrid.apply(this, arguments);
      // hook pageLifetimes show用于组件中注册曝光
      if (!options.pageLifetimes) {
        options.pageLifetimes = {};
      }
      // 页面进入时发起监听
      if (!options.pageLifetimes.show) {
        options.pageLifetimes.show = function () {};
      }
      const originShow = options.pageLifetimes.show;
      options.pageLifetimes.show = function () {
        const r = originShow.apply(this, arguments);
        self.growingIO.minipInstance.initImpression(this);
        return r;
      };
      return options;
    };
  };

  // 判断是否为相同的监听节点
  isEqualRects = (rs: any[], route: string, nodeId: string) => {
    const controlGroup = ((this.rects[route] ?? {})[nodeId] ?? []).map((o) =>
      ut.hashCode(JSON.stringify(o))
    );
    const comparisonGroup = (rs ?? []).map((o) =>
      ut.hashCode(JSON.stringify(o))
    );
    return ut.isEqualArray(controlGroup, comparisonGroup);
  };

  // 获取到可监听节点后校验节点信息
  rectobserve = (rect, collectTarget, optionKey) => {
    const nodeId = collectTarget.__wxExparserNodeId__;
    const page = collectTarget.route
      ? collectTarget
      : this.growingIO.minipInstance.getCurrentPage();
    // 监听的节点和上一次的不一致，或者监听的组件或页面的监听已经被注销时，可以继续生成新的监听
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
    const route = collectTarget.route;
    // 页面中存在曝光标记的节点才监听
    // 有route字段的是页面，没有的是组件内部
    const query = route
      ? this.growingIO.minipInstance.minip?.createSelectorQuery()
      : this.growingIO.minipInstance.minip
          ?.createSelectorQuery()
          .in(collectTarget);
    if (['ks', 'qq'].includes(gioPlatform)) {
      query.selectAll('.growing_collect_imp').boundingClientRect(([rect]) => {
        this.rectobserve(rect, collectTarget, optionKey);
      });
      query.exec();
    } else {
      query.selectAll('.growing_collect_imp').boundingClientRect();
      query.exec(([rect]) => {
        this.rectobserve(rect, collectTarget, optionKey);
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

    const nodeId = collectTarget.__wxExparserNodeId__;

    // 给页面创建监听
    const creatPageObserver = () => {
      if (!this.observerIds[collectTarget.route]) {
        this.observerIds[collectTarget.route] = {};
      }
      // 存在页面id一致的监听时要先移除监听，防止重复监听重复触发
      const originObserver = this.observerIds[collectTarget.route][nodeId];
      if (originObserver && !originObserver._disconnected) {
        originObserver.disconnect();
      }
      // 创建一个新的监听
      let observer = minipInstance.minip?.createIntersectionObserver(
        collectTarget,
        observerOption
      );
      observer = observer.relativeToViewport();
      // 不管原先是否创建过，直接覆盖（obeserverId会更新）
      this.observerIds[collectTarget.route][nodeId] = observer;
      // 添加监听回调
      this.targetObserve(observer, collectTarget);
    };

    // 给组件创建监听（组件需要从页面中selectComponent获取）
    const createComponentObserver = () => {
      const page = minipInstance.getCurrentPage();
      const collectComponent = page?.selectComponent(
        '.growing_collect_imp_component'
      );
      // 判断页面中是否存在需要被监听的自定义组件
      if (collectComponent) {
        if (!this.observerIds[page.route]) {
          this.observerIds[page.route] = {};
        }
        // 存在组件id一致的监听时要先移除监听，防止重复监听重复触发
        const originObserver = this.observerIds[page.route][nodeId];
        if (originObserver && !originObserver._disconnected) {
          originObserver.disconnect();
        }
        // 创建一个新的监听
        let observer = minipInstance.minip?.createIntersectionObserver(
          collectComponent,
          observerOption
        );
        observer = observer.relativeToViewport();
        // 不管原先是否创建过，直接覆盖（obeserverId会更新）
        this.observerIds[page.route][nodeId] = observer;
        // 添加监听回调
        this.targetObserve(observer, page);
      }
    };
    // uniapp是组件和页面一体，所以要分两次尝试监听；原生是组件和页面互相独立，按类型监听
    // 自定义组件是不能直接在页面上被拿到，所以直接监听页面不会监听到自定义组件
    if (
      collectTarget.isComponent ||
      !collectTarget.route ||
      collectTarget.mpType === 'component'
    ) {
      createComponentObserver();
    } else {
      creatPageObserver();
    }
  };

  // 给目标节点添加监听回调
  targetObserve = (observerTarget: any, collectPage: any) => {
    const { taro } = this.growingIO.vdsConfig;
    // 监听节点变化
    observerTarget.observe('.growing_collect_imp', async (result: any) => {
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
        if (dataProperties.eventId) {
          this.buildImpEvent(dataProperties);
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
      eventId: undefined,
      properties: {}
    };
    if (!dataSet?.gioImpTrack) {
      return data;
    } else {
      data.eventId = dataSet.gioImpTrack;
    }
    if (ut.has(dataSet, 'gioImpAttrs')) {
      // imp写法二
      data.properties = ut.niceTry(() =>
        ut.isObject(dataSet.gioImpAttrs)
          ? dataSet.gioImpAttrs
          : JSON.parse(dataSet.gioImpAttrs)
      );
      // 兼容cdp的items
      data.items = ut.niceTry(() =>
        ut.isObject(dataSet.gioImpItems)
          ? dataSet.gioImpItems
          : JSON.parse(dataSet.gioImpItems)
      );
    } else {
      // imp写法一
      const propReg = /^gioTrack(.+)/;
      for (const key in dataSet) {
        let normKey;
        const matchArr = key.match(propReg);
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
    data.items = ut.limitObject(data.items);
    // 校验eventId
    const eventIdReg = /^\w+$/;
    if (
      !eventIdReg.test(data.eventId) ||
      Number.isInteger(Number.parseInt(ut.head(data.eventId.split('')), 10))
    ) {
      data.eventId = null;
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
  buildImpEvent = (dataProperties: any) => {
    const { eventId, properties, items } = dataProperties;
    const {
      dataStore: { eventContextBuilder, eventInterceptor, eventHooks }
    } = this.growingIO;
    const event = {
      eventType: 'CUSTOM',
      pageShowTimestamp: eventHooks.currentPage.time,
      eventName: eventId,
      attributes: properties,
      resourceItem: items,
      ...eventContextBuilder()
    };
    eventInterceptor(event);
  };
}

export default { name: 'gioImpressionTracking', method: GioImpressionTracking };
