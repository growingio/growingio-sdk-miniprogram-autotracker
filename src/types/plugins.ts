/**
 * 插件项接口
 * @interface PluginItem
 */
export interface PluginItem {
  /** 插件名称 */
  name: string;
  /** 插件方法 */
  method: (growingIO: any) => void;
  /** 插件配置 */
  options?: any;
}

/**
 * 插件管理类型接口
 * @interface PluginsType
 */
export interface PluginsType {
  gioCompress?: any;
  gioCustomTracking?: any;
  gioEventAutoTracking?: any;
  gioImpressionTracking?: any;
  gioPerformance?: any;
  gioTaobaoAdapter?: any;
  gioTaroAdapter?: any;
  gioMpxAdapter?: any;
  gioUniAppAdapter?: any;
  gioMultipleInstances?: any;
  /**
   * 内部插件初始化
   */
  innerPluginInit: () => void;
  /**
   * 外部插件初始化
   * @param {string} [folder] 文件夹路径
   */
  outerPluginInit?: (folder?: string) => void;
  /**
   * 安装插件
   * @param {string} pluginName 插件名称
   * @param {boolean} showLog 是否显示日志
   * @returns {boolean} 是否安装成功
   */
  install: (pluginName: string, showLog: boolean) => boolean;
  /**
   * 安装所有插件
   * @param {PluginItem[]} plugins 插件列表
   */
  installAll: (plugins: PluginItem[]) => void;
  /** 插件列表 */
  pluginItems: PluginItem[];
  /**
   * 卸载插件
   * @param {string} pluginName 插件名称
   * @returns {boolean} 是否卸载成功
   */
  uninstall: (pluginName: string) => boolean;
  /**
   * 卸载所有插件
   */
  uninstallAll: () => void;
}
