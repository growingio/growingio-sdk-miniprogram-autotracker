# 清空产物
rm -rf dist/saas/*
rm -rf dist/saas_npm/*

# 微信小程序
npm run build:saas-wx

# 支付宝小程序
npm run build:saas-my

# 百度小程序
npm run build:saas-swan

# 字节小程序
npm run build:saas-tt

# 京东小程序
npm run build:saas-jd

# QQ小程序
npm run build:saas-qq

# 淘宝小程序
npm run build:saas-tb

# 快手小程序
npm run build:saas-ks

# 快应用
npm run build:saas-quickapp

# uni-app vue2/vue3
npm run build:saas-uniapp

# wepy2
npm run build:saas-wepy

# taro2/3 react/vue2/vue3
npm run build:saas-taro

# chameleon
npm run build:saas-chameleon

# remax
npm run build:saas-remax

# 全量版本
npm run build:saas-full


# 复制一份给发npm包的时候用
mkdir -p dist/saas_npm/

cp -r dist/saas/* dist/saas_npm/

cd dist/saas_npm/
for name in `ls *.js`
do
  mv $name gio-${name%.js}.js
done
