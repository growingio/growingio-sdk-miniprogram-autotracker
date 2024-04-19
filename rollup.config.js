// @ts-nocheck
import { babel } from '@rollup/plugin-babel';
import { version } from './package.json';
import { terser } from 'rollup-plugin-terser';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import filesize from 'rollup-plugin-filesize';
import path from 'path';
import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const processENV = process.argv[process.argv.length - 1]
  .split('-')
  .filter((o) => o);

// 小程序平台
const platform = processENV[0];
// 框架平台
const frameName = processENV[1];
// 插件实例的入口名
const pluginInstanceName = frameName || platform === 'tb' ? frameName || platform : 'base';
// 小程序平台文件名枚举
const PLATFORMS = {
  wx: 'wechat',
  my: 'alipay',
  swan: 'baidu',
  tt: 'bytedance',
  qq: 'qq',
  ks: 'kuaishou',
  tb: 'taobao',
  jd: 'jingdong',
  quickapp: 'quickapp'
};

// 控制台打印当前打包的环境和小程序平台
console.log(
  `Packaging ${PLATFORMS[platform]
    ? 'platform：' + PLATFORMS[platform]
    : 'framework：' + frameName
  }`
);

const fileName = () => {
  let n = 'dist/';
  n += PLATFORMS[platform] ?? frameName;
  n += '.js';
  return n;
};

const config = {
  input: 'src/index.ts',
  output: {
    file: fileName(),
    format: 'es'
  },
  plugins: [
    replace({
      __SDK_VERSION__: version,
      __GIO_PLATFORM__: PLATFORMS[platform] ? platform : 'framework',
      __GIO_FRAMEWORK__: PLATFORMS[platform] ? 'native' : frameName,
      __GIO_PLATFORM_CONFIG__: `@@/platformConfig/${platform}.ts`,
      __GIO_PLATFORM_INSTANCE__: `@@/minipInstance/${platform}.ts`,
      __GIO_PLUGIN_INSTANCE__: `@@/core/pluginsInstance/${pluginInstanceName}.ts`
    }),
    alias({
      entries: {
        '@@': path.resolve(__dirname, 'src')
      }
    }),
    resolve(),
    commonjs({ extensions: ['.js', '.ts'] }),
    typescript(),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      extensions: ['.ts', '.js', '.json']
    }),
    terser({
      ecma: 'es6',
      format: { comments: false },
      compress: {
        passes: 2,
        unsafe: true,
        unsafe_comps: true,
        unsafe_proto: true,
        unsafe_undefined: true
      }
    }),
    filesize({
      showMinifiedSize: false,
      showGzippedSize: false
    })
  ]
};

export default config;
