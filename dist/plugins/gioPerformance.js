var e=function(){return e=Object.assign||function(e){for(var t,n=1,r=arguments.length;r>n;n++)for(var i in t=arguments[n])({}).hasOwnProperty.call(t,i)&&(e[i]=t[i]);return e},e.apply(this,arguments)};function t(e,t,n){if(n||2===arguments.length)for(var r,i=0,o=t.length;o>i;i++)!r&&i in t||(r||(r=[].slice.call(t,0,i)),r[i]=t[i]);return e.concat(r||[].slice.call(t))}"function"==typeof SuppressedError&&SuppressedError;var n,r=function(e){return["undefined","null"].includes(P(e))},i=function(e){return"string"===P(e)},o=function(e){return"[object Object]"==={}.toString.call(e)&&!r(e)},a=function(e){return"[object RegExp]"==={}.toString.call(e)},s=function(e){return["function","asyncfunction"].includes(P(e))},u=function(e){return Array.isArray(e)&&"array"===P(e)},c=function(e){try{return Array.from(e)[0]}catch(e){return}},l=function(e,t){if(void 0===t&&(t=!1),u(e)){for(var n=0,r=[],i=0,o=e;i<o.length;i++){var a=o[i];a&&!v(a)&&(r[n++]=a),t&&0===a&&(r[n++]=a)}return r}return e},f=function(e){return r(e)?"":"".concat(e)},d={}.hasOwnProperty,p=function(e,t){return!r(e)&&d.call(e,t)},h=function(e){return o(e)?Object.keys(e):[]},g=function(e,t){h(e).forEach((function(n){return t(e[n],n)}))},m=function(e,t){if(!o(e))return!1;try{if("string"===P(t))return delete e[t];if("array"===P(t))return t.map((function(t){return delete e[t]}));"object"===P(t)&&t.constructor===RegExp&&h(e).forEach((function(n){t.test(n)&&m(e,n)}))}catch(e){return!1}},v=function(e){return u(e)?0===e.length:o(e)?0===h(e).length:!e},P=function(e){return{}.toString.call(e).slice(8,-1).toLowerCase()},I=function(e){var t={};return o(e)&&(m(e,"&&sendTo"),g(e,(function(e,n){var i=f(n).slice(0,100);o(e)?t[i]=I(e):u(e)?(t[i]=l(e.slice(0,100),!0),t[i]=t[i].join("||").slice(0,1e3)):function(e){return"date"===P(e)}(e)?t[i]=function(e){function t(e){return 10>e?"0"+e:e}return e.getFullYear()+"-"+t(e.getMonth()+1)+"-"+t(e.getDate())+" "+t(e.getHours())+":"+t(e.getMinutes())+":"+t(e.getSeconds())+"."+t(e.getMilliseconds())}(e):t[i]=r(e)?"":f(e).slice(0,1e3)}))),t},w="SDK_INITIALIZED",E=function(t){var n,r,i,o,a=this;this.growingIO=t,this.listenerSet=!1,this.setListeners=function(){var e,t,n;a.listenerSet||(a.minipInst.canIUse("onError")&&(null===(e=a.minipInst)||void 0===e||e.onError((function(e){a.errorParse(e)}))),a.minipInst.canIUse("onUnhandledRejection")&&(null===(t=a.minipInst)||void 0===t||t.onUnhandledRejection((function(e){e.reason.stack&&a.errorParse(e.reason.stack,e.reason.message)}))),a.minipInst.canIUse("onLazyLoadError")&&(null===(n=a.minipInst)||void 0===n||n.onLazyLoadError((function(e){a.buildErrorEvent({error_type:e.errMsg,error_content:f(e.subpackage)})})))),a.listenerSet=!0},this.hookNavigate=function(){var t=a;["switchTab","reLaunch","redirectTo","navigateTo","navigateBack"].forEach((function(n){var r=a.minipInst[n];Object.defineProperty(a.minipInst,n,{writable:!0,enumerable:!0,configurable:!0,value:function(){for(var i,o=[],a=0;arguments.length>a;a++)o[a]=arguments[a];var s=null!==(i=o[0])&&void 0!==i?i:{},u=null==s?void 0:s.fail;return r.call(this,e(e({},s),{fail:function(e){var r;if(null===(r=t.growingIO.plugins.gioPerformance)||void 0===r||r.buildPerfEvent("Error",{error_type:"".concat(n," Error"),error_content:e.errMsg}),"function"==typeof u)return u(e)}}))}})}))},this.errorParse=function(e,t){var n,r,i=e.split("\n");i.length?(i.find((function(e,t){var o=e.match(/at (.*?) \((.*):(\d{1,}):(\d{1,})\)/);if(u(o))return n=i[t-1],r=e.trim(),o.length})),n||(n=i[0]),r||(r=i[1])):(n=t||"Error",r=e.substring(0,100)),a.buildErrorEvent({error_type:t||n,error_content:r})},this.minipInst=this.growingIO.minipInstance.minip,this.cacheQueue=[],this.buildErrorEvent=function(e){var t;return null===(t=a.growingIO.plugins.gioPerformance)||void 0===t?void 0:t.buildPerfEvent("apm_system_error",e)},this.setListeners(),this.hookNavigate(),s(null===(n=this.minipInst)||void 0===n?void 0:n.onAppShow)&&(null===(r=this.minipInst)||void 0===r||r.onAppShow(this.setListeners)),s(null===(i=this.minipInst)||void 0===i?void 0:i.onAppHide)&&(null===(o=this.minipInst)||void 0===o||o.onAppHide((function(){a.minipInst.canIUse("offError")&&a.minipInst.offError(),a.minipInst.canIUse("offUnhandledRejection")&&a.minipInst.offUnhandledRejection(),a.minipInst.canIUse("offLazyLoadError")&&a.minipInst.offLazyLoadError(),a.listenerSet=!1}))),this.growingIO.emitter.on(w,(function(){v(a.cacheQueue)||a.cacheQueue.forEach((function(e){a.buildErrorEvent(e)}))}))},b=function(t){var n=this;this.growingIO=t,this.lastWarm=!1,this.referrerPath="",this.lastUnloadPath="",this.initObserver=function(){var e=n.minipInst.canIUse("getPerformance")?n.minipInst.getPerformance():{},t=null==e?void 0:e.createObserver((function(e){n.handleLaunch(c(e.getEntriesByName("appLaunch"))),n.handleFCP(c(e.getEntriesByName("firstContentfulPaint"))),n.handleLCP(c(e.getEntriesByName("largestContentfulPaint"))),n.handleRoute(c(e.getEntriesByName("route")))}));null==t||t.observe({entryTypes:["render","script","navigation"]})},this.handleLaunch=function(t){v(t)||(n.appPerf=e(e({},n.appPerf),{appStartTime:t.startTime,appDuration:t.duration,firstPath:t.path}))},this.handleFCP=function(t){v(t)||(n.pagePerf[t.path]=e(e({},n.pagePerf[t.path]),{FCPStartTime:t.startTime})),n.entriesValidate(null!=t?t:{name:"firstContentfulPaint"})},this.handleLCP=function(t){v(t)||(n.pagePerf[t.path]=e(e({},n.pagePerf[t.path]),{LCPStartTime:t.startTime})),n.entriesValidate(null!=t?t:{name:"largestContentfulPaint"})},this.handleRoute=function(t){v(t)||(n.pagePerf[t.path]=e(e({},n.pagePerf[t.path]),{navigationStart:t.startTime,routeDuration:t.duration})),n.entriesValidate(null!=t?t:{name:"route"})},this.entriesValidate=function(e){var t=e.path||n.growingIO.minipInstance.getCurrentPage().route;n.pagePerf[t]||(n.pagePerf[t]={path:t}),n.pagePerf[t].entries||(n.pagePerf[t].entries=[]),n.pagePerf[t].entries.push(e.name);var r=["firstContentfulPaint","largestContentfulPaint","route"],i=!0;n.pagePerf[t].entries.length<r.length&&(i=!1),r.forEach((function(e){n.pagePerf[t].entries.includes(e)||(i=!1)})),i&&n.handleEvent(t)},this.handleEvent=function(e){var t=n.growingIO.dataStore.eventHooks.currentPage,r={title:t.getPageTitle()},i=n.appPerf.appStartTime,o=n.appPerf.onLaunch,a=n.appPerf.onShow,s=n.pagePerf[e],u=s.onLoad,c=s.onShowEnd,l=s.onReadyEnd,f=s.navigationStart,d=s.FCPStartTime,v=s.LCPStartTime,P=u,I=l||c;if(d&&(r.first_contentful_paint_duration=d>P?d-P:0),v&&(r.largest_contentful_paint_duration=v>P?v-P:0),n.referrerPath?e===n.referrerPath&&a?(r.page_launch_duration=I-a,r.reboot_duration=I-a,r.reboot_mode="warm",n.lastWarm=!1):r.page_launch_duration=I-(null!=f?f:P):"cold"===n.bootType&&(r.page_launch_duration=I-o,r.reboot_duration=I-i,r.reboot_mode="cold",n.bootType="warm"),g(r,(function(e,t){[null,"null",NaN,"NaN"].includes(e)&&m(r,t)})),r.reboot_mode&&!p(r,"reboot_duration")&&m(r,"reboot_mode"),n.appPerf={},n.pagePerf[e]={},2>=h(r).length||!p(r,"page_launch_duration"))return!1;n.buildMonitorEvent(r,{timestamp:+Date.now(),path:t.getPagePath(),query:t.getPageQuery(),title:r.title})},this.minipInst=this.growingIO.minipInstance.minip,this.appPerf={},this.pagePerf={},this.bootType="cold",this.lastWarm=!1,this.buildMonitorEvent=function(e,t){var r;return null===(r=n.growingIO.plugins.gioPerformance)||void 0===r?void 0:r.buildPerfEvent("apm_app_launch",e,t)},["MinP","bytedance"].includes(this.growingIO.minipInstance.platform)&&this.initObserver(),this.growingIO.emitter.on("MINIP_LIFECYCLE",(function(t){var r,i,o,a=t.event,s=t.timestamp,u=t.params,c=a.split(" "),l=c[0],f=c[1];switch(l){case"App":n.appPerf=e(e({},n.appPerf),((r={})[f]=s,r)),"onShowEnd"===f&&("warm"!==n.bootType||n.lastWarm||(n.lastWarm=!0));break;case"Page":var d=null===(o=u.page||u.instance)||void 0===o?void 0:o.route;n.pagePerf[d]=e(e({},n.pagePerf[d]),((i={})[f]=s,i)),"onShowEnd"===f&&n.lastWarm&&"warm"===n.bootType&&n.referrerPath===d&&n.lastUnloadPath!==d&&n.handleEvent(d),["onHide","onUnload"].includes(f)&&(n.referrerPath=d),"onUnload"===f&&(n.lastUnloadPath=d)}}))},O=function(t,n){void 0===n&&(n={});var o,s=this;this.growingIO=t,this.options=n,this.verifyUrl=function(e){if(e.indexOf(s.gdpRequestURL)>-1)return!0;if(u(s.excludeRegExp)){var t=l(s.excludeRegExp.map((function(t){return a(t)?t.test(e):i(t)?e.indexOf(t)>-1:void 0})));return!v(t)}return i(s.excludeRegExp)?e.indexOf(s.excludeRegExp)>-1:!!a(s.excludeRegExp)&&s.excludeRegExp.test(e)},this.hookRequest=function(){var t=s;["request","downloadFile","uploadFile"].forEach((function(n){var r=s.minipInst[n];Object.defineProperty(s.minipInst,n,{writable:!0,enumerable:!0,configurable:!0,value:function(){for(var i=[],o=0;arguments.length>o;o++)i[o]=arguments[o];var a=i[0],s=a.url;if(t.verifyUrl(s))return r.call(this,a);var u={header:a.header||{},url:a.url};switch(n){case"request":var c=a.method;u=e(e({},u),{method:c});break;case"downloadFile":case"uploadFile":var l=a.filePath;u=e(e({},u),{filePath:l,method:"downloadFile"===n?"GET":"POST"})}var f=a.fail,d=a.success;return u.startTime=Date.now(),r.call(this,e(e({},a),{success:function(e){if(u.endTime=Date.now(),t.networkPerfBuilder(e,u),"function"==typeof d)return d(e)},fail:function(e){var n;if(u.endTime=Date.now(),null===(n=t.growingIO.plugins.gioPerformance)||void 0===n||n.buildPerfEvent("Error",{error_type:e.errMsg,error_content:u.url}),"function"==typeof f)return f(e)}}))}})}))},this.networkPerfBuilder=function(e,t){var n=e.profile,i=void 0===n?{}:n,o=e.statusCode,a=void 0===o?0:o,u=e.errMsg,c=t.url,l=t.filePath,f=t.method,d=i.redirectStart,p=i.redirectEnd,h=i.fetchStart,P=i.domainLookUpStart,I=i.domainLookUpEnd,w=i.connectStart,E=i.connectEnd,b=i.requestStart,O=i.responseStart,y=i.responseEnd,_=!v(i),S={url:c,filePath:l,method:f,statusCode:a,message:u,redirect:_?p-d:0,cache:_?P-h:0,dns:_?I-P:0,tcp:_?E-w:0,request:_?O-b:0,response:_?y-O:0,duration:_?y-h:t.endTime-t.startTime};g(S,(function(e,t){return(""===e||r(e))&&m(S,t)})),s.buildNetworkEvent(S)},this.minipInst=this.growingIO.minipInstance.minip,this.buildNetworkEvent=function(e){var t;if(n.network){var r=e.duration,i=e.url,o=e.method,a=e.statusCode;null===(t=s.growingIO.plugins.gioPerformance)||void 0===t||t.buildPerfEvent("apm_network_request",{response_duration:r,request_address:i,request_method:o,http_code:a})}},(null===(o=this.options.network)||void 0===o?void 0:o.exclude)&&(this.excludeRegExp=this.options.network.exclude),this.hookRequest();var c=this,f=this.growingIO.uploader.generateURL;this.growingIO.uploader.generateURL=function(){var e=f.apply(this,arguments);return arguments[0]===c.growingIO.trackingId&&(c.gdpRequestURL=e),e}},y={name:"gioPerformance",method:function(r,i){void 0===i&&(i={});var o,a=this;this.growingIO=r,this.options=i,this.init=function(){var e=a.growingIO.vdsConfig.dataCollect,t=a.options,n=t.monitor,r=t.exception,i=t.network;n&&(a.monitor=new b(a.growingIO)),r&&(a.exception=new E(a.growingIO)),i&&(a.network=new O(a.growingIO,a.options)),e&&a.sendCacheQuene()},this.sendCacheQuene=function(){n.isEmpty(a.cacheQueue)||(a.cacheQueue.forEach((function(e){a.buildPerfEvent(e.eventName,e.attributes,e.extra)})),a.cacheQueue=[])},this.buildPerfEvent=function(r,i,o){var s,u=a.growingIO,c=u.dataStore,l=c.eventContextBuilder,f=c.eventConverter,d=u.gioSDKInitialized,p=u.vdsConfig;if(!d||!p.dataCollect)return a.cacheQueue=t(t([],a.cacheQueue,!0),[{eventName:r,attributes:i,extra:o}],!1),!1;n.forEach(i,(function(e,t){(Number.isNaN(e)||n.isNil(e)||0>Number(e))&&(i[t]=0),i[t]=n.fixed(e,0)}));var h=e({eventType:"CUSTOM",eventName:r,attributes:i},l(a.growingIO.trackingId));h.attributes=I(e(e({},null!==(s=h.attributes)&&void 0!==s?s:{}),i)),v(o)||(h=e(e({},h),o)),f(h)},this.pluginVersion="4.3.2",n=this.growingIO.utils,this.options=e({monitor:!0,exception:!0,network:!1},this.options),this.cacheQueue=[],this.growingIO.emitter.on(w,(function(e){if(e.trackingId===a.growingIO.trackingId){var t=e.performance,n=t.monitor,r=t.exception,i=t.network;n!==a.options.monitor&&(a.options.monitor=n),r!==a.options.exception&&(a.options.exception=r),i!==a.options.network&&(a.options.network=i),a.init()}})),null===(o=this.growingIO.emitter)||void 0===o||o.on("SESSIONID_UPDATE",(function(){var e=a.growingIO,t=e.trackingId;(0,e.getOption)(t,"dataCollect")&&a.sendCacheQuene()}))}};export{y as default};
