# 清空目录
rm -rf dist/*

mkdir -p dist/saas
mkdir -p dist/cdp

# 运营组件
npm run build:gtouch

# 插件
npm run build:plugins

# 微信小程序
npm run build:cdp-wx
npm run build:saas-wx
mkdir -p demos/native/weixin/utils
cp dist/cdp/wechat.js demos/native/weixin/utils/gio-cdp.js
cp dist/saas/wechat.js demos/native/weixin/utils/gio-saas.js

# 支付宝小程序
npm run build:cdp-my
npm run build:saas-my
mkdir -p demos/native/alipay/utils
cp dist/cdp/alipay.js demos/native/alipay/utils/gio-cdp.js
cp dist/saas/alipay.js demos/native/alipay/utils/gio-saas.js

# 百度小程序
npm run build:cdp-swan
npm run build:saas-swan
mkdir -p demos/native/baidu/utils
cp dist/cdp/baidu.js demos/native/baidu/utils/gio-cdp.js
cp dist/saas/baidu.js demos/native/baidu/utils/gio-saas.js

# 字节小程序
npm run build:cdp-tt
npm run build:saas-tt
mkdir -p demos/native/bytedance/utils
cp dist/cdp/bytedance.js demos/native/bytedance/utils/gio-cdp.js
cp dist/saas/bytedance.js demos/native/bytedance/utils/gio-saas.js

# QQ小程序
npm run build:cdp-qq
npm run build:saas-qq
mkdir -p demos/native/qq/utils
cp dist/cdp/qq.js demos/native/qq/utils/gio-cdp.js
cp dist/saas/qq.js demos/native/qq/utils/gio-saas.js

# 淘宝小程序
npm run build:cdp-tb
npm run build:saas-tb
mkdir -p demos/native/taobao/client/utils
cp dist/cdp/taobao.js demos/native/taobao/client/utils/gio-cdp.js
cp dist/saas/taobao.js demos/native/taobao/client/utils/gio-saas.js

# 淘宝小部件
npm run build:cdp-tbwidget
npm run build:saas-tbwidget
mkdir -p demos/native/taobaowidget/widget/utils
mkdir -p demos/native/taobaowidget/client/utils
cp dist/cdp/taobao.js demos/native/taobaowidget/widget/utils/gio-cdp.js
cp dist/cdp/taobao.js demos/native/taobaowidget/client/utils/gio-cdp.js
cp dist/saas/taobao.js demos/native/taobaowidget/widget/utils/gio-saas.js
cp dist/saas/taobao.js demos/native/taobaowidget/client/utils/gio-saas.js

# 快手小程序
npm run build:cdp-ks
npm run build:saas-ks
mkdir -p demos/native/kuaishou/utils
cp dist/cdp/kuaishou.js demos/native/kuaishou/utils/gio-cdp.js
cp dist/saas/kuaishou.js demos/native/kuaishou/utils/gio-saas.js

# 快应用
npm run build:cdp-quickapp
npm run build:saas-quickapp
mkdir -p demos/native/quickApp/utils
cp dist/cdp/quickapp.js demos/native/quickApp/utils/gio-cdp.js
cp dist/saas/quickapp.js demos/native/quickApp/utils/gio-saas.js

# uni-app vue2/vue3
npm run build:cdp-uniapp
npm run build:saas-uniapp
mkdir -p demos/uni-app/vue2/src/utils
cp dist/cdp/uniapp.js demos/uni-app/vue2/src/utils/gio-cdp.js
cp dist/saas/uniapp.js demos/uni-app/vue2/src/utils/gio-saas.js
mkdir -p demos/uni-app/vue3/src/utils
cp dist/cdp/uniapp.js demos/uni-app/vue3/src/utils/gio-cdp.js
cp dist/saas/uniapp.js demos/uni-app/vue3/src/utils/gio-saas.js

# taro2、taro3 react/vue2/vue3
npm run build:cdp-taro
npm run build:saas-taro
mkdir -p demos/taro/taro2/src/utils
cp dist/cdp/taro.js demos/taro/taro2/src/utils/gio-cdp.js
cp dist/saas/taro.js demos/taro/taro2/src/utils/gio-saas.js
mkdir -p demos/taro/taro3-react/src/utils
cp dist/cdp/taro.js demos/taro/taro3-react/src/utils/gio-cdp.js
cp dist/saas/taro.js demos/taro/taro3-react/src/utils/gio-saas.js
mkdir -p demos/taro/taro3-vue2/src/utils
cp dist/cdp/taro.js demos/taro/taro3-vue2/src/utils/gio-cdp.js
cp dist/saas/taro.js demos/taro/taro3-vue2/src/utils/gio-saas.js
mkdir -p demos/taro/taro3-vue3/src/utils
cp dist/cdp/taro.js demos/taro/taro3-vue3/src/utils/gio-cdp.js
cp dist/saas/taro.js demos/taro/taro3-vue3/src/utils/gio-saas.js

# wepy2
npm run build:cdp-wepy
npm run build:saas-wepy
mkdir -p demos/wepy/src/utils
cp dist/cdp/wepy.js demos/wepy/src/utils/gio-cdp.js
cp dist/saas/wepy.js demos/wepy/src/utils/gio-saas.js

# chameleon
npm run build:cdp-chameleon
npm run build:saas-chameleon
mkdir -p demos/chameleon/src/utils
cp dist/cdp/chameleon.js demos/chameleon/src/utils/gio-cdp.js
cp dist/saas/chameleon.js demos/chameleon/src/utils/gio-saas.js

# remax
npm run build:cdp-remax
npm run build:saas-remax
mkdir -p demos/remax/src/utils
cp dist/cdp/remax.js demos/remax/src/utils/gio-cdp.js
cp dist/saas/remax.js demos/remax/src/utils/gio-saas.js
