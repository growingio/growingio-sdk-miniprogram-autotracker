### 原生快手小程序打包逻辑

# 新建plugins目录
mkdir -p src/plugins
# 移除已有文件
rm src/plugins/*

### CDP打包逻辑
# cdp埋点插件
cp src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 打包
npm run cBuild -- --cdp-ks
# 移除埋点插件
rm src/plugins/gioCustomTracking.ts
