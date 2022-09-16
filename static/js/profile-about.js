!function(){"use strict";var t,e={4254:function(t,e,n){var r=n(2541),o=(n(3233),n(4458),n(5101),n(2004),n(8407),n(6394),n(4669),n(2322),n(9268),n(3080),n(8288),n(5677),n(2129),n(4655),n(5466)),i=n(3074),a=n.n(i),u=n(137),c=n.n(u),l=n(3613),s=n(473),f=n(541),p=n(8578),m=n(8556),d=n(6970),h=n(7180),y=n(4982),b=n(1283);function v(t){return(v="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}function g(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function S(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}function k(t,e,n){return e&&S(t.prototype,e),n&&S(t,n),t}function w(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function");t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,writable:!0,configurable:!0}}),e&&E(t,e)}function E(t,e){return(E=Object.setPrototypeOf||function(t,e){return t.__proto__=e,t})(t,e)}function P(t){var e=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(t){return!1}}();return function(){var n,r=A(t);if(e){var o=A(this).constructor;n=Reflect.construct(r,arguments,o)}else n=r.apply(this,arguments);return O(this,n)}}function O(t,e){return!e||"object"!==v(e)&&"function"!=typeof e?_(t):e}function _(t){if(void 0===t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return t}function A(t){return(A=Object.setPrototypeOf?Object.getPrototypeOf:function(t){return t.__proto__||Object.getPrototypeOf(t)})(t)}var j=function(t){w(n,t);var e=P(n);function n(t){var r;return g(this,n),(r=e.call(this,t)).state={subject:"",body:"",isSending:!1},r.onUpdateSubject=r.onUpdateSubject.bind(_(r)),r.onUpdateBody=r.onUpdateBody.bind(_(r)),r.onSubmit=r.onSubmit.bind(_(r)),r.onSubmitSuccess=r.onSubmitSuccess.bind(_(r)),r.onSubmitFail=r.onSubmitFail.bind(_(r)),r}return k(n,[{key:"onUpdateSubject",value:function(){this.setState({subject:this.refs.msgSubject.value.trim()})}},{key:"onUpdateBody",value:function(){this.setState({body:this.refs.msgBody.value.trim()})}},{key:"onSubmitSuccess",value:function(t){this.setState({subject:"",body:"",isSending:!1},(function(){setTimeout(function(){f.PageActions.addNotification("Your message was successfully submitted to "+this.props.author.name,"messageSubmitSucceed")}.bind(this),100)}))}},{key:"onSubmitFail",value:function(t){this.setState({isSending:!1},(function(){b.log(t),setTimeout(function(){f.PageActions.addNotification("Your message failed to submit. Please try again","messageSubmitFailed")}.bind(this),100)}))}},{key:"onSubmit",value:function(t){this.state.isSending||""===this.state.subject||""===this.state.body||(t.preventDefault(),t.stopPropagation(),this.setState({isSending:!0},(function(){var t=l.ApiUrlContext._currentValue.users+"/"+this.props.author.username+"/contact";(0,s.postRequest)(t,{subject:this.state.subject,body:this.state.body},{headers:{"X-CSRFToken":(0,s.csrfToken)()}},!1,this.onSubmitSuccess,this.onSubmitFail)})))}},{key:"render",value:function(){return o.createElement("div",{className:"media-list-row profile-contact"},o.createElement("div",{className:"media-list-header"},o.createElement("h2",null,"Contact")),o.createElement("form",{method:"post",className:"user-contact-form"+(this.state.isSending?" pending-response":"")},o.createElement("span",null,o.createElement("label",null,"Subject"),o.createElement("input",{ref:"msgSubject",type:"text",required:!0,onChange:this.onUpdateSubject,value:this.state.subject})),o.createElement("span",null,o.createElement("label",null,"Message"),o.createElement("textarea",{ref:"msgBody",required:!0,cols:"40",rows:"10",onChange:this.onUpdateBody,value:this.state.body})),o.createElement("button",{onClick:this.onSubmit},"SUBMIT")))}}]),n}(o.PureComponent),C=function(t){w(n,t);var e=P(n);function n(t){var r;return g(this,n),(r=e.call(this,t,"author-about")).userIsAuthor=null,r.enabledContactForm=!1,r}return k(n,[{key:"pageContent",value:function(){var t=null,e=[],n=[];if(this.state.author){var r,i;if(null===this.userIsAuthor&&(l.MemberContext._currentValue.is.anonymous?(this.userIsAuthor=!1,this.enabledContactForm=!1):(this.userIsAuthor=p.ProfilePageStore.get("author-data").username===l.MemberContext._currentValue.username,this.enabledContactForm=!this.userIsAuthor&&l.MemberContext._currentValue.can.contactUser)),void 0!==this.state.author.description&&this.state.author.description&&""!==this.state.author.description&&(t=this.state.author.description),void 0!==this.state.author.location_info&&this.state.author.location_info.length){var a=[];for(r=0;r<this.state.author.location_info.length;)void 0!==this.state.author.location_info[r].title&&void 0!==this.state.author.location_info[r].url&&a.push(o.createElement("a",{key:r,href:(0,s.formatInnerLink)(this.state.author.location_info[r].url,l.SiteContext._currentValue.url),title:this.state.author.location_info[r].title},this.state.author.location_info[r].title)),r+=1;e.push(o.createElement("li",{key:"location"},o.createElement("span",null,"Location:"),o.createElement("span",null,a)))}else void 0!==this.state.author.location&&this.state.author.location&&""!==this.state.author.location&&e.push(o.createElement("li",{key:"location"},o.createElement("span",null,"Location:"),o.createElement("span",null,this.state.author.location)));if(void 0!==this.state.author.home_page&&this.state.author.home_page&&""!==this.state.author.home_page&&""!==(i=c()(this.state.author.home_page.trim()).toString())&&e.push(o.createElement("li",{key:"website"},o.createElement("span",null,"Website:"),o.createElement("span",null,i))),void 0!==this.state.author.social_media_links&&this.state.author.social_media_links&&""!==this.state.author.social_media_links){var u=this.state.author.social_media_links.split(",");if(u.length){for(r=0;r<u.length;)""!==(i=u[r].trim())&&n.push(o.createElement("span",{key:r},i)),r+=1;e.push(o.createElement("li",{key:"social_media"},o.createElement("span",null,"Social media:"),o.createElement("span",{className:"author-social-media"},n)))}}}return[this.state.author?o.createElement(m.Z,{key:"ProfilePagesHeader",author:this.state.author,type:"about"}):null,this.state.author?o.createElement(d.Z,{key:"ProfilePagesContent",enabledContactForm:this.enabledContactForm},o.createElement("div",{className:"media-list-wrapper items-list-ver  profile-about-content "},null===t&&0<e.length?null:p.PageStore.get("config-options").pages.profile.htmlInDescription?o.createElement(h.MediaListRow,{title:this.props.title},o.createElement("span",{dangerouslySetInnerHTML:{__html:t||null}})):o.createElement(h.MediaListRow,{title:this.props.title},t),e.length?o.createElement(h.MediaListRow,{title:"Details"},o.createElement("ul",{className:"profile-details"},e)):null,this.enabledContactForm?o.createElement(j,{author:this.state.author}):null)):null]}}]),n}(y.a);C.propTypes={title:a().string.isRequired},C.defaultProps={title:"Biography"},(0,r.X)("page-profile-about",C)},7714:function(t,e,n){n.d(e,{M:function(){return u}}),n(4517);var r=n(5466),o=n(3074),i=n.n(o);function a(){return(a=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var n=arguments[e];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(t[r]=n[r])}return t}).apply(this,arguments)}function u(t){var e=r.createElement("span",null,r.createElement("span",null,t.children)),n={tabIndex:t.tabIndex||null,title:t.title||null,className:"circle-icon-button"+(void 0!==t.className?" "+t.className:"")+(t.buttonShadow?" button-shadow":"")};return void 0!==t["data-page-id"]&&(n["data-page-id"]=t["data-page-id"]),void 0!==t["aria-label"]&&(n["aria-label"]=t["aria-label"]),"link"===t.type?r.createElement("a",a({},n,{href:t.href||null,rel:t.rel||null}),e):"span"===t.type?r.createElement("span",a({},n,{onClick:t.onClick||null}),e):r.createElement("button",a({},n,{onClick:t.onClick||null}),e)}u.propTypes={type:i().oneOf(["button","link","span"]),buttonShadow:i().bool,className:i().string},u.defaultProps={type:"button",buttonShadow:!1}},7446:function(t,e,n){n(2070),n(5466);var r=n(3074),o=n.n(r);n(2299),o().string.isRequired,o().string.isRequired,o().func.isRequired},2915:function(t,e,n){n(2004),n(8407),n(6394),n(8288),n(5677),n(2129),n(4655),n(288),n(4458),n(3675);var r=n(5466),o=n(3074),i=n.n(o),a=n(2299);function u(t,e){(null==e||e>t.length)&&(e=t.length);for(var n=0,r=new Array(e);n<e;n++)r[n]=t[n];return r}function c(t){var e,n,o=(e=(0,r.useState)(t.active),n=2,function(t){if(Array.isArray(t))return t}(e)||function(t,e){var n=null==t?null:"undefined"!=typeof Symbol&&t[Symbol.iterator]||t["@@iterator"];if(null!=n){var r,o,i=[],a=!0,u=!1;try{for(n=n.call(t);!(a=(r=n.next()).done)&&(i.push(r.value),!e||i.length!==e);a=!0);}catch(t){u=!0,o=t}finally{try{a||null==n.return||n.return()}finally{if(u)throw o}}return i}}(e,n)||function(t,e){if(t){if("string"==typeof t)return u(t,e);var n=Object.prototype.toString.call(t).slice(8,-1);return"Object"===n&&t.constructor&&(n=t.constructor.name),"Map"===n||"Set"===n?Array.from(t):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?u(t,e):void 0}}(e,n)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()),i=o[0],c=o[1];return r.createElement("div",{className:"mi-filters-toggle"},r.createElement("button",{className:i?"active":"","aria-label":"Filter",onClick:function(){c(!i),void 0!==t.onClick&&t.onClick()}},r.createElement(a.O,{type:"filter_list"}),r.createElement("span",{className:"filter-button-label"},r.createElement("span",{className:"filter-button-label-text"},"FILTERS"))))}c.propTypes={onClick:i().func,active:i().bool},c.defaultProps={active:!1}},4234:function(t,e,n){n.d(e,{CircleIconButton:function(){return r.M},MaterialIcon:function(){return o.O},NavigationContentApp:function(){return i.o},NavigationMenuList:function(){return a.S},Notifications:function(){return u.T},PopupMain:function(){return c.W8},PopupTop:function(){return c.HF},SpinnerLoader:function(){return l.i},UserThumbnail:function(){return s.q}});var r=n(7714),o=(n(7446),n(2915),n(2299)),i=n(2917),a=n(5671),u=n(2436),c=(n(5517),n(940)),l=n(6309),s=n(6142)},2299:function(t,e,n){n.d(e,{O:function(){return o}});var r=n(5466),o=function(t){var e=t.type;return e?r.createElement("i",{className:"material-icons","data-icon":e}):null}},2917:function(t,e,n){n.d(e,{o:function(){return c}}),n(3233),n(9751),n(2004),n(8407),n(6394),n(8288),n(5677),n(2129),n(4655),n(288),n(4458),n(3675);var r=n(5466),o=n(6116),i=n(3074),a=n.n(i);function u(t,e){(null==e||e>t.length)&&(e=t.length);for(var n=0,r=new Array(e);n<e;n++)r[n]=t[n];return r}function c(t){var e,n,i=(0,r.useRef)(null),a=(e=(0,r.useState)(null),n=2,function(t){if(Array.isArray(t))return t}(e)||function(t,e){var n=null==t?null:"undefined"!=typeof Symbol&&t[Symbol.iterator]||t["@@iterator"];if(null!=n){var r,o,i=[],a=!0,u=!1;try{for(n=n.call(t);!(a=(r=n.next()).done)&&(i.push(r.value),!e||i.length!==e);a=!0);}catch(t){u=!0,o=t}finally{try{a||null==n.return||n.return()}finally{if(u)throw o}}return i}}(e,n)||function(t,e){if(t){if("string"==typeof t)return u(t,e);var n=Object.prototype.toString.call(t).slice(8,-1);return"Object"===n&&t.constructor&&(n=t.constructor.name),"Map"===n||"Set"===n?Array.from(t):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?u(t,e):void 0}}(e,n)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()),c=a[0],l=a[1],s=[];function f(e,n){var r;n.preventDefault(),n.stopPropagation(),r=s[e].id,void 0!==t.pages[r]&&l(r)}return(0,r.useEffect)((function(){void 0!==t.pages[t.initPage]?l(t.initPage):Object.keys(t.pages).length?l(Object.keys(t.pages)[0]):l(null)}),[t.initPage]),(0,r.useEffect)((function(){!function(){for(var t=0;t<s.length;)s[t].elem.removeEventListener("click",s[t].listener),t+=1;s=[]}(),c&&(function(){var e,n,r=(0,o.findDOMNode)(i.current),a=r.querySelectorAll(t.pageChangeSelector);if(a.length)for(e=0;e<a.length;)(n=(n=a[e].getAttribute(t.pageIdSelectorAttr))?n.trim():n)&&(s[e]={id:n,elem:a[e]},s[e].listener=function(t){return function(e){return f(t,e)}}(e),s[e].elem.addEventListener("click",s[e].listener)),e+=1;t.focusFirstItemOnPageChange&&r.focus()}(),"function"==typeof t.pageChangeCallback&&t.pageChangeCallback(c))}),[c]),c?r.createElement("div",{ref:i},r.cloneElement(t.pages[c])):null}c.propTypes={initPage:a().string,pages:a().object.isRequired,pageChangeSelector:a().string.isRequired,pageIdSelectorAttr:a().string.isRequired,focusFirstItemOnPageChange:a().bool,pageChangeCallback:a().func},c.defaultProps={focusFirstItemOnPageChange:!0}},5671:function(t,e,n){n.d(e,{S:function(){return l}}),n(9808),n(3233),n(2070),n(4517);var r=n(5466),o=n(3074),i=n.n(o),a=n(2299);function u(){return(u=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var n=arguments[e];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(t[r]=n[r])}return t}).apply(this,arguments)}function c(t){var e=[],n=t.itemAttr||{};void 0===n.className?n.className="":n.className&&(n.className+=" ");var o=t.text?t.icon&&"right"!==t.iconPos?1:0:-1,i=t.icon?t.text&&"right"===t.iconPos?1:0:-1;switch(-1<o&&(e[o]=r.createElement("span",{key:"Text"},t.text)),-1<i&&(e[i]=r.createElement("span",{key:"Icon",className:"right"===t.iconPos?"menu-item-icon-right":"menu-item-icon"},r.createElement(a.O,{type:t.icon}))),t.itemType){case"link":e=r.createElement("a",u({},t.linkAttr||{},{href:t.link,title:t.text||null}),e),n.className+="link-item"+(t.active?" active":"");break;case"button":case"open-subpage":e=r.createElement("button",u({},t.buttonAttr||{},{key:"button"}),e);break;case"label":e=r.createElement("button",u({},t.buttonAttr||{},{key:"button"}),r.createElement("span",null,t.text||null)),n.className="label-item";break;case"div":e=r.createElement("div",u({},t.divAttr||{},{key:"div"}),t.text||null)}return""!==n.className&&(n.className=" "+n.className),n.className=n.className.trim(),r.createElement("li",n,e)}function l(t){var e=t.items.map((function(t,e){return r.createElement(c,u({key:e},t))}));return e.length?r.createElement("div",{className:"nav-menu"+(t.removeVerticalPadding?" pv0":"")},r.createElement("nav",null,r.createElement("ul",null,e))):null}c.propTypes={itemType:i().oneOf(["link","open-subpage","button","label","div"]),link:i().string,icon:i().string,iconPos:i().oneOf(["left","right"]),text:i().string,active:i().bool,divAttr:i().object,buttonAttr:i().object,itemAttr:i().object,linkAttr:i().object},c.defaultProps={itemType:"link",iconPos:"left",active:!1},l.propTypes={removeVerticalPadding:i().bool,items:i().arrayOf(i().shape(c.propTypes)).isRequired},l.defaultProps={removeVerticalPadding:!1}},2436:function(t,e,n){n.d(e,{T:function(){return f}}),n(2070),n(1646),n(2004),n(8407),n(6394),n(8288),n(5677),n(2129),n(4655),n(288),n(4458),n(3675);var r=n(5466),o=n(7959);function i(t){return function(t){if(Array.isArray(t))return c(t)}(t)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(t)||u(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function a(t,e){return function(t){if(Array.isArray(t))return t}(t)||function(t,e){var n=null==t?null:"undefined"!=typeof Symbol&&t[Symbol.iterator]||t["@@iterator"];if(null!=n){var r,o,i=[],a=!0,u=!1;try{for(n=n.call(t);!(a=(r=n.next()).done)&&(i.push(r.value),!e||i.length!==e);a=!0);}catch(t){u=!0,o=t}finally{try{a||null==n.return||n.return()}finally{if(u)throw o}}return i}}(t,e)||u(t,e)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function u(t,e){if(t){if("string"==typeof t)return c(t,e);var n=Object.prototype.toString.call(t).slice(8,-1);return"Object"===n&&t.constructor&&(n=t.constructor.name),"Map"===n||"Set"===n?Array.from(t):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?c(t,e):void 0}}function c(t,e){(null==e||e>t.length)&&(e=t.length);for(var n=0,r=new Array(e);n<e;n++)r[n]=t[n];return r}var l=[];function s(t){var e=a((0,r.useState)(!1),2),n=e[0],o=e[1],i=a((0,r.useState)(!0),2),u=i[0],c=i[1],l=null,s=null;return(0,r.useEffect)((function(){return l=setTimeout((function(){s=setTimeout((function(){c(!1),s=null}),1e3),l=null,o(!0),t.onHide(t.id)}),5e3),function(){l&&clearTimeout(l),s&&clearTimeout(s)}}),[]),u?r.createElement("div",{className:"notification-item"+(n?" hidden":"")},r.createElement("div",null,t.children||null)):null}function f(){var t,e,n,u=a((0,r.useState)(l.length),2),c=u[0],f=u[1];function p(){f(o.default.get("notifications-size")+l.length)}function m(t){var e=[];l.map((function(n){n[0]!==t&&e.push(n)})),l=e}return(0,r.useEffect)((function(){return p(),o.default.on("added_notification",p),function(){return o.default.removeListener("added_notification",p)}}),[]),c?r.createElement("div",{className:"notifications"},r.createElement("div",null,(t=o.default.get("notifications"),e=l.map((function(t){return r.createElement(s,{key:t[0],id:t[0],onHide:m},t[1])})),n=t.map((function(t){return l.push(t),r.createElement(s,{key:t[0],id:t[0],onHide:m},t[1])})),[].concat(i(e),i(n))))," "):null}},940:function(t,e,n){n.d(e,{HF:function(){return i},W8:function(){return a}});var r=n(5466),o=r.forwardRef((function(t,e){return void 0!==t.children?r.createElement("div",{ref:e,className:"popup"+(void 0!==t.className?" "+t.className:""),style:t.style},t.children):null}));function i(t){return void 0!==t.children?r.createElement("div",{className:"popup-top"+(void 0!==t.className?" "+t.className:""),style:t.style},t.children):null}function a(t){return void 0!==t.children?r.createElement("div",{className:"popup-main"+(void 0!==t.className?" "+t.className:""),style:t.style},t.children):null}e.ZP=o},6309:function(t,e,n){n.d(e,{i:function(){return a}});var r=n(5466),o=n(3074),i=n.n(o);function a(t){var e="spinner-loader";switch(t.size){case"tiny":case"x-small":case"small":case"large":case"x-large":e+=" "+t.size}return r.createElement("div",{className:e},r.createElement("svg",{className:"circular",viewBox:"25 25 50 50"},r.createElement("circle",{className:"path",cx:"50",cy:"50",r:"20",fill:"none",strokeWidth:"1.5",strokeMiterlimit:"10"})))}a.propTypes={size:i().oneOf(["tiny","x-small","small","medium","large","x-large"])},a.defaultProps={size:"medium"}},6142:function(t,e,n){n.d(e,{q:function(){return l}});var r=n(5466),o=n(3074),i=n.n(o),a=n(9747),u=n(7714),c=n(2299);function l(t){var e=(0,a.useUser)().thumbnail,n={"aria-label":"Account profile photo that opens list of options and settings pages links",className:"thumbnail"};switch(t.isButton?void 0!==t.onClick&&(n.onClick=t.onClick):n.type="span",t.size){case"small":case"large":n.className+=" "+t.size+"-thumb"}return r.createElement(u.M,n,e?r.createElement("img",{src:e,alt:""}):r.createElement(c.O,{type:"person"}))}l.propTypes={isButton:i().bool,size:i().oneOf(["small","medium","large"]),onClick:i().func},l.defaultProps={isButton:!1,size:"medium"}},6191:function(t,e,n){n.d(e,{PageHeader:function(){return r.m},PageMain:function(){return o.r},PageSidebar:function(){return i.$}});var r=n(6006),o=n(9198),i=n(2947);n(1542)},1450:function(t,e,n){function r(){var t,e,n,r=null;if(document.cookie&&""!==document.cookie)for(e=document.cookie.split(";"),t=0;t<e.length;){if("csrftoken="===(n=e[t].trim()).substring(0,10)){r=decodeURIComponent(n.substring(10));break}t+=1}return r}n.d(e,{o:function(){return r}}),n(2322),n(9268),n(3233)},1397:function(t,e,n){n.d(e,{U:function(){return i}}),n(2322),n(3296),n(6394),n(4669);var r=n(137),o=n.n(r);function i(t,e){var n=o()(t,{});return""!==n.origin&&"null"!==n.origin&&n.origin||(n=o()(e+"/"+t.replace(/^\//g,""),{})),n.toString()}},447:function(t,e,n){n.d(e,{A_:function(){return u},j0:function(){return l},GH:function(){return f},Jl:function(){return m}}),n(7588),n(6394),n(5334);var r=n(4559),o=n.n(r);function i(t,e,n,r,o,i,a){try{var u=t[i](a),c=u.value}catch(t){return void n(t)}u.done?e(c):Promise.resolve(c).then(r,o)}function a(t){return function(){var e=this,n=arguments;return new Promise((function(r,o){var a=t.apply(e,n);function u(t){i(a,r,o,u,c,"next",t)}function c(t){i(a,r,o,u,c,"throw",t)}u(void 0)}))}}function u(t,e,n,r){return c.apply(this,arguments)}function c(){return(c=a(regeneratorRuntime.mark((function t(e,n,o,i){var a,u,c;return regeneratorRuntime.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:if(c=function(t){if(i instanceof Function){var e=t;if(void 0===t.response)e={type:"network",error:t};else if(void 0!==t.response.status)switch(t.response.status){case 401:e={type:"private",error:t,message:"Media is private"};break;case 400:e={type:"unavailable",error:t,message:"Media is unavailable"}}i(e)}},u=function(t){o instanceof Function&&o(t)},a={timeout:null,maxContentLength:null},!n){t.next=8;break}return t.next=6,(0,r.get)(e,a).then(u).catch(c||null);case 6:t.next=9;break;case 8:(0,r.get)(e,a).then(u).catch(c||null);case 9:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function l(t,e,n,r,o,i){return s.apply(this,arguments)}function s(){return(s=a(regeneratorRuntime.mark((function t(e,n,o,i,a,u){var c,l;return regeneratorRuntime.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:if(l=function(t){u instanceof Function&&u(t)},c=function(t){a instanceof Function&&a(t)},n=n||{},!i){t.next=8;break}return t.next=6,(0,r.post)(e,n,o||null).then(c).catch(l||null);case 6:t.next=9;break;case 8:(0,r.post)(e,n,o||null).then(c).catch(l||null);case 9:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function f(t,e,n,r,o,i){return p.apply(this,arguments)}function p(){return(p=a(regeneratorRuntime.mark((function t(e,n,o,i,a,u){var c,l;return regeneratorRuntime.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:if(l=function(t){u instanceof Function&&u(t)},c=function(t){a instanceof Function&&a(t)},n=n||{},!i){t.next=8;break}return t.next=6,(0,r.put)(e,n,o||null).then(c).catch(l||null);case 6:t.next=9;break;case 8:(0,r.put)(e,n,o||null).then(c).catch(l||null);case 9:case"end":return t.stop()}}),t)})))).apply(this,arguments)}function m(t,e,n,r,o){return d.apply(this,arguments)}function d(){return(d=a(regeneratorRuntime.mark((function t(e,n,r,i,a){var u,c;return regeneratorRuntime.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:if(c=function(t){a instanceof Function&&a(t)},u=function(t){i instanceof Function&&i(t)},n=n||{},!r){t.next=8;break}return t.next=6,o().delete(e,n||null).then(u).catch(c||null);case 6:t.next=9;break;case 8:o().delete(e,n||null).then(u).catch(c||null);case 9:case"end":return t.stop()}}),t)})))).apply(this,arguments)}},7959:function(t,e,n){n.r(e),n(5677),n(6394),n(506),n(3224),n(597),n(3543),n(5210),n(5785),n(91),n(9595),n(3357),n(1816),n(5292),n(7445),n(4875),n(1608),n(2994),n(284),n(601),n(9494),n(6229),n(9149),n(9503),n(9617),n(1962),n(8097),n(2322),n(3296),n(4669),n(7441),n(2070),n(3675),n(2129),n(9268),n(2004),n(8407),n(8288),n(4655),n(288),n(4458),n(5101),n(3080);var r,o=n(1590),i=n.n(o),a=n(9722),u=n(473),c=n(9479);function l(t){return(l="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}function s(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}function f(t,e){return(f=Object.setPrototypeOf||function(t,e){return t.__proto__=e,t})(t,e)}function p(t,e){return!e||"object"!==l(e)&&"function"!=typeof e?m(t):e}function m(t){if(void 0===t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return t}function d(t){return(d=Object.setPrototypeOf?Object.getPrototypeOf:function(t){return t.__proto__||Object.getPrototypeOf(t)})(t)}function h(t,e){(null==e||e>t.length)&&(e=t.length);for(var n=0,r=new Array(e);n<e;n++)r[n]=t[n];return r}var y=null,b=null,v=function(t){!function(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function");t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,writable:!0,configurable:!0}}),e&&f(t,e)}(v,t);var e,n,o,i,l=(o=v,i=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(t){return!1}}(),function(){var t,e=d(o);if(i){var n=d(this).constructor;t=Reflect.construct(e,arguments,n)}else t=e.apply(this,arguments);return p(this,t)});function v(t){var e;return function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,v),e=l.call(this),b=(0,c.v)(window.MediaCMS),r=new a.BrowserCache(b.site.id,86400),(y={mediaAutoPlay:r.get("media-auto-play")}).mediaAutoPlay=null===y.mediaAutoPlay||y.mediaAutoPlay,e.browserEvents=(0,u.BrowserEvents)(),e.browserEvents.doc(e.onDocumentVisibilityChange.bind(m(e))),e.browserEvents.win(e.onWindowResize.bind(m(e)),e.onWindowScroll.bind(m(e))),e.notifications=function(t){var e=[];function n(t){var n;"string"==typeof t&&e.push([(n=new Uint32Array(3),window.crypto.getRandomValues(n),(performance.now().toString(36)+Array.from(n).map((function(t){return t.toString(36)})).join("")).replace(/./g,""+Math.random()+Intl.DateTimeFormat().resolvedOptions().timeZone+Date.now())),t])}return t.map(n),{size:function(){return e.length},push:n,clear:function(){e=[]},messages:function(){return function(t){if(Array.isArray(t))return h(t)}(t=e)||function(t){if("undefined"!=typeof Symbol&&null!=t[Symbol.iterator]||null!=t["@@iterator"])return Array.from(t)}(t)||function(t,e){if(t){if("string"==typeof t)return h(t,e);var n=Object.prototype.toString.call(t).slice(8,-1);return"Object"===n&&t.constructor&&(n=t.constructor.name),"Map"===n||"Set"===n?Array.from(t):"Arguments"===n||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)?h(t,e):void 0}}(t)||function(){throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}();var t}}}(void 0!==window.MediaCMS&&void 0!==window.MediaCMS.notifications?window.MediaCMS.notifications:[]),e}return e=v,(n=[{key:"onDocumentVisibilityChange",value:function(){this.emit("document_visibility_change")}},{key:"onWindowScroll",value:function(){this.emit("window_scroll")}},{key:"onWindowResize",value:function(){this.emit("window_resize")}},{key:"initPage",value:function(t){y.currentPage=t}},{key:"get",value:function(t){var e,n;switch(t){case"browser-cache":e=r;break;case"media-auto-play":e=y.mediaAutoPlay;break;case"config-contents":e=b.contents;break;case"config-enabled":e=b.enabled;break;case"config-media-item":e=b.media.item;break;case"config-options":e=b.options;break;case"config-site":e=b.site;break;case"api-playlists":n=t.split("-")[1],e=b.api[n]||null;break;case"notifications-size":e=this.notifications.size();break;case"notifications":e=this.notifications.messages(),this.notifications.clear();break;case"current-page":e=y.currentPage}return e}},{key:"actions_handler",value:function(t){switch(t.type){case"INIT_PAGE":this.initPage(t.page),this.emit("page_init");break;case"TOGGLE_AUTO_PLAY":y.mediaAutoPlay=!y.mediaAutoPlay,r.set("media-auto-play",y.mediaAutoPlay),this.emit("switched_media_auto_play");break;case"ADD_NOTIFICATION":this.notifications.push(t.notification),this.emit("added_notification")}}}])&&s(e.prototype,n),v}(i());e.default=(0,u.exportStore)(new v,"actions_handler")}},n={};function r(t){var o=n[t];if(void 0!==o)return o.exports;var i=n[t]={exports:{}};return e[t].call(i.exports,i,i.exports,r),i.exports}r.m=e,t=[],r.O=function(e,n,o,i){if(!n){var a=1/0;for(l=0;l<t.length;l++){n=t[l][0],o=t[l][1],i=t[l][2];for(var u=!0,c=0;c<n.length;c++)(!1&i||a>=i)&&Object.keys(r.O).every((function(t){return r.O[t](n[c])}))?n.splice(c--,1):(u=!1,i<a&&(a=i));u&&(t.splice(l--,1),e=o())}return e}i=i||0;for(var l=t.length;l>0&&t[l-1][2]>i;l--)t[l]=t[l-1];t[l]=[n,o,i]},r.n=function(t){var e=t&&t.__esModule?function(){return t.default}:function(){return t};return r.d(e,{a:e}),e},r.d=function(t,e){for(var n in e)r.o(e,n)&&!r.o(t,n)&&Object.defineProperty(t,n,{enumerable:!0,get:e[n]})},r.g=function(){if("object"==typeof globalThis)return globalThis;try{return this||new Function("return this")()}catch(t){if("object"==typeof window)return window}}(),r.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},r.r=function(t){"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(t,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(t,"__esModule",{value:!0})},r.j=797,function(){var t;r.g.importScripts&&(t=r.g.location+"");var e=r.g.document;if(!t&&e&&(e.currentScript&&(t=e.currentScript.src),!t)){var n=e.getElementsByTagName("script");n.length&&(t=n[n.length-1].src)}if(!t)throw new Error("Automatic publicPath is not supported in this browser");t=t.replace(/#.*$/,"").replace(/\?.*$/,"").replace(/\/[^\/]+$/,"/"),r.p=t+"../"}(),function(){var t={797:0};r.O.j=function(e){return 0===t[e]};var e=function(e,n){var o,i,a=n[0],u=n[1],c=n[2],l=0;for(o in u)r.o(u,o)&&(r.m[o]=u[o]);if(c)var s=c(r);for(e&&e(n);l<a.length;l++)i=a[l],r.o(t,i)&&t[i]&&t[i][0](),t[a[l]]=0;return r.O(s)},n=self.webpackChunkmediacms_frontend=self.webpackChunkmediacms_frontend||[];n.forEach(e.bind(null,0)),n.push=e.bind(null,n.push.bind(n))}();var o=r.O(void 0,[431],(function(){return r(4254)}));o=r.O(o)}();