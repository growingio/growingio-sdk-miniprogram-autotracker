### 原生快应用开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# cdp埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 无埋点插件
cp -n src/plugins\(external\)/ordinary/gioEventAutoTracking.ts src/plugins/gioEventAutoTracking.ts
# 打包
rollup -c --cdp-quickapp
# 新建plugins目录
mkdir -p demos/native/quickapp/src/utils
# 复制到demo目录
cp dist/cdp/quickapp.js demos/native/quickapp/src/utils/gio-cdp.js
