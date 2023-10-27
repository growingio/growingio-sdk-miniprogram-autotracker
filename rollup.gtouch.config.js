import { babel } from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';
import filesize from 'rollup-plugin-filesize';
import {
  jsTransfer,
  wxmlTransfer
} from 'rollup-plugin-minip-components-transfer';
import terser from '@rollup/plugin-terser';

import { gTouchVersion } from './package.json';

const components = [
  {
    name: 'gio-marketing',
    platforms: ['wx', 'my']
  },
  {
    name: 'gio-banner',
    platforms: ['wx']
  }
];

const suffix = {
  wx: '.wxss',
  my: '.acss',
  swan: '.css',
  tt: '.ttss',
  qq: '.qss'
};
const P_ENUMS = {
  wx: 'wechat',
  my: 'alipay',
  swan: 'baidu',
  tt: 'bytedance',
  ks: 'kuaishou',
  tb: 'taobao'
};

const configs = [];
const configGenerat = (o) => ({
  input: `src/gtouch/${o.name}/${o.name}.js`,
  output: {
    file: `dist/gtouch/${P_ENUMS[o.platform]}/${o.name}/${o.name}.js`,
    format: 'es'
  },
  plugins: [
    replace({
      __GTOUCH_VERSION__: JSON.stringify(gTouchVersion)
    }),
    jsTransfer({
      platform: o.platform,
      include: `src/gtouch/${o.name}/${o.name}.js`
    }),
    wxmlTransfer({
      platform: o.platform,
      template: `src/gtouch/${o.name}/${o.name}.wxml`,
      name: o.name,
      output: `dist/gtouch/${P_ENUMS[o.platform]}`
    }),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      extensions: ['.ts', '.js', '.json']
    }),
    copy({
      targets: [
        {
          src: `src/gtouch/${o.name}/${o.name}.json`,
          dest: `dist/gtouch/${P_ENUMS[o.platform]}/${o.name}`,
          rename: `${o.name}.json`
        },
        {
          src: `src/gtouch/${o.name}/${o.name}.wxss`,
          dest: `dist/gtouch/${P_ENUMS[o.platform]}/${o.name}`,
          transform: (contents) => contents.toString().replace(/\s+/g, ''),
          rename: `${o.name}${suffix[o.platform]}`
        }
      ]
    }),
    typescript(),
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
components.forEach((o) => {
  if (Array.isArray(o.platforms)) {
    o.platforms.forEach((p) => {
      configs.push(configGenerat({ name: o.name, platform: p }));
    });
  } else {
    configs.push(configGenerat({ name: o.name, platform: o.platform }));
  }
});

export default configs;
