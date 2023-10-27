### gtouch打包逻辑

# 替换.babelrc配置并备份
sed -i.bak "s/\/\/ //g" .babelrc
# 打包
rollup -c rollup.gtouch.config.js
# 删除配置
rm -r .babelrc
# 恢复备份
cp .babelrc.bak .babelrc
# 移除备份
rm -r .babelrc.bak