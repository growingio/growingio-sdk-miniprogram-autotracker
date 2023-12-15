var e,t=function(){return t=Object.assign||function(e){for(var t,r=1,n=arguments.length;n>r;r++)for(var i in t=arguments[r])({}).hasOwnProperty.call(t,i)&&(e[i]=t[i]);return e},t.apply(this,arguments)},r=function(e){return["undefined","null"].includes(a(e))},n=function(e){return"[object Object]"==={}.toString.call(e)&&!r(e)},i=function(e){return Array.isArray(e)&&"array"===a(e)},o=function(e){return r(e)?"":""+e},s=function(e){return i(e)?0===e.length:n(e)?0===function(e){return n(e)?Object.keys(e):[]}(e).length:!e},a=function(e){return{}.toString.call(e).slice(8,-1).toLowerCase()},c=function(e){var t=0;if(s(e)||"boolean"==typeof e)return t;for(var r=0;r<e.length;)t=(t<<5)-t+e.charCodeAt(r),t&=t,r++;return t},u={name:"gioImpressionTracking",method:function(r){var n=this;this.growingIO=r,this.traverseListen=function(t){var r=n.growingIO.minipInstance;if(e.isFunction(null==t?void 0:t.selectAllComponents)){var i=null==t?void 0:t.selectAllComponents(".growing_collect_imp_component");e.isEmpty(i)||i.forEach((function(e){n.traverseListen(e)}))}r.initImpression(t)},this.isEqualRects=function(e,t,r){var o,s,a,u,g=(null!==(s=(null!==(o=n.rects[t])&&void 0!==o?o:{})[r])&&void 0!==s?s:[]).map((function(e){return c(JSON.stringify(e))})),l=(null!=e?e:[]).map((function(e){return c(JSON.stringify(e))}));return u=l,!(!i(a=g)||!i(u)||a.length!==u.length)&&a.every((function(e,t){return e===u[t]}))},this.getNodeId=function(e){switch(n.growingIO.gioPlatform){case"wx":case"qq":case"ks":case"jd":return e.__wxExparserNodeId__;case"my":return e.$page?e.$page.$id+"-"+e.$id:e.$id;case"swan":return e.route?o(c(e.route)):e.nodeId;case"tt":return e.route?o(c(e.route)):e.__nodeId__}},this.rectobserve=function(t,r,i){var o=n.growingIO.gioPlatform;if("tt"===o&&r.__nodeId__||"ks"===o&&r.is)return!1;var s=n.getNodeId(r),a=r.route?r:n.growingIO.minipInstance.getCurrentPage(),c=!1;if(a.route){var u=n.isEqualRects(t,a.route,s),g=e.get(n.observerIds,a.route+"."+s+"._disconnected");c=!u||!1!==g}e.isArray(t)&&!e.isEmpty(t)&&!e.isNil(t[0])&&c&&(e.isEmpty(n.rects[a.route])&&(n.rects[a.route]={}),n.rects[a.route][s]=t,n.creatObserver(r,i))},this.main=function(t,r){var i,o,a=n.growingIO.gioPlatform,c=t.route?null===(i=n.growingIO.minipInstance.minip)||void 0===i?void 0:i.createSelectorQuery():null===(o=n.growingIO.minipInstance.minip)||void 0===o?void 0:o.createSelectorQuery().in(t);["ks","qq"].includes(a)?(c.selectAll(".growing_collect_imp").boundingClientRect((function(i){var o=i[0],a=void 0===o?[]:o;a=e.isArray(a)?a:[a],s(a)||n.rectobserve(a,t,r)})),c.exec()):(c.selectAll(".growing_collect_imp").boundingClientRect(),c.exec((function(e){var i=e[0];s(i)||n.rectobserve(i,t,r)})))},this.creatObserver=function(t,r){var i,o,s=n.growingIO,a=s.gioPlatform,c=s.minipInstance,u=((i={})[r]=!0,i);["tb","my"].includes(a)&&e.compareVersion(my.SDKVersion,"2.7.0")>=-1&&(u.dataset=!0);var g=n.getNodeId(t),l=t;!t.isComponent&&t.route&&"component"!==t.mpType||(l=c.getCurrentPage()),n.observerIds[l.route]||(n.observerIds[l.route]={});var d=n.observerIds[l.route][g];d&&!d._disconnected&&d.disconnect();var v=["swan","jd"].includes(a)?null===(o=c.minip)||void 0===o?void 0:o.createIntersectionObserver(t,u):t.createIntersectionObserver(u);v=v.relativeToViewport(),n.observerIds[l.route][g]=v,n.targetObserve(v,l)},this.targetObserve=function(t,r){var i=n.growingIO.vdsConfig.taro;t.observe(".growing_collect_imp",(function(t){if(!e.isEmpty(t)&&t.intersectionRatio>0){var o=t.dataset;i&&e.isTaro3(i)&&(o=n.getTaro3Dataset(r.route,t.id));var s=n.getImpressionProperties(o),a=t.id;if(a){if("once"===o.gioImpType&&e.has(n.sentImps,a))return;n.sentImps[a]=s}s.eventId?n.buildImpEvent(s):e.consoleText("曝光事件格式不正确，事件名只能包含数字、字母和下划线，且不以数字开头!","warn")}}))},this.getImpressionProperties=function(t){var r={eventId:void 0,properties:{}};if(!(null==t?void 0:t.gioImpTrack))return r;if(r.eventId=t.gioImpTrack,e.has(t,"gioImpAttrs"))r.properties=e.niceTry((function(){return e.isObject(t.gioImpAttrs)?t.gioImpAttrs:JSON.parse(t.gioImpAttrs)})),r.items=e.niceTry((function(){return e.isObject(t.gioImpItems)?t.gioImpItems:JSON.parse(t.gioImpItems)}));else{var n=/^gioTrack(.+)/;for(var i in t){var o=void 0,s=i.match(n);s&&"track"!==(o=e.lowerFirst(s[1]))&&(r.properties[o]=t[i])}}return r.properties=e.limitObject(r.properties),r.items=e.limitObject(r.items),/^\w+$/.test(r.eventId)&&!Number.isInteger(Number.parseInt(e.head(r.eventId.split("")),10))||(r.eventId=null,r={}),r},this.getTaro3Dataset=function(t,r){var i,o=null===(i=n.growingIO)||void 0===i?void 0:i.taro3VMs[t];if(!o)return!1;var s={},a=function(t){t.some((function(t){var n;return t.uid!==r&&t.sid!==r||-1>=(null===(n=t.props)||void 0===n?void 0:n.class.indexOf("growing_collect_imp"))||e.isEmpty(t.dataset)?!!Array.isArray(t.childNodes)&&a(t.childNodes):(s=t.dataset,!0)}))};return a(o.childNodes),s},this.buildImpEvent=function(e){var r=e.eventId,i=e.properties,o=e.items,s=n.growingIO.dataStore,a=s.eventContextBuilder,c=s.eventInterceptor,u=s.eventHooks;c(t({eventType:"CUSTOM",pageShowTimestamp:u.currentPage.time,eventName:r,attributes:i,resourceItem:o},a()))},e=this.growingIO.utils,this.observerIds={},this.rects={},this.sentImps={};var a=this.growingIO,u=a.emitter,g=a.minipInstance;this.growingIO.updateImpression=function(e){e||(e=g.getCurrentPage()),g.initImpression(e)},u.on("minipLifecycle",(function(e){var t,r=e.event,i=e.params,o=n.growingIO.minipInstance;if("Page onShowEnd"===r){var s=o.getCurrentPage();n.traverseListen(s)}if(["Page onHide","Page onUnload"].includes(r)){var a=i.page.route;Object.values(null!==(t=n.observerIds[a])&&void 0!==t?t:{}).forEach((function(e){return e.disconnect()}))}}))}};export default u;