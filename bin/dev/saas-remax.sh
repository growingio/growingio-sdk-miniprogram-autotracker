### Remax打包逻辑

# 新建plugins目录
mkdir -p src/plugins

# 框架适配插件
cp -n src/plugins\(external\)/frameworks/gioRemaxAdapter.ts src/plugins/gioRemaxAdapter.ts
# saas埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-saas.ts src/plugins/gioCustomTracking.ts
# saas无埋点插件
cp -n src/plugins\(external\)/ordinary/gioEventAutoTracking.ts src/plugins/gioEventAutoTracking.ts
# 曝光插件
cp -n src/plugins\(external\)/ordinary/gioImpressionTracking.ts src/plugins/gioImpressionTracking.ts
# 打包
rollup -c --saas-framework-remax
# 新建plugins目录
mkdir -p demos/remax/src/utils
# 复制到demo目录
cp dist/saas/remax.js demos/remax/src/utils/gio-saas.js
