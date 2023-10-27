### 原生淘宝小程序开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# 淘宝小程序上报适配插件
cp -n src/plugins\(external\)/frameworks/gioTaobaoSendAdapter.ts src/plugins/gioTaobaoSendAdapter.ts
# saas埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-saas.ts src/plugins/gioCustomTracking.ts
# saas无埋点插件
cp -n src/plugins\(external\)/ordinary/gioEventAutoTracking.ts src/plugins/gioEventAutoTracking.ts
# 曝光插件
cp -n src/plugins\(external\)/ordinary/gioImpressionTracking.ts src/plugins/gioImpressionTracking.ts
# 打包
rollup -c --saas-my-tb
# 新建plugins目录
mkdir -p demos/native/taobaowidget/widget/utils
mkdir -p demos/native/taobaowidget/client/utils
# 复制到demo目录
cp dist/saas/taobao.js demos/native/taobaowidget/widget/utils/gio-saas.js
cp dist/saas/taobao.js demos/native/taobaowidget/client/utils/gio-saas.js
