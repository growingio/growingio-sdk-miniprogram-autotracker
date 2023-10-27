### Chameleon cdp开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# cdp埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 框架适配插件
cp -n src/plugins\(external\)/frameworks/gioChameleonAdapter.ts src/plugins/gioChameleonAdapter.ts
# 打包
rollup -c --cdp-framework-chameleon
# 新建plugins目录
mkdir -p demos/chameleon/src/utils
# 复制到demo目录
cp dist/cdp/chameleon.js demos/chameleon/src/utils/gio-cdp.js
