function e(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function t(t){for(var r=1;arguments.length>r;r++){var n=null!=arguments[r]?arguments[r]:{};r%2?e(Object(n),!0).forEach((function(e){o(t,e,n[e])})):Object.getOwnPropertyDescriptors?Object.defineProperties(t,Object.getOwnPropertyDescriptors(n)):e(Object(n)).forEach((function(e){Object.defineProperty(t,e,Object.getOwnPropertyDescriptor(n,e))}))}return t}function r(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function n(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,c(n.key),n)}}function i(e,t,r){return t&&n(e.prototype,t),r&&n(e,r),Object.defineProperty(e,"prototype",{writable:!1}),e}function o(e,t,r){return(t=c(t))in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function s(e){return function(e){if(Array.isArray(e))return u(e)}(e)||function(e){if("undefined"!=typeof Symbol&&null!=e[Symbol.iterator]||null!=e["@@iterator"])return Array.from(e)}(e)||a(e)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function a(e,t){if(e){if("string"==typeof e)return u(e,t);var r={}.toString.call(e).slice(8,-1);return"Object"===r&&e.constructor&&(r=e.constructor.name),"Map"===r||"Set"===r?Array.from(e):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?u(e,t):void 0}}function u(e,t){(null==t||t>e.length)&&(t=e.length);for(var r=0,n=Array(t);t>r;r++)n[r]=e[r];return n}function c(e){var t=function(e,t){if("object"!=typeof e||null===e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var n=r.call(e,"string");if("object"!=typeof n)return n;throw new TypeError("@@toPrimitive must return a primitive value.")}return e+""}(e);return"symbol"==typeof t?t:t+""}var g=function(){try{return $global}catch(e){return global}};g().gTouchVersion="3.8.5";var l,p,v=function(e,t){console.log("%c[GrowingIO]：".concat(e),{info:"color: #3B82F6;",error:"color: #EF4444;",warn:"color: #F59E0B;",success:"color: #10B981;"}[t]||"")},d=function(){var e=getApp({allowDefault:!0});return("function"==typeof e.__gio__?e.__gio__():e.__gio__)||("function"==typeof g().__gio__?g().__gio__():g().__gio__)||{}},f="push-user-status",m=i((function e(t){var n=this;r(this,e),o(this,"get",(function(e,t){var r=n.getStorageSync("".concat(f,"#").concat(e).concat(t?"#"+t:""))||{},i="userAttrs"===e?432e7:864e5;return Date.now()>r.startAt+i?(n.set(e,0,t),0):r.value})),o(this,"set",(function(e,t,r){var i=new Date;i.setHours(0),i.setMinutes(0),i.setSeconds(0),n.setStorageSync("".concat(f,"#").concat(e).concat(r?"#"+r:""),{startAt:i.getTime(),value:t})})),this.getStorageSync=t.minipInstance.getStorageSync,this.setStorageSync=t.minipInstance.setStorageSync})),h=i((function e(n){var i=this;r(this,e),o(this,"get",(function(e,r){var n,o=i.getStorageSync("#push-status#".concat(e,"#").concat(r||""))||{},s={showTimes:0,showDate:Date.now(),recommendIdx:0,recommendDate:null};return n=o?t(t({},s),o):s,i.set(e,r,n),n})),o(this,"set",(function(e,t,r){i.setStorageSync("#push-status#".concat(e,"#").concat(t||""),r)})),this.getStorageSync=n.minipInstance.getStorageSync,this.setStorageSync=n.minipInstance.setStorageSync})),y=function(e){return"boolean"==typeof e?e:"string"==typeof e?"t"===e:void 0},b=function(e){if("t"===e)return!0;if("f"===e)return!1;e="("+e.replace(/&+/g,"&").replace(/\|+/g,"|")+")";for(var t=[],r=function(){var r,i;t.push(e[n]);for(var o=[];")"===e[n]&&"("!==r&&void 0!==(r=t.pop());)["&","|"].includes(r)?i=r:["t","f",!0,!1].includes(r)&&o.push(r);if(i&&o.length){var s=o.reduce((function(e,t){var r=y(e),n=y(t);return"&"===i?r&&n:"|"===i?r||n:void 0}),y(o[0]));t.push(s)}},n=0;n<e.length;n++)r();return t.pop()},w=function(e){var t=e.substr(0,4),r=e.substr(4,2),n=e.substr(6,2);return new Date("".concat(t,"-").concat(r,"-").concat(n)).getTime()},S={isRequested:!1,retryTimes:0,isPreview:!1,isConsuming:!1,originData:[],triggerConditions:[],unResolvedEvents:[],renderQueue:[],isRendering:!1,renderFn:void 0},I=function(){function e(){var t=this;r(this,e),o(this,"getBaseURL",(function(){var e=t.growingIO,r=e.vdsConfig,n=e.gioEnvironment,i=r.projectId,o=r.gtouchHost,s=r.scheme;"saas"===n?t.baseURL="https://messages.growingio.com/v3/".concat(i,"/notifications"):o&&l.isString(o)?(s?l.endsWith(l.toString(s),"://")||(s="".concat(s,"://")):s="https://",l.startsWith(o,"http")&&(o=o.substring(o.indexOf("://")+(l.endsWith(l.toString(s),"://")?4:1))),t.baseURL="".concat(s).concat(o,"/marketing/automation/v3/").concat(i,"/notifications")):v("如果您需要使用触达功能，请在 Gio小程序SDK 中配置 gtouchHost!","info")})),o(this,"debugLog",(function(e){t.growingIO.vdsConfig.debug&&console.log("[GrowingIO Debug]:",JSON.stringify(e,null,2))})),o(this,"activateInit",(function(){t.saveOriginData([]),t.isRequested=!1;var e=t.previewVerify();l.isEmpty(e)?(t.getMarketingData(),clearTimeout(t.t),t.t=null,t.t=setTimeout((function(){t.activateInit(),clearTimeout(t.t)}),18e5)):(t.isPreview=!0,t.getPreviewMarketingData(e))})),o(this,"previewVerify",(function(){var e=l.qs.parse(t.growingIO.dataStore.eventHooks.currentPage.query||"");return e&&e.scene&&e.scene.gioMessageId?{messageId:e.scene.gioMessageId,msgType:{s:"splash",pw:"popupWindow",p:"push",b:"banner",ab:"abTest"}[e.scene.mt||""]}:{}})),o(this,"destroy",(function(){l.keys(S).forEach((function(e){t[e]=S[e]})),t.growingIO.emitter.all.clear()})),o(this,"persistentEvents",(function(e){switch(e.t||e.eventType){case"vst":case"vstr":case"ppl":case"VISIT":case"LOGIN_USER_ATTRIBUTES":t.userVariable(e);break;case"cstm":case"CUSTOM":t.isRequested?l.isEmpty(t.originData)||l.isEmpty(t.triggerConditions)||!t.triggerConditions.includes(e.n||e.eventName)||(t.cstmVariable(e),t.consumeUnResolvedEvents(e)):(t.cstmVariable(e),t.unResolvedEvents.push(e))}})),o(this,"userVariable",(function(e){var r=t.growingIO.userStore.userId,n=e.var||e.attributes,i=t.popupUserStore.get("userAttrs",r)||[],o=s(i);l.isEmpty(n)||(l.keys(n).forEach((function(e){var t=i.findIndex((function(t){return t.key===e}));-1!==t?o[t].value=n[e]:o.push({key:e,value:n[e]})})),t.popupUserStore.set("userAttrs",o,r))})),o(this,"cstmVariable",(function(e){var r=t.growingIO.userStore.userId,n=e.var||e.attributes,i=t.popupUserStore.get("triggerAttrs",r)||[];t.popupUserStore.set("triggerAttrs",[].concat(s(i),[{key:e.n||e.eventName,value:"",event_variable:n?l.keys(n).map((function(e){return{key:e,value:n[e]}})):[]}]),r)})),o(this,"persistentGroupingData",(function(e){var r=e.bu,n=e.bcs;t.popupUserStore.set("bu",r),t.popupUserStore.set("bcs",n)})),o(this,"generateURL",(function(){var e=t.growingIO,r=e.vdsConfig.appId,n=e.userStore,i=n.uid,o=n.userId,s=n.gioId,a={bu:t.popupUserStore.get("bu"),bcs:t.popupUserStore.get("bcs"),u:i,cs:o,gioId:s},u="".concat(t.baseURL,"?url_scheme=").concat(r,"&enableRecommend=1");return l.keys(a).forEach((function(e){return u+=a[e]?"&".concat(e,"=").concat(a[e]):""})),u})),o(this,"getMarketingData",(function(){(0,t.growingIO.minipInstance.request)({url:t.generateURL(),header:{"X-Timezone":(((new Date).toString()||"").match(/GMT\+[0-9]+/g)||[])[0]},success:function(e){var r=e.data;200!==e.statusCode||l.isEmpty(r)||(t.persistentGroupingData(r.idMappings||{}),t.isPreview=!!r.previewStatus,t.isPreview?t.getPreviewMarketingData(r.previewStatus):t.saveOriginData(r.popupWindows),t.isRequested=!0,t.consumeUnResolvedEvents())},fail:function(){t.retryTimes+=1,3>t.retryTimes?t.getMarketingData():(t.isRequested=!0,l.consoleText("获取弹窗数据失败！","error"))},timeout:5e3})})),o(this,"getPreviewMarketingData",(function(e){var r=e.messageId,n=e.msgType,i=t.growingIO,o=i.vdsConfig.appId,s=i.gioEnvironment;(0,i.minipInstance.request)({url:"".concat(t.baseURL,"/preview?url_scheme=").concat(o,"&message_id=").concat(r,"&msgType=").concat(n).concat("cdp"===s?"&enableRecommend=1":""),success:function(e){var r=e.data;200!==e.statusCode||l.isEmpty(r)||(t.persistentGroupingData(r.idMappings||{}),t.isRequested=!0)},fail:function(){t.retryTimes+=1,3>t.retryTimes?t.getPreviewMarketingData({messageId:r,msgType:n}):(t.isRequested=!0,l.consoleText("获取弹窗数据失败！","error"))},timeout:5e3})})),o(this,"verifyOnline",(function(e,r){var n=t.growingIO.userStore.userId;return t.validAbNeedShow(e)&&t.validTimeRange(e)&&t.validTimes(e,n)&&t.validTriggerCd(e,n)&&t.validUserFilter(e)&&t.validTriggerFilter(e,r)})),o(this,"verifyPreview",(function(e,r){return t.validAbNeedShow(e)&&t.validTriggerFilter(e,r)})),o(this,"saveOriginData",(function(e){t.originData=e.sort((function(e,t){return t.updateAt-e.updateAt})),t.originData.forEach((function(e){var r,n=[];e.rule&&e.rule.triggerFilter&&(n=null!==(r=e.rule.triggerFilter.conditions)&&void 0!==r?r:[]),l.isEmpty(n)||n.forEach((function(e){t.triggerConditions.push(e.key)}))})),t.triggerConditions=Array.from(new Set(l.compact(t.triggerConditions)))})),o(this,"consumeUnResolvedEvents",(function(e){var r={};l.isEmpty(e)||t.unResolvedEvents.push(e),l.isEmpty(t.unResolvedEvents)||(r=t.unResolvedEvents.shift());var n=r.n||r.eventName||"";l.isEmpty(r)||t.isConsuming||l.isEmpty(t.originData)||0===n.indexOf("in_app_message_")||(t.isConsuming=!0,t.eventVerify(r))})),o(this,"eventVerify",(function(e){var r=l.head(t.originData.filter((function(r){return t.isPreview?t.verifyPreview(r,e):t.verifyOnline(r,e)})))||{};if(l.isEmpty(r))t.isConsuming=!1,t.consumeUnResolvedEvents();else if(r.rule&&(r.rule.triggerDelay||0)>0)var n=setTimeout((function(){t.pushRenderQueue(r),clearTimeout(n)}),1e3*message.rule.triggerDelay);else t.pushRenderQueue(r)})),o(this,"pushRenderQueue",(function(e){t.renderQueue.push(e),t.dispatchPopRender()})),o(this,"dispatchPopRender",(function(){t.isRendering=!0;var e=t.renderQueue.shift();e&&t.renderFn&&t.renderFn(e)})),o(this,"getTargetConfig",(function(e){if(!t.isIntelligent(e))return e.contentMetadata.components[0].config;var r=userStorage.get("cs1"),n=e.contentMetadata.components[0].recommendDate,i=e.contentMetadata.components[0].recommendList,o=t.get(e.id,r);n!==o.recommendDate&&(o.recommendIdx=0,o.recommendDate=n);var s=i[o.recommendIdx%i.length];return o.recommendIdx=o.recommendIdx+1,t.popupStore.set(e.id,r,o),s})),o(this,"isIntelligent",(function(e){var t=e.contentMetadata.components[0].recommendList;return l.isArray(t)&&t.length>0})),o(this,"trackImp",(function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},r=t.growingIO,n=r.userStore.userId,i=r.track;t.isPreview||i("in_app_message_imp",{in_app_message_name:e.name});var o=t.popupStore.get(e.id,n);o.showTimes+=1;var s=new Date(Date.now()+1e3*((e.rule?e.rule.triggerCd:0)||0));s.setHours(0),s.setMinutes(0),s.setSeconds(0),o.showDate=s.getTime(),t.popupStore.set(e.id,n,o)})),o(this,"trackClose",(function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{},r=t.growingIO.track;t.isPreview||r("in_app_message_close",{in_app_message_name:e.name}),t.isRendering=!1,t.dispatchPopRender()})),o(this,"handleTarget",(function(e){var r=t.growingIO,n=r.userStore.userId,i=r.vdsConfig.appId,o=r.track;if(t.isPreview||o("in_app_message_cmp_click",{in_app_message_name:e.name}),!t.isIntelligent(e)){var s=t.popupStore.get(e.id,n);s.showTimes+=9999,t.popupStore.set(e.id,n,s)}var a=e.targetConfig&&e.targetConfig.target?e.targetConfig.target["growing.".concat(i)]:void 0;a&&t.navigateDistribute(a)})),o(this,"navigateDistribute",(function(e){var r,n,i=t.growingIO.minipInstance,o=i.navigateToMiniProgram,s=i.navigateTo,u=/^MINP::(.*?)::(.*)/;if(u.test(e)){var c=(r=e.match(u),n=3,function(e){if(Array.isArray(e))return e}(r)||function(e,t){var r=null==e?null:"undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(null!=r){var n,i,o,s,a=[],u=!0,c=!1;try{if(o=(r=r.call(e)).next,0===t){if(Object(r)!==r)return;u=!1}else for(;!(u=(n=o.call(r)).done)&&(a.push(n.value),a.length!==t);u=!0);}catch(e){c=!0,i=e}finally{try{if(!u&&null!=r.return&&(s=r.return(),Object(s)!==s))return}finally{if(c)throw i}}return a}}(r,n)||a(r,n)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}());c[0],o({appId:c[1],path:c[2],envVersion:["develop","trial","release"].includes(t.envVersion)?t.envVersion:"release"})}else s({url:/^https?:\/\//.test(e)?"".concat(t.h5Page,"?url=").concat(e):e})})),v("GioMarketing 初始化中...","info"),this.growingIO=d();var n=this.growingIO,i=n.emitter,u=n.utils;l=null!=u?u:{},this.baseURL="",this.growingIO&&this.growingIO.gioSDKInitialized?(this.popupUserStore=new m(this.growingIO),this.popupStore=new h(this.growingIO),this.getBaseURL(),i&&(i.on("onComposeAfter",(function(e){var r=e.composedEvent;return t.persistentEvents(r)})),i.on("USERID_UPDATE",(function(e){e.newUserId?t.activateInit():t.popupUserStore.set("bcs",0)}))),l.keys(S).forEach((function(e){t[e]=S[e]}))):v("未集成或未初始化加载 Gio小程序SDK! GioMarketing 加载失败！","error")}return i(e,[{key:"validAbNeedShow",value:function(e){var t=!(e.abTest&&e.abTest.ctrlGroup);return this.debugLog("".concat(e.name," validAbNeedShow ").concat(t)),t}},{key:"validTimeRange",value:function(e){var t=Date.now(),r=(e.rule.startAt||0)<=t&&t<(e.rule.endAt||t+1);return this.debugLog("".concat(e.name," validTimeRange ").concat(r)),r}},{key:"validTimes",value:function(e,t){var r=this.popupStore.get(e.id,t).showTimes<e.rule.limit;return this.debugLog("".concat(e.name," validTimes ").concat(r)),r}},{key:"validTriggerCd",value:function(e,t){var r=this.popupStore.get(e.id,t).showDate<Date.now();return this.debugLog("".concat(e.name," validTriggerCd  ").concat(r)),r}},{key:"validUserFilter",value:function(e){var t;if(e.rule.filters&&e.rule.filters.expr&&e.rule.filters.exprs&&e.rule.filters.exprs.length){var r=this.getUserFilterMaps(e.rule.filters.exprs),n=this.getBoolExprs(r,e.rule.filters.expr);t=b(n)}else t=!0;return this.debugLog("".concat(e.name," validUserFilter ").concat(t)),t}},{key:"validTriggerFilter",value:function(e,t){var r;if(e.rule.triggerFilter&&e.rule.triggerFilter.conditionExpr&&e.rule.triggerFilter.conditions&&e.rule.triggerFilter.conditions.length){var n=this.getTriggerFilterMaps(t,e.rule.triggerFilter.conditions),i=this.getBoolExprs(n,e.rule.triggerFilter.conditionExpr);r=b(i)}else r=!0;return this.debugLog("".concat(e.name," validTriggerFilter ").concat(r)),r}},{key:"mergeUserAttrs",value:function(e){var t={};return e.forEach((function(e){t[e.key]=e})),Object.values(t)}},{key:"getUserFilterMaps",value:function(e){var t=this,r=this.growingIO.userStore.userId,n=this.mergeUserAttrs(this.popupUserStore.get("userAttrs",r)||[]);return e.map((function(e){return{symbol:e.symbol,result:n.some(t.validUserFilterExpression.bind(t,e))?"t":"f"}}))}},{key:"getTriggerFilterMaps",value:function(e,t){var r=this,n=this.growingIO.userStore.userId,i=this.popupUserStore.get("triggerAttrs",n)||[],o=e.eventName||e.n;return t.map((function(e){var t=i.filter((function(t){return t.key===e.key}));return{symbol:e.alias,result:o===e.key&&t.length&&r.validTriggerFilterExpression(e,t)?"t":"f"}}))}},{key:"getBoolExprs",value:function(e,t){return e.reduce((function(e,t){return e.replace(RegExp(t.symbol,"g"),t.result)}),t)}},{key:"validUserFilterExpression",value:function(e,t){return t.key===e.key&&this.validExpression(t.value,e)}},{key:"validTriggerFilterExpression",value:function(e,t){var r=this,n=e.dimFilters||[];return{count:function(){var i=r.validDimFilters(t,n).length;return r.validExpression(i,e)},sum:function(){var i=e.attribute;if(!i)return!1;var o=0;if(n.length){var s=r.validDimFilters(t,n);o=r.sumAttribute(s,i)}else o=r.sumAttribute(t,i);return r.validExpression(o,e)}}[e.aggregator]()||!1}},{key:"validDimFilters",value:function(e){var t=this,r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:[];return r.length?e.filter((function(e){var n=e.event_variable||[];return r.every((function(e){return n.some((function(r){return t.validExpression(r.value,e)}))}))})):e}},{key:"sumAttribute",value:function(e,t){var r=0;return e.forEach((function(e){(e.event_variable||[]).forEach((function(e){e.key===t&&(r+=Number(e.value)||0)}))})),r}},{key:"validExpression",value:function(e,t){var r=t.values;return"date"===t.valueType&&(r=r.map(w),e=w(e)),"=="===t.op?e==r[0]:"<"===t.op?e<r[0]:">"===t.op?e>r[0]:"<="===t.op?e<=r[0]:">="===t.op?e>=r[0]:"!="===t.op?e!=r[0]:"between"===t.op?e<=r[1]&&e>=r[0]:"in"===t.op?r.find((function(t){return t===e})):"not in"===t.op&&!r.find((function(t){return t===e}))}}],[{key:"getSingleton",value:function(){return this.singleton||(this.singleton=new e),this.singleton}}]),e}();Component({props:{h5Page:{type:String,value:"/pages/h5/h5"},envVersion:{type:String,value:"release"}},data:{message:void 0,imageUrl:void 0,visible:!1},didUnmount:function(){this.setData({message:void 0,imageUrl:void 0,visible:!1}),p&&p.destroy(),this.hideModal()},didMount:function(){var e=this,t=d();if(t.gioSDKInitialized){p=I.getSingleton();var r=this.props,n=r.envVersion,i=r.h5Page;p.envVersion=n,p.h5Page=i,p.renderFn=function(r){var n,i=p.getTargetConfig(r);null===(n=t.minipInstance)||void 0===n||n.getImageInfo({src:i.src,success:function(t){e.setData({message:Object.assign({targetConfig:i},r),visible:!0,imageUrl:t.path}),p.trackImp(r)},fail:function(){p.isRendering=!1,p.dispatchPopRender()},complete:function(){p.isConsuming=!1,p.consumeUnResolvedEvents()}})};var o="saas"===t.gioEnvironment?{t:"cstm",n:"appOpen"}:{eventType:"CUSTOM",eventName:"appOpen"};p.persistentEvents(o),p.activateInit(),v("GioMarketing 初始化完成!","success")}},methods:{hideModal:function(){this.setData({visible:!1})},onClose:function(){this.hideModal(),p&&p.trackClose(this.data.message)},onTapTarget:function(){p&&p.handleTarget(this.data.message),this.hideModal()}}});
