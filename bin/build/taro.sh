### Taro打包逻辑

# 新建plugins目录
mkdir -p src/pluginsIn
# 移除已有文件
rm src/pluginsIn/*

### 打包逻辑
# 框架适配插件
cp src/pluginsOut/frameworks/gioTaroAdapter.ts src/pluginsIn/gioTaroAdapter.ts
# 埋点插件
cp src/pluginsOut/ordinary/gioCustomTracking.ts src/pluginsIn/gioCustomTracking.ts
# 打包
rollup -c rollup.config.js --framework-taro
# 移除框架适配插件
rm src/pluginsIn/gioTaroAdapter.ts
# 移除埋点插件
rm src/pluginsIn/gioCustomTracking.ts
