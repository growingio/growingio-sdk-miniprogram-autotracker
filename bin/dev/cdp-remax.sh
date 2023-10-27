### Remax开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# cdp埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 框架适配插件
cp -n src/plugins\(external\)/frameworks/gioRemaxAdapter.ts src/plugins/gioRemaxAdapter.ts
# 打包
rollup -c --cdp-framework-remax
# 新建plugins目录
mkdir -p demos/remax/src/utils
# 复制到demo目录
cp dist/cdp/remax.js demos/remax/src/utils/gio-cdp.js
