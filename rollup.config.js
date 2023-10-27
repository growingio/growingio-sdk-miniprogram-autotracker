// @ts-nocheck
import alias from '@rollup/plugin-alias';
import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import path from 'path';
import filesize from 'rollup-plugin-filesize';
import terser from '@rollup/plugin-terser';

import { cdpVersion, saasVersion } from './package.json';

const processPlatform = process.argv[process.argv.length - 1]
  .split('-')
  .filter((o) => o);
// 获取命令指定的打包环境
const gioEnvironment = ['saas', 'cdp'].includes(processPlatform[0])
  ? processPlatform[0]
  : 'saas';
const platformType = processPlatform[1];
const platform = platformType.split(':')[0];
const frameworkName = processPlatform[2] || '';
// 小程序平台
const gioPlatform = [
  'wx',
  'my',
  'swan',
  'qq',
  'tt',
  'ks',
  'jd',
  'quickapp',
  'framework'
].includes(platform)
  ? platform
  : 'wx';
const P_ENUMS = {
  wx: 'wechat',
  my: 'alipay',
  swan: 'baidu',
  tt: 'bytedance',
  ks: 'kuaishou',
  tb: 'taobao',
  jd: 'jingdong'
};

// 控制台打印当前打包的环境和小程序平台
console.log(
  `[gioEnvironment]：${gioEnvironment}  [gioPlatform]：${gioPlatform}`
);

const fileName = () => {
  let n = `dist/${gioEnvironment}/`;
  if (frameworkName) {
    n += P_ENUMS[frameworkName] || frameworkName;
  } else {
    n += P_ENUMS[gioPlatform] || gioPlatform;
  }
  n += '.js';
  return n;
};

const config = {
  input: `src/${gioEnvironment}/index.ts`,
  output: {
    file:
      // saas以小程序平台 + 框架的命名方式（例：saas/wx.js、saas/framework-taro.js）
      // cdp以小程序平台的命名方式（例：cdp/wx.cdp/framework.js）cdp通过插件的形式增删功能
      fileName(),
    format: 'es'
  },
  plugins: [
    replace({
      __SDK_VERSION__: gioEnvironment === 'saas' ? saasVersion : cdpVersion,
      __GIO_ENVIRONMENT__: gioEnvironment,
      __GIO_PLATFORM__: gioPlatform,
      __GIO_FRAMEWORK__: frameworkName,
      __GIO_PLATFORM_CONFIG__: `@@/platformConfig/${gioPlatform}.ts`,
      __GIO_PLATFORM_INSTANCE__: `@@/minipInstance/${gioPlatform}.ts`
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
