### 原生字节小程序开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# saas埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-saas.ts src/plugins/gioCustomTracking.ts
# saas无埋点插件
cp -n src/plugins\(external\)/ordinary/gioEventAutoTracking.ts src/plugins/gioEventAutoTracking.ts
# 曝光插件
cp -n src/plugins\(external\)/ordinary/gioImpressionTracking.ts src/plugins/gioImpressionTracking.ts
# 打包
rollup -c --saas-tt
# 新建plugins目录
mkdir -p demos/native/bytedance/utils
# 复制到demo目录
cp dist/saas/bytedance.js demos/native/bytedance/utils/gio-saas.js
