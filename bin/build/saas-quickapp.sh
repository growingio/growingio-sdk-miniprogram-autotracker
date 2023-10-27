### 原生快应用打包逻辑

# 新建plugins目录
mkdir -p src/plugins
# 移除已有文件
rm src/plugins/*

### Saas打包逻辑
# saas埋点插件
cp src/plugins\(external\)/ordinary/gioCustomTracking-saas.ts src/plugins/gioCustomTracking.ts
# 无埋点插件
cp src/plugins\(external\)/ordinary/gioEventAutoTracking.ts src/plugins/gioEventAutoTracking.ts
# 打包
npm run cBuild -- --saas-quickapp
# 移除埋点插件
rm src/plugins/gioCustomTracking.ts
# 移除无埋点插件
rm src/plugins/gioEventAutoTracking.ts
