### 原生淘宝小程序打包逻辑

# 新建plugins目录
mkdir -p src/plugins
# 移除已有文件
rm src/plugins/*

### CDP打包逻辑
# 淘宝小程序上报适配插件
cp src/plugins\(external\)/frameworks/gioTaobaoSendAdapter.ts src/plugins/gioTaobaoSendAdapter.ts
# cdp埋点插件
cp src/plugins\(external\)/ordinary/gioCustomTracking-cdp.ts src/plugins/gioCustomTracking.ts
# 打包
npm run cBuild -- --cdp-my-tb
# 移除淘宝小程序上报适配插件
rm src/plugins/gioTaobaoSendAdapter.ts
# 移除埋点插件
rm src/plugins/gioCustomTracking.ts
