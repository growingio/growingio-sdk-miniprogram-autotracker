export interface PluginItem {
  name: string;
  method: (growingIO) => void;
  options?: any;
}

export interface PluginsType {
  gioCompress?: any;
  gioCustomTracking?: any;
  gioEventAutoTracking?: any;
  gioImpressionTracking?: any;
  gioPerformance?: any;
  gioTaobaoAdapter?: any;
  gioTaroAdapter?: any;
  gioUniAppAdapter?: any;
  gioMultipleInstances?: any;
  innerPluginInit: () => void;
  outerPluginInit?: (folder?: string) => void;
  install: (pluginName: string, showLog: boolean) => boolean;
  installAll: (plugins: PluginItem[]) => void;
  pluginItems: PluginItem[];
  uninstall: (pluginName: string) => boolean;
  uninstallAll: () => void;
}
