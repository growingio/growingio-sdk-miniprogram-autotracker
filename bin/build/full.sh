### 全量打包逻辑

# 新建plugins目录
mkdir -p src/pluginsIn
# 移除已有文件
rm src/pluginsIn/*

### 打包逻辑
# 框架适配插件
cp src/pluginsOut/frameworks/gioTaroAdapter.ts src/pluginsIn/gioTaroAdapter.ts
cp src/pluginsOut/frameworks/gioUniAppAdapter.ts src/pluginsIn/gioUniAppAdapter.ts
# 埋点插件
cp src/pluginsOut/ordinary/gioCustomTracking.ts src/pluginsIn/gioCustomTracking.ts
# 无埋点插件
cp src/pluginsOut/ordinary/gioEventAutoTracking.ts src/pluginsIn/gioEventAutoTracking.ts
# 加密插件
cp src/pluginsOut/ordinary/gioCompress.ts src/pluginsIn/gioCompress.ts
# 曝光插件
cp src/pluginsOut/ordinary/gioImpressionTracking.ts src/pluginsIn/gioImpressionTracking.ts
# 打包
rollup -c rollup.config.js --framework-full
# 移除框架适配插件
rm src/pluginsIn/gioTaroAdapter.ts
rm src/pluginsIn/gioUniAppAdapter.ts
# 移除埋点插件
rm src/pluginsIn/gioCustomTracking.ts
# 移除无埋点插件
rm src/pluginsIn/gioEventAutoTracking.ts
# 移除加密插件
rm src/pluginsIn/gioCompress.ts
# 移除曝光插件
rm src/pluginsIn/gioImpressionTracking.ts
