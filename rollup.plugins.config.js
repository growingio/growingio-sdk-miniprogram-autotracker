// @ts-nocheck
import { babel } from '@rollup/plugin-babel';
import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import filesize from 'rollup-plugin-filesize';
import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';

const fs = require('fs');

const processENV = process.argv[process.argv.length - 1]
  .split('-')
  .filter((o) => o);
// 获取是否打包全量插件
const folder = processENV[0] ?? 'all';

const expls = [];
const plgs = fs.readdirSync(`./src/pluginsOut/${folder}`);
plgs.forEach((plg) => {
  if (plg && plg.endsWith('.ts') && plg !== 'gioCustomTracking.ts') {
    const outName = plg.split('.')[0];
    expls.push({
      input: `${folder}/${plg}`,
      output: `${folder === 'ordinary' ? 'plugins/' : folder + '/'
        }${outName}.js`,
      name: `${outName}.js`
    });
  }
});

const configs = [];
const configGenerat = ({ input, output, name }) => ({
  input: `src/pluginsOut/${input}`,
  output: {
    file: `dist/${output}`,
    format: 'es',
    name
  },
  plugins: [
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
