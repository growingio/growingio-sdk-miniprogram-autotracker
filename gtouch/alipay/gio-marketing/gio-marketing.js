function e(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function t(t){for(var r=1;arguments.length>r;r++){var n=null!=arguments[r]?arguments[r]:{};r%2?e(Object(n),!0).forEach((function(e){o(t,e,n[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(n)):e(Object(n)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(n,e))}))}return t}function r(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function n(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function i(e,t,r){return t&&n(e.prototype,t),r&&n(e,r),Object.defineProperty(e,"prototype",{writable:!1}),e}function o(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function a(e){return function(e){if(Array.isArray(e))return u(e)}(e)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(e)||s(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function s(e,t){if(e){if("string"==typeof e)return u(e,t);var r={}.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?u(e,t):void 0}}function u(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=Array(t);t>r;r++)n[r]=e[r];return n}(global||$global).gTouchVersion="3.8.4";var c=getApp(),l=("function"==typeof c.__gio__?c.__gio__():c.__gio__)||("function"==typeof(global||$global).__gio__?(global||$global).__gio__():(global||$global).__gio__)||{},g=l.dataStore,p=l.emitter,v=l.gioEnvironment,d=l.minipInstance,f=l.userStore,m=l.utils,h=l.vdsConfig,y=l.track,b=h||{},w=b.appId,S=b.debug,T=b.gtouchHost,D=b.projectId,_=b.scheme,I=d||{getImageInfo:function(){},getStorageSync:function(){},navigateTo:function(){},navigateToMiniProgram:function(){},request:function(){},setStorageSync:function(){}},E=I.getImageInfo,k=I.getStorageSync,R=I.navigateTo,O=I.navigateToMiniProgram,P=I.request,U=I.setStorageSync,A=m||{},M=A.compact,F=A.endsWith,C=A.head,x=A.isArray,j=A.isEmpty,V=A.isString,G=A.keys,N=A.qs,q=A.startsWith,B=function(e,t){console.log("%c[GrowingIO]：".concat(e),{info:"color: #3B82F6;",error:"color: #EF4444;",warn:"color: #F59E0B;",success:"color: #10B981;"}[t]||"")},Q=function(e){return S&&console.log("[GrowingIO Debug]:",JSON.stringify(e,null,2))};l&&l.gioSDKInitialized||B("未集成或未初始化加载 Gio小程序SDK! GioMarketing 加载失败！","error");var H="";"saas"===v?H="https://messages.growingio.com/v3/".concat(D,"/notifications"):T&&V(T)?(_?F(toString(_),"://")||(_="".concat(_,"://")):_="https://",q(T,"http")&&(T=T.substring(T.indexOf("://")+(F(toString(_),"://")?4:1))),H="".concat(_).concat(T,"/marketing/automation/v3/").concat(D,"/notifications")):B("如果您需要使用触达功能，请在 Gio小程序SDK 中配置 gtouchHost!","info");var L=i((function e(){var t=this;r(this,e),o(this,"get",(function(e,r){var n=k("".concat("push-user-status","#").concat(e).concat(r?"#"+r:""))||{},i="userAttrs"===e?432e7:864e5;return Date.now()>n.startAt+i?(t.set(e,0,r),0):n.value})),o(this,"set",(function(e,t,r){var n=new Date;n.setHours(0),n.setMinutes(0),n.setSeconds(0),U("".concat("push-user-status","#").concat(e).concat(r?"#"+r:""),{startAt:n.getTime(),value:t})}))})),$=i((function e(){var n=this;r(this,e),o(this,"get",(function(e,r){var i,o=k("#push-status#".concat(e,"#").concat(r||""))||{},a={showTimes:0,showDate:Date.now(),recommendIdx:0,recommendDate:null};return i=o?t(t({},a),o):a,n.set(e,r,i),i})),o(this,"set",(function(e,t,r){U("#push-status#".concat(e,"#").concat(t||""),r)}))})),K=function(e){return"boolean"==typeof e?e:"string"==typeof e?"t"===e:void 0},W=function(e){if("t"===e)return!0;if("f"===e)return!1;e="("+e.replace(/&+/g,"&").replace(/\|+/g,"|")+")";for(var t=[],r=function(r){t.push(e[r]);for(var n=void 0,i=void 0,o=[];")"===e[r]&&"("!==n&&void 0!==(n=t.pop());)["&","|"].includes(n)?i=n:["t","f",!0,!1].includes(n)&&o.push(n);if(i&&o.length){var a=o.reduce((function(e,t){var r=K(e),n=K(t);return"&"===i?r&&n:"|"===i?r||n:void 0}),K(o[0]));t.push(a)}},n=0;n<e.length;n++)r(n);return t.pop()},z=function(e){var t=e.substr(0,4),r=e.substr(4,2),n=e.substr(6,2);return new Date("".concat(t,"-").concat(r,"-").concat(n)).getTime()},J={isRequested:!1,retryTimes:0,isPreview:!1,isConsuming:!1,originData:[],triggerConditions:[],unResolvedEvents:[],renderQueue:[],isRendering:!1,renderFn:void 0},X=function(){function e(){var t=this;r(this,e),o(this,"activateInit",(function(){t.saveOriginData([]),t.isRequested=!1;var e=t.previewVerify();j(e)?(t.getMarketingData(),clearTimeout(t.t),t.t=null,t.t=setTimeout((function(){t.activateInit(),clearTimeout(t.t)}),18e5)):(t.isPreview=!0,t.getPreviewMarketingData(e))})),o(this,"previewVerify",(function(){var e=N.parse(g.eventHooks.currentPage.query||"");return e&&e.scene&&e.scene.gioMessageId?{messageId:e.scene.gioMessageId,msgType:{s:"splash",pw:"popupWindow",p:"push",b:"banner",ab:"abTest"}[e.scene.mt||""]}:{}})),o(this,"emitterDestroy",(function(){return p.all.clear()})),o(this,"destroy",(function(){G(J).forEach((function(e){t[e]=J[e]})),t.emitterDestroy()})),o(this,"persistentEvents",(function(e){switch(e.t||e.eventType){case"vst":case"vstr":case"ppl":case"VISIT":case"LOGIN_USER_ATTRIBUTES":t.userVariable(e);break;case"cstm":case"CUSTOM":t.isRequested?j(t.originData)||j(t.triggerConditions)||!t.triggerConditions.includes(e.n||e.eventName)||(t.cstmVariable(e),t.consumeUnResolvedEvents(e)):(t.cstmVariable(e),t.unResolvedEvents.push(e))}})),o(this,"userVariable",(function(e){var r=f.userId,n=e.var||e.attributes,i=t.popupUserStore.get("userAttrs",r)||[],o=a(i);j(n)||(G(n).forEach((function(e){var t=i.findIndex((function(t){return t.key===e}));-1!==t?o[t].value=n[e]:o.push({key:e,value:n[e]})})),t.popupUserStore.set("userAttrs",o,r))})),o(this,"cstmVariable",(function(e){var r=f.userId,n=e.var||e.attributes,i=t.popupUserStore.get("triggerAttrs",r)||[];t.popupUserStore.set("triggerAttrs",[].concat(a(i),[{key:e.n||e.eventName,value:"",event_variable:n?G(n).map((function(e){return{key:e,value:n[e]}})):[]}]),r)})),o(this,"persistentGroupingData",(function(e){var r=e.bu,n=e.bcs;t.popupUserStore.set("bu",r),t.popupUserStore.set("bcs",n)})),o(this,"generateURL",(function(){var e=f.uid,r=f.userId,n=f.gioId,i={bu:t.popupUserStore.get("bu",r),bcs:t.popupUserStore.get("bcs",r),u:e,cs:r,gioId:n},o="".concat(H,"?url_scheme=").concat(w,"&enableRecommend=1");return G(i).forEach((function(e){return o+=i[e]?"&".concat(e,"=").concat(i[e]):""})),o})),o(this,"getMarketingData",(function(){P({url:t.generateURL(),header:{"X-Timezone":(((new Date).toString()||"").match(/GMT\+[0-9]+/g)||[])[0]},success:function(e){var r=e.data;200!==e.statusCode||j(r)||(t.persistentGroupingData(r.idMappings||{}),t.isPreview=!!r.previewStatus,t.isPreview?t.getPreviewMarketingData(r.previewStatus):t.saveOriginData(r.popupWindows),t.isRequested=!0,t.consumeUnResolvedEvents())},fail:function(){t.retryTimes+=1,3>t.retryTimes?t.getMarketingData():(t.isRequested=!0,B("获取弹窗数据失败！","error"))},timeout:5e3})})),o(this,"getPreviewMarketingData",(function(e){var r=e.messageId,n=e.msgType;P({url:"".concat(H,"/preview?url_scheme=").concat(w,"&message_id=").concat(r,"&msgType=").concat(n).concat("cdp"===v?"&enableRecommend=1":""),success:function(e){var r=e.data;200!==e.statusCode||j(r)||(t.persistentGroupingData(r.idMappings||{}),t.isRequested=!0)},fail:function(){t.retryTimes+=1,3>t.retryTimes?t.getPreviewMarketingData({messageId:r,msgType:n}):(t.isRequested=!0,B("获取弹窗数据失败！","error"))},timeout:5e3})})),o(this,"verifyOnline",(function(e,r){var n=f.userId;return t.validAbNeedShow(e)&&t.validTimeRange(e)&&t.validTimes(e,n)&&t.validTriggerCd(e,n)&&t.validUserFilter(e)&&t.validTriggerFilter(e,r)})),o(this,"verifyPreview",(function(e,r){return t.validAbNeedShow(e)&&t.validTriggerFilter(e,r)})),o(this,"saveOriginData",(function(e){t.originData=e.sort((function(e,t){return t.updateAt-e.updateAt})),t.originData.forEach((function(e){var r,n=[];e.rule&&e.rule.triggerFilter&&(n=null!==(r=e.rule.triggerFilter.conditions)&&void 0!==r?r:[]),j(n)||n.forEach((function(e){t.triggerConditions.push(e.key)}))})),t.triggerConditions=Array.from(new Set(M(t.triggerConditions)))})),o(this,"consumeUnResolvedEvents",(function(e){var r={};j(e)||t.unResolvedEvents.push(e),j(t.unResolvedEvents)||(r=t.unResolvedEvents.shift());var n=r.n||r.eventName||"";j(r)||t.isConsuming||j(t.originData)||0===n.indexOf("in_app_message_")||(t.isConsuming=!0,t.eventVerify(r))})),o(this,"eventVerify",(function(e){var r=C(t.originData.filter((function(r){return t.isPreview?t.verifyPreview(r,e):t.verifyOnline(r,e)})))||{};if(j(r))t.isConsuming=!1,t.consumeUnResolvedEvents();else if(r.rule&&(r.rule.triggerDelay||0)>0)var n=setTimeout((function(){t.pushRenderQueue(r),clearTimeout(n)}),1e3*message.rule.triggerDelay);else t.pushRenderQueue(r)})),o(this,"pushRenderQueue",(function(e){t.renderQueue.push(e),t.dispatchPopRender()})),o(this,"dispatchPopRender",(function(){t.isRendering=!0;var e=t.renderQueue.shift();e&&t.renderFn&&t.renderFn(e)})),o(this,"getTargetConfig",(function(e){if(!t.isIntelligent(e))return e.contentMetadata.components[0].config;var r=userStorage.get("cs1"),n=e.contentMetadata.components[0].recommendDate,i=e.contentMetadata.components[0].recommendList,o=t.get(e.id,r);n!==o.recommendDate&&(o.recommendIdx=0,o.recommendDate=n);var a=i[o.recommendIdx%i.length];return o.recommendIdx=o.recommendIdx+1,t.popupStore.set(e.id,r,o),a})),o(this,"isIntelligent",(function(e){var t=e.contentMetadata.components[0].recommendList;return x(t)&&t.length>0})),o(this,"trackImp",(function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};t.isPreview||y("in_app_message_imp",{in_app_message_name:e.name});var r=f.userId,n=t.popupStore.get(e.id,r);n.showTimes+=1;var i=new Date(Date.now()+1e3*((e.rule?e.rule.triggerCd:0)||0));i.setHours(0),i.setMinutes(0),i.setSeconds(0),n.showDate=i.getTime(),t.popupStore.set(e.id,r,n)})),o(this,"trackClose",(function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};t.isPreview||y("in_app_message_close",{in_app_message_name:e.name}),t.isRendering=!1,t.dispatchPopRender()})),o(this,"handleTarget",(function(e){if(t.isPreview||y("in_app_message_cmp_click",{in_app_message_name:e.name}),!t.isIntelligent(e)){var r=f.userId,n=t.popupStore.get(e.id,r);n.showTimes+=9999,t.popupStore.set(e.id,r,n)}var i=e.targetConfig&&e.targetConfig.target?e.targetConfig.target["growing.".concat(w)]:void 0;i&&t.navigateDistribute(i)})),o(this,"navigateDistribute",(function(e){var r,n,i=/^MINP::(.*?)::(.*)/;if(i.test(e)){var o=(r=e.match(i),n=3,function(e){if(Array.isArray(e))return e}(r)||function(e,t){var r=null==e?null:"undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(null!=r){var n,i,o=[],a=!0,s=!1;try{for(r=r.call(e);!(a=(n=r.next()).done)&&(o.push(n.value),!t||o.length!==t);a=!0);}catch(e){s=!0,i=e}finally{try{a||null==r.return||r.return()}finally{if(s)throw i}}return o}}(r,n)||s(r,n)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}());o[0];var a=o[1],u=o[2];O({appId:a,path:u,envVersion:["develop","trial","release"].includes(t.envVersion)?t.envVersion:"release"})}else R({url:/^https?:\/\//.test(e)?"".concat(t.h5Page,"?url=").concat(e):e})})),B("GioMarketing 初始化中...","info"),this.popupUserStore=new L,this.popupStore=new $,G(J).forEach((function(e){t[e]=J[e]})),p&&(p.on("onComposeAfter",(function(e){var r=e.composedEvent;return t.persistentEvents(r)})),p.on("USERID_UPDATE",(function(){t.activateInit()})))}return i(e,[{key:"validAbNeedShow",value:function(e){var t=!(e.abTest&&e.abTest.ctrlGroup);return Q("".concat(e.name," validAbNeedShow ").concat(t)),t}},{key:"validTimeRange",value:function(e){var t=Date.now(),r=(e.rule.startAt||0)<=t&&t<(e.rule.endAt||t+1);return Q("".concat(e.name," validTimeRange ").concat(r)),r}},{key:"validTimes",value:function(e,t){var r=this.popupStore.get(e.id,t).showTimes<e.rule.limit;return Q("".concat(e.name," validTimes ").concat(r)),r}},{key:"validTriggerCd",value:function(e,t){var r=this.popupStore.get(e.id,t).showDate<Date.now();return Q("".concat(e.name," validTriggerCd  ").concat(r)),r}},{key:"validUserFilter",value:function(e){var t;if(e.rule.filters&&e.rule.filters.expr&&e.rule.filters.exprs&&e.rule.filters.exprs.length){var r=this.getUserFilterMaps(e.rule.filters.exprs),n=this.getBoolExprs(r,e.rule.filters.expr);t=W(n)}else t=!0;return Q("".concat(e.name," validUserFilter ").concat(t)),t}},{key:"validTriggerFilter",value:function(e,t){var r;if(e.rule.triggerFilter&&e.rule.triggerFilter.conditionExpr&&e.rule.triggerFilter.conditions&&e.rule.triggerFilter.conditions.length){var n=this.getTriggerFilterMaps(t,e.rule.triggerFilter.conditions),i=this.getBoolExprs(n,e.rule.triggerFilter.conditionExpr);r=W(i)}else r=!0;return Q("".concat(e.name," validTriggerFilter ").concat(r)),r}},{key:"mergeUserAttrs",value:function(e){var t={};return e.forEach((function(e){t[e.key]=e})),Object.values(t)}},{key:"getUserFilterMaps",value:function(e){var t=this,r=f.userId,n=this.mergeUserAttrs(this.popupUserStore.get("userAttrs",r)||[]);return e.map((function(e){return{symbol:e.symbol,result:n.some(t.validUserFilterExpression.bind(t,e))?"t":"f"}}))}},{key:"getTriggerFilterMaps",value:function(e,t){var r=this,n=f.userId,i=this.popupUserStore.get("triggerAttrs",n)||[],o=e.eventName||e.n;return t.map((function(e){var t=i.filter((function(t){return t.key===e.key}));return{symbol:e.alias,result:o===e.key&&t.length&&r.validTriggerFilterExpression(e,t)?"t":"f"}}))}},{key:"getBoolExprs",value:function(e,t){return e.reduce((function(e,t){return e.replace(RegExp(t.symbol,"g"),t.result)}),t)}},{key:"validUserFilterExpression",value:function(e,t){return t.key===e.key&&this.validExpression(t.value,e)}},{key:"validTriggerFilterExpression",value:function(e,t){var r=this,n=e.dimFilters||[];return{count:function(){var i=r.validDimFilters(t,n).length;return r.validExpression(i,e)},sum:function(){var i=e.attribute;if(!i)return!1;var o=0;if(n.length){var a=r.validDimFilters(t,n);o=r.sumAttribute(a,i)}else o=r.sumAttribute(t,i);return r.validExpression(o,e)}}[e.aggregator]()||!1}},{key:"validDimFilters",value:function(e){var t=this,r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:[];return r.length?e.filter((function(e){var n=e.event_variable||[];return r.every((function(e){return n.some((function(r){return t.validExpression(r.value,e)}))}))})):e}},{key:"sumAttribute",value:function(e,t){var r=0;return e.forEach((function(e){(e.event_variable||[]).forEach((function(e){e.key===t&&(r+=Number(e.value)||0)}))})),r}},{key:"validExpression",value:function(e,t){var r=t.values;return"date"===t.valueType&&(r=r.map(z),e=z(e)),"=="===t.op?e==r[0]:"<"===t.op?e<r[0]:">"===t.op?e>r[0]:"<="===t.op?e<=r[0]:">="===t.op?e>=r[0]:"!="===t.op?e!=r[0]:"between"===t.op?e<=r[1]&&e>=r[0]:"in"===t.op?r.find((function(t){return t===e})):"not in"===t.op&&!r.find((function(t){return t===e}))}}],[{key:"getSingleton",value:function(){return this.singleton||(this.singleton=new e),this.singleton}}]),e}().getSingleton();Component({props:{h5Page:{type:String,value:"/pages/h5/h5"},envVersion:{type:String,value:"release"}},data:{message:void 0,imageUrl:void 0,visible:!1},didUnmount:function(){this.setData({message:void 0,imageUrl:void 0,visible:!1}),X&&X.destroy(),this.hideModal()},didMount:function(){var e=this;if(l.gioSDKInitialized){var t=this.props,r=t.envVersion,n=t.h5Page;X.envVersion=r,X.h5Page=n,X.renderFn=function(t){var r=X.getTargetConfig(t);E({src:r.src,success:function(n){e.setData({message:Object.assign({targetConfig:r},t),visible:!0,imageUrl:n.path}),X.trackImp(t)},fail:function(){X.isRendering=!1,X.dispatchPopRender()},complete:function(){X.isConsuming=!1,X.consumeUnResolvedEvents()}})};var i="saas"===v?{t:"cstm",n:"appOpen"}:{eventType:"CUSTOM",eventName:"appOpen"};X.persistentEvents(i),X.activateInit(),B("GioMarketing 初始化完成!","success")}},methods:{hideModal:function(){this.setData({visible:!1})},onClose:function(){this.hideModal(),X&&X.trackClose(this.data.message)},onTapTarget:function(){X&&X.handleTarget(this.data.message),this.hideModal()}}});
