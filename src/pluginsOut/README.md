## 目录说明

本目录下有多个文件夹，其中`ordinary`是主要的一些内置插件，`frameworks`是小程序开发框架的适配，其他文件夹为特殊场景适配。

## 插件名称命名规则

`gio`开头表明是gio的插件；

名称带`Adapter`表明是某个场景下的适配；

短横线加环境`-cdp`、`-saas`表明是cdp或者是saas专有的插件；不会被单独打包插件；

除`ordinary`目录下的插件打包会打在`dist/plugins`根目录下，`frameworks`不会被单独打包，其他带文件夹的插件会打包在保留文件夹路径且与`plugins`同级的目录下。

如果新增目录，发布时需要在jekins上修改配置添加路径。

## 开发插件

- 这里提供一个Demo供参考：

```js
/**
 * 名称：插件Demo
 * 用途：用于提供编写插件的模板。
 */
import { GrowingIOType } from '@@/types/growingIO';

class GioDemoPlugin {
  constructor(public growingIO: GrowingIOType) {}

  onComposeBefore(args) {
    // console.log('onComposeBefore', args);
  }

  onComposeAfter(args) {
    // console.log('onComposeAfter', args);
  }

  onSendBefore(args) {
    // console.log('onSendBefore', args);
  }

  onSendAfter(args) {
    // console.log('onSendAfter', args);
  }
}

export default { name: 'gioDemoPlugin', method: GioDemoPlugin };

```
