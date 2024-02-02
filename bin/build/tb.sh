### 原生淘宝小程序打包逻辑

# 新建plugins目录
mkdir -p src/pluginsIn
# 移除已有文件
rm src/pluginsIn/*

### 打包逻辑
# 淘宝小程序上报适配插件
cp src/pluginsOut/frameworks/gioTaobaoAdapter.ts src/pluginsIn/gioTaobaoAdapter.ts
# 埋点插件
cp src/pluginsOut/ordinary/gioCustomTracking.ts src/pluginsIn/gioCustomTracking.ts
# 打包
rollup -c rollup.config.js --tb
# 移除淘宝小程序上报适配插件
rm src/pluginsIn/gioTaobaoAdapter.ts
# 移除埋点插件
rm src/pluginsIn/gioCustomTracking.ts
