var e=function(){return e=Object.assign||function(e){for(var t,r=1,n=arguments.length;n>r;r++)for(var i in t=arguments[r])({}).hasOwnProperty.call(t,i)&&(e[i]=t[i]);return e},e.apply(this,arguments)};"function"==typeof SuppressedError&&SuppressedError;var t=function(e){return["undefined","null"].includes(s(e))},r=function(e){return"string"===s(e)},n=function(e){return"NaN"===a(Number(e))},i=function(e){return"number"===s(e)},o=function(e){return"[object Object]"==={}.toString.call(e)&&!t(e)},a=function(e){return t(e)?"":"".concat(e)},c=function(e){return o(e)?Object.keys(e):[]},u=function(e){return function(e){return Array.isArray(e)&&"array"===s(e)}(e)?0===e.length:o(e)?0===c(e).length:!e},s=function(e){return{}.toString.call(e).slice(8,-1).toLowerCase()},g=/^\d+_gdp_abt_sign$/,l=/^\d+_gdp_abtd$/,d=function(e,t){console.log("%c[GrowingIO]：".concat(e),{info:"color: #3B82F6;",error:"color: #EF4444",warn:"color: #F59E0B",success:"color: #10B981"}[t]||"")},f=function(e,t){if(["function","asyncfunction"].includes(s(e)))try{e(t)}catch(e){d("回调执行失败！".concat(e),"error")}},v=function(e,t){void 0===t&&(t=!1);var r=0;if(u(e)||"boolean"==typeof e)return r;for(var n=0;n<e.length;)r=(r<<5)-r+e.charCodeAt(n),r|=0,n++;return t?Math.abs(r):r},y={name:"gioABTest",method:function(t,s){var y=this;this.growingIO=t,this.timeoutCheck=function(e,t){y.requestInterval=i(Number(e))&&!n(Number(e))?Number(e):5,(y.requestInterval>1440||0>y.requestInterval)&&(y.requestInterval=5),y.requestTimeout=i(Number(t))&&!n(Number(t))?Number(t):1e3,(y.requestTimeout>5e3||100>y.requestTimeout)&&(y.requestTimeout=1e3)},this.abtStorageCheck=function(){var e,t=y.growingIO.minipInstance,r=(null===(e=t.minip)||void 0===e?void 0:e.getStorageInfoSync().keys)||[];r.filter((function(e){return g.test(e)})).forEach((function(e){var r=t.getStorageSync(e);r&&r>=Date.now()||t.removeStorageSync(e)})),r.filter((function(e){return l.test(e)})).forEach((function(e){u(t.getStorageSync(e))&&t.removeStorageSync(e)}))},this.getHashKey=function(e,t){var r=y.growingIO,n=r.userStore.getUid,i=r.vdsConfig.projectId;return v("".concat(e,"#").concat(i,"#").concat(n(),"#").concat(t),!0)},this.generateUrl=function(e,t){var n,i;i="http",r(n=t)||(n=a(n)),n.slice(0,4)!==i?y.url[e]="https://".concat(t,"/diversion/specified-layer-variables"):y.url[e]="".concat(t,"/diversion/specified-layer-variables")},this.getABTest=function(e,t,r){if(u(y.url[e])&&y.generateUrl(e,"https://ab.growingio.com"),!t)return d("获取ABTest数据失败! 实验层Id不合法!","error"),void f(r,{});var n=y.growingIO.minipInstance,i=n.getStorageSync("".concat(y.getHashKey(e,t),"_gdp_abt_sign"))||0,o=n.getStorageSync("".concat(y.getHashKey(e,t),"_gdp_abtd"))||{};!i||i<Date.now()?y.initiateRequest(e,t,o,r):f(r,o)},this.initiateRequest=function(t,r,n,i){var o=y.growingIO,a=o.userStore.getUid,c=o.dataStore,u=o.minipInstance,s=c.getTrackerVds(t),g=s.projectId,l=s.dataSourceId;u.request({url:y.url[t],header:{"Content-Type":"application/x-www-form-urlencoded"},method:"POST",data:{accountId:g,datasourceId:l,distinctId:a(),layerId:r},timeout:y.requestTimeout,success:function(o){var a=o.data;0===a.code?y.experimentVerify(t,e(e({},a),{layerId:r}),n,i):(d("获取ABTest数据失败! ".concat(a.errorMsg,"!"),"error"),f(i,{})),u.setStorageSync("".concat(y.getHashKey(t,r),"_gdp_abt_sign"),Date.now()+6e4*y.requestInterval)},fail:function(e){var o=e.errMsg;o.indexOf("timeout")>-1?(d("获取ABTest数据失败! 请求超时!","error"),f(i,{})):2>y.retryCount?(y.initiateRequest(t,r,n,i),y.retryCount+=1):(d("获取ABTest数据失败! ".concat(JSON.stringify(o).slice(0,30),"!"),"error"),f(i,{}))}})},this.experimentVerify=function(e,t,r,n){var i=t.layerId,o=t.strategyId,c=t.experimentId,u=t.variables,s="".concat(y.getHashKey(e,i),"_gdp_abtd"),g={layerId:a(i),strategyId:a(o),experimentId:a(c),variables:u};v(JSON.stringify(g))!==v(JSON.stringify(r))&&(y.growingIO.minipInstance.setStorageSync(s,g,new Date((new Date).getFullYear(),(new Date).getMonth(),(new Date).getDate()+1).getTime()),o&&c&&y.buildExperimentHitEvent(e,a(i),a(c),a(o))),f(n,g)},this.buildExperimentHitEvent=function(t,r,n,i){var o=y.growingIO.dataStore,a=o.eventContextBuilder;(0,o.eventConverter)(e(e({eventType:"CUSTOM",eventName:"$exp_hit",attributes:{$exp_layer_id:r,$exp_id:n,$exp_strategy_id:i}},a(t)),{customEventType:0}))};var h=null!=s?s:{},p=h.abServerUrl,I=void 0===p?"https://ab.growingio.com":p,m=h.requestInterval,S=h.requestTimeout;this.timeoutCheck(m,S);var b=this.growingIO.emitter;this.growingIO.getABTest=this.getABTest,b.on("OPTION_INITIALIZED",(function(){u(I)?d("如果您需要使用ABTest功能，请配置服务地址 abServerUrl!","warn"):(y.abtStorageCheck(),y.url={},r(I)?y.generateUrl(y.growingIO.trackingId,I):o(I)&&c(I).forEach((function(e){y.generateUrl(e,I[e])})))})),this.retryCount=0}};export{y as default};