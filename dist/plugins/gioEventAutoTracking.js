var t=function(){return t=Object.assign||function(t){for(var e,n=1,r=arguments.length;r>n;n++)for(var a in e=arguments[n])({}).hasOwnProperty.call(e,a)&&(t[a]=e[a]);return t},t.apply(this,arguments)};"function"==typeof SuppressedError&&SuppressedError;var e,n=/^\d{1,10}$/,r=/^_[0-9a-z]+/,a=/^_n_[0-9]+$/,i={name:"gioEventAutoTracking",method:function(i){var o=this;this.growingIO=i,this.main=function(t,n){var r,a,i=o.growingIO,l=i.vdsConfig,g=i.platformConfig,d=i.plugins,v=i.emitter,u=i.trackingId;if(!(!l.autotrack||!n||e.get(t,"currentTarget.dataset.growingIgnore")||e.get(t,"target.dataset.growingIgnore")||!e.get(t,"target.dataset.growingTrack")&&"autoplay"===e.get(t,"detail.source")||t.type===(null===(r=o.prevEvent)||void 0===r?void 0:r.type)&&10>Math.abs(Number(t.timeStamp)-Number(null===(a=o.prevEvent)||void 0===a?void 0:a.timeStamp))||l.taro&&["eh"].includes(n))){o.prevEvent=t,l.uniVue&&(n=null==d?void 0:d.gioUniAppAdapter.getHandlerName(n,t)),l.debug&&console.log("Action：",t.type,Date.now()),v.emit("ON_COMPOSE_BEFORE",{event:n,params:null!=t?t:{}});var s=g.listeners.actions;s.click.includes(t.type)?o.buildClickEvent(u,t,n):s.change.includes(t.type)&&o.buildChangeEvent(u,t,n)}},this.getNodeXpath=function(t,e){var n,i,l,g=o.growingIO,d=g.gioPlatform,v=g.vdsConfig,u=(t.currentTarget||t.target).id;return(!u||"swan"===d&&r.test(u)||(i=(n=v.taro).Current,l=n.createComponent,n&&i&&!l&&a.test(u)))&&(u=""),"".concat(u,"#").concat(e)},this.buildClickEvent=function(r,a,i){var l,g,d,v,u=o.getNodeXpath(a,i);if(u){var s=o.growingIO.dataStore,c=s.eventContextBuilder,p=s.eventInterceptor,h=s.eventHooks,m=a.currentTarget||a.target,f=void 0;if(e.has(null==m?void 0:m.dataset,"index")&&""!==(null===(l=null==m?void 0:m.dataset)||void 0===l?void 0:l.index)){var E=e.toString(m.dataset.index);n.test(E)&&E-0>0&&2147483647>E-0?f=+E:(v="".concat(m.dataset.index,"，index标记应为 大于 0 且小于 2147483647 的整数！"),"warn",console.log("%c[GrowingIO]：".concat(v),"color: #F59E0B"))}var I=t({eventType:"VIEW_CLICK",element:[{xpath:u,index:f,textValue:null===(g=null==m?void 0:m.dataset)||void 0===g?void 0:g.title,hyperlink:null===(d=null==m?void 0:m.dataset)||void 0===d?void 0:d.src}]},c(r));I.attributes=h.currentPage.eventSetPageProps(r,I),p(I)}},this.buildTabClickEvent=function(n,r){var a=o.growingIO.dataStore,i=a.eventContextBuilder,l=a.eventInterceptor,g=a.eventHooks,d=t({eventType:"VIEW_CLICK",element:[{xpath:"#onTabItemTap",textValue:r.text,index:r.index+1,hyperlink:e.toString(r.pagePath)}]},i(n));d.attributes=g.currentPage.eventSetPageProps(n,d),l(d)},this.buildChangeEvent=function(n,r,a){var i,l,g=o.getNodeXpath(r,a);if(g){var d=o.growingIO.dataStore,v=d.eventContextBuilder,u=d.eventInterceptor,s=d.eventHooks,c=r.currentTarget||r.target,p=t({eventType:"VIEW_CHANGE",element:{xpath:g}},v(n)),h=e.get(r,"detail.value")||e.get(r,"target.attr.value");((null===(i=null==c?void 0:c.dataset)||void 0===i?void 0:i.growingTrack)||(null===(l=null==c?void 0:c.dataset)||void 0===l?void 0:l.growingtrack))&&(e.isNil(h)||(p.element.textValue=e.toString(h))),p.element=[p.element],p.attributes=s.currentPage.eventSetPageProps(n,p),u(p)}},this.pluginVersion="4.2.0",e=this.growingIO.utils,this.prevEvent={}}};export{i as default};
