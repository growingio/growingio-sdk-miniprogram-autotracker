### 原生淘宝小程序开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# cdp埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 淘宝小程序上报适配插件
cp -n src/plugins\(external\)/frameworks/gioTaobaoSendAdapter.ts src/plugins/gioTaobaoSendAdapter.ts
# 打包
rollup -c --cdp-my-tb
# 新建plugins目录
mkdir -p demos/native/taobaowidget/widget/utils
mkdir -p demos/native/taobaowidget/client/utils
# 复制到demo目录
cp dist/cdp/taobao.js demos/native/taobaowidget/widget/utils/gio-cdp.js
cp dist/cdp/taobao.js demos/native/taobaowidget/client/utils/gio-cdp.js
