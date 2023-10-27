# 清空产物
rm -rf dist/cdp/*
rm -rf dist/cdp_npm/*

# 插件
npm run build:plugins

# 微信小程序
npm run build:cdp-wx

# 支付宝小程序
npm run build:cdp-my

# 百度小程序
npm run build:cdp-swan

# 字节小程序
npm run build:cdp-tt

# 京东小程序
npm run build:cdp-jd

# QQ小程序
npm run build:cdp-qq

# 淘宝小程序
npm run build:cdp-tb

# 快手小程序
npm run build:cdp-ks

# 快应用
npm run build:cdp-quickapp

# uni-app vue2/vue3
npm run build:cdp-uniapp

# wepy2
npm run build:cdp-wepy

# taro2/3 react/vue2/vue3
npm run build:cdp-taro

# chameleon
npm run build:cdp-chameleon

# remax
npm run build:cdp-remax

# 全量版本
npm run build:cdp-full

# 复制一份给发npm包的时候用
mkdir -p dist/cdp_npm/

cp -r dist/cdp/* dist/cdp_npm/

cd dist/cdp_npm/
for name in `ls *.js`
do
  mv $name gio-${name%.js}.js
done

rm -r performance
rm -r sensors
rm -r volcengine
