import { EventTarget } from './base';

export default interface GioEventAutoTrackingType {
  main: (event: EventTarget, eventName: string) => void;
  getNodeXpath: (e: EventTarget, eventName: string) => string;
  buildClickEvent: (e: EventTarget, eventName: string) => void;
  buildTabClickEvent: (tabItem: any) => void;
  buildChangeEvent: (e: EventTarget, eventName: string) => void;
  buildSubmitEvent: (e: EventTarget, eventName: string) => void;
}
