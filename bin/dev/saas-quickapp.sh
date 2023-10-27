### 原生快应用开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# saas埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-saas.ts src/plugins/gioCustomTracking.ts
# saas无埋点插件
cp -n src/plugins\(external\)/ordinary/gioEventAutoTracking.ts src/plugins/gioEventAutoTracking.ts
# 打包
rollup -c --saas-quickapp
# 新建plugins目录
mkdir -p demos/native/quickApp/utils
# 复制到demo目录
cp dist/saas/quickapp.js demos/native/quickApp/src/utils/gio-saas.js
