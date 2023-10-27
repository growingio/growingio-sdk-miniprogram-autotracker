### 原生微信小程序开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# cdp埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 打包
rollup -c --cdp-wx
# 新建plugins目录
mkdir -p demos/native/weixin/utils
# 复制到demo目录
cp dist/cdp/wechat.js demos/native/weixin/utils/gio-cdp.js

