### 全量打包逻辑

# 新建plugins目录
mkdir -p src/plugins

### CDP打包逻辑
# 框架适配插件
cp -n src/plugins\(external\)/frameworks/gioChameleonAdapter.ts src/plugins/gioChameleonAdapter.ts
cp -n src/plugins\(external\)/frameworks/gioRemaxAdapter.ts src/plugins/gioRemaxAdapter.ts
cp -n src/plugins\(external\)/frameworks/gioTaroAdapter.ts src/plugins/gioTaroAdapter.ts
cp -n src/plugins\(external\)/frameworks/gioUniAppAdapter.ts src/plugins/gioUniAppAdapter.ts
cp -n src/plugins\(external\)/frameworks/gioWepyAdapter.ts src/plugins/gioWepyAdapter.ts
# cdp埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 无埋点插件
cp -n src/plugins\(external\)/ordinary/gioEventAutoTracking.ts src/plugins/gioEventAutoTracking.ts
# 加密插件
cp -n src/plugins\(external\)/ordinary/gioCompress.ts src/plugins/gioCompress.ts
# 曝光插件
cp -n src/plugins\(external\)/ordinary/gioImpressionTracking.ts src/plugins/gioImpressionTracking.ts
# 打包
npm run cBuild -- --cdp-framework-full
# 复制到demo目录
cp dist/cdp/full.js demos/native/weixin/utils/gio-full.js
cp dist/cdp/full.js demos/native/kuaishou/utils/gio-full.js
cp dist/cdp/full.js demos/native/alipay/utils/gio-full.js
cp dist/cdp/full.js demos/native/qq/utils/gio-full.js
cp dist/cdp/full.js demos/native/quickApp/src/utils/gio-full.js
cp dist/cdp/full.js demos/native/baidu/utils/gio-full.js
cp dist/cdp/full.js demos/native/bytedance/utils/gio-full.js
cp dist/cdp/full.js demos/remax/src/utils/gio-full.js
cp dist/cdp/full.js demos/taro/taro2/src/utils/gio-full.js
cp dist/cdp/full.js demos/taro/taro3-react/src/utils/gio-full.js
cp dist/cdp/full.js demos/taro/taro3-vue2/src/utils/gio-full.js
cp dist/cdp/full.js demos/taro/taro3-vue3/src/utils/gio-full.js
cp dist/cdp/full.js demos/native/taobao/client/utils/gio-full.js
cp dist/cdp/full.js demos/native/taobaowidget/widget/utils/gio-full.js
cp dist/cdp/full.js demos/native/taobaowidget/client/utils/gio-full.js
cp dist/cdp/full.js demos/uni-app/vue2/src/utils/gio-full.js
cp dist/cdp/full.js demos/uni-app/vue3/src/utils/gio-full.js
cp dist/cdp/full.js demos/wepy/src/utils/gio-full.js
cp dist/cdp/full.js demos/chameleon/src/utils/gio-full.js
