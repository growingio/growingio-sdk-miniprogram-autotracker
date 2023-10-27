# 微信自动化测试saas

# 自动化测试插件
cp test/gioAutoTest.ts src/plugins/gioAutoTest.ts
# 创建demo目录用于存放sdk
mkdir -p demos/native/weixin/utils
# 打包sdk
npm run build:wx
# 移除自动化测试插件
rm src/plugins/gioAutoTest.ts
# 复制到demo目录下
cp dist/saas/wechat.js demos/native/weixin/utils/gio-saas.js
# 运行自动化
jest test/saas.spec.js

