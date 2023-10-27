### Chameleon开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# 框架适配插件
cp -n src/plugins\(external\)/frameworks/gioChameleonAdapter.ts src/plugins/gioChameleonAdapter.ts
# saas埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-saas.ts src/plugins/gioCustomTracking.ts
# saas无埋点插件
cp -n src/plugins\(external\)/ordinary/gioEventAutoTracking.ts src/plugins/gioEventAutoTracking.ts
# 曝光插件
cp -n src/plugins\(external\)/ordinary/gioImpressionTracking.ts src/plugins/gioImpressionTracking.ts
# 打包
rollup -c --saas-framework-chameleon
# 新建plugins目录
mkdir -p demos/chameleon/src/utils
# 复制到demo目录
cp dist/saas/chameleon.js demos/chameleon/src/utils/gio-saas.js
