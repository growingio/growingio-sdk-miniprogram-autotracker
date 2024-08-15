// @ts-nocheck
import * as packageJson from './package.json';
import { babel } from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import filesize from 'rollup-plugin-filesize';
import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';

const fs = require('fs');

const processENV = process.argv[process.argv.length - 1]
  .split('-')
  .filter((o) => o);
// 获取是否打包全量插件
const folder = processENV[0] || 'plugins';

// 获取外置插件的目录
const plugInFolder = fs
  .readdirSync(`./src/${folder}`)
  .filter((o) => !['.DS_Store'].includes(o));

const expls = [];
plugInFolder.forEach((plugin) => {
  if (plugin && plugin.endsWith('.ts')) {
    const outName = plugin.split('.')[0];
    expls.push({
      input: `src/${folder}/${plugin}`,
      output: `${folder}/${outName}.js`,
      name: `${outName}.js`
    });
  }
});

const configs = [];
const configGenerat = ({ input, output, name }) => ({
  input,
  output: {
    file: `dist/${output}`,
    format: 'es',
    name
  },
  plugins: [
    replace({
      __PLUGIN_VERSION__: packageJson.version || '0.0.1'
    }),
    alias({
      entries: {
        '@@': path.resolve(__dirname, 'src')
      }
    }),
    resolve(),
    commonjs({ extensions: ['.js', '.ts'] }),
    typescript({ target: 'ES5' }),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      extensions: ['.ts']
    }),
    terser({
      ecma: 'es5',
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
});
expls.forEach((o) => {
  if (o) configs.push(configGenerat(o));
});

export default configs;
