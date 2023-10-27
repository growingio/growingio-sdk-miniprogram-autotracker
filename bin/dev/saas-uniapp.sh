### UniApp开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# 框架适配插件
cp -n src/plugins\(external\)/frameworks/gioUniAppAdapter.ts src/plugins/gioUniAppAdapter.ts
# saas埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-saas.ts src/plugins/gioCustomTracking.ts
# saas无埋点插件
cp -n src/plugins\(external\)/ordinary/gioEventAutoTracking.ts src/plugins/gioEventAutoTracking.ts
# 曝光插件
cp -n src/plugins\(external\)/ordinary/gioImpressionTracking.ts src/plugins/gioImpressionTracking.ts
# 打包
rollup -c --saas-framework-uniapp
# 新建plugins目录
mkdir -p demos/uni-app/vue2/src/utils
mkdir -p demos/uni-app/vue3/src/utils
# 复制到demo目录
cp dist/saas/uniapp.js demos/uni-app/vue2/src/utils/gio-saas.js
cp dist/saas/uniapp.js demos/uni-app/vue3/src/utils/gio-saas.js
