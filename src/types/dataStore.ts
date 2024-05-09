import { UserOptions } from '@@/types/base';
import { EventHooksType } from '@@/types/eventHooks';

export type StorageKeyType =
  | 'gsid'
  | 'originalSource'
  | 'uid'
  | 'sessionId'
  | 'userId'
  | 'userKey'
  | 'gioId';

export interface OriginOptions extends UserOptions {
  appId: string;
  dataSourceId?: string;
  projectId: string;
  trackingId: string;
}

export interface DataStoreType {
  buildAddFavorites: (trackingId: string, args: any) => void;
  buildAppMessageEvent: (trackingId: string, args: any) => void;
  buildTimelineEvent: (trackingId: string, args: any) => void;
  // 事件通用维度组装
  eventContextBuilder?: (
    trackingId: string,
    params?: any,
    executeAttributes?: boolean
  ) => any;
  eventConverter?: (event) => void;
  eventHooks: EventHooksType;
  eventInterceptor?: (event: any | void) => void;
  eventReleaseInspector?: () => void;
  generalProps: any;
  getStorageKey: (trackingId: string, name: StorageKeyType) => string;
  getTrackerVds: (trackingId: string) => any;
  getOption: (trackingId: string, k?: string) => OriginOptions;
  getOriginalSource: (trackingId: string) => any;
  getGsid: (trackingId: string) => number;
  setGsid: (trackingId: string, value: number) => void;
  initTrackerOptions: (userOptions: OriginOptions) => any;
  initTrackerHooker: (trackerOptions: OriginOptions) => void;
  initOptions: (userOptions: OriginOptions) => OriginOptions;
  initStorageInfo: (trackingId: string) => void;
  interceptEvents: any[];
  lastCloseTime: number;
  lastPageEvent: any;
  lastScene: number | string;
  lastVisitEvent: any;
  locationData: any;
  saveStorageInfo: () => void;
  scene: number | string;
  sendPage: (trackingId: string, props?: any) => void;
  sendVisit: (trackingId: string, props?: any) => void;
  setOption: (trackingId: string, k: string, v: any) => boolean;
  setOriginalSource: (trackingId: string, origins: any) => void;
  shareOut: boolean;
  toggleShareOut: (v?: boolean) => void;
  trackTimers?: any;
  initializedTrackingIds: string[];
  trackersExecute: (callback: (trackingId: string) => void) => void;
}
