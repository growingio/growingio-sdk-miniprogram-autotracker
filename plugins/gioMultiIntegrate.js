const i=i=>{return(t=i,(i=>"[object Object]"==={}.toString.call(i)&&!(i=>null==i||void 0===i)(i))(t)?Object.keys(t):[]).filter((i=>i.indexOf("__sub")>-1&&i.indexOf("gio__")>-1)).sort();var t},t=()=>{let i=(i=>{try{return getApp({allowDefault:!0})}catch(i){return}})();return i||(i=global||$global),i};let o;var s={name:"gioMultiIntegrate",method:class{constructor(s){this.growingIO=s,this.addListener=()=>{const i=t();(null==i?void 0:i.gioEmitter)?null==i||i.gioEmitter.on("OPTION_CHANGE",(({optionName:i,optionValue:t})=>{this.storeUpdate("vdsConfig",i,t)})):o.consoleText("主包实例错误，请检查主包是否已集成插件!","warn")},this.storeUpdate=(o,s,g)=>{let n=t();const e=n.__gio__;e&&(e[o][s]=g),i(n).forEach((i=>{const t=n[i];t[o]&&(t[o][s]=g)}))},o=this.growingIO.utils,this.growingIO.emitter.on("SDK_INITIALIZED",(()=>{this.subpackage=this.growingIO.vdsConfig.subpackage;const s=t();if(this.subpackage){this.growingIO.subKey=`__sub${i(s).length+1}_gio__`,this.subKey=this.growingIO.subKey,s[this.subKey]=this.growingIO,this.growingIO.identify=()=>{};const t=s.__gio__;t&&(o.keys(this.growingIO).forEach((i=>{o.isObject(this.growingIO[i])&&("vdsConfig"===i?o.keys(t.vdsConfig).forEach((i=>{["cml","remax","taro","taroVue","uniVue","wepy","subpackage"].includes(i)||(this.growingIO.vdsConfig[i]=t.vdsConfig[i])})):"plugins"!==i&&(this.growingIO[i]=t[i]))})),this.growingIO.vdsConfig.autotrack=!1,this.growingIO.plugins.uninstall("gioEventAutoTracking")&&o.consoleText("多项目集成，无埋点已自动关闭!","info"),this.addListener())}else{const i=t();this.growingIO.vdsConfig.autotrack=!1,this.growingIO.plugins.uninstall("gioEventAutoTracking")&&o.consoleText("多项目集成，无埋点已自动关闭!","info"),i.gioEmitter=this.growingIO.emitter,i.gio_esid=this.growingIO.dataStore.esid,i.gio_gsid=this.growingIO.dataStore.gsid}}))}}};export{s as default};