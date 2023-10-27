export interface PluginItem {
  name: string;
  method: (growingIO) => void;
  options?: any;
}

export interface PluginsType {
  gioChameleonAdapter?: any;
  gioCompress?: any;
  gioCustomTracking?: any;
  gioEventAutoTracking?: any;
  gioImpressionTracking?: any;
  gioMultiIntegrate?: any;
  gioPerformance?: any;
  gioRemaxAdapter?: any;
  gioTaobaoSendAdapter?: any;
  gioTaroAdapter?: any;
  gioUniAppAdapter?: any;
  gioWepyAdapter?: any;
  innerPluginInit: () => void;
  outerPluginInit?: (folder?: string) => void;
  install: (pluginName: string, showLog: boolean) => boolean;
  installAll: (plugins: PluginItem[]) => void;
  pluginItems: PluginItem[];
  uninstall: (pluginName: string) => boolean;
  uninstallAll: () => void;
}
