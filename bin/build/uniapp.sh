### UniApp打包逻辑

# 新建plugins目录
mkdir -p src/pluginsIn
# 移除已有文件
rm src/pluginsIn/*

### 打包逻辑
# 框架适配插件
cp src/pluginsOut/frameworks/gioUniAppAdapter.ts src/pluginsIn/gioUniAppAdapter.ts
# 埋点插件
cp src/pluginsOut/ordinary/gioCustomTracking.ts src/pluginsIn/gioCustomTracking.ts
# 打包
rollup -c rollup.config.js --framework-uniapp
# 移除框架适配插件
rm src/pluginsIn/gioUniAppAdapter.ts
# 移除埋点插件
rm src/pluginsIn/gioCustomTracking.ts
