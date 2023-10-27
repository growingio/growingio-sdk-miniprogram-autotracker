### UniApp开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# cdp埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 框架适配插件
cp -n src/plugins\(external\)/frameworks/gioUniAppAdapter.ts src/plugins/gioUniAppAdapter.ts
# 打包
rollup -c --cdp-framework-uniapp
# 新建plugins目录
mkdir -p demos/uni-app/vue2/src/utils
mkdir -p demos/uni-app/vue3/src/utils
# 复制到demo目录
cp dist/cdp/uniapp.js demos/uni-app/vue2/src/utils/gio-cdp.js
cp dist/cdp/uniapp.js demos/uni-app/vue3/src/utils/gio-cdp.js
