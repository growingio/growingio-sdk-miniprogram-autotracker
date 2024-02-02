GrowingIO 小程序采集 SDK (GrowingIO Miniprogram Autotracker)
======

![GrowingIO](https://www.growingio.com/vassets/images/home_v3/gio-logo-primary.svg)

# 小程序SDK

## 介绍

小程序SDK4.0支持 微信小程序、支付宝小程序、百度小程序、字节(抖音头条)小程序、QQ小程序、淘宝小程序、快手小程序、京东小程序、快应用。

- 埋点能力，开发同学可调用API主动采集自定义事件。
- 插件无埋点能力，自动采集用户行为事件，可通过开关和插件控制。
- 插件半自动埋点浏览能力，除快应用外，其他小程序均支持半自动埋点浏览事件。
- 可依据使用场景自由拆分 SDK，减少大小。
- 支持自定义插件开发。

## 官方集成文档（Integration Document）

[集成文档](https://growingio.github.io/growingio-sdk-docs/docs/miniprogram)

## 开发

### 检查环境

Nodejs 版本>=16，推荐使使用 nvm 进行 Nodejs 版本管理

### 安装依赖包

> npm install

### 打包

打包SDK
> npm run build:wx // 原生微信小程序<br/>
> npm run build:my // 原生支付宝小程序<br/>
> npm run build:swan // 原生百度小程序<br/>
> npm run build:tt // 原生字节头条小程序<br/>
> npm run build:qq // 原生QQ小程序<br/>
> npm run build:jd // 原生京东小程序<br/>
> npm run build:ks // 原生快手小程序<br/>
> npm run build:tb // 原生淘宝小程序<br/>
> npm run build:quickapp // 原生快应用<br/>
> npm run build:uniapp // uni-app框架<br/>
> npm run build:taro // Taro框架

打包插件
> npm run build:plugins

## 开发插件

- 这里提供一个Demo供参考：

```js
/**
 * 名称：插件Demo
 * 用途：用于提供编写插件的模板。
 */
import { GrowingIOType } from '@/types/growingIO';

class GioDemoPlugin {
  constructor(public growingIO: GrowingIOType) {
    const { emitter } = this.growingIO;
    emitter.on('SDK_INITIALIZED', (args) => { ...});
    // 其他可支持监听的消息名称请参考 src -> constants -> emitMsg.ts
  }

  onInstall(args) {
    // console.log('onInstall', args);
  }

  onError(args) {
    // console.log('onError', args);
  }

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

## 开源说明

开源的源代码移除了性能监控、第三方厂商适配以及定制化开发的一些商业化内容，和自动化测试的相关代码。仅保留相对完整的SDK主要内容。

GrowingIO 小程序 SDK 完全免费并开源，请注意仔细甄别。欢迎大家一起学习进步和互相帮助。

Tips：请注意开源协议。
