// @ts-nocheck
import alias from '@rollup/plugin-alias';
import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import path from 'path';
import filesize from 'rollup-plugin-filesize';
import terser from '@rollup/plugin-terser';

const fs = require('fs');

// 获取外置插件的目录忽略框架专属插件目录
const externalPlugInFolders = fs
  .readdirSync('./src/plugins(external)')
  .filter((o) => !['README.md', 'frameworks', '.DS_Store'].includes(o));

const expls = [];
externalPlugInFolders.forEach((extf) => {
  const plgs = fs.readdirSync(`./src/plugins(external)/${extf}`);
  plgs.forEach((plg) => {
    if (plg && plg.endsWith('.ts') && plg.indexOf('-') < 0) {
      const outName = plg.split('.')[0];
      expls.push({
        input: `${extf}/${plg}`,
        output: `${extf === 'ordinary' ? 'plugins/' : extf + '/'}${outName}.js`,
        name: `${outName}.js`
      });
    }
  });
});

const configs = [];
const configGenerat = ({ input, output, name }) => ({
  input: `src/plugins(external)/${input}`,
  output: {
    file: `dist/cdp/${output}`,
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
    typescript(),
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
  if (o) configs.push(configGenerat(o, 'plugins(external)'));
});

export default configs;
