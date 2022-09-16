!function(){"use strict";var e,t={7839:function(e,t,n){var r=n(2541),o=(n(7441),n(5101),n(3080),n(2004),n(8407),n(6394),n(8288),n(5677),n(2129),n(4655),n(5466)),i=n(3074),a=n.n(i),l=n(3613),u=n(541),s=n(4234),c=n(5910),f=(n(288),n(4458),n(3675),n(8578));function p(e,t){return function(e){if(Array.isArray(e))return e}(e)||function(e,t){var n=null==e?null:"undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(null!=n){var r,o,i=[],a=!0,l=!1;try{for(n=n.call(e);!(a=(r=n.next()).done)&&(i.push(r.value),!t||i.length!==t);a=!0);}catch(e){l=!0,o=e}finally{try{a||null==n.return||n.return()}finally{if(l)throw o}}return i}}(e,t)||function(e,t){if(e){if("string"==typeof e)return d(e,t);var n=Object.prototype.toString.call(e).slice(8,-1);return"Object"===n&&e.constructor&&(n=e.constructor.name),"Map"===n||"Set"===n?Array.from(e):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?d(e,t):void 0}}(e,t)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function d(e,t){(null==t||t>e.length)&&(t=e.length);for(var n=0,r=new Array(t);n<t;n++)r[n]=e[n];return r}var m={role:[{id:"all",title:"All"},{id:"editor",title:"Editor"},{id:"manager",title:"Manager"}]};function g(e){var t=p((0,o.useState)(e.hidden),2),n=t[0],r=t[1],i=p((0,o.useState)("all"),2),a=i[0],l=i[1],u=(0,o.useRef)(null),c=(0,o.useRef)(null);function d(){n||(u.current.style.height=24+c.current.offsetHeight+"px")}return(0,o.useEffect)((function(){r(e.hidden),d()}),[e.hidden]),(0,o.useEffect)((function(){return f.PageStore.on("window_resize",d),function(){return f.PageStore.removeListener("window_resize",d)}}),[]),o.createElement("div",{ref:u,className:"mi-filters-row"+(n?" hidden":"")},o.createElement("div",{ref:c,className:"mi-filters-row-inner"},o.createElement("div",{className:"mi-filter"},o.createElement("div",{className:"mi-filter-title"},"ROLE"),o.createElement("div",{className:"mi-filter-options"},o.createElement(s.FilterOptions,{id:"role",options:m.role,selected:a,onSelect:function(t){var n={role:a};switch(t.currentTarget.getAttribute("filter")){case"role":n.role=t.currentTarget.getAttribute("value"),e.onFiltersUpdate(n),l(n.role)}}})))))}g.propTypes={hidden:a().bool},g.defaultProps={hidden:!1};var v=n(9700);function y(e){return(y="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(e){return typeof e}:function(e){return e&&"function"==typeof Symbol&&e.constructor===Symbol&&e!==Symbol.prototype?"symbol":typeof e})(e)}function h(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r)}}function b(e,t){return(b=Object.setPrototypeOf||function(e,t){return e.__proto__=t,e})(e,t)}function C(e,t){return!t||"object"!==y(t)&&"function"!=typeof t?k(e):t}function k(e){if(void 0===e)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return e}function S(e){return(S=Object.setPrototypeOf?Object.getPrototypeOf:function(e){return e.__proto__||Object.getPrototypeOf(e)})(e)}function E(e,t,n,r){return e+"?"+t+(""===t?"":"&")+n+(""===n?"":"&")+"page="+r}var P=function(e){!function(e,t){if("function"!=typeof t&&null!==t)throw new TypeError("Super expression must either be null or a function");e.prototype=Object.create(t&&t.prototype,{constructor:{value:e,writable:!0,configurable:!0}}),t&&b(e,t)}(f,e);var t,n,r,i,a=(r=f,i=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(e){return!1}}(),function(){var e,t=S(r);if(i){var n=S(this).constructor;e=Reflect.construct(t,arguments,n)}else e=t.apply(this,arguments);return C(this,e)});function f(e){var t;return function(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}(this,f),(t=a.call(this,e,"manage-users")).state={resultsCount:null,currentPage:1,requestUrl:l.ApiUrlContext._currentValue.manage.users,hiddenFilters:!0,filterArgs:"",sortingArgs:"",sortBy:"add_date",ordering:"desc",refresh:0},t.getCountFunc=t.getCountFunc.bind(k(t)),t.onTablePageChange=t.onTablePageChange.bind(k(t)),t.onToggleFiltersClick=t.onToggleFiltersClick.bind(k(t)),t.onFiltersUpdate=t.onFiltersUpdate.bind(k(t)),t.onColumnSortClick=t.onColumnSortClick.bind(k(t)),t.onItemsRemoval=t.onItemsRemoval.bind(k(t)),t.onItemsRemovalFail=t.onItemsRemovalFail.bind(k(t)),t}return t=f,(n=[{key:"onTablePageChange",value:function(e,t){this.setState({currentPage:t,requestUrl:E(l.ApiUrlContext._currentValue.manage.users,this.state.filterArgs,this.state.sortingArgs,t)})}},{key:"onToggleFiltersClick",value:function(){this.setState({hiddenFilters:!this.state.hiddenFilters})}},{key:"getCountFunc",value:function(e){this.setState({resultsCount:e})}},{key:"onFiltersUpdate",value:function(e){var t=[];for(var n in e)null!==e[n]&&"all"!==e[n]&&t.push(n+"="+e[n]);this.setState({filterArgs:t.join("&"),requestUrl:E(l.ApiUrlContext._currentValue.manage.users,t.join("&"),this.state.sortingArgs,this.state.currentPage)})}},{key:"onColumnSortClick",value:function(e,t){var n="sort_by="+e+"&ordering="+t;this.setState({sortBy:e,ordering:t,sortingArgs:n,requestUrl:E(l.ApiUrlContext._currentValue.manage.users,this.state.filterArgs,n,this.state.currentPage)})}},{key:"onItemsRemoval",value:function(e){this.setState({resultsCount:null,refresh:this.state.refresh+1,requestUrl:l.ApiUrlContext._currentValue.manage.users},(function(){e?u.PageActions.addNotification("The users deleted successfully.","usersRemovalSucceed"):u.PageActions.addNotification("The user deleted successfully.","userRemovalSucceed")}))}},{key:"onItemsRemovalFail",value:function(e){e?u.PageActions.addNotification("The users removal failed. Please try again.","usersRemovalFailed"):u.PageActions.addNotification("The user removal failed. Please try again.","userRemovalFailed")}},{key:"pageContent",value:function(){return[o.createElement(c.MediaListWrapper,{key:"2",title:this.props.title+(null===this.state.resultsCount?"":" ("+this.state.resultsCount+")")},o.createElement(s.FiltersToggleButton,{onClick:this.onToggleFiltersClick}),o.createElement(g,{hidden:this.state.hiddenFilters,onFiltersUpdate:this.onFiltersUpdate}),o.createElement(v.d,{pageItems:50,manageType:"users",key:this.state.requestUrl+"["+this.state.refresh+"]",itemsCountCallback:this.getCountFunc,requestUrl:this.state.requestUrl,onPageChange:this.onTablePageChange,sortBy:this.state.sortBy,ordering:this.state.ordering,onRowsDelete:this.onItemsRemoval,onRowsDeleteFail:this.onItemsRemovalFail,onClickColumnSort:this.onColumnSortClick}))]}}])&&h(t.prototype,n),f}(n(8204).T);P.propTypes={title:a().string.isRequired},P.defaultProps={title:"Manage users"},(0,r.X)("page-manage-users",P)},7714:function(e,t,n){n.d(t,{M:function(){return l}}),n(4517);var r=n(5466),o=n(3074),i=n.n(o);function a(){return(a=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e}).apply(this,arguments)}function l(e){var t=r.createElement("span",null,r.createElement("span",null,e.children)),n={tabIndex:e.tabIndex||null,title:e.title||null,className:"circle-icon-button"+(void 0!==e.className?" "+e.className:"")+(e.buttonShadow?" button-shadow":"")};return void 0!==e["data-page-id"]&&(n["data-page-id"]=e["data-page-id"]),void 0!==e["aria-label"]&&(n["aria-label"]=e["aria-label"]),"link"===e.type?r.createElement("a",a({},n,{href:e.href||null,rel:e.rel||null}),t):"span"===e.type?r.createElement("span",a({},n,{onClick:e.onClick||null}),t):r.createElement("button",a({},n,{onClick:e.onClick||null}),t)}l.propTypes={type:i().oneOf(["button","link","span"]),buttonShadow:i().bool,className:i().string},l.defaultProps={type:"button",buttonShadow:!1}},7446:function(e,t,n){n.d(t,{j:function(){return l}}),n(2070);var r=n(5466),o=n(3074),i=n.n(o),a=n(2299);function l(e){return e.options.map((function(t){return r.createElement("div",{key:t.id,className:t.id===e.selected?"active":""},r.createElement("button",{onClick:e.onSelect,filter:e.id,value:t.id},r.createElement("span",null,t.title),t.id===e.selected?r.createElement(a.O,{type:"close"}):null))}))}l.propTypes={id:i().string.isRequired,selected:i().string.isRequired,onSelect:i().func.isRequired}},2915:function(e,t,n){n.d(t,{_:function(){return u}}),n(2004),n(8407),n(6394),n(8288),n(5677),n(2129),n(4655),n(288),n(4458),n(3675);var r=n(5466),o=n(3074),i=n.n(o),a=n(2299);function l(e,t){(null==t||t>e.length)&&(t=e.length);for(var n=0,r=new Array(t);n<t;n++)r[n]=e[n];return r}function u(e){var t,n,o=(t=(0,r.useState)(e.active),n=2,function(e){if(Array.isArray(e))return e}(t)||function(e,t){var n=null==e?null:"undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(null!=n){var r,o,i=[],a=!0,l=!1;try{for(n=n.call(e);!(a=(r=n.next()).done)&&(i.push(r.value),!t||i.length!==t);a=!0);}catch(e){l=!0,o=e}finally{try{a||null==n.return||n.return()}finally{if(l)throw o}}return i}}(t,n)||function(e,t){if(e){if("string"==typeof e)return l(e,t);var n=Object.prototype.toString.call(e).slice(8,-1);return"Object"===n&&e.constructor&&(n=e.constructor.name),"Map"===n||"Set"===n?Array.from(e):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?l(e,t):void 0}}(t,n)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()),i=o[0],u=o[1];return r.createElement("div",{className:"mi-filters-toggle"},r.createElement("button",{className:i?"active":"","aria-label":"Filter",onClick:function(){u(!i),void 0!==e.onClick&&e.onClick()}},r.createElement(a.O,{type:"filter_list"}),r.createElement("span",{className:"filter-button-label"},r.createElement("span",{className:"filter-button-label-text"},"FILTERS"))))}u.propTypes={onClick:i().func,active:i().bool},u.defaultProps={active:!1}},4234:function(e,t,n){n.d(t,{CircleIconButton:function(){return r.M},FilterOptions:function(){return o.j},FiltersToggleButton:function(){return i._},MaterialIcon:function(){return a.O},NavigationContentApp:function(){return l.o},NavigationMenuList:function(){return u.S},Notifications:function(){return s.T},PopupMain:function(){return c.W8},PopupTop:function(){return c.HF},SpinnerLoader:function(){return f.i},UserThumbnail:function(){return p.q}});var r=n(7714),o=n(7446),i=n(2915),a=n(2299),l=n(2917),u=n(5671),s=n(2436),c=(n(5517),n(940)),f=n(6309),p=n(6142)},2299:function(e,t,n){n.d(t,{O:function(){return o}});var r=n(5466),o=function(e){var t=e.type;return t?r.createElement("i",{className:"material-icons","data-icon":t}):null}},2917:function(e,t,n){n.d(t,{o:function(){return u}}),n(3233),n(9751),n(2004),n(8407),n(6394),n(8288),n(5677),n(2129),n(4655),n(288),n(4458),n(3675);var r=n(5466),o=n(6116),i=n(3074),a=n.n(i);function l(e,t){(null==t||t>e.length)&&(t=e.length);for(var n=0,r=new Array(t);n<t;n++)r[n]=e[n];return r}function u(e){var t,n,i=(0,r.useRef)(null),a=(t=(0,r.useState)(null),n=2,function(e){if(Array.isArray(e))return e}(t)||function(e,t){var n=null==e?null:"undefined"!=typeof Symbol&&e[Symbol.iterator]||e["@@iterator"];if(null!=n){var r,o,i=[],a=!0,l=!1;try{for(n=n.call(e);!(a=(r=n.next()).done)&&(i.push(r.value),!t||i.length!==t);a=!0);}catch(e){l=!0,o=e}finally{try{a||null==n.return||n.return()}finally{if(l)throw o}}return i}}(t,n)||function(e,t){if(e){if("string"==typeof e)return l(e,t);var n=Object.prototype.toString.call(e).slice(8,-1);return"Object"===n&&e.constructor&&(n=e.constructor.name),"Map"===n||"Set"===n?Array.from(e):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?l(e,t):void 0}}(t,n)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()),u=a[0],s=a[1],c=[];function f(t,n){var r;n.preventDefault(),n.stopPropagation(),r=c[t].id,void 0!==e.pages[r]&&s(r)}return(0,r.useEffect)((function(){void 0!==e.pages[e.initPage]?s(e.initPage):Object.keys(e.pages).length?s(Object.keys(e.pages)[0]):s(null)}),[e.initPage]),(0,r.useEffect)((function(){!function(){for(var e=0;e<c.length;)c[e].elem.removeEventListener("click",c[e].listener),e+=1;c=[]}(),u&&(function(){var t,n,r=(0,o.findDOMNode)(i.current),a=r.querySelectorAll(e.pageChangeSelector);if(a.length)for(t=0;t<a.length;)(n=(n=a[t].getAttribute(e.pageIdSelectorAttr))?n.trim():n)&&(c[t]={id:n,elem:a[t]},c[t].listener=function(e){return function(t){return f(e,t)}}(t),c[t].elem.addEventListener("click",c[t].listener)),t+=1;e.focusFirstItemOnPageChange&&r.focus()}(),"function"==typeof e.pageChangeCallback&&e.pageChangeCallback(u))}),[u]),u?r.createElement("div",{ref:i},r.cloneElement(e.pages[u])):null}u.propTypes={initPage:a().string,pages:a().object.isRequired,pageChangeSelector:a().string.isRequired,pageIdSelectorAttr:a().string.isRequired,focusFirstItemOnPageChange:a().bool,pageChangeCallback:a().func},u.defaultProps={focusFirstItemOnPageChange:!0}},5671:function(e,t,n){n.d(t,{S:function(){return s}}),n(9808),n(3233),n(2070),n(4517);var r=n(5466),o=n(3074),i=n.n(o),a=n(2299);function l(){return(l=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e}).apply(this,arguments)}function u(e){var t=[],n=e.itemAttr||{};void 0===n.className?n.className="":n.className&&(n.className+=" ");var o=e.text?e.icon&&"right"!==e.iconPos?1:0:-1,i=e.icon?e.text&&"right"===e.iconPos?1:0:-1;switch(-1<o&&(t[o]=r.createElement("span",{key:"Text"},e.text)),-1<i&&(t[i]=r.createElement("span",{key:"Icon",className:"right"===e.iconPos?"menu-item-icon-right":"menu-item-icon"},r.createElement(a.O,{type:e.icon}))),e.itemType){case"link":t=r.createElement("a",l({},e.linkAttr||{},{href:e.link,title:e.text||null}),t),n.className+="link-item"+(e.active?" active":"");break;case"button":case"open-subpage":t=r.createElement("button",l({},e.buttonAttr||{},{key:"button"}),t);break;case"label":t=r.createElement("button",l({},e.buttonAttr||{},{key:"button"}),r.createElement("span",null,e.text||null)),n.className="label-item";break;case"div":t=r.createElement("div",l({},e.divAttr||{},{key:"div"}),e.text||null)}return""!==n.className&&(n.className=" "+n.className),n.className=n.className.trim(),r.createElement("li",n,t)}function s(e){var t=e.items.map((function(e,t){return r.createElement(u,l({key:t},e))}));return t.length?r.createElement("div",{className:"nav-menu"+(e.removeVerticalPadding?" pv0":"")},r.createElement("nav",null,r.createElement("ul",null,t))):null}u.propTypes={itemType:i().oneOf(["link","open-subpage","button","label","div"]),link:i().string,icon:i().string,iconPos:i().oneOf(["left","right"]),text:i().string,active:i().bool,divAttr:i().object,buttonAttr:i().object,itemAttr:i().object,linkAttr:i().object},u.defaultProps={itemType:"link",iconPos:"left",active:!1},s.propTypes={removeVerticalPadding:i().bool,items:i().arrayOf(i().shape(u.propTypes)).isRequired},s.defaultProps={removeVerticalPadding:!1}},940:function(e,t,n){n.d(t,{HF:function(){return i},W8:function(){return a}});var r=n(5466),o=r.forwardRef((function(e,t){return void 0!==e.children?r.createElement("div",{ref:t,className:"popup"+(void 0!==e.className?" "+e.className:""),style:e.style},e.children):null}));function i(e){return void 0!==e.children?r.createElement("div",{className:"popup-top"+(void 0!==e.className?" "+e.className:""),style:e.style},e.children):null}function a(e){return void 0!==e.children?r.createElement("div",{className:"popup-main"+(void 0!==e.className?" "+e.className:""),style:e.style},e.children):null}t.ZP=o}},n={};function r(e){var o=n[e];if(void 0!==o)return o.exports;var i=n[e]={exports:{}};return t[e].call(i.exports,i,i.exports,r),i.exports}r.m=t,e=[],r.O=function(t,n,o,i){if(!n){var a=1/0;for(s=0;s<e.length;s++){n=e[s][0],o=e[s][1],i=e[s][2];for(var l=!0,u=0;u<n.length;u++)(!1&i||a>=i)&&Object.keys(r.O).every((function(e){return r.O[e](n[u])}))?n.splice(u--,1):(l=!1,i<a&&(a=i));l&&(e.splice(s--,1),t=o())}return t}i=i||0;for(var s=e.length;s>0&&e[s-1][2]>i;s--)e[s]=e[s-1];e[s]=[n,o,i]},r.n=function(e){var t=e&&e.__esModule?function(){return e.default}:function(){return e};return r.d(t,{a:t}),t},r.d=function(e,t){for(var n in t)r.o(t,n)&&!r.o(e,n)&&Object.defineProperty(e,n,{enumerable:!0,get:t[n]})},r.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(e){if("object"==typeof window)return window}}(),r.o=function(e,t){return Object.prototype.hasOwnProperty.call(e,t)},r.r=function(e){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},r.j=611,function(){var e;r.g.importScripts&&(e=r.g.location+"");var t=r.g.document;if(!e&&t&&(t.currentScript&&(e=t.currentScript.src),!e)){var n=t.getElementsByTagName("script");n.length&&(e=n[n.length-1].src)}if(!e)throw new Error("Automatic publicPath is not supported in this browser");e=e.replace(/#.*$/,"").replace(/\?.*$/,"").replace(/\/[^\/]+$/,"/"),r.p=e+"../"}(),function(){var e={611:0};r.O.j=function(t){return 0===e[t]};var t=function(t,n){var o,i,a=n[0],l=n[1],u=n[2],s=0;for(o in l)r.o(l,o)&&(r.m[o]=l[o]);if(u)var c=u(r);for(t&&t(n);s<a.length;s++)i=a[s],r.o(e,i)&&e[i]&&e[i][0](),e[a[s]]=0;return r.O(c)},n=self.webpackChunkmediacms_frontend=self.webpackChunkmediacms_frontend||[];n.forEach(t.bind(null,0)),n.push=t.bind(null,n.push.bind(n))}();var o=r.O(void 0,[431],(function(){return r(7839)}));o=r.O(o)}();