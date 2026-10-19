import { splitPath } from './tools';

/** 判断查询目标是否为页面；组件携带所属页信息时仍保留组件身份。 */
export const isPageTarget = (page: any) =>
  !!page &&
  !page.isComponent &&
  page.mpType !== 'component' &&
  page.$vm?.mpType !== 'component' &&
  page.$page?.$id === undefined &&
  !!getPageIdentityPath(page);

/** 只读取给定对象的页面身份，不回退页面栈或历史事件。 */
export const getPageIdentityPath = (page: any): string =>
  page?.route ||
  page?.uri ||
  page?.__route__ ||
  page?.$vm?.__route__ ||
  splitPath(page?.$page?.fullPath || page?.$taroPath)[0] ||
  '';
