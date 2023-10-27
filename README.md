# gio-miniprogram-autotracker

# 小程序数据采集 SDK

## 介绍

目前支持 微信小程序、支付宝小程序、百度小程序、字节(抖音头条)小程序、QQ 小程序、淘宝小程序、京东小程序、快应用 8 大平台。

目前具备以下特性：

- 无埋点能力，自动采集用户行为事件，可通过开关和插件控制。
- 埋点能力，开发同学可调用 Api 主动采集自定义事件。
- 除快应用外，其他小程序均支持半自动曝光事件。
- 可依据使用场景自由拆分 SDK，减少大小。
- 支持自定义插件开发。（实验性功能）

与原版本的区别、集成方式等文档内容请参考现在的 CDP 文档。

## 开发

1、检查环境，Nodejs 版本>=10，推荐使用 Nodejs v14。（推荐使用 nvm 进行 Nodejs 版本管理）

2、安装依赖包

> npm install 或 yarn

3、打包

1）打包所有端

> npm run build

2）打包指定端

查看 **`package.json`** 文件下，查找对应 **`build:xxx-xxx`** 的命令运行。

3）打包运营组件

> npm run build:component

## 插件目录说明

### plugins目录

该目录下的所有文件都会被当成内置插件进行引入。开发或调试插件时建议放到这个目录里进行调试。

该目录下的文件均会被git忽略，插件开发或修改完成后在`plugins(external)`目录中保存。

### plugins(external)目录

该目录存放一般性的功能插件，插件内容saas/cdp通用，在cdp使用中会单独打包供客户自主按需选择功能拆件，在saas中默认全部包含。
打包插件时，会自动忽略含`-cdp`、`-saas`、`Adapter`字符文件名的文件。

### cdp使用逻辑

在cdp环境运行dev时，会自动从cdp目录中复制埋点插件至plugins目录，存在时不覆盖。即默认cdp SDK仅有埋点功能，其他插件需要手动进行复制粘贴或使用打包过后的插件在demo中注册插件。

在cdp环境运行build时，会自动清空`plugins`目录并重新复制埋点插件进行打包。因此，在`plugins`目录调试或者开发插件时，谨慎执行build命令。

### saas使用逻辑

在saas环境运行dev时，会自动从`plugins(external)`目录中复制全量的插件至plugins目录，存在时不覆盖。即默认saas SDK拥有全量插件功能，不允许用户自己定义需要哪些插件。

在saas环境运行build时，会自动清空`plugins`目录并重新复制`plugins(external)`目录中全量的插件进行打包。因此，在`plugins`目录调试或者开发插件时，谨慎执行build命令。

## 其他

- 目录中并没有为淘宝小程序做特殊适配，淘宝小程序的 SDK 就是支付宝小程序的 SDK+淘宝小程序插件。本质与支付宝小程序无差别，只有上报数据时只能用单发的逻辑，加入单发逻辑插件就会自动走单发逻辑。

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
