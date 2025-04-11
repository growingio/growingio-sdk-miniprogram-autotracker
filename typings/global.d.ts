declare interface Window {
  gioSdkInstalled: boolean;
  gio: any;
  GioApp: any;
  GioPage: any;
  GioComponent: any;
}

declare var global: any;
declare var $global: any;
declare var document: Document;
declare var App: any;
declare var Page: any;
declare var Component: any;
declare var Behavior: any;
declare var SelectorQuery: any;
declare var getApp: any;

// platform
declare var wx: any;
declare var swan: any;
declare var my: any;
declare var qq: any;
declare var tt: any;
declare var ks: any;
declare var jd: any;
declare var xhs: any;
declare var quickapp: any;
declare var __wxAppCode__: any;
declare var __wxConfig: any;
declare var appConfig: any; // swan的全局配置
declare var __myConfig: any; // my的全局配置
declare var TMAConfig: any; // tt的全局配置
declare var __ttConfig: any; // tt的全局配置
declare var __allConfig__: any;
declare var __qqConfig: any; // qq的全局配置
declare var __ksConfig: any; // ks的全局配置
declare var __module__: any;
declare var __jdConfig: any; // jd的全局配置
declare var __jdAppCode__: any; 
declare var __MP_APP_JSON_MIGRATION__: any; // xhs的全局配置
declare var __MP_APP_JSON__: any; // xhs的全局配置
declare var __proto__: any;
declare var Taro: any
declare var uni: any

declare module "__GIO_PLATFORM_CONFIG__" {
  let module: any;
  export default module;
}

declare module "__GIO_PLATFORM_INSTANCE__" {
  let module: any;
  export default module;
}

declare module "__GIO_PLUGIN_INSTANCE__" {
  let module: any;
  export default module;
}

declare module "@system.app" {
  let module: any;
  export default module;
}

declare module "@system.storage" {
  let module: any;
  export default module;
}

declare module "@system.network" {
  let module: any;
  export default module;
}

declare module "@system.device" {
  let module: any;
  export default module;
}

declare module "@system.geolocation" {
  let module: any;
  export default module;
}

declare module "@system.fetch" {
  let module: any;
  export default module;
}

declare module "@system.router" {
  let module: any;
  export default module;
}

declare module "@system.image" {
  let module: any;
  export default module;
}

declare module "@system.share" {
  let module: any;
  export default module;
}