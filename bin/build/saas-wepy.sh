### Wepy打包逻辑

# 新建plugins目录
mkdir -p src/plugins
# 移除已有文件
rm src/plugins/*

### Saas打包逻辑
# 框架适配插件
cp src/plugins\(external\)/frameworks/gioWepyAdapter.ts src/plugins/gioWepyAdapter.ts
# saas埋点插件
cp src/plugins\(external\)/ordinary/gioCustomTracking-saas.ts src/plugins/gioCustomTracking.ts
# saas无埋点插件
cp src/plugins\(external\)/ordinary/gioEventAutoTracking.ts src/plugins/gioEventAutoTracking.ts
# 曝光插件
cp src/plugins\(external\)/ordinary/gioImpressionTracking.ts src/plugins/gioImpressionTracking.ts
# 打包
npm run cBuild -- --saas-framework-wepy
# 移除框架适配插件
rm src/plugins/gioWepyAdapter.ts
# 移除埋点插件
rm src/plugins/gioCustomTracking.ts
# 移除无埋点插件
rm src/plugins/gioEventAutoTracking.ts
# 移除曝光插件
rm src/plugins/gioImpressionTracking.ts
