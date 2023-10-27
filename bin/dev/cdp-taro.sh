### Taro开发逻辑

# 新建plugins目录
mkdir -p src/plugins

# cdp埋点插件
cp -n src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 框架适配插件
cp -n src/plugins\(external\)/frameworks/gioTaroAdapter.ts src/plugins/gioTaroAdapter.ts
# 打包
rollup -c --cdp-framework-taro
# 新建plugins目录
mkdir -p demos/taro/taro2/src/utils
mkdir -p demos/taro/taro3-react/src/utils
mkdir -p demos/taro/taro3-vue2/src/utils
mkdir -p demos/taro/taro3-vue3/src/utils
# 复制到demo目录
cp dist/cdp/taro.js demos/taro/taro2/src/utils/gio-cdp.js
cp dist/cdp/taro.js demos/taro/taro3-react/src/utils/gio-cdp.js
cp dist/cdp/taro.js demos/taro/taro3-vue2/src/utils/gio-cdp.js
cp dist/cdp/taro.js demos/taro/taro3-vue3/src/utils/gio-cdp.js
