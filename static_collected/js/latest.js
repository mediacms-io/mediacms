!function(){var e,t={463:function(e,t,n){"use strict";n.d(t,{c:function(){return u}});var r=n(4571),i=n.n(r);function u(e,t){let n=i()(e,{});return""!==n.origin&&"null"!==n.origin&&n.origin||(n=i()(t+"/"+e.replace(/^\//g,""),{})),n.toString()}},977:function(e,t,n){"use strict";n.d(t,{A:function(){return i}});var r=n(7143);function i(e,t){return r.register(e[t].bind(e)),e}},1702:function(e,t,n){"use strict";n.d(t,{R:function(){return u},e:function(){return o}});var r=n(6403),i=n(8354);const u=function(e,t,n){return void 0===e[t]||(0,i.tR)(e[t])?null:(0,r.m)(["Invalid prop `"+t+"` of type `"+typeof e[t]+"` supplied to `"+(n||"N/A")+"`, expected `positive integer or zero` ("+e[t]+")."])},o=function(e,t,n){return void 0===e[t]||(0,i.q6)(e[t])?null:(0,r.m)(["Invalid prop `"+t+"` of type `"+typeof e[t]+"` supplied to `"+(n||"N/A")+"`, expected `positive integer` ("+e[t]+")."])}},1936:function(e,t,n){"use strict";n.r(t),n.d(t,{PageHeader:function(){return r.z},PageMain:function(){return i.P},PageSidebar:function(){return u.E},PageSidebarContentOverlay:function(){return o.B}});var r=n(1254),i=n(3212),u=n(795),o=n(1470)},2558:function(e,t,n){"use strict";var r=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0}),t.LatestMediaPage=void 0;var i=r(n(9471)),u=n(8790),o=n(7460),a=n(2855),s=n(7731),c=n(9287),l=n(1838);t.LatestMediaPage=function(e){var t=e.id,n=void 0===t?"latest-media":t,r=e.title,f=void 0===r?(0,l.translateString)("Recent uploads"):r;return i.default.createElement(c.Page,{id:n},i.default.createElement(u.ApiUrlConsumer,null,(function(e){return i.default.createElement(a.MediaListWrapper,{title:f,className:"items-list-ver"},i.default.createElement(s.LazyLoadItemListAsync,{requestUrl:e.media,hideViews:!o.PageStore.get("config-media-item").displayViews,hideAuthor:!o.PageStore.get("config-media-item").displayAuthor,hideDate:!o.PageStore.get("config-media-item").displayPublishDate}))})))}},2626:function(e,t,n){"use strict";var r=n(2985),i=n(2558);(0,r.C)("page-latest",i.LatestMediaPage)},2855:function(e,t,n){"use strict";var r=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(t,"__esModule",{value:!0}),t.MediaListWrapper=void 0;var i=r(n(9471)),u=n(6190);n(5050),t.MediaListWrapper=function(e){var t=e.title,n=e.viewAllLink,r=e.viewAllText,o=e.className,a=e.style,s=e.children;return i.default.createElement("div",{className:(o?o+" ":"")+"media-list-wrapper",style:a},i.default.createElement(u.MediaListRow,{title:t,viewAllLink:n,viewAllText:r},s||null))}},4685:function(e,t,n){"use strict";n.d(t,{ItemListAsync:function(){return d}});var r=n(9471),i=n(8713),u=n.n(i),o=n(5338),a=n(4737),s=n(2495),c=n(4433),l=n(5633);function f(){return f=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)({}).hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e},f.apply(null,arguments)}function d(e){const[t,n,i,u,a,d,p,m,v,g,y]=(0,o.useItemListSync)(e);return(0,r.useEffect)((()=>(u(new l.B(e.pageItems,e.maxItems,e.firstItemRequestUrl,e.requestUrl,m,v)),()=>{i&&(i.cancelAll(),u(null))})),[]),t?n.length?r.createElement("div",{className:a.listOuter},g(),r.createElement("div",{ref:d,className:"items-list-wrap"},r.createElement("div",{ref:p,className:a.list},n.map(((t,n)=>r.createElement(c.c,f({key:n},(0,c.k)(e,t,n))))))),y()):null:r.createElement(s.e,{className:a.listOuter})}d.propTypes={...a.k.propTypes,items:u().array,requestUrl:u().string.isRequired,firstItemRequestUrl:u().string},d.defaultProps={...a.k.defaultProps,requestUrl:null,firstItemRequestUrl:null,pageItems:24}},6403:function(e,t,n){"use strict";n.d(t,{g:function(){return o},m:function(){return u}});var r=n(8004);function i(e,t,n){let r;switch(n){case TypeError:case RangeError:case SyntaxError:case ReferenceError:r=new n(t[0]);break;default:r=new Error(t[0])}return e(r.message,...t.slice(1)),r}function u(e,t){return i(r.z,e,t)}function o(e,t){return i(r.R,e,t)}},7143:function(e,t,n){const r=n(2063).Dispatcher;e.exports=new r},7664:function(e,t,n){"use strict";n.r(t),n.d(t,{CircleIconButton:function(){return r.i},FilterOptions:function(){return i.P},FiltersToggleButton:function(){return u.I},MaterialIcon:function(){return o.Z},NavigationContentApp:function(){return a.V},NavigationMenuList:function(){return s.S},Notifications:function(){return c.$},NumericInputWithUnit:function(){return l._},PopupMain:function(){return f.AP},PopupTop:function(){return f.cp},SpinnerLoader:function(){return d.x},UserThumbnail:function(){return p.c}});var r=n(5321),i=n(7256),u=n(3135),o=n(2828),a=n(5305),s=n(7201),c=n(6089),l=n(3818),f=n(2901),d=n(6568),p=n(878)},7731:function(e,t,n){"use strict";n.r(t),n.d(t,{LazyLoadItemListAsync:function(){return f}});var r=n(9471),i=n(7460),u=n(5338),o=n(4685),a=n(2495),s=n(4433),c=n(5633);function l(){return l=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)({}).hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e},l.apply(null,arguments)}function f(e){const[t,n,o,f,d,p,m,v,g,y,h,b,w]=(0,u.useItemListLazyLoad)(e);return(0,r.useEffect)((()=>(f(new c.B(e.pageItems,e.maxItems,e.firstItemRequestUrl,e.requestUrl,p,m)),i.PageStore.on("window_scroll",v),i.PageStore.on("document_visibility_change",g),v(),()=>{i.PageStore.removeListener("window_scroll",v),i.PageStore.removeListener("document_visibility_change",g),o&&(o.cancelAll(),f(null))})),[]),n?t.length?r.createElement("div",{className:d.listOuter},b(),r.createElement("div",{ref:y,className:"items-list-wrap"},r.createElement("div",{ref:h,className:d.list},t.map(((t,n)=>r.createElement(s.c,l({key:n},(0,s.k)(e,t,n))))))),w()):null:r.createElement(a.e,{className:d.listOuter})}f.propTypes={...o.ItemListAsync.propTypes},f.defaultProps={...o.ItemListAsync.defaultProps,pageItems:2}},8004:function(e,t,n){"use strict";n.d(t,{R:function(){return u},z:function(){return o}});var r=n(5697);const i=function(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];return r[t[0]](...t.slice(1))},u=function(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];return i("warn",...t)},o=function(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];return i("error",...t)}}},n={};function r(e){var i=n[e];if(void 0!==i)return i.exports;var u=n[e]={exports:{}};return t[e].call(u.exports,u,u.exports,r),u.exports}r.m=t,e=[],r.O=function(t,n,i,u){if(!n){var o=1/0;for(l=0;l<e.length;l++){n=e[l][0],i=e[l][1],u=e[l][2];for(var a=!0,s=0;s<n.length;s++)(!1&u||o>=u)&&Object.keys(r.O).every((function(e){return r.O[e](n[s])}))?n.splice(s--,1):(a=!1,u<o&&(o=u));if(a){e.splice(l--,1);var c=i();void 0!==c&&(t=c)}}return t}u=u||0;for(var l=e.length;l>0&&e[l-1][2]>u;l--)e[l]=e[l-1];e[l]=[n,i,u]},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,{a:t}),t},r.d=function(e,t){for(var n in t)r.o(t,n)&&!r.o(e,n)&&Object.defineProperty(e,n,{enumerable:!0,get:t[n]})},r.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(e){if("object"==typeof window)return window}}(),r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.j=658,function(){var e={658:0};r.O.j=function(t){return 0===e[t]};var t=function(t,n){var i,u,o=n[0],a=n[1],s=n[2],c=0;if(o.some((function(t){return 0!==e[t]}))){for(i in a)r.o(a,i)&&(r.m[i]=a[i]);if(s)var l=s(r)}for(t&&t(n);c<o.length;c++)u=o[c],r.o(e,u)&&e[u]&&e[u][0](),e[u]=0;return r.O(l)},n=self.webpackChunkmediacms_frontend=self.webpackChunkmediacms_frontend||[];n.forEach(t.bind(null,0)),n.push=t.bind(null,n.push.bind(n))}();var i=r.O(void 0,[276],(function(){return r(2626)}));i=r.O(i)}();