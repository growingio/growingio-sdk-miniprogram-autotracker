### 全量打包逻辑

# 新建plugins目录
mkdir -p src/plugins
# 移除已有文件
rm src/plugins/*

### CDP打包逻辑
# 框架适配插件
cp src/plugins\(external\)/frameworks/gioChameleonAdapter.ts src/plugins/gioChameleonAdapter.ts
cp src/plugins\(external\)/frameworks/gioRemaxAdapter.ts src/plugins/gioRemaxAdapter.ts
cp src/plugins\(external\)/frameworks/gioTaroAdapter.ts src/plugins/gioTaroAdapter.ts
cp src/plugins\(external\)/frameworks/gioUniAppAdapter.ts src/plugins/gioUniAppAdapter.ts
cp src/plugins\(external\)/frameworks/gioWepyAdapter.ts src/plugins/gioWepyAdapter.ts
# cdp埋点插件
cp src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 无埋点插件
cp src/plugins\(external\)/ordinary/gioEventAutoTracking.ts src/plugins/gioEventAutoTracking.ts
# 加密插件
cp src/plugins\(external\)/ordinary/gioCompress.ts src/plugins/gioCompress.ts
# 曝光插件
cp src/plugins\(external\)/ordinary/gioImpressionTracking.ts src/plugins/gioImpressionTracking.ts
# 打包
npm run cBuild -- --cdp-framework-full
# 移除框架适配插件
rm src/plugins/gioChameleonAdapter.ts
rm src/plugins/gioRemaxAdapter.ts
rm src/plugins/gioTaroAdapter.ts
rm src/plugins/gioUniAppAdapter.ts
rm src/plugins/gioWepyAdapter.ts
# 移除埋点插件
rm src/plugins/gioCustomTracking.ts
# 移除无埋点插件
rm src/plugins/gioEventAutoTracking.ts
# 移除加密插件
rm src/plugins/gioCompress.ts
# 移除曝光插件
rm src/plugins/gioImpressionTracking.ts
