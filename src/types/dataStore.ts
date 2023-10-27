import { UserOptions } from '@@/types/base';
import { EventHooksType } from '@@/types/eventHooks';

export interface OriginOptions extends UserOptions {
  projectId: string;
  dataSourceId?: string;
  appId: string;
}

export interface DataStoreType {
  trackTimers?: any;
  esidStorageName: string;
  esid: any;
  gsidStorageName: string;
  gsid: number;
  eventHooks: EventHooksType;
  scene: number | string;
  lastScene: number | string;
  shareOut: boolean;
  lastCloseTime: number;
  keepAlive: number;
  initStorageInfo: () => void;
  saveStorageInfo: () => void;
  toggleShareOut: (v?: boolean) => void;
  eventContextBuilder: (params?: any) => any;
  buildAppMessageEvent: (args: any) => void;
  buildTimelineEvent: (args: any) => void;
  buildAddFavorites: (args: any) => void;
  initOptions: (userOptions: OriginOptions) => void;
  setOption: (k: string, v: any) => boolean;
  getOption: (k?: string) => OriginOptions;
  sendVisit: () => void;
  sendPage: () => void;
  eventConverter?: (event) => void;
  eventInterceptor?: (event: any | void) => void;
  eventReleaseInspector?: () => void;
  lastVisitEvent: any;
  lastPageEvent: any;
  locationData: any;
  generalProps: any;
  interceptEvents: any[];
}
