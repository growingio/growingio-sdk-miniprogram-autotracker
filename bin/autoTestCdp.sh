# 微信自动化测试cdp

# 自动化测试插件
cp test/gioAutoTest.ts src/plugins/gioAutoTest.ts
# 创建demo目录用于存放sdk
mkdir -p demos/native/weixin/utils/plugins
# 打包sdk
npm run build:cdp-wx-autotest
# 移除自动化测试插件
rm src/plugins/gioAutoTest.ts
# 复制到demo目录下
cp dist/cdp/wechat.js demos/native/weixin/utils/gio-cdp.js
cp dist/cdp/plugins/* demos/native/weixin/utils/plugins
# 运行自动化
jest test/cdp/*.js
