### Chameleon打包逻辑

# 新建plugins目录
mkdir -p src/plugins
# 移除已有文件
rm src/plugins/*

### CDP打包逻辑
# 框架适配插件
cp src/plugins\(external\)/frameworks/gioChameleonAdapter.ts src/plugins/gioChameleonAdapter.ts
# cdp埋点插件
cp src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 打包
npm run cBuild -- --cdp-framework-chameleon
# 移除框架适配插件
rm src/plugins/gioChameleonAdapter.ts
# 移除埋点插件
rm src/plugins/gioCustomTracking.ts
