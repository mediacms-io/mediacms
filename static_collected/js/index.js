!function(){var e,t={463:function(e,t,n){"use strict";n.d(t,{c:function(){return a}});var r=n(4571),i=n.n(r);function a(e,t){let n=i()(e,{});return""!==n.origin&&"null"!==n.origin&&n.origin||(n=i()(t+"/"+e.replace(/^\//g,""),{})),n.toString()}},977:function(e,t,n){"use strict";n.d(t,{A:function(){return i}});var r=n(7143);function i(e,t){return r.register(e[t].bind(e)),e}},1482:function(e,t,n){"use strict";var r,i=this&&this.__createBinding||(Object.create?function(e,t,n,r){void 0===r&&(r=n);var i=Object.getOwnPropertyDescriptor(t,n);i&&!("get"in i?!t.__esModule:i.writable||i.configurable)||(i={enumerable:!0,get:function(){return t[n]}}),Object.defineProperty(e,r,i)}:function(e,t,n,r){void 0===r&&(r=n),e[r]=t[n]}),a=this&&this.__setModuleDefault||(Object.create?function(e,t){Object.defineProperty(e,"default",{enumerable:!0,value:t})}:function(e,t){e.default=t}),u=this&&this.__importStar||(r=function(e){return r=Object.getOwnPropertyNames||function(e){var t=[];for(var n in e)Object.prototype.hasOwnProperty.call(e,n)&&(t[t.length]=n);return t},r(e)},function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var n=r(e),u=0;u<n.length;u++)"default"!==n[u]&&i(t,e,n[u]);return a(t,e),t});Object.defineProperty(t,"__esModule",{value:!0}),t.HomePage=void 0;var o=u(n(9471)),l=n(8790),s=n(7460),c=n(6190),f=n(6788),d=n(4685),m=n(5841),p=n(9287),g=n(1838),v=function(e){return o.default.createElement(l.LinksConsumer,null,(function(e){return o.default.createElement("div",{className:"empty-media"},o.default.createElement("div",{className:"welcome-title"},"Welcome to MediaCMS!"),o.default.createElement("div",{className:"start-uploading"},"Start uploading media and sharing your work!"),o.default.createElement("a",{href:e.user.addMedia,title:"Upload media",className:"button-link"},o.default.createElement("i",{className:"material-icons","data-icon":"video_call"}),"UPLOAD MEDIA"))}))};t.HomePage=function(e){var t=e.id,n=void 0===t?"home":t,r=e.featured_title,i=void 0===r?(0,g.translateString)("Featured"):r,a=e.recommended_title,u=void 0===a?(0,g.translateString)("Recommended"):a,y=e.latest_title,h=void 0===y?(0,g.translateString)("Latest"):y,b=e.latest_view_all_link,P=void 0!==b&&b,w=e.featured_view_all_link,S=void 0===w||w,_=e.recommended_view_all_link,E=void 0===_||_,O=(0,o.useState)(!1),I=O[0],A=O[1],L=(0,o.useState)(!1),M=L[0],k=L[1],N=(0,o.useState)(!1),j=N[0],C=N[1],U=(0,o.useState)(!1),R=U[0],q=U[1],x=function(e){k(0<e),A(0===e)},D=function(e){C(0<e)},T=function(e){q(0<e)};return o.default.createElement(p.Page,{id:n},o.default.createElement(l.LinksConsumer,null,(function(e){return o.default.createElement(l.ApiUrlConsumer,null,(function(t){return o.default.createElement(f.MediaMultiListWrapper,{className:"items-list-ver"},s.PageStore.get("config-enabled").pages.featured&&s.PageStore.get("config-enabled").pages.featured.enabled&&o.default.createElement(c.MediaListRow,{title:i,style:j?void 0:{display:"none"},viewAllLink:S?e.featured:null},o.default.createElement(m.InlineSliderItemListAsync,{requestUrl:t.featured,itemsCountCallback:D,hideViews:!s.PageStore.get("config-media-item").displayViews,hideAuthor:!s.PageStore.get("config-media-item").displayAuthor,hideDate:!s.PageStore.get("config-media-item").displayPublishDate})),s.PageStore.get("config-enabled").pages.recommended&&s.PageStore.get("config-enabled").pages.recommended.enabled&&o.default.createElement(c.MediaListRow,{title:u,style:R?void 0:{display:"none"},viewAllLink:E?e.recommended:null},o.default.createElement(m.InlineSliderItemListAsync,{requestUrl:t.recommended,itemsCountCallback:T,hideViews:!s.PageStore.get("config-media-item").displayViews,hideAuthor:!s.PageStore.get("config-media-item").displayAuthor,hideDate:!s.PageStore.get("config-media-item").displayPublishDate})),o.default.createElement(c.MediaListRow,{title:h,style:M?void 0:{display:"none"},viewAllLink:P?e.latest:null},o.default.createElement(d.ItemListAsync,{pageItems:30,requestUrl:t.media,itemsCountCallback:x,hideViews:!s.PageStore.get("config-media-item").displayViews,hideAuthor:!s.PageStore.get("config-media-item").displayAuthor,hideDate:!s.PageStore.get("config-media-item").displayPublishDate})),I&&o.default.createElement(v,null))}))})))}},1702:function(e,t,n){"use strict";n.d(t,{R:function(){return a},e:function(){return u}});var r=n(6403),i=n(8354);const a=function(e,t,n){return void 0===e[t]||(0,i.tR)(e[t])?null:(0,r.m)(["Invalid prop `"+t+"` of type `"+typeof e[t]+"` supplied to `"+(n||"N/A")+"`, expected `positive integer or zero` ("+e[t]+")."])},u=function(e,t,n){return void 0===e[t]||(0,i.q6)(e[t])?null:(0,r.m)(["Invalid prop `"+t+"` of type `"+typeof e[t]+"` supplied to `"+(n||"N/A")+"`, expected `positive integer` ("+e[t]+")."])}},1936:function(e,t,n){"use strict";n.r(t),n.d(t,{PageHeader:function(){return r.z},PageMain:function(){return i.P},PageSidebar:function(){return a.E},PageSidebarContentOverlay:function(){return u.B}});var r=n(1254),i=n(3212),a=n(795),u=n(1470)},4497:function(e,t,n){"use strict";var r=n(2985),i=n(1482);(0,r.C)("page-home",i.HomePage)},4685:function(e,t,n){"use strict";n.r(t),n.d(t,{ItemListAsync:function(){return d}});var r=n(9471),i=n(8713),a=n.n(i),u=n(5338),o=n(4737),l=n(2495),s=n(4433),c=n(5633);function f(){return f=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)({}).hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e},f.apply(null,arguments)}function d(e){const[t,n,i,a,o,d,m,p,g,v,y]=(0,u.useItemListSync)(e);return(0,r.useEffect)((()=>(a(new c.B(e.pageItems,e.maxItems,e.firstItemRequestUrl,e.requestUrl,p,g)),()=>{i&&(i.cancelAll(),a(null))})),[]),t?n.length?r.createElement("div",{className:o.listOuter},v(),r.createElement("div",{ref:d,className:"items-list-wrap"},r.createElement("div",{ref:m,className:o.list},n.map(((t,n)=>r.createElement(s.c,f({key:n},(0,s.k)(e,t,n))))))),y()):null:r.createElement(l.e,{className:o.listOuter})}d.propTypes={...o.k.propTypes,items:a().array,requestUrl:a().string.isRequired,firstItemRequestUrl:a().string},d.defaultProps={...o.k.defaultProps,requestUrl:null,firstItemRequestUrl:null,pageItems:24}},5841:function(e,t,n){"use strict";n.r(t),n.d(t,{InlineSliderItemListAsync:function(){return f}});var r=n(9471),i=n(7460),a=n(5338),u=n(4685),o=n(2495),l=n(4433),s=n(5633);function c(){return c=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)({}).hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e},c.apply(null,arguments)}function f(e){const{visibleSidebar:t}=(0,a.useLayout)(),[n,u,f,d,m,p,g,v,y,h,b,P,w]=(0,a.useItemListInlineSlider)(e);return(0,r.useEffect)((()=>{y()}),[t]),(0,r.useEffect)((()=>(m(new s.B(e.pageItems,e.maxItems,e.firstItemRequestUrl,e.requestUrl,p,g)),i.PageStore.on("window_resize",v),()=>{i.PageStore.removeListener("window_resize",v),f&&(f.cancelAll(),m(null))})),[]),u?n.length?r.createElement("div",{className:d.listOuter},P(),r.createElement("div",{ref:h,className:"items-list-wrap"},r.createElement("div",{ref:b,className:d.list},n.map(((t,n)=>r.createElement(l.c,c({key:n},(0,l.k)(e,t,n))))))),w()):null:r.createElement(o.e,{className:d.listOuter})}f.propTypes={...u.ItemListAsync.propTypes},f.defaultProps={...u.ItemListAsync.defaultProps,pageItems:12}},6403:function(e,t,n){"use strict";n.d(t,{g:function(){return u},m:function(){return a}});var r=n(8004);function i(e,t,n){let r;switch(n){case TypeError:case RangeError:case SyntaxError:case ReferenceError:r=new n(t[0]);break;default:r=new Error(t[0])}return e(r.message,...t.slice(1)),r}function a(e,t){return i(r.z,e,t)}function u(e,t){return i(r.R,e,t)}},6788:function(e,t,n){"use strict";var r=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0}),t.MediaMultiListWrapper=void 0;var i=r(n(9471));n(5050),t.MediaMultiListWrapper=function(e){var t=e.className,n=e.style,r=e.children;return i.default.createElement("div",{className:(t?t+" ":"")+"media-list-wrapper",style:n},r||null)}},7143:function(e,t,n){const r=n(2063).Dispatcher;e.exports=new r},7664:function(e,t,n){"use strict";n.r(t),n.d(t,{CircleIconButton:function(){return r.i},FilterOptions:function(){return i.P},FiltersToggleButton:function(){return a.I},MaterialIcon:function(){return u.Z},NavigationContentApp:function(){return o.V},NavigationMenuList:function(){return l.S},Notifications:function(){return s.$},NumericInputWithUnit:function(){return c._},PopupMain:function(){return f.AP},PopupTop:function(){return f.cp},SpinnerLoader:function(){return d.x},UserThumbnail:function(){return m.c}});var r=n(5321),i=n(7256),a=n(3135),u=n(2828),o=n(5305),l=n(7201),s=n(6089),c=n(3818),f=n(2901),d=n(6568),m=n(878)},8004:function(e,t,n){"use strict";n.d(t,{R:function(){return a},z:function(){return u}});var r=n(5697);const i=function(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];return r[t[0]](...t.slice(1))},a=function(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];return i("warn",...t)},u=function(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];return i("error",...t)}}},n={};function r(e){var i=n[e];if(void 0!==i)return i.exports;var a=n[e]={exports:{}};return t[e].call(a.exports,a,a.exports,r),a.exports}r.m=t,e=[],r.O=function(t,n,i,a){if(!n){var u=1/0;for(c=0;c<e.length;c++){n=e[c][0],i=e[c][1],a=e[c][2];for(var o=!0,l=0;l<n.length;l++)(!1&a||u>=a)&&Object.keys(r.O).every((function(e){return r.O[e](n[l])}))?n.splice(l--,1):(o=!1,a<u&&(u=a));if(o){e.splice(c--,1);var s=i();void 0!==s&&(t=s)}}return t}a=a||0;for(var c=e.length;c>0&&e[c-1][2]>a;c--)e[c]=e[c-1];e[c]=[n,i,a]},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,{a:t}),t},r.d=function(e,t){for(var n in t)r.o(t,n)&&!r.o(e,n)&&Object.defineProperty(e,n,{enumerable:!0,get:t[n]})},r.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(e){if("object"==typeof window)return window}}(),r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.j=57,function(){var e={57:0};r.O.j=function(t){return 0===e[t]};var t=function(t,n){var i,a,u=n[0],o=n[1],l=n[2],s=0;if(u.some((function(t){return 0!==e[t]}))){for(i in o)r.o(o,i)&&(r.m[i]=o[i]);if(l)var c=l(r)}for(t&&t(n);s<u.length;s++)a=u[s],r.o(e,a)&&e[a]&&e[a][0](),e[a]=0;return r.O(c)},n=self.webpackChunkmediacms_frontend=self.webpackChunkmediacms_frontend||[];n.forEach(t.bind(null,0)),n.push=t.bind(null,n.push.bind(n))}();var i=r.O(void 0,[276],(function(){return r(4497)}));i=r.O(i)}();