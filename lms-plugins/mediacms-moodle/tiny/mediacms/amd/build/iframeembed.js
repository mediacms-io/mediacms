define(["exports", "core/templates", "core/str", "core/modal_events", "./common", "./iframemodal", "./selectors", "./options"], function (_exports, _templates, _str, ModalEvents, _common, _iframemodal, _selectors, _options) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  _templates = _interopRequireDefault(_templates);
  ModalEvents = _interopRequireWildcard(ModalEvents);
  _iframemodal = _interopRequireDefault(_iframemodal);
  _selectors = _interopRequireDefault(_selectors);
  function _interopRequireWildcard(e, t) { if ("function" == typeof WeakMap) var r = new WeakMap(), n = new WeakMap(); return (_interopRequireWildcard = function _interopRequireWildcard(e, t) { if (!t && e && e.__esModule) return e; var o, i, f = { __proto__: null, default: e }; if (null === e || "object" != _typeof(e) && "function" != typeof e) return f; if (o = t ? n : r) { if (o.has(e)) return o.get(e); o.set(e, f); } for (var _t in e) "default" !== _t && {}.hasOwnProperty.call(e, _t) && ((i = (o = Object.defineProperty) && Object.getOwnPropertyDescriptor(e, _t)) && (i.get || i.set) ? o(f, _t, i) : f[_t] = e[_t]); return f; })(e, t); }
  function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
  function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
  function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i.return) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
  function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); } r ? i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n : (o("next", 0), o("throw", 1), o("return", 2)); }, _regeneratorDefine2(e, r, n, t); }
  function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
  function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
  function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
  function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
  function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
  function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
  function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
  var IframeEmbed = _exports.default = /*#__PURE__*/function () {
    function IframeEmbed(editor) {
      _classCallCheck(this, IframeEmbed);
      this.editor = editor;
      this.currentModal = null;
      this.isUpdating = false;
      this.selectedIframe = null;
      this.debounceTimer = null;
      this.iframeLibraryLoaded = false;
      this.selectedLibraryVideo = null;
    }
    return _createClass(IframeEmbed, [{
      key: "parseInput",
      value: function parseInput(input) {
        if (!input || !input.trim()) {
          return null;
        }
        input = input.trim();

        // Check for iframe
        var iframeMatch = input.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
        if (iframeMatch) {
          return this.parseEmbedUrl(iframeMatch[1]);
        }

        // Check URL
        if (input.startsWith('http://') || input.startsWith('https://')) {
          return this.parseVideoUrl(input);
        }
        return null;
      }
    }, {
      key: "parseVideoUrl",
      value: function parseVideoUrl(url) {
        try {
          var urlObj = new URL(url);
          var baseUrl = "".concat(urlObj.protocol, "//").concat(urlObj.host);

          // /view?m=ID
          if (urlObj.pathname.indexOf('/view') !== -1 && urlObj.searchParams.has('m')) {
            return {
              baseUrl: baseUrl,
              videoId: urlObj.searchParams.get('m'),
              isEmbed: false
            };
          }

          // /embed?m=ID
          if (urlObj.pathname.indexOf('/embed') !== -1 && urlObj.searchParams.has('m')) {
            return {
              baseUrl: baseUrl,
              videoId: urlObj.searchParams.get('m'),
              isEmbed: true,
              // Parse options
              showTitle: urlObj.searchParams.get('showTitle') === '1',
              linkTitle: urlObj.searchParams.get('linkTitle') === '1',
              showRelated: urlObj.searchParams.get('showRelated') === '1',
              showUserAvatar: urlObj.searchParams.get('showUserAvatar') === '1'
            };
          }

          // Check if it's already a launch.php URL
          if (urlObj.pathname.indexOf('/filter/mediacms/launch.php') !== -1 && urlObj.searchParams.has('token')) {
            return {
              baseUrl: baseUrl,
              videoId: urlObj.searchParams.get('token'),
              isEmbed: true,
              isLaunchUrl: true
            };
          }
          return {
            baseUrl: baseUrl,
            rawUrl: url,
            isGeneric: true
          };
        } catch (e) {
          return null;
        }
      }
    }, {
      key: "parseEmbedUrl",
      value: function parseEmbedUrl(url) {
        return this.parseVideoUrl(url);
      }
    }, {
      key: "buildEmbedUrl",
      value: function buildEmbedUrl(parsed, options) {
        if (parsed.isGeneric) {
          return parsed.rawUrl;
        }
        var launchUrl = (0, _options.getLaunchUrl)(this.editor);
        if (launchUrl && parsed.videoId) {
          var _url = new URL(launchUrl);
          _url.searchParams.set('token', parsed.videoId);
          return _url.toString();
        }

        // Fallback to direct embed if launchUrl missing
        var url = new URL("".concat(parsed.baseUrl, "/embed"));
        url.searchParams.set('m', parsed.videoId);
        return url.toString();
      }
    }, {
      key: "getTemplateContext",
      value: function () {
        var _getTemplateContext = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(data) {
          var width, height, aspectRatio;
          return _regenerator().w(function (_context) {
            while (1) switch (_context.n) {
              case 0:
                data = data || {};
                width = data.width || 560;
                height = data.height || 315;
                aspectRatio = data.aspectRatio || '16:9';
                return _context.a(2, {
                  elementid: this.editor.getElement().id,
                  isupdating: this.isUpdating,
                  url: data.url || '',
                  showTitle: data.showTitle !== false,
                  linkTitle: data.linkTitle !== false,
                  showRelated: data.showRelated !== false,
                  showUserAvatar: data.showUserAvatar !== false,
                  responsive: data.responsive !== false,
                  startAtEnabled: data.startAtEnabled || false,
                  startAt: data.startAt || '0:00',
                  width: width,
                  height: height,
                  is16_9: aspectRatio === '16:9',
                  is4_3: aspectRatio === '4:3',
                  is1_1: aspectRatio === '1:1',
                  isCustom: aspectRatio === 'custom'
                });
            }
          }, _callee, this);
        }));
        function getTemplateContext(_x) {
          return _getTemplateContext.apply(this, arguments);
        }
        return getTemplateContext;
      }()
    }, {
      key: "displayDialogue",
      value: function () {
        var _displayDialogue = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2() {
          var data, title, templateContext;
          return _regenerator().w(function (_context2) {
            while (1) switch (_context2.n) {
              case 0:
                this.selectedIframe = this.getSelectedIframe();
                data = this.getCurrentIframeData();
                this.isUpdating = data !== null;
                this.iframeLibraryLoaded = false;
                _context2.n = 1;
                return (0, _str.getString)('iframemodaltitle', _common.component);
              case 1:
                title = _context2.v;
                _context2.n = 2;
                return this.getTemplateContext(data || {});
              case 2:
                templateContext = _context2.v;
                _context2.n = 3;
                return _iframemodal.default.create({
                  title: title,
                  templateContext: templateContext
                });
              case 3:
                this.currentModal = _context2.v;
                _context2.n = 4;
                return this.registerEventListeners(this.currentModal);
              case 4:
                return _context2.a(2);
            }
          }, _callee2, this);
        }));
        function displayDialogue() {
          return _displayDialogue.apply(this, arguments);
        }
        return displayDialogue;
      }()
    }, {
      key: "getSelectedIframe",
      value: function getSelectedIframe() {
        var node = this.editor.selection.getNode();
        if (node.nodeName.toLowerCase() === 'iframe') return node;
        return node.querySelector('iframe') || null;
      }
    }, {
      key: "getCurrentIframeData",
      value: function getCurrentIframeData() {
        if (!this.selectedIframe) return null;
        var src = this.selectedIframe.getAttribute('src');
        var parsed = this.parseInput(src);

        // Defaults
        var showTitle = true;
        if (parsed && typeof parsed.showTitle !== 'undefined') {
          showTitle = parsed.showTitle;
        }
        return {
          url: src,
          width: this.selectedIframe.getAttribute('width') || 560,
          height: this.selectedIframe.getAttribute('height') || 315,
          showTitle: showTitle
        };
      }
    }, {
      key: "getFormValues",
      value: function getFormValues(root) {
        var form = root.querySelector(_selectors.default.IFRAME.elements.form);
        // Helper to safely get value or checked state
        var getVal = function getVal(sel) {
          var el = form.querySelector(sel);
          return el ? el.value : '';
        };
        var getCheck = function getCheck(sel) {
          var el = form.querySelector(sel);
          return el ? el.checked : false;
        };
        return {
          url: getVal(_selectors.default.IFRAME.elements.url).trim(),
          showTitle: getCheck(_selectors.default.IFRAME.elements.showTitle),
          linkTitle: getCheck(_selectors.default.IFRAME.elements.linkTitle),
          showRelated: getCheck(_selectors.default.IFRAME.elements.showRelated),
          showUserAvatar: getCheck(_selectors.default.IFRAME.elements.showUserAvatar),
          responsive: getCheck(_selectors.default.IFRAME.elements.responsive),
          aspectRatio: getVal(_selectors.default.IFRAME.elements.aspectRatio),
          width: parseInt(getVal(_selectors.default.IFRAME.elements.width)) || 560,
          height: parseInt(getVal(_selectors.default.IFRAME.elements.height)) || 315
        };
      }
    }, {
      key: "generateIframeHtml",
      value: function () {
        var _generateIframeHtml = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(values) {
          var parsed, embedUrl, aspectRatioCalcs, context, template;
          return _regenerator().w(function (_context3) {
            while (1) switch (_context3.n) {
              case 0:
                parsed = this.parseInput(values.url);
                if (parsed) {
                  _context3.n = 1;
                  break;
                }
                return _context3.a(2, '');
              case 1:
                embedUrl = this.buildEmbedUrl(parsed, values);
                aspectRatioCalcs = {
                  '16:9': '16 / 9',
                  '4:3': '4 / 3',
                  '1:1': '1 / 1',
                  'custom': "".concat(values.width, " / ").concat(values.height)
                };
                context = {
                  src: embedUrl,
                  width: values.width,
                  height: values.height,
                  responsive: values.responsive,
                  aspectRatioValue: aspectRatioCalcs[values.aspectRatio] || '16 / 9'
                };
                _context3.n = 2;
                return _templates.default.renderForPromise("".concat(_common.component, "/iframe_embed_output"), context);
              case 2:
                template = _context3.v;
                return _context3.a(2, template.html);
            }
          }, _callee3, this);
        }));
        function generateIframeHtml(_x2) {
          return _generateIframeHtml.apply(this, arguments);
        }
        return generateIframeHtml;
      }()
    }, {
      key: "updatePreview",
      value: function () {
        var _updatePreview = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(root) {
          var values, previewContainer, parsed, embedUrl;
          return _regenerator().w(function (_context4) {
            while (1) switch (_context4.n) {
              case 0:
                values = this.getFormValues(root);
                previewContainer = root.querySelector(_selectors.default.IFRAME.elements.preview);
                if (values.url) {
                  _context4.n = 1;
                  break;
                }
                previewContainer.innerHTML = '<span>Enter URL</span>';
                return _context4.a(2);
              case 1:
                parsed = this.parseInput(values.url);
                if (parsed) {
                  _context4.n = 2;
                  break;
                }
                previewContainer.innerHTML = '<span class="text-danger">Invalid URL</span>';
                return _context4.a(2);
              case 2:
                embedUrl = this.buildEmbedUrl(parsed, values); // Simple preview
                previewContainer.innerHTML = "<iframe src=\"".concat(embedUrl, "\" width=\"100%\" height=\"200\" frameborder=\"0\"></iframe>");
              case 3:
                return _context4.a(2);
            }
          }, _callee4, this);
        }));
        function updatePreview(_x3) {
          return _updatePreview.apply(this, arguments);
        }
        return updatePreview;
      }()
    }, {
      key: "registerEventListeners",
      value: function () {
        var _registerEventListeners = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(modal) {
          var _this = this;
          var root, form, urlInput, tabUrl, tabLib;
          return _regenerator().w(function (_context5) {
            while (1) switch (_context5.n) {
              case 0:
                root = modal.getRoot()[0];
                form = root.querySelector(_selectors.default.IFRAME.elements.form); // Input changes update preview
                form.addEventListener('change', function () {
                  return _this.updatePreview(root);
                });
                urlInput = form.querySelector(_selectors.default.IFRAME.elements.url);
                if (urlInput) {
                  urlInput.addEventListener('input', function () {
                    return _this.updatePreview(root);
                  });
                }

                // Tab switching
                tabUrl = form.querySelector(_selectors.default.IFRAME.elements.tabUrlBtn);
                tabLib = form.querySelector(_selectors.default.IFRAME.elements.tabIframeLibraryBtn);
                if (tabLib) {
                  tabLib.addEventListener('click', function (e) {
                    e.preventDefault();
                    _this.switchToTab(root, 'library');
                    _this.loadIframeLibrary(root);
                  });
                }
                if (tabUrl) {
                  tabUrl.addEventListener('click', function (e) {
                    e.preventDefault();
                    _this.switchToTab(root, 'url');
                  });
                }
                modal.getRoot().on(ModalEvents.save, function () {
                  return _this.handleDialogueSubmission(modal);
                });

                // Listen for messages
                window.addEventListener('message', function (e) {
                  return _this.handleIframeLibraryMessage(root, e);
                });
              case 1:
                return _context5.a(2);
            }
          }, _callee5);
        }));
        function registerEventListeners(_x4) {
          return _registerEventListeners.apply(this, arguments);
        }
        return registerEventListeners;
      }()
    }, {
      key: "switchToTab",
      value: function switchToTab(root, tab) {
        var form = root.querySelector(_selectors.default.IFRAME.elements.form);
        var urlPane = form.querySelector(_selectors.default.IFRAME.elements.paneUrl);
        var libPane = form.querySelector(_selectors.default.IFRAME.elements.paneIframeLibrary);
        var urlBtn = form.querySelector(_selectors.default.IFRAME.elements.tabUrlBtn);
        var libBtn = form.querySelector(_selectors.default.IFRAME.elements.tabIframeLibraryBtn);
        if (tab === 'url') {
          if (urlPane) {
            urlPane.classList.add('show', 'active');
          }
          if (libPane) {
            libPane.classList.remove('show', 'active');
          }
          if (urlBtn) {
            urlBtn.classList.add('active');
          }
          if (libBtn) {
            libBtn.classList.remove('active');
          }
        } else {
          if (urlPane) {
            urlPane.classList.remove('show', 'active');
          }
          if (libPane) {
            libPane.classList.add('show', 'active');
          }
          if (urlBtn) {
            urlBtn.classList.remove('active');
          }
          if (libBtn) {
            libBtn.classList.add('active');
          }
        }
      }
    }, {
      key: "loadIframeLibrary",
      value: function loadIframeLibrary(root) {
        var ltiConfig = (0, _options.getLti)(this.editor);
        if (ltiConfig && ltiConfig.contentItemUrl) {
          var iframe = root.querySelector(_selectors.default.IFRAME.elements.iframeLibraryFrame);
          var loading = root.querySelector(_selectors.default.IFRAME.elements.iframeLibraryLoading);
          var placeholder = root.querySelector(_selectors.default.IFRAME.elements.iframeLibraryPlaceholder);
          if (placeholder) placeholder.classList.add('d-none');
          if (iframe && !iframe.src) {
            if (loading) loading.classList.remove('d-none');
            iframe.classList.add('d-none');
            iframe.onload = function () {
              if (loading) loading.classList.add('d-none');
              iframe.classList.remove('d-none');
            };
            iframe.src = ltiConfig.contentItemUrl;
          }
        }
      }
    }, {
      key: "handleIframeLibraryMessage",
      value: function handleIframeLibraryMessage(root, event) {
        var data = event.data;
        if (!data) return;
        var embedUrl = null;
        var videoId = null;

        // LTI Deep Linking Response
        if (data.type === 'ltiDeepLinkingResponse' || data.messageType === 'LtiDeepLinkingResponse') {
          var items = data.content_items || data.contentItems || [];
          if (items.length) {
            embedUrl = items[0].url || items[0].embed_url;
            if (embedUrl) {
              var parsed = this.parseInput(embedUrl);
              if (parsed) videoId = parsed.videoId;
            }
          }
        }

        // MediaCMS custom message
        if (data.action === 'selectMedia' || data.type === 'videoSelected') {
          embedUrl = data.embedUrl || data.url;
          videoId = data.mediaId || data.videoId || data.id;
        }
        if (videoId) {
          var mediaCMSUrl = (0, _options.getMediaCMSUrl)(this.editor);
          if (mediaCMSUrl) {
            var viewUrl = "".concat(mediaCMSUrl, "/view?m=").concat(videoId);
            var urlInput = root.querySelector(_selectors.default.IFRAME.elements.url);
            if (urlInput) {
              urlInput.value = viewUrl;
              this.updatePreview(root);
              this.switchToTab(root, 'url');
            }
          }
        }
      }
    }, {
      key: "handleDialogueSubmission",
      value: function () {
        var _handleDialogueSubmission = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(modal) {
          var root, values, html;
          return _regenerator().w(function (_context6) {
            while (1) switch (_context6.n) {
              case 0:
                root = modal.getRoot()[0];
                values = this.getFormValues(root);
                _context6.n = 1;
                return this.generateIframeHtml(values);
              case 1:
                html = _context6.v;
                if (html) {
                  this.editor.insertContent(html);
                }
                modal.hide();
              case 2:
                return _context6.a(2);
            }
          }, _callee6, this);
        }));
        function handleDialogueSubmission(_x5) {
          return _handleDialogueSubmission.apply(this, arguments);
        }
        return handleDialogueSubmission;
      }()
    }]);
  }();
});