### 原生快手小程序开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# cdp埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 打包
rollup -c --cdp-ks
# 新建plugins目录
mkdir -p demos/native/kuaishou/utils
# 复制到demo目录
cp dist/cdp/kuaishou.js demos/native/kuaishou/utils/gio-cdp.js
