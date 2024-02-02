import { UserOptions } from '@@/types/base';
import { EventHooksType } from '@@/types/eventHooks';

export interface OriginOptions extends UserOptions {
  appId: string;
  dataSourceId?: string;
  projectId: string;
}

export interface DataStoreType {
  buildAddFavorites: (args: any) => void;
  buildAppMessageEvent: (args: any) => void;
  buildTimelineEvent: (args: any) => void;
  eventContextBuilder: (params?: any) => any;
  eventConverter?: (event) => void;
  eventHooks: EventHooksType;
  eventInterceptor?: (event: any | void) => void;
  eventReleaseInspector?: () => void;
  generalProps: any;
  getOption: (k?: string) => OriginOptions;
  getOriginalSource: () => any;
  gsid: number;
  gsidStorageName: string;
  initOptions: (userOptions: OriginOptions) => void;
  initStorageInfo: () => void;
  interceptEvents: any[];
  keepAlive: number;
  lastCloseTime: number;
  lastPageEvent: any;
  lastScene: number | string;
  lastVisitEvent: any;
  locationData: any;
  originalSourceName: string;
  saveStorageInfo: () => void;
  scene: number | string;
  sendPage: (props?: any) => void;
  sendVisit: (props?: any) => void;
  setOption: (k: string, v: any) => boolean;
  setOriginalSource: (origins: any) => void;
  shareOut: boolean;
  toggleShareOut: (v?: boolean) => void;
  trackTimers?: any;
}
