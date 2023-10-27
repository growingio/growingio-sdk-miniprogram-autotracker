/**
 * 名称：Remax代理插件
 * 用途：用于获取Remax框架下的自定义方法真实方法名获取。
 */
import { GrowingIOType } from '@@/types/growingIO';

// 字符释义：节点id-节点在上一层children数组中的下标
let handlerPath = [];
let ut, mName, nId;
class GioRemaxAdapter {
  private remax: any;
  private page: string;
  constructor(public growingIO: GrowingIOType) {
    ut = this.growingIO.utils;
    this.remax = this.growingIO?.vdsConfig?.remax;
    this.page = '';
    this.growingIO.emitter.on('minipLifecycle', ({ event, params }) => {
      if (event === 'Page onShow') {
        if (!this.remax) return;
        const { page } = params;
        const { dataStore, remaxVMs } = this.growingIO;
        const { customFcEffects } = dataStore.eventHooks;
        if (!remaxVMs) {
          this.growingIO.remaxVMs = {};
        }
        if (page && !this.growingIO.remaxVMs[page.route]) {
          this.growingIO.remaxVMs[page.route] = {};
        }
        this.page = page.route;
        // 页面第一次onShow的时候对页面中的自定义事件进行hook
        if (page && !this.growingIO.remaxVMs[page.route]?.hooked) {
          const methodKeys = ut
            .keys(page)
            .filter((o) => o.indexOf('$$REMAX_METHOD') > -1);
          methodKeys.forEach((o) => {
            page[o] = customFcEffects(o, page[o]);
          });
          // 获取节点数据存起来方便后面方法执行时查找对比方法名称
          this.growingIO.remaxVMs[page.route] = {
            hooked: true,
            fiberNode: this.findRealRoot(page),
            data: this.getTopView(page)
          };
        }
      }
    });
  }

  main = () => {
    // 插件挂载时可能还没取到
    if (!this.remax) {
      this.remax = this.growingIO?.vdsConfig?.remax;
    }
    const { nativeGrowing } = this.growingIO.dataStore.eventHooks;
    nativeGrowing();
  };

  // 获取remax代理后的数据树中真实的页面根节点(顶层的view节点)
  getTopView = (page) => {
    // data数据格式不一样，wx在__data__中，alipay在data中
    const d = (page.__data__ || page.data)?.root;
    const firstChild = ut.head(d.children);
    let topView;
    if (ut.isNumber(firstChild) && ut.has(d, 'nodes')) {
      // wx的children存的是节点id数组，需要从nodes中获取
      topView = d.nodes[ut.head(d.children)];
    } else if (ut.isObject(firstChild)) {
      // alipay的children存的是节点对象数组
      topView = firstChild;
    }
    return topView;
  };

  // 判断是否为页面根节点
  isPageTopView = (o, page) => {
    // 页面根节点上第一层view
    const topView = this.getTopView(page);
    // 获取判断目标的children
    const tc = ut.isArray(o?.memoizedProps?.children)
      ? ut.compact(o?.memoizedProps?.children)
      : [];
    // 认为一致的条件为节点类型一致且样式名一致且children个数一致
    return (
      o?.type === topView?.type &&
      o?.memoizedProps?.className === topView?.props?.class &&
      tc.length === topView?.children?.length
    );
  };

  // 遍历获取页面根节点
  fiberNodeTraverse = (fiberNode, page) => {
    if (this.isPageTopView(fiberNode, page)) {
      return fiberNode;
    } else if (fiberNode.child) {
      return this.fiberNodeTraverse(fiberNode.child, page);
    } else {
      return null;
    }
  };

  // 查找真实的页面根节点
  findRealRoot = (page) => {
    if (
      page?.wrapperRef?.current?._reactInternals &&
      (page.__data__ || page.data)
    ) {
      return this.fiberNodeTraverse(
        page.wrapperRef.current._reactInternals,
        page
      );
    } else {
      return null;
    }
  };

  // 获取自定义真实的方法名
  getHandlerName = (methodName) => {
    const vmPage = this.growingIO.remaxVMs[this.page];
    mName = methodName;
    nId = Number(ut.split(mName, '_')[2]);
    handlerPath = [];
    if (vmPage) {
      // 先在data中查找触发事件的目标节点、路径和位置
      this.getDataNodePath(vmPage.data);
      // 然后根据data中查找到的节点路径和位置取原始节点
      let targetNode = vmPage.fiberNode;
      const getPathNode = (p, props) => {
        const [_, nodeIndex] = ut.split(p, '-');
        if (ut.isArray(props.children)) {
          targetNode = ut.compact(props.children)[Number(nodeIndex)];
        } else if (ut.isObject(props.children)) {
          targetNode = props.children;
        }
        return targetNode;
      };
      // 所有路径上的节点，最后一个就是目标节点
      const pathNodes = handlerPath.map((o) => {
        return getPathNode(o, targetNode.props || targetNode.memoizedProps);
      });
      if (pathNodes.length === handlerPath.length) {
        const handleProps = ut.last(pathNodes).props;
        const handleType = ut.last(ut.split(mName, '_'));
        return handleProps[handleType].name;
      }
    }
  };

  // 获取data中触发事件的目标节点、路径和位置
  // nodes存在则children中项为id，不存在则children中项为节点对象
  getDataNodePath = ({ children, nodes }) => {
    let res = null;
    // 直接尝试在节点children层查找
    const target = children.find((o: number | any, i: number) => {
      const condition =
        (ut.toString(o) === ut.toString(nId) ||
          ut.toString(o.id) === ut.toString(nId)) &&
        Object.values((nodes ? nodes[o] : o).props).includes(mName);
      if (condition) {
        handlerPath.unshift(`${nodes ? o : o.id}-${i}`);
      }
      return condition;
    });
    // children层查不到开始遍历children层尝试下层查找
    if (!target) {
      children.every((o: number | any, i: number) => {
        if ((nodes ? nodes[o] : o).children) {
          res = this.getDataNodePath(nodes ? nodes[o] : o);
          if (res) {
            handlerPath.unshift(`${nodes ? o : o.id}-${i}`);
          }
          return !res;
        } else {
          // 无children直接跳下一个
          return true;
        }
      });
    } else {
      res = ut.isNumber(target) && nodes ? nodes[target] : target;
    }
    return res;
  };
}

export default { name: 'gioRemaxAdapter', method: GioRemaxAdapter };
