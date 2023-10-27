### 原生京东小程序开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# cdp埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 打包
rollup -c --cdp-jd
# 新建plugins目录
mkdir -p demos/native/jingdong/utils
# 复制到demo目录
cp dist/cdp/jingdong.js demos/native/jingdong/utils/gio-cdp.js
