# 清空原产物
rm -r dist/plugins/*

# 打包插件
rollup -c rollup.plugins.config.js --ordinary
