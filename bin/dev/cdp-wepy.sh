### Wepy开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# cdp埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 框架适配插件
cp -n src/plugins\(external\)/frameworks/gioWepyAdapter.ts src/plugins/gioWepyAdapter.ts
# 打包
rollup -c --cdp-framework-wepy
# 新建plugins目录
mkdir -p demos/wepy/src/utils
# 复制到demo目录
cp dist/cdp/wepy.js demos/wepy/src/utils/gio-cdp.js
