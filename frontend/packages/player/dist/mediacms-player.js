(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global['mediacms-player'] = factory());
}(this, (function () { 'use strict';

  function _typeof(obj) {
    "@babel/helpers - typeof";

    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
      _typeof = function (obj) {
        return typeof obj;
      };
    } else {
      _typeof = function (obj) {
        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
      };
    }

    return _typeof(obj);
  }

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  var mediacmsVjsPlugin = {exports: {}};

  (function (module, exports) {
  (function (global, factory) {
    module.exports = factory() ;
  })(commonjsGlobal, function () {
    function _typeof(obj) {
      "@babel/helpers - typeof";
      if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
        _typeof = function (obj) {
          return typeof obj;
        };
      } else {
        _typeof = function (obj) {
          return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
        };
      }
      return _typeof(obj);
    }
    function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
        throw new TypeError("Cannot call a class as a function");
      }
    }
    function _defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }
    function _createClass(Constructor, protoProps, staticProps) {
      if (protoProps) _defineProperties(Constructor.prototype, protoProps);
      if (staticProps) _defineProperties(Constructor, staticProps);
      return Constructor;
    }
    function _defineProperty(obj, key, value) {
      if (key in obj) {
        Object.defineProperty(obj, key, {
          value: value,
          enumerable: true,
          configurable: true,
          writable: true
        });
      } else {
        obj[key] = value;
      }
      return obj;
    }
    function _inherits(subClass, superClass) {
      if (typeof superClass !== "function" && superClass !== null) {
        throw new TypeError("Super expression must either be null or a function");
      }
      subClass.prototype = Object.create(superClass && superClass.prototype, {
        constructor: {
          value: subClass,
          writable: true,
          configurable: true
        }
      });
      if (superClass) _setPrototypeOf(subClass, superClass);
    }
    function _getPrototypeOf(o) {
      _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
        return o.__proto__ || Object.getPrototypeOf(o);
      };
      return _getPrototypeOf(o);
    }
    function _setPrototypeOf(o, p) {
      _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
        o.__proto__ = p;
        return o;
      };
      return _setPrototypeOf(o, p);
    }
    function _isNativeReflectConstruct() {
      if (typeof Reflect === "undefined" || !Reflect.construct) return false;
      if (Reflect.construct.sham) return false;
      if (typeof Proxy === "function") return true;
      try {
        Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {}));
        return true;
      } catch (e) {
        return false;
      }
    }
    function _assertThisInitialized(self) {
      if (self === void 0) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
      }
      return self;
    }
    function _possibleConstructorReturn(self, call) {
      if (call && (typeof call === "object" || typeof call === "function")) {
        return call;
      }
      return _assertThisInitialized(self);
    }
    function _createSuper(Derived) {
      var hasNativeReflectConstruct = _isNativeReflectConstruct();
      return function _createSuperInternal() {
        var Super = _getPrototypeOf(Derived),
            result;
        if (hasNativeReflectConstruct) {
          var NewTarget = _getPrototypeOf(this).constructor;
          result = Reflect.construct(Super, arguments, NewTarget);
        } else {
          result = Super.apply(this, arguments);
        }
        return _possibleConstructorReturn(this, result);
      };
    }
    var version = "0.9.0";
    var Plugin = null;
    function generatePlugin() {
      var videojsComponent = videojs.getComponent('Component');
      var videojsClickableComponent = videojs.getComponent('ClickableComponent');
      var videojsComponentButton = videojs.getComponent('Button');
      var __MediaCMSComponent__ = videojs.extend(videojsComponent, {
        constructor: function constructor() {
          videojsComponent.apply(this, arguments);
          this.setAttribute('class', this.buildCSSClass());
        },
        buildCSSClass: function buildCSSClass() {
          return '';
        }
      });
      var __MediaCMSButtonClickableComponent__ = videojs.extend(videojsClickableComponent, {
        buildCSSClass: function buildCSSClass() {
          return '';
        }
      });
      var __SettingsPanelComponent__ = composeAndExtendCustomComp('vjs-settings-panel');
      var __SettingsPanelInnerComponent__ = composeAndExtendCustomComp('vjs-settings-panel-inner');
      var __SettingsPanelTitleComponent__ = composeAndExtendCustomComp('vjs-setting-panel-title');
      var __SettingsMenuComponent__ = composeAndExtendCustomComp('vjs-settings-menu');
      var __SettingsMenuItemComponent__ = videojsComposeAndExtendCustomComp(__MediaCMSButtonClickableComponent__, 'vjs-settings-menu-item');
      var __SettingsMenuItemLabelComponent__ = composeAndExtendCustomComp('vjs-setting-menu-item-label');
      var __SettingsMenuItemContentComponent__ = composeAndExtendCustomComp('vjs-setting-menu-item-content');
      function composeCustomCompMethods(ret, extnd, innerHtml, extraCSSClass, htmlAttr) {
        var innerHtmlIsHTMLElement = !!innerHtml && innerHtml.nodeType === 1;
        if (!innerHtmlIsHTMLElement) {
          switch (_typeof(innerHtml)) {
            case 'string':
              innerHtml = innerHtml.trim();
              innerHtml = '' === innerHtml ? null : innerHtml;
              break;
            case 'number':
              innerHtml = innerHtml.toString();
              break;
            default:
              innerHtml = null;
          }
        }
        switch (_typeof(extraCSSClass)) {
          case 'string':
            extraCSSClass = extraCSSClass.trim();
            extraCSSClass = '' === extraCSSClass ? null : extraCSSClass;
            break;
          default:
            extraCSSClass = null;
        }
        if (!htmlAttr || !Object.keys(htmlAttr).length) {
          htmlAttr = null;
        }
        if (innerHtml || htmlAttr) {
          ret.constructor = function () {
            extnd.apply(this, arguments);
            var k;
            if (innerHtml) {
              if (innerHtmlIsHTMLElement) {
                this.el_.appendChild(innerHtml);
              } else {
                this.el_.innerHTML = innerHtml;
              }
            }
            if (htmlAttr) {
              for (k in htmlAttr) {
                if (htmlAttr.hasOwnProperty(k)) {
                  this.el_.setAttribute(k, htmlAttr[k]);
                }
              }
            }
          };
        }
        if (extraCSSClass) {
          ret.buildCSSClass = function () {
            return extraCSSClass + ' ' + extnd.prototype.buildCSSClass.call(this);
          };
        }
      }
      function videosjsExtendCustomComp(parent, methods) {
        return videojs.extend(parent, methods);
      }
      function videosjsFormatExtendObj(parent, methods) {
        return {
          extend: parent,
          methods: methods
        };
      }
      function videojsComposeAndExtendCustomComp(extnd, extraCSSClass, innerHtml, htmlAttr) {
        var ret = {};
        composeCustomCompMethods(ret, extnd, innerHtml, extraCSSClass, htmlAttr);
        return videosjsExtendCustomComp(extnd, ret);
      }
      function composeCustomComp(extnd, extraCSSClass, innerHtml, htmlAttr) {
        var ret = {};
        composeCustomCompMethods(ret, extnd, innerHtml, extraCSSClass, htmlAttr);
        return videosjsFormatExtendObj(extnd, ret);
      }
      function composeAndExtendCustomComp(extraCSSClass, innerHtml, htmlAttr) {
        return videojsComposeAndExtendCustomComp(__MediaCMSComponent__, extraCSSClass, innerHtml, htmlAttr);
      }
      function generateControlBarComponents(pluginInstanceRef) {
        function childrenGen(parentKey, child, allComps, parentsConn, level) {
          var k,
              addedChild = false;
          allComps[level] = void 0 === allComps[level] ? [] : allComps[level];
          for (k in child) {
            if (child.hasOwnProperty(k)) {
              if (child[k] && child[k].children) {
                if (childrenGen(k, child[k].children, allComps, parentsConn, level + 1)) {
                  addedChild = true;
                  allComps[level].push(k);
                  parentsConn[k] = parentKey;
                }
              } else {
                addedChild = true;
                allComps[level].push(k);
                parentsConn[k] = parentKey;
              }
            }
          }
          return addedChild;
        }
        function gen(parent, ControlBar) {
          var componentsToAppend = [],
              parentsConnections = {},
              appendedComponents = {};
          var i, j, prnt;
          if (parent.children) {
            childrenGen('controlBar', parent.children, componentsToAppend, parentsConnections, 0);
            i = 0;
            while (i < componentsToAppend.length) {
              j = 0;
              while (j < componentsToAppend[i].length) {
                prnt = 0 === i ? pluginInstanceRef.player.getChild(parentsConnections[componentsToAppend[i][j]]) : appendedComponents[parentsConnections[componentsToAppend[i][j]]];
                prnt.addChild(componentsToAppend[i][j], {});
                appendedComponents[componentsToAppend[i][j]] = prnt.getChild(componentsToAppend[i][j]);
                j++;
              }
              i++;
            }
          }
        }
        return gen;
      }
      function generateTouchControlComponents(pluginInstanceRef, options) {
        if (options.enabledTouchControls) {
          var TouchControls, TouchControlsInner, TouchPrevious, TouchPlay, TouchNext;
          var previousButton = composeCustomComp(videojsComponentButton, 'vjs-icon-previous-item');
          var playButton = composeCustomComp(videojsComponentButton, 'vjs-icon-play');
          var nextButton = composeCustomComp(videojsComponentButton, 'vjs-icon-next-item');
          playButton.methods.handleClick = function (ev) {
            if (this.player_.paused()) {
              this.player_.play();
              setTimeout(function () {
                this.player_.userActive(false);
              }.bind(this), 250);
            } else {
              this.player_.pause();
            }
          };
          if (options.controlBar.next) {
            nextButton.methods.handleClick = function (ev) {
              this.player_.trigger('clicked_next_button');
            };
          }
          if (options.controlBar.previous) {
            previousButton.methods.handleClick = function (ev) {
              this.player_.trigger('clicked_previous_button');
            };
          }
          videojs.registerComponent('TouchControls', videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-touch-controls').methods));
          videojs.registerComponent('TouchControlsInner', videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__).methods));
          videojs.registerComponent('TouchPreviousButton', videojs.extend(previousButton.extend, previousButton.methods));
          videojs.registerComponent('TouchPlayButton', videojs.extend(playButton.extend, playButton.methods));
          videojs.registerComponent('TouchNextButton', videojs.extend(nextButton.extend, nextButton.methods));
          videojs.registerComponent('TouchPlay', videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-touch-play-button').methods));
          if (options.controlBar.next || options.controlBar.previous) {
            videojs.registerComponent('TouchPrevious', videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-touch-previous-button' + (!options.controlBar.previous ? ' vjs-touch-disabled-button' : '')).methods));
            videojs.registerComponent('TouchNext', videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-touch-next-button' + (!options.controlBar.next ? ' vjs-touch-disabled-button' : '')).methods));
          } else {
            videojs.registerComponent('TouchPrevious', videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-touch-previous-button' + (!options.controlBar.previous ? ' vjs-touch-hidden-button' : '')).methods));
            videojs.registerComponent('TouchNext', videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-touch-next-button' + (!options.controlBar.next ? ' vjs-touch-hidden-button' : '')).methods));
          }
          pluginInstanceRef.player.addChild('TouchControls');
          TouchControls = pluginInstanceRef.player.getChild('TouchControls');
          TouchControls.addChild('TouchControlsInner');
          TouchControlsInner = TouchControls.getChild('TouchControlsInner');
          TouchControlsInner.addChild('TouchPrevious');
          TouchControlsInner.addChild('TouchPlay');
          TouchControlsInner.addChild('TouchNext');
          TouchPrevious = TouchControlsInner.getChild('TouchPrevious');
          TouchPlay = TouchControlsInner.getChild('TouchPlay');
          TouchNext = TouchControlsInner.getChild('TouchNext');
          TouchPrevious.addChild('TouchPreviousButton');
          TouchPlay.addChild('TouchPlayButton');
          TouchNext.addChild('TouchNextButton');
        }
      }
      function generateCornerLayersComponents(pluginInstanceRef, options) {
        var layers = {};
        var compPrefix = 'CornerLayer_';
        var k;
        if (options.cornerLayers.topLeft) {
          layers.topLeft = {
            className: 'vjs-corner-layer vjs-corner-top-left',
            parent: pluginInstanceRef.player,
            content: options.cornerLayers.topLeft
          };
        }
        if (options.cornerLayers.topRight) {
          layers.topRight = {
            className: 'vjs-corner-layer vjs-corner-top-right',
            parent: pluginInstanceRef.player,
            content: options.cornerLayers.topRight
          };
        }
        if (options.cornerLayers.bottomLeft) {
          layers.bottomLeft = {
            className: 'vjs-corner-layer vjs-corner-bottom-left',
            parent: pluginInstanceRef.player,
            content: options.cornerLayers.bottomLeft
          };
        }
        if (options.cornerLayers.bottomRight) {
          layers.bottomRight = {
            className: 'vjs-corner-layer vjs-corner-bottom-right',
            parent: pluginInstanceRef.player,
            content: options.cornerLayers.bottomRight
          };
        }
        for (k in layers) {
          if (layers.hasOwnProperty(k)) {
            if (layers[k].content) {
              videojs.registerComponent(compPrefix + k, videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, layers[k].className, layers[k].content).methods));
              layers[k].parent.addChild(compPrefix + k);
            }
          }
        }
      }
      function generateActionsAnimationsComponents(pluginInstanceRef) {
        videojs.registerComponent('ActionsAnimations', videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-actions-anim', '<span></span>').methods));
        pluginInstanceRef.player.addChild('ActionsAnimations');
      }
      function generateLoadingSpinnerComponent(pluginInstanceRef) {
        pluginInstanceRef.player.removeChild('LoadingSpinner');
        videojs.registerComponent('LoadingSpinner', videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-loading-spinner', '<div class="spinner">\
                        <div class="spinner-container">\
                            <div class="spinner-rotator">\
                                <div class="spinner-left"><div class="spinner-circle"></div></div>\
                                <div class="spinner-right"><div class="spinner-circle"></div></div>\
                            </div>\
                        </div>\
                    </div>').methods));
        pluginInstanceRef.player.addChild('LoadingSpinner');
      }
      function initComponents(pluginInstanceRef, which, struct, args) {
        var k, i;
        var tmp;
        switch (which) {
          case 'bottomBackground':
            struct.bottomBackground = null;
            videojs.registerComponent('BottomBackground', videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-bottom-bg').methods));
            break;
          case 'progressControl':
            struct.progressControl = null;
            break;
          case '__subtitles':
            struct.subtitlesPanel = {
              children: {
                subtitlesPanelInner: {
                  children: {
                    subtitlesMenuTitle: null,
                    subtitlesMenu: {
                      children: {}
                    }
                  }
                }
              }
            };
            tmp = composeCustomComp(__SettingsPanelComponent__, 'vjs-subtitles-panel');
            tmp.methods.constructor = function () {
              videojsComponent.apply(this, arguments);
              this.setAttribute('class', this.buildCSSClass());
              var that = this;
              function onFocusout(ev) {
                if (that.el_.contains(ev.relatedTarget)) {
                  return;
                }
                that.player_.trigger('focusoutSubtitlesPanel');
              }
              pluginInstanceRef.on(this.player_, ['updatedSubtitlesPanelsVisibility'], function () {
                videojs.dom[this.state.isOpenSubtitlesOptions ? 'addClass' : 'removeClass'](that.el_, 'vjs-visible-panel');
              });
              pluginInstanceRef.on(this.player_, ['openedSubtitlesPanel'], function (ev, openedFromKeyboard) {
                that.el_.setAttribute('tabindex', '-1');
                that.el_.addEventListener('focusout', onFocusout);
                if (!!openedFromKeyboard) {
                  that.el_.querySelector('.vjs-settings-menu-item').focus();
                } else {
                  that.el_.focus();
                }
              });
              pluginInstanceRef.on(this.player_, ['closedSubtitlesPanel'], function (ev, closedFromKeyboard) {
                that.el_.removeAttribute('tabindex');
                that.el_.removeEventListener('focusout', onFocusout);
                if (!!closedFromKeyboard) {
                  that.el_.querySelector('.vjs-settings-menu-item').focus();
                }
              });
            };
            videojs.registerComponent('SubtitlesPanel', videojs.extend(tmp.extend, tmp.methods));
            videojs.registerComponent('SubtitlesPanelInner', videojs.extend(__SettingsPanelInnerComponent__, composeCustomComp(__SettingsPanelInnerComponent__).methods));
            videojs.registerComponent('SubtitlesMenu', videojs.extend(__SettingsMenuComponent__, composeCustomComp(__SettingsMenuComponent__).methods));
            videojs.registerComponent('SubtitlesMenuTitle', videojs.extend(__SettingsPanelTitleComponent__, composeCustomComp(__SettingsPanelTitleComponent__, null, '<span>Subtitles</span>').methods));
            i = 0;
            while (i < args.options.subtitles.languages.length) {
              k = args.options.subtitles.languages[i];
              struct.subtitlesPanel.children.subtitlesPanelInner.children.subtitlesMenu.children['subtitleOption_' + k.srclang] = {
                children: _defineProperty({}, 'subtitleOption_' + k.srclang + '_content', null)
              };
              (function (key, title) {
                tmp = composeCustomComp(__SettingsMenuItemComponent__, key === pluginInstanceRef.state.theSelectedSubtitleOption ? 'vjs-selected-menu-item' : null, null);
                tmp.methods.constructor = function () {
                  __SettingsMenuItemComponent__.apply(this, arguments);
                  this.subtitleKey = key;
                  var that = this;
                  this.setAttribute('data-opt', key);
                  pluginInstanceRef.on(this.player_, ['updatedSelectedSubtitleOption'], function () {
                    if (that.subtitleKey === this.state.theSelectedSubtitleOption) {
                      videojs.dom.addClass(that.el_, 'vjs-selected-menu-item');
                    } else {
                      videojs.dom.removeClass(that.el_, 'vjs-selected-menu-item');
                    }
                  });
                };
                tmp.methods.handleClick = function () {
                  this.player_.trigger('selectedSubtitleOption', this.el_.getAttribute('data-opt'));
                };
                videojs.registerComponent('SubtitleOption_' + key, videojs.extend(tmp.extend, tmp.methods));
                tmp = composeCustomComp(__SettingsMenuItemContentComponent__, null, title);
                videojs.registerComponent('SubtitleOption_' + key + '_content', videojs.extend(tmp.extend, tmp.methods));
              })(k.srclang, k.label);
              i += 1;
            }
            break;
          case '__settings':
            struct.settingsPanel = {
              children: {
                settingsPanelInner: {
                  children: {
                    settingsMenu: {
                      children: {}
                    }
                  }
                }
              }
            };
            tmp = composeCustomComp(__SettingsPanelComponent__, 'vjs-settings-root');
            tmp.methods.constructor = function () {
              videojsComponent.apply(this, arguments);
              this.setAttribute('class', this.buildCSSClass());
              var that = this;
              function onFocusout(ev) {
                if (that.el_.contains(ev.relatedTarget)) {
                  return;
                }
                that.player_.trigger('focusoutSettingsPanel');
              }
              pluginInstanceRef.on(this.player_, ['updatedSettingsPanelsVisibility'], function () {
                videojs.dom[this.state.isOpenSettingsOptions ? 'addClass' : 'removeClass'](that.el_, 'vjs-visible-panel');
              });
              pluginInstanceRef.on(this.player_, ['openedSettingsPanel'], function (ev, openedFromKeyboard) {
                that.el_.setAttribute('tabindex', '-1');
                that.el_.addEventListener('focusout', onFocusout);
                if (!!openedFromKeyboard) {
                  that.el_.querySelector('.vjs-settings-menu-item').focus();
                } else {
                  that.el_.focus();
                }
              });
              pluginInstanceRef.on(this.player_, ['closedSettingsPanel'], function (ev, closedFromKeyboard) {
                that.el_.removeAttribute('tabindex');
                that.el_.removeEventListener('focusout', onFocusout);
                if (!!closedFromKeyboard) {
                  that.el_.querySelector('.vjs-settings-menu-item').focus();
                }
              });
            };
            videojs.registerComponent('SettingsPanel', videojs.extend(tmp.extend, tmp.methods));
            videojs.registerComponent('SettingsPanelInner', videojs.extend(__SettingsPanelInnerComponent__, composeCustomComp(__SettingsPanelInnerComponent__).methods));
            videojs.registerComponent('SettingsMenu', videojs.extend(__SettingsMenuComponent__, composeCustomComp(__SettingsMenuComponent__).methods));
            if (args.enabledPlaybackSpeedPanel) {
              struct.settingsPanel.children.settingsPanelInner.children.settingsMenu.children.selectedPlaybackSpeed = {
                children: {
                  selectedPlaybackSpeedLabel: null,
                  selectedPlaybackSpeedContent: null
                }
              };
              tmp = composeCustomComp(__SettingsMenuItemComponent__, 'vjs-selected-speed');
              tmp.methods.handleClick = function (ev) {
                this.player_.trigger('openPlaybackSpeedOptions', !ev.screenX && !ev.screenY);
              };
              videojs.registerComponent('SelectedPlaybackSpeed', videojs.extend(tmp.extend, tmp.methods));
              videojs.registerComponent('SelectedPlaybackSpeedLabel', videojs.extend(__SettingsMenuItemLabelComponent__, composeCustomComp(__SettingsMenuItemLabelComponent__, null, 'Playback speed').methods));
              tmp = composeCustomComp(__SettingsMenuItemContentComponent__, null, args.selectedPlaybackSpeed);
              tmp.methods.constructor = function () {
                videojsComponent.apply(this, arguments);
                var that = this;
                that.el_.innerHTML = pluginInstanceRef.selectedPlaybackSpeedTitle();
                this.setAttribute('class', this.buildCSSClass());
                pluginInstanceRef.on(this.player_, ['updatedSelectedPlaybackSpeed'], function () {
                  that.el_.innerHTML = this.selectedPlaybackSpeedTitle();
                });
              };
              videojs.registerComponent('SelectedPlaybackSpeedContent', videojs.extend(tmp.extend, tmp.methods));
            }
            if (args.enabledResolutionsPanel) {
              struct.settingsPanel.children.settingsPanelInner.children.settingsMenu.children.selectedResolution = {
                children: {
                  selectedResolutionLabel: null,
                  selectedResolutionContent: null
                }
              };
              tmp = composeCustomComp(__SettingsMenuItemComponent__, 'vjs-selected-quality');
              tmp.methods.handleClick = function (ev) {
                this.player_.trigger('openQualityOptions', !ev.screenX && !ev.screenY);
              };
              videojs.registerComponent('SelectedResolution', videojs.extend(tmp.extend, tmp.methods));
              videojs.registerComponent('SelectedResolutionLabel', videojs.extend(__SettingsMenuItemLabelComponent__, composeCustomComp(__SettingsMenuItemLabelComponent__, null, 'Quality').methods));
              tmp = composeCustomComp(__SettingsMenuItemContentComponent__, null, args.selectedResolution);
              tmp.methods.constructor = function () {
                videojsComponent.apply(this, arguments);
                var that = this;
                that.el_.innerHTML = args.selectedResolution;
                this.setAttribute('class', this.buildCSSClass());
                pluginInstanceRef.on(this.player_, ['updatedSelectedQuality'], function () {
                  that.el_.innerHTML = this.selectedQualityTitle();
                });
              };
              videojs.registerComponent('SelectedResolutionContent', videojs.extend(tmp.extend, tmp.methods));
            }
            break;
          case '__resolution':
            struct.resolutionsPanel = {
              children: {
                resolutionsPanelInner: {
                  children: {
                    resolutionsMenuTitle: {
                      children: {
                        resolutionsMenuBackButton: null
                      }
                    },
                    resolutionsMenu: {
                      children: {}
                    }
                  }
                }
              }
            };
            tmp = composeCustomComp(__SettingsPanelComponent__, 'vjs-resolutions-panel');
            tmp.methods.constructor = function () {
              videojsComponent.apply(this, arguments);
              this.setAttribute('class', this.buildCSSClass());
              var that = this;
              function onFocusout(ev) {
                if (that.el_.contains(ev.relatedTarget)) {
                  return;
                }
                that.player_.trigger('focusoutResolutionsPanel');
              }
              pluginInstanceRef.on(this.player_, ['updatedSettingsPanelsVisibility'], function () {
                videojs.dom[this.state.isOpenQualityOptions ? 'addClass' : 'removeClass'](that.el_, 'vjs-visible-panel');
              });
              pluginInstanceRef.on(this.player_, ['openedQualities'], function (ev, openedFromKeyboard) {
                that.el_.setAttribute('tabindex', '-1');
                that.el_.addEventListener('focusout', onFocusout);
                if (!!openedFromKeyboard) {
                  that.el_.querySelector('.vjs-setting-panel-title > *[role="button"]').focus();
                } else {
                  that.el_.focus();
                }
              });
              pluginInstanceRef.on(this.player_, ['closedQualities'], function (ev, closedFromKeyboard) {
                that.el_.removeAttribute('tabindex');
                that.el_.removeEventListener('focusout', onFocusout);
                if (!!closedFromKeyboard) {
                  that.el_.querySelector('.vjs-settings-menu-item').focus();
                }
              });
            };
            videojs.registerComponent('ResolutionsPanel', videojs.extend(tmp.extend, tmp.methods));
            videojs.registerComponent('ResolutionsPanelInner', videojs.extend(__SettingsPanelInnerComponent__, composeCustomComp(__SettingsPanelInnerComponent__).methods));
            videojs.registerComponent('ResolutionsMenu', videojs.extend(__SettingsMenuComponent__, composeCustomComp(__SettingsMenuComponent__).methods));
            videojs.registerComponent('ResolutionsMenuTitle', videojs.extend(__SettingsPanelTitleComponent__, composeCustomComp(__SettingsPanelTitleComponent__, 'vjs-settings-back').methods));
            tmp = composeCustomComp(__MediaCMSButtonClickableComponent__, null, 'Quality');
            tmp.methods.handleClick = function (ev) {
              this.player_.trigger('closeQualityOptions', !ev.screenX && !ev.screenY);
            };
            videojs.registerComponent('ResolutionsMenuBackButton', videojs.extend(tmp.extend, tmp.methods));
            var resolutionKeys = function () {
              var i;
              var ret = [];
              var keys = Object.keys(args.resolutions);
              var stringKeys = [];
              var numericKeys = [];
              i = 0;
              while (i < keys.length) {
                if (isNaN(0 + keys[i])) {
                  stringKeys.push(keys[i]);
                } else {
                  numericKeys.push([parseFloat(keys[i]), keys[i]]);
                }
                i += 1;
              }
              numericKeys.sort(function (a, b) {
                return b[0] - a[0];
              });
              i = 0;
              while (i < numericKeys.length) {
                ret.push(numericKeys[i][1]);
                i += 1;
              }
              i = 0;
              while (i < stringKeys.length) {
                ret.push(stringKeys[i]);
                i += 1;
              }
              return ret;
            }();
            i = 0;
            while (i < resolutionKeys.length) {
              k = resolutionKeys[i];
              struct.resolutionsPanel.children.resolutionsPanelInner.children.resolutionsMenu.children['resolutionOption_' + k] = {
                children: _defineProperty({}, 'resolutionOption_' + k + '_content', null)
              };
              (function (key, title) {
                tmp = composeCustomComp(__SettingsMenuItemComponent__, key.toString() === pluginInstanceRef.state.theSelectedQuality.toString() ? 'vjs-selected-menu-item' : null, null);
                tmp.methods.constructor = function () {
                  __SettingsMenuItemComponent__.apply(this, arguments);
                  var that = this;
                  this.qualityKey = key;
                  this.setAttribute('data-opt', key);
                  pluginInstanceRef.on(this.player_, ['updatedSelectedQuality'], function () {
                    videojs.dom[that.qualityKey === this.state.theSelectedQuality ? 'addClass' : 'removeClass'](that.el_, 'vjs-selected-menu-item');
                  });
                };
                tmp.methods.handleClick = function () {
                  this.player_.trigger('selectedQuality', this.el_.getAttribute('data-opt'));
                };
                videojs.registerComponent('ResolutionOption_' + key, videojs.extend(tmp.extend, tmp.methods));
                tmp = composeCustomComp(__SettingsMenuItemContentComponent__, null, title);
                videojs.registerComponent('ResolutionOption_' + key + '_content', videojs.extend(tmp.extend, tmp.methods));
              })(k, args.resolutions[k].title || k);
              i += 1;
            }
            break;
          case '__playbackSpeed':
            struct.playbackSpeedsPanel = {
              children: {
                playbackSpeedsPanelInner: {
                  children: {
                    playbackSpeedsMenuTitle: {
                      children: {
                        playbackSpeedsMenuBackButton: null
                      }
                    },
                    playbackSpeedsMenu: {
                      children: {}
                    }
                  }
                }
              }
            };
            tmp = composeCustomComp(__SettingsPanelComponent__, 'vjs-playback-speed-panel');
            tmp.methods.constructor = function () {
              videojsComponent.apply(this, arguments);
              this.setAttribute('class', this.buildCSSClass());
              var that = this;
              function onFocusout(ev) {
                if (that.el_.contains(ev.relatedTarget)) {
                  return;
                }
                that.player_.trigger('focusoutPlaybackSpeedsPanel');
              }
              pluginInstanceRef.on(this.player_, ['updatedSettingsPanelsVisibility'], function () {
                videojs.dom[this.state.isOpenPlaybackSpeedOptions ? 'addClass' : 'removeClass'](that.el_, 'vjs-visible-panel');
              });
              pluginInstanceRef.on(this.player_, ['openedPlaybackSpeeds'], function (ev, openedFromKeyboard) {
                that.el_.setAttribute('tabindex', '-1');
                that.el_.addEventListener('focusout', onFocusout);
                if (!!openedFromKeyboard) {
                  that.el_.querySelector('.vjs-setting-panel-title > *[role="button"]').focus();
                } else {
                  that.el_.focus();
                }
              });
              pluginInstanceRef.on(this.player_, ['closedPlaybackSpeeds'], function (ev, closedFromKeyboard) {
                that.el_.removeAttribute('tabindex');
                that.el_.removeEventListener('focusout', onFocusout);
                if (!!closedFromKeyboard) {
                  that.el_.querySelector('.vjs-settings-menu-item').focus();
                }
              });
            };
            videojs.registerComponent('PlaybackSpeedsPanel', videojs.extend(tmp.extend, tmp.methods));
            videojs.registerComponent('PlaybackSpeedsPanelInner', videojs.extend(__SettingsPanelInnerComponent__, composeCustomComp(__SettingsPanelInnerComponent__).methods));
            videojs.registerComponent('PlaybackSpeedsMenu', videojs.extend(__SettingsMenuComponent__, composeCustomComp(__SettingsMenuComponent__).methods));
            videojs.registerComponent('PlaybackSpeedsMenuTitle', videojs.extend(__SettingsPanelTitleComponent__, composeCustomComp(__SettingsPanelTitleComponent__, 'vjs-settings-back').methods));
            tmp = composeCustomComp(__MediaCMSButtonClickableComponent__, null, 'Playback speed');
            tmp.methods.handleClick = function (ev) {
              this.player_.trigger('closePlaybackSpeedOptions', !ev.screenX && !ev.screenY);
            };
            videojs.registerComponent('PlaybackSpeedsMenuBackButton', videojs.extend(tmp.extend, tmp.methods));
            for (k in args.playbackSpeeds) {
              if (args.playbackSpeeds.hasOwnProperty(k)) {
                struct.playbackSpeedsPanel.children.playbackSpeedsPanelInner.children.playbackSpeedsMenu.children['playbackSpeedOption_' + args.playbackSpeeds[k].speed] = {
                  children: _defineProperty({}, 'playbackSpeedOption_' + args.playbackSpeeds[k].speed + '_content', null)
                };
                (function (key, title) {
                  tmp = composeCustomComp(__SettingsMenuItemComponent__, key.toString() === pluginInstanceRef.state.theSelectedPlaybackSpeed.toString() ? 'vjs-selected-menu-item' : null, null);
                  tmp.methods.constructor = function () {
                    __SettingsMenuItemComponent__.apply(this, arguments);
                    var that = this;
                    this.playbackSpeedKey = key;
                    this.setAttribute('data-opt', key);
                    pluginInstanceRef.on(this.player_, ['updatedSelectedPlaybackSpeed'], function () {
                      videojs.dom[that.playbackSpeedKey === this.state.theSelectedPlaybackSpeed ? 'addClass' : 'removeClass'](that.el_, 'vjs-selected-menu-item');
                    });
                  };
                  tmp.methods.handleClick = function () {
                    this.player_.trigger('selectedPlaybackSpeed', this.el_.getAttribute('data-opt'));
                  };
                  videojs.registerComponent('PlaybackSpeedOption_' + key, videojs.extend(tmp.extend, tmp.methods));
                  tmp = composeCustomComp(__SettingsMenuItemContentComponent__, null, title);
                  videojs.registerComponent('PlaybackSpeedOption_' + key + '_content', videojs.extend(tmp.extend, tmp.methods));
                })(args.playbackSpeeds[k].speed, args.playbackSpeeds[k].title || k);
              }
            }
            break;
          case '__leftControls':
            struct.leftControls = {
              children: {}
            };
            if (args.options.controlBar.previous) {
              tmp = composeCustomComp(videojsComponentButton, 'vjs-previous-button');
              tmp.methods.handleClick = function (ev) {
                this.player_.trigger('clicked_previous_button');
              };
              videojs.registerComponent('PreviousButton', videojs.extend(tmp.extend, tmp.methods));
              struct.leftControls.children.previousButton = null;
            }
            if (args.options.controlBar.play) {
              struct.leftControls.children.playToggle = null;
            }
            if (args.options.controlBar.next) {
              tmp = composeCustomComp(videojsComponentButton, 'vjs-next-button');
              tmp.methods.handleClick = function (ev) {
                this.player_.trigger('clicked_next_button');
              };
              videojs.registerComponent('NextButton', videojs.extend(tmp.extend, tmp.methods));
              struct.leftControls.children.nextButton = null;
            }
            if (args.options.controlBar.volume) {
              struct.leftControls.children.volumePanel = null;
            }
            if (args.options.controlBar.time) {
              struct.leftControls.children.currentTimeDisplay = null;
              struct.leftControls.children.timeDivider = null;
              struct.leftControls.children.durationDisplay = null;
            }
            videojs.registerComponent('LeftControls', videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-left-controls').methods));
            break;
          case '__rightControls':
            struct.rightControls = {
              children: {}
            };
            if (args.options.subtitles) {
              struct.rightControls.children.subtitlesToggle = null;
            }
            if (args.enabledSettingsPanel) {
              struct.rightControls.children.settingsToggle = null;
            }
            if (args.options.controlBar.theaterMode) {
              struct.rightControls.children.theaterModeToggle = null;
            }
            if (args.options.controlBar.pictureInPicture) {
              struct.rightControls.children.pictureInPictureToggle = null;
            }
            if (args.options.controlBar.fullscreen) {
              struct.rightControls.children.fullscreenToggle = null;
            }
            videojs.registerComponent('RightControls', videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-right-controls').methods));
            if (args.options.subtitles) {
              tmp = composeCustomComp(videojsComponentButton, 'vjs-subtitles-control');
              tmp.methods.handleClick = function (ev) {
                this.player_.trigger(pluginInstanceRef.state.isOpenSubtitlesOptions ? 'closeSubtitlesPanel' : 'openSubtitlesPanel', !ev.screenX && !ev.screenY);
              };
              videojs.registerComponent('SubtitlesToggle', videojs.extend(tmp.extend, tmp.methods));
            }
            if (args.enabledSettingsPanel) {
              tmp = composeCustomComp(videojsComponentButton, 'vjs-settings-control vjs-icon-cog');
              tmp.methods.handleClick = function (ev) {
                this.player_.trigger(pluginInstanceRef.state.isOpenSettingsOptions ? 'closeSettingsPanel' : 'openSettingsPanel', !ev.screenX && !ev.screenY);
              };
              videojs.registerComponent('SettingsToggle', videojs.extend(tmp.extend, tmp.methods));
            }
            if (args.options.controlBar.theaterMode) {
              tmp = composeCustomComp(videojsComponentButton, 'vjs-theater-mode-control');
              tmp.methods.handleClick = function () {
                this.player_.trigger('theatermodechange');
                this.updateControlText();
              };
              tmp.methods.updateControlText = function () {
                this.controlText(this.player_.localize(pluginInstanceRef.isTheaterMode() ? 'Default mode' : 'Theater mode'));
              };
              videojs.registerComponent('TheaterModeToggle', videojs.extend(tmp.extend, tmp.methods));
            }
            break;
        }
      }
      function controlBarComponentsStructs(pluginInstanceRef, options) {
        var struct = {};
        var enabledResolutionsPanel = void 0 !== options.resolutions && void 0 !== options.resolutions.options && !!Object.keys(options.resolutions.options).length;
        var enabledPlaybackSpeedPanel = void 0 !== options.playbackSpeeds && void 0 !== options.playbackSpeeds.options && !!Object.keys(options.playbackSpeeds.options).length;
        var enabledSettingsPanel = enabledResolutionsPanel || enabledPlaybackSpeedPanel;
        if (options.controlBar.bottomBackground) {
          initComponents(pluginInstanceRef, 'bottomBackground', struct);
        }
        if (options.controlBar.progress) {
          initComponents(pluginInstanceRef, 'progressControl', struct);
        }
        if (enabledResolutionsPanel) {
          initComponents(pluginInstanceRef, '__resolution', struct, {
            resolutions: options.resolutions.options
          });
        }
        if (enabledPlaybackSpeedPanel) {
          initComponents(pluginInstanceRef, '__playbackSpeed', struct, {
            playbackSpeeds: options.playbackSpeeds.options
          });
        }
        if (options.subtitles) {
          initComponents(pluginInstanceRef, '__subtitles', struct, {
            options: options
          });
        }
        if (enabledSettingsPanel) {
          if (enabledResolutionsPanel && enabledPlaybackSpeedPanel) {
            initComponents(pluginInstanceRef, '__settings', struct, {
              enabledResolutionsPanel: enabledResolutionsPanel,
              selectedResolution: enabledResolutionsPanel ? options.resolutions.default : null,
              enabledPlaybackSpeedPanel: enabledPlaybackSpeedPanel,
              selectedPlaybackSpeed: enabledPlaybackSpeedPanel ? options.playbackSpeeds.default : null
            });
          } else if (enabledResolutionsPanel) {
            initComponents(pluginInstanceRef, '__settings', struct, {
              enabledResolutionsPanel: enabledResolutionsPanel,
              selectedResolution: enabledResolutionsPanel ? options.resolutions.default : null
            });
          } else if (enabledPlaybackSpeedPanel) {
            initComponents(pluginInstanceRef, '__settings', struct, {
              enabledPlaybackSpeedPanel: enabledPlaybackSpeedPanel,
              selectedPlaybackSpeed: enabledPlaybackSpeedPanel ? options.playbackSpeeds.default : null
            });
          }
        }
        if (options.controlBar.play || options.controlBar.previous || options.controlBar.next || options.controlBar.volume || options.controlBar.time) {
          initComponents(pluginInstanceRef, '__leftControls', struct, {
            options: options
          });
        }
        if (enabledSettingsPanel || options.subtitles || options.controlBar.theaterMode || options.controlBar.fullscreen || options.controlBar.pictureInPictureToggle) {
          initComponents(pluginInstanceRef, '__rightControls', struct, {
            options: options,
            enabledSettingsPanel: enabledSettingsPanel
          });
        }
        return {
          children: struct
        };
      }
      function setControlBarComponents(pluginInstncRef, options, player) {
        if (isDefined(options) && isDefined(options.controlBar)) {
          generateControlBarComponents(pluginInstncRef)(controlBarComponentsStructs(pluginInstncRef, options), player.getChild('controlBar'));
        }
      }
      function setCornerLayersComponents(pluginInstncRef, options) {
        if (isDefined(options)) {
          generateCornerLayersComponents(pluginInstncRef, options);
        }
      }
      function setActionsAnimationsComponents(pluginInstncRef) {
        generateActionsAnimationsComponents(pluginInstncRef);
      }
      function replaceLoadingSpinnerComponent(pluginInstncRef) {
        generateLoadingSpinnerComponent(pluginInstncRef);
      }
      function setTouchControlComponents(pluginInstncRef, options) {
        generateTouchControlComponents(pluginInstncRef, options);
      }
      function centralizeBoxPosition(vw, vh, vr, pw, ph, pr) {
        var ret = {};
        var videoRatio = isDefined(vr) && !isNull(vr) ? vr : vw / vh,
            playerRatio = isDefined(pr) && !isNull(pr) ? pr : pw / ph,
            playerVerticalOrientation = 1 > playerRatio,
            videoVerticalOrientation = 1 > videoRatio;
        if (!playerVerticalOrientation) {
          if (!videoVerticalOrientation) {
            if (videoRatio > playerRatio) {
              if (vw >= pw) {
                ret.w = pw;
                ret.h = ret.w / videoRatio;
              } else {
                ret.w = vw;
                ret.h = vh;
              }
            } else {
              ret.h = vw >= pw ? ph : vh >= ph ? ph : vh;
              ret.w = ret.h * videoRatio;
            }
          } else {
            if (vh >= ph) {
              ret.h = ph;
              ret.w = ret.h * videoRatio;
            } else {
              ret.w = vw;
              ret.h = vh;
            }
          }
        } else if (!videoVerticalOrientation) {
          if (vw >= pw) {
            ret.w = pw;
            ret.h = ret.w / videoRatio;
          } else {
            ret.w = vw;
            ret.h = vh;
          }
        } else {
          if (videoRatio > playerRatio) {
            if (vw >= pw) {
              ret.w = pw;
              ret.h = ret.w / videoRatio;
            } else {
              ret.w = vw;
              ret.h = vh;
            }
          } else if (vw >= pw) {
            ret.h = ph;
            ret.w = ret.h * videoRatio;
          } else if (vh >= ph) {
            ret.h = ph;
            ret.w = ret.h * videoRatio;
          } else {
            ret.w = vw;
            ret.h = vh;
          }
        }
        ret.t = (ph - ret.h) / 2;
        ret.l = (pw - ret.w) / 2;
        return ret;
      }
      function isBoolean(v) {
        return 'boolean' === typeof v || v instanceof Boolean;
      }
      function isDefined(v) {
        return void 0 != v;
      }
      function isNull(v) {
        return null === v;
      }
      function applyCssTransform(elem, val) {
        val = val.replace(/ /g, '');
        elem.style.transform = val;
        elem.style.msTransform = val;
        elem.style.MozTransform = val;
        elem.style.WebkitTransform = val;
        elem.style.OTransform = val;
      }
      function browserSupports_csstransforms() {
        var i,
            v,
            b = document.body || document.documentElement,
            s = b.style,
            p = 'transition';
        if ('string' === typeof s[p]) {
          return true;
        }
        v = ['Moz', 'webkit', 'Webkit', 'Khtml', 'O', 'ms'];
        p = p.charAt(0).toUpperCase() + p.substr(1);
        i = 0;
        while (i < v.length) {
          if ('string' === typeof s[v[i] + p]) {
            return true;
          }
          i += 1;
        }
        return false;
      }
      function browserSupports(type) {
        switch (type) {
          case 'csstransforms':
            return browserSupports_csstransforms();
        }
        return null;
      }
      function extractSupportedAndUsedVideoFormat(defaultSource, defaultResolution, availabeResolutions) {
        if (defaultResolution && availabeResolutions) {
          var x = availabeResolutions[defaultResolution];
          var i = 0;
          while (i < x.src.length) {
            if (defaultSource === x.src[i]) {
              return {
                defaultResolution: defaultResolution,
                format: x.format[i],
                order: i
              };
            }
            i += 1;
          }
        }
        var k, j;
        for (k in availabeResolutions) {
          if (availabeResolutions.hasOwnProperty(k)) {
            j = 0;
            while (j < availabeResolutions[k].src.length) {
              if (defaultSource === availabeResolutions[k].src[j]) {
                while (void 0 === availabeResolutions[k].format[j] && j < availabeResolutions[k].format.length) {
                  j += 1;
                }
                defaultResolution = k;
                j = void 0 === availabeResolutions[k].format[j] ? availabeResolutions[k].format.length - 1 : j;
                return {
                  defaultResolution: k,
                  format: availabeResolutions[k].format[j],
                  order: j
                };
              }
              j += 1;
            }
          }
        }
        return {
          defaultResolution: defaultResolution,
          format: availabeResolutions[defaultResolution].format[0],
          order: 0
        };
      }
      function initElementsFocus(player) {
        var controlBar = player.getChild('controlBar');
        var progressControl = void 0 === controlBar ? controlBar : controlBar.getChild('progressControl');
        var leftControls = void 0 === controlBar ? controlBar : controlBar.getChild('leftControls');
        var rightControls = void 0 === controlBar ? controlBar : controlBar.getChild('rightControls');
        var volumePanel = void 0 === leftControls ? leftControls : leftControls.getChild('volumePanel');
        void 0 === volumePanel ? volumePanel : volumePanel.getChild('volumeControl');
        var elems = {
          playToggle: void 0 === leftControls ? leftControls : leftControls.getChild('playToggle'),
          previousButton: void 0 === leftControls ? leftControls : leftControls.getChild('previousButton'),
          nextButton: void 0 === leftControls ? leftControls : leftControls.getChild('nextButton'),
          muteToggle: void 0 === volumePanel ? volumePanel : volumePanel.getChild('muteToggle'),
          volumeBar: void 0 === volumePanel ? volumePanel : volumePanel.getChild('volumeControl').getChild('volumeBar'),
          subtitlesToggle: void 0 === rightControls ? rightControls : rightControls.getChild('subtitlesToggle'),
          settingsToggle: void 0 === rightControls ? rightControls : rightControls.getChild('settingsToggle'),
          fullscreenToggle: void 0 === rightControls ? rightControls : rightControls.getChild('fullscreenToggle'),
          theaterModeToggle: void 0 === rightControls ? rightControls : rightControls.getChild('theaterModeToggle'),
          pictureInPictureToggle: void 0 === rightControls ? rightControls : rightControls.getChild('PictureInPictureToggle'),
          seekBar: void 0 === progressControl ? progressControl : progressControl.getChild('seekBar')
        };
        if (void 0 !== elems.playToggle) {
          handleElemFocus(player, elems.playToggle.el_);
        }
        if (void 0 !== elems.previousButton) {
          handleElemFocus(player, elems.previousButton.el_);
        }
        if (void 0 !== elems.nextButton) {
          handleElemFocus(player, elems.nextButton.el_);
        }
        if (void 0 !== elems.muteToggle) {
          handleElemFocus(player, elems.muteToggle.el_);
        }
        if (void 0 !== elems.volumeBar) {
          handleElemFocus(player, elems.volumeBar.el_);
        }
        if (void 0 !== elems.subtitlesToggle) {
          handleElemFocus(player, elems.subtitlesToggle.el_);
        }
        if (void 0 !== elems.settingsToggle) {
          handleElemFocus(player, elems.settingsToggle.el_);
        }
        if (void 0 !== elems.fullscreenToggle) {
          handleElemFocus(player, elems.fullscreenToggle.el_);
        }
        if (void 0 !== elems.theaterModeToggle) {
          handleElemFocus(player, elems.theaterModeToggle.el_);
        }
        if (void 0 !== elems.pictureInPictureToggle) {
          handleElemFocus(player, elems.pictureInPictureToggle.el_);
        }
        if (void 0 !== elems.seekBar) {
          handleElemFocus(player, elems.seekBar.el_);
        }
      }
      function handleElemFocus(player, elem) {
        function onFocus(ev) {
          if (!isMouseDown) {
            isKeyboardFocus = true;
            ev.target.setAttribute('key-focus', '');
          }
        }
        function onBlur(ev) {
          if (isKeyboardFocus) {
            isKeyboardFocus = false;
            ev.target.removeAttribute('key-focus');
          }
        }
        var isMouseDown = false;
        var isKeyboardFocus = false;
        elem.addEventListener('blur', onBlur);
        elem.addEventListener('focus', onFocus);
        elem.addEventListener('mouseup', function () {
          isMouseDown = false;
        });
        elem.addEventListener('mousedown', function () {
          isMouseDown = true;
        });
      }
      function videoPreviewThumb(player, options) {
        player.getChild('ControlBar').getChild('ProgressControl').getChild('SeekBar').removeChild('MouseTimeDisplay');
        var halfThumbWidth = -1;
        var defaults = {
          frame: {
            width: 160,
            height: 120
          }
        };
        function extend() {
          var args = Array.prototype.slice.call(arguments);
          var target = args.shift() || {};
          var i, obj, prop;
          for (i in args) {
            obj = args[i];
            for (prop in obj) {
              if (obj.hasOwnProperty(prop)) {
                target[prop] = 'object' === _typeof(obj[prop]) ? extend(target[prop], obj[prop]) : obj[prop];
              }
            }
          }
          return target;
        }
        function getAllComputedStyles(el) {
          return window.getComputedStyle ? window.getComputedStyle(el) : el.currentStyle;
        }
        function getComputedStyle(el, pseudo) {
          return function (prop) {
            return window.getComputedStyle ? window.getComputedStyle(el, pseudo)[prop] : el.currentStyle[prop];
          };
        }
        function offsetParent(el) {
          return 'HTML' !== el.nodeName && 'static' === getComputedStyle(el)('position') ? offsetParent(el.offsetParent) : el;
        }
        function updateDimensions() {
          if (isFullscreen) {
            halfThumbWidth = (innerBorderWidth.left + innerBorderWidth.right + 1.5 * settings.frame.width) / 2;
            spriteDom.inner.style.height = innerBorderWidth.top + innerBorderWidth.bottom + 1.5 * settings.frame.height + 'px';
            spriteDom.inner.style.width = innerBorderWidth.left + innerBorderWidth.right + 1.5 * settings.frame.width + 'px';
          } else {
            halfThumbWidth = (innerBorderWidth.left + innerBorderWidth.right + settings.frame.width) / 2;
            spriteDom.inner.style.height = innerBorderWidth.top + innerBorderWidth.bottom + settings.frame.height + 'px';
            spriteDom.inner.style.width = innerBorderWidth.left + innerBorderWidth.right + settings.frame.width + 'px';
          }
          spriteDom.inner.style.left = -1 * halfThumbWidth + 'px';
        }
        var spriteDom = {
          wrap: document.createElement('div'),
          inner: document.createElement('div'),
          img: document.createElement('img'),
          timeDisplay: document.createElement('div'),
          timeDisplayInner: document.createElement('div')
        };
        var innerBorderWidth = {
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        };
        var progressControl = player.controlBar.childNameIndex_.ProgressControl;
        var progressControlElem;
        progressControl.childNameIndex_.SeekBar;
        var duration = player.duration();
        var isFullscreen = player.isFullscreen();
        var settings = extend({}, defaults, options);
        spriteDom.wrap.className = 'vjs-preview-thumb';
        spriteDom.inner.className = 'vjs-preview-thumb-inner';
        spriteDom.inner.style.backgroundImage = 'url(' + settings.url + ')';
        spriteDom.timeDisplay.className = 'vjs-preview-thumb-time-display';
        spriteDom.timeDisplayInner.innerHTML = '0:00';
        var spriteHeight = 0;
        player.on('durationchange', function (e) {
          duration = player.duration();
        });
        player.on('loadedmetadata', function (e) {
          duration = player.duration();
        });
        player.on('fullscreenchange', function (e) {
          setTimeout(function () {
            isFullscreen = player.isFullscreen();
            updateDimensions();
          }, 100);
        });
        player.one('playing', function (e) {
          updateDimensions();
          player.addClass('vjs-enabled-preview-thumb');
          spriteDom.img.onload = function () {
            var innerStyles = getAllComputedStyles(spriteDom.inner);
            if (void 0 !== innerStyles) {
              innerBorderWidth.top = parseFloat(innerStyles.borderTopWidth);
              innerBorderWidth.left = parseFloat(innerStyles.borderLeftWidth);
              innerBorderWidth.right = parseFloat(innerStyles.borderRightWidth);
              innerBorderWidth.bottom = parseFloat(innerStyles.borderBottomWidth);
            }
            spriteHeight = this.naturalHeight;
            spriteDom.img = void 0;
            updateDimensions();
          };
          spriteDom.img.src = settings.url;
        });
        function moveListener(event) {
          progressControlElem = progressControlElem || progressControl.el();
          var progressControlClientRect = offsetParent(progressControlElem).getBoundingClientRect();
          var pageXOffset = window.pageXOffset ? window.pageXOffset : document.documentElement.scrollLeft;
          var pageX = event.changedTouches ? event.changedTouches[0].pageX : event.pageX;
          var left = (pageX || event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft) - (progressControlClientRect.left + pageXOffset);
          var right = (progressControlClientRect.width || progressControlClientRect.right) + pageXOffset;
          var mouseTime = !spriteHeight ? 0 : Math.min(spriteHeight / settings.frame.height * settings.frame.seconds - 1, Math.floor((left - progressControlElem.offsetLeft) / progressControl.width() * duration));
          spriteDom.timeDisplayInner.innerHTML = videojs.formatTime(duration * (left / right));
          if (left < halfThumbWidth) {
            left = halfThumbWidth;
          } else if (left > right - halfThumbWidth) {
            left = right - halfThumbWidth;
          }
          spriteDom.wrap.style.transform = 'translate(' + Math.min(right - halfThumbWidth, left) + 'px, 0px)';
          spriteDom.inner.style.backgroundPositionY = (isFullscreen ? -1.5 : -1) * settings.frame.height * Math.floor(mouseTime / settings.frame.seconds) + 'px';
        }
        progressControl.on('mouseover', moveListener);
        progressControl.on('mousemove', moveListener);
        spriteDom.timeDisplay.appendChild(spriteDom.timeDisplayInner);
        spriteDom.inner.appendChild(spriteDom.timeDisplay);
        spriteDom.wrap.appendChild(spriteDom.inner);
        progressControl.el_.appendChild(spriteDom.wrap);
      }
      var VideojsPluginClass = videojs.getPlugin('plugin');
      var MediaCmsVjsPlugin = function (_VideojsPluginClass) {
        _inherits(MediaCmsVjsPlugin, _VideojsPluginClass);
        var _super = _createSuper(MediaCmsVjsPlugin);
        function MediaCmsVjsPlugin(player, domElem, options, state, resolutions, playbackSpeeds, stateUpdateCallback, nextButtonClickCallback, previousButtonClickCallback) {
          var _this;
          _classCallCheck(this, MediaCmsVjsPlugin);
          _this = _super.call(this, player, options);
          if (!options.sources.length) {
            console.warn('Missing media source');
            return _possibleConstructorReturn(_this);
          }
          options.enabledTouchControls = !!videojs.TOUCH_ENABLED ? true : options.enabledTouchControls;
          function filterState(st) {
            var ret = {};
            if (st && st instanceof Object && Object.keys(st).length) {
              if (!isNaN(st.volume)) {
                ret.volume = Math.max(Math.min(st.volume, 1), 0);
              }
              if (isBoolean(st.soundMuted)) {
                ret.soundMuted = st.soundMuted;
              }
              if (isBoolean(st.theaterMode)) {
                ret.theaterMode = st.theaterMode;
              }
            }
            if (Object.keys(resolutions).length) {
              var resolutionKeys = Object.keys(resolutions);
              ret.theSelectedQuality = !st || void 0 === st.theSelectedQuality || void 0 === resolutions[st.theSelectedQuality] ? resolutionKeys[Math.floor(resolutionKeys.length / 2)] : st.theSelectedQuality;
            }
            if (Object.keys(playbackSpeeds).length) {
              if (!!st.theSelectedPlaybackSpeed) {
                var k;
                st.theSelectedPlaybackSpeed = st.theSelectedPlaybackSpeed.toString();
                for (k in playbackSpeeds) {
                  if (playbackSpeeds.hasOwnProperty(k)) {
                    if (st.theSelectedPlaybackSpeed === playbackSpeeds[k].speed) {
                      ret.theSelectedPlaybackSpeed = playbackSpeeds[k].speed;
                      break;
                    }
                  }
                }
              }
            } else {
              ret.theSelectedPlaybackSpeed = '1';
            }
            return ret;
          }
          _this.videoHtmlElem = domElem;
          _this.initedVideoPreviewThumb = false;
          _this.videoPreviewThumb = null;
          if (!!!videojs.TOUCH_ENABLED && !!options.videoPreviewThumb && void 0 !== options.videoPreviewThumb.url && void 0 !== options.videoPreviewThumb.frame && !isNaN(options.videoPreviewThumb.frame.width) && !isNaN(options.videoPreviewThumb.frame.height) && !isNaN(options.videoPreviewThumb.frame.seconds)) {
            _this.videoPreviewThumb = options.videoPreviewThumb;
          }
          _this.enabledFullscreenToggle = options.controlBar.fullscreen;
          _this.enabledTheaterMode = options.controlBar.theaterMode;
          _this.playbackSpeeds = playbackSpeeds;
          _this.videoResolutions = null;
          _this.videoPlaybackSpeeds = null;
          _this.timeoutSettingsPanelFocusout = null;
          _this.timeoutSubtitlesPanelFocusout = null;
          _this.timeoutResolutionsPanelFocusout = null;
          _this.timeoutPlaybackSpeedsPanelFocusout = null;
          _this.actionAnimationTimeout = null;
          _this.seekingTimeout = null;
          _this.updateTime = 0;
          _this.pausedTime = -1;
          _this.seeking = false;
          _this.wasPlayingOnResolutionChange = false;
          _this.hadStartedOnResolutionChange = false;
          _this.isChangingResolution = false;
          _this.videoNativeDimensions = options.nativeDimensions;
          _this.setState(videojs.mergeOptions(_this.state, filterState(state)));
          _this.stateUpdateCallback = stateUpdateCallback instanceof Function ? stateUpdateCallback : null;
          _this.nextButtonClickCallback = nextButtonClickCallback instanceof Function ? nextButtonClickCallback : null;
          _this.previousButtonClickCallback = previousButtonClickCallback instanceof Function ? previousButtonClickCallback : null;
          if (_this.state.theSelectedQuality) {
            _this.videoResolutions = resolutions;
            _this.videoFormat = extractSupportedAndUsedVideoFormat(_this.player.src(), _this.state.theSelectedQuality, _this.videoResolutions);
            _this.state.theSelectedQuality = _this.videoFormat.defaultResolution;
            _this.videoFormat = {
              format: _this.videoFormat.format,
              order: _this.videoFormat.order
            };
            options.resolutions = {
              default: _this.state.theSelectedQuality,
              options: _this.videoResolutions
            };
          }
          if (_this.state.theSelectedPlaybackSpeed) {
            _this.videoPlaybackSpeeds = playbackSpeeds;
            options.playbackSpeeds = {
              default: _this.state.theSelectedPlaybackSpeed,
              options: _this.videoPlaybackSpeeds
            };
          }
          if (void 0 !== state.theSelectedSubtitleOption && null !== state.theSelectedSubtitleOption) {
            _this.state.theSelectedSubtitleOption = state.theSelectedSubtitleOption;
          }
          if (!!!options.subtitles || !!!options.subtitles.languages || !!!options.subtitles.languages.length || !options.subtitles.languages.length) {
            options.subtitles = null;
          } else {
            options.subtitles.languages.unshift({
              label: 'Off',
              srclang: 'off',
              src: null
            });
          }
          _this.subtitles = options.subtitles;
          setActionsAnimationsComponents(_assertThisInitialized(_this));
          replaceLoadingSpinnerComponent(_assertThisInitialized(_this));
          setCornerLayersComponents(_assertThisInitialized(_this), options);
          if (options.enabledTouchControls) {
            setTouchControlComponents(_assertThisInitialized(_this), options);
          }
          setControlBarComponents(_assertThisInitialized(_this), options, player);
          _this.csstransforms = browserSupports('csstransforms');
          player.addClass('vjs-loading-video');
          if (_this.videoNativeDimensions) {
            player.addClass('vjs-native-dimensions');
          }
          if (options.enabledTouchControls) {
            player.addClass('vjs-enabled-touch-controls');
          }
          _this.progressBarLine = null;
          _this.onBandwidthUpdate = null;
          _this.onHlsRetryPlaylist = null;
          if (options.keyboardControls) {
            _this.player.el_.onkeyup = _this.onKeyUp.bind(_assertThisInitialized(_this));
            _this.player.el_.onkeydown = _this.onKeyDown.bind(_assertThisInitialized(_this));
          }
          _this.onError = _this.onError.bind(_assertThisInitialized(_this));
          _this.on(player, ['error'], _this.onError);
          _this.on(player, ['dispose'], _this.onDispose);
          _this.on(player, ['ended'], _this.onEnded);
          _this.on(player, ['volumechange'], _this.onVolumeChange);
          _this.on(player, ['playing', 'pause'], _this.onPlayToggle);
          _this.on(player, ['timeupdate'], _this.onTimeUpdateChange);
          _this.on(player, ['fullscreenchange'], _this.onFullscreenChange);
          _this.on(player, ['theatermodechange'], _this.onTheaterModeChange);
          _this.on(player, ['openSettingsPanel'], _this.openSettingsOptions);
          _this.on(player, ['closeSettingsPanel'], _this.closeSettingsOptions);
          _this.on(player, ['openSubtitlesPanel'], _this.openSubtitlesOptions);
          _this.on(player, ['closeSubtitlesPanel'], _this.closeSubtitlesOptions);
          _this.on(player, ['openQualityOptions'], _this.openQualityOptions);
          _this.on(player, ['closeQualityOptions'], _this.closeQualityOptions);
          _this.on(player, ['openPlaybackSpeedOptions'], _this.openPlaybackSpeedOptions);
          _this.on(player, ['closePlaybackSpeedOptions'], _this.closePlaybackSpeedOptions);
          _this.on(player, ['selectedQuality'], _this.onQualitySelection);
          _this.on(player, ['selectedSubtitleOption'], _this.onSubtitleOptionSelection);
          _this.on(player, ['selectedPlaybackSpeed'], _this.onPlaybackSpeedSelection);
          _this.on(player, ['focusoutSettingsPanel'], _this.onFocusOutSettingsPanel);
          _this.on(player, ['focusoutSubtitlesPanel'], _this.onFocusOutSubtitlesPanel);
          _this.on(player, ['focusoutResolutionsPanel'], _this.onFocusOutResolutionsPanel);
          _this.on(player, ['focusoutPlaybackSpeedsPanel'], _this.onFocusOutPlaybackSpeedsPanel);
          _this.on(player, ['moveforward'], _this.onMoveForward);
          _this.on(player, ['movebackward'], _this.onMoveBackward);
          _this.on(player, ['userinactive'], _this.onUserInactive);
          _this.on(player, ['seeked'], _this.onSeeked);
          _this.on(player, ['seeking'], _this.onSeeking);
          _this.on('statechanged', _this.onStateChange);
          _this.hasPrevious = !!options.controlBar.previous;
          _this.hasNext = !!options.controlBar.next;
          if (_this.hasPrevious) {
            _this.on(player, ['clicked_previous_button'], _this.onPreviousButtonClick);
          }
          if (_this.hasNext) {
            _this.on(player, ['clicked_next_button'], _this.onNextButtonClick);
          }
          _this.onPlayerReady = _this.onPlayerReady.bind(_assertThisInitialized(_this));
          player.ready(_this.onPlayerReady);
          initElementsFocus(player);
          return _this;
        }
        _createClass(MediaCmsVjsPlugin, [{
          key: "onPreviousButtonClick",
          value: function onPreviousButtonClick() {
            if (this.hasPrevious) {
              this.actionAnimation('play_previous');
              if (this.previousButtonClickCallback) {
                this.previousButtonClickCallback();
              }
            }
          }
        }, {
          key: "onNextButtonClick",
          value: function onNextButtonClick() {
            if (this.hasNext) {
              this.actionAnimation('play_next');
              if (this.nextButtonClickCallback) {
                this.nextButtonClickCallback();
              }
            }
          }
        }, {
          key: "actionAnimation",
          value: function actionAnimation(action) {
            if (!this.player.hasStarted_) {
              return;
            }
            this.actionAnimElem = this.actionAnimElem || this.player.el_.querySelector('.vjs-actions-anim');
            if (!this.actionAnimElem) {
              return;
            }
            var cls;
            switch (action) {
              case 'play':
                if (void 0 !== this.previousActionAnim && 'forward' !== this.previousActionAnim && 'backward' !== this.previousActionAnim) {
                  cls = 'started-playing';
                }
                break;
              case 'pause':
                cls = 'just-paused';
                break;
              case 'backward':
                cls = 'moving-backward';
                break;
              case 'forward':
                cls = 'moving-forward';
                break;
              case 'volume':
                if (this.player.muted() || 0.001 >= this.player.volume()) {
                  cls = 'volume-mute';
                } else if (0.33 >= this.player.volume()) {
                  cls = 'volume-low';
                } else if (0.69 >= this.player.volume()) {
                  cls = 'volume-mid';
                } else {
                  cls = 'volume-high';
                }
                break;
              case 'play_previous':
                cls = 'play_previous';
                break;
              case 'play_next':
                cls = 'play_next';
                break;
            }
            if (!cls) {
              return;
            }
            if (this.actionAnimationTimeout) {
              this.actionAnimElem.setAttribute('class', 'vjs-actions-anim');
            }
            setTimeout(function () {
              this.previousActionAnim = action;
              cls += ' active-anim';
              clearTimeout(this.actionAnimationTimeout);
              this.actionAnimElem.setAttribute('class', 'vjs-actions-anim ' + cls);
              this.actionAnimationTimeout = setTimeout(function (ins) {
                ins.actionAnimElem.setAttribute('class', 'vjs-actions-anim');
                ins.actionAnimationTimeout = null;
                ins.previousActionAnim = null;
              }, 750, this);
            }.bind(this), this.actionAnimationTimeout ? 20 : 0);
          }
        }, {
          key: "onMoveForward",
          value: function onMoveForward() {
            this.actionAnimation('forward');
          }
        }, {
          key: "onMoveBackward",
          value: function onMoveBackward() {
            this.actionAnimation('backward');
          }
        }, {
          key: "onKeyDown",
          value: function onKeyDown(e) {
            if (this.player.ended()) {
              return;
            }
            var key = e.keyCode || e.charCode;
            var found = false;
            switch (key) {
              case 32:
                this.player[this.player.paused() ? 'play' : 'pause']();
                found = true;
                break;
              case 37:
                this.player.currentTime(this.player.currentTime() - 5 * this.state.theSelectedPlaybackSpeed);
                this.player.trigger('movebackward');
                found = true;
                break;
              case 38:
                if (this.player.muted()) {
                  this.player.muted(false);
                } else {
                  this.player.volume(Math.min(1, this.player.volume() + 0.03));
                }
                found = true;
                break;
              case 39:
                this.player.currentTime(this.player.currentTime() + 5 * this.state.theSelectedPlaybackSpeed);
                this.player.trigger('moveforward');
                found = true;
                break;
              case 40:
                this.player.volume(Math.max(0, this.player.volume() - 0.03));
                found = true;
                break;
            }
            if (found) {
              e.preventDefault();
              e.stopPropagation();
            }
          }
        }, {
          key: "onKeyUp",
          value: function onKeyUp(e) {
            if (this.player.ended()) {
              return;
            }
            var key = e.keyCode || e.charCode;
            var found = false;
            if (e.shiftKey) {
              switch (key) {
                case 78:
                  this.onNextButtonClick();
                  break;
                case 80:
                  this.onPreviousButtonClick();
                  break;
              }
            } else if (48 <= key && 57 >= key || 96 <= key && 105 >= key) {
              this.player.currentTime(0.1 * (57 < key ? key - 96 : key - 48) * this.player.duration());
              this.player.trigger({
                type: 'timeupdate',
                target: this,
                manuallyTriggered: true
              });
            } else {
              switch (key) {
                case 75:
                  this.player[this.player.paused() ? 'play' : 'pause']();
                  found = true;
                  break;
                case 70:
                  if (this.enabledFullscreenToggle) {
                    if (this.player.isFullscreen()) {
                      this.player.exitFullscreen();
                    } else {
                      this.player.requestFullscreen();
                    }
                    found = true;
                  }
                  break;
                case 77:
                  this.player.muted(!this.player.muted());
                  found = true;
                  break;
                case 84:
                  if (this.enabledTheaterMode) {
                    if (this.player.isFullscreen()) {
                      this.player.exitFullscreen();
                    }
                    this.player.trigger('theatermodechange');
                  }
                  break;
              }
            }
            if (found) {
              e.preventDefault();
              e.stopPropagation();
            }
          }
        }, {
          key: "onUserInactive",
          value: function onUserInactive() {
            if (this.state.isOpenQualityOptions || this.state.isOpenPlaybackSpeedOptions || this.state.isOpenSettingsOptions) {
              this.player.trigger('closeSettingsPanel');
            }
          }
        }, {
          key: "onSeeked",
          value: function onSeeked() {
            this.seekingTimeout = setTimeout(function (ins) {
              ins.seeking = false;
            }, 300, this);
          }
        }, {
          key: "onSeeking",
          value: function onSeeking() {
            clearTimeout(this.seekingTimeout);
            this.seeking = true;
            if (!!this.progressBarLine) {
              this.progressBarLine.style.width = (100 * this.player.currentTime() / this.player.duration()).toFixed(2) + '%';
            }
          }
        }, {
          key: "initDomEvents",
          value: function initDomEvents() {
            this.onWindowResize = this.onWindowResize.bind(this);
            window.addEventListener('resize', this.onWindowResize);
            this.videoHtmlElem.onloadeddata = this.onVideoDataLoad.bind(this);
            if (4 === this.videoHtmlElem.readyState) {
              this.onVideoDataLoad();
            }
          }
        }, {
          key: "onVideoMetaDataLoad",
          value: function onVideoMetaDataLoad() {}
        }, {
          key: "onVideoDataLoad",
          value: function onVideoDataLoad() {
            if (this.videoPreviewThumb && !this.initedVideoPreviewThumb) {
              this.initedVideoPreviewThumb = true;
              videoPreviewThumb(this.player, this.videoPreviewThumb);
            }
            this.player.removeClass('vjs-loading-video');
            if ('Auto' === this.state.theSelectedQuality) {
              if (!!this.player.tech_.hls && null === this.onBandwidthUpdate) {
                this.onBandwidthUpdate = this.onBandwidthUpdateCallback.bind(this);
                this.player.tech_.on('bandwidthupdate', this.onBandwidthUpdate);
                this.onBandwidthUpdateCallback();
              }
            } else {
              if (null !== this.onBandwidthUpdate) {
                this.player.tech_.off('bandwidthupdate', this.onBandwidthUpdate);
                this.onBandwidthUpdate = null;
              }
              if (!!this.player.tech_.hls && null === this.onHlsRetryPlaylist) {
                this.onHlsRetryPlaylist = this.onHlsRetryPlaylistCallback.bind(this);
                this.player.tech_.on('retryplaylist', this.onHlsRetryPlaylist);
              }
            }
            if (this.isChangingResolution) {
              if (this.hadStartedOnResolutionChange) {
                this.player.hasStarted(true);
                this.player.removeClass('vjs-changing-resolution');
                this.hadStartedOnResolutionChange = false;
              }
              if (this.wasPlayingOnResolutionChange) {
                this.player.play();
                this.wasPlayingOnResolutionChange = false;
              } else {
                this.player.pause();
              }
              this.isChangingResolution = false;
            }
            this.updateVideoElementPosition();
          }
        }, {
          key: "onBandwidthUpdateCallback",
          value: function onBandwidthUpdateCallback(ev) {
            this.onAutoQualitySelection(this.player.tech_.hls.playlists.media_.attributes.RESOLUTION.height);
          }
        }, {
          key: "onHlsRetryPlaylistCallback",
          value: function onHlsRetryPlaylistCallback(ev) {
            if ('Auto' !== this.state.theSelectedQuality && void 0 !== this.videoResolutions['Auto']) {
              this.setState({
                theSelectedQuality: 'Auto'
              });
            }
          }
        }, {
          key: "onPlayerReady",
          value: function onPlayerReady() {
            if (null !== this.subtitles) {
              var subtitleLanguages = [];
              var i;
              var tracks = this.player.textTracks();
              for (i = 0; i < tracks.length; i++) {
                subtitleLanguages.push(tracks[i].language);
              }
              i = 1;
              while (i < this.subtitles.languages.length) {
                if (-1 === subtitleLanguages.indexOf(this.subtitles.languages[i].srclang)) {
                  this.player.addRemoteTextTrack({
                    kind: 'subtitles',
                    label: this.subtitles.languages[i].label,
                    language: this.subtitles.languages[i].srclang,
                    src: this.subtitles.languages[i].src
                  });
                }
                i += 1;
              }
            }
            this.changeVideoSubtitle();
            this.progressBarLine = this.player.el_.querySelector('.video-js .vjs-progress-holder .vjs-play-progress');
            this.initDomEvents();
            this.player.volume(this.state.volume);
            this.player.muted(this.state.soundMuted);
            this.player.playbackRate(this.state.theSelectedPlaybackSpeed);
            this.player.addClass('vjs-mediacms-plugin');
            this.updateTheaterModeClassname();
            setTimeout(function (ins) {
              ins.updateVideoPlayerRatios();
            }, 100, this);
          }
        }, {
          key: "changeVideoSubtitle",
          value: function changeVideoSubtitle() {
            if ('off' !== this.state.theSelectedSubtitleOption) {
              this.player.removeClass('vjs-subtitles-off');
              this.player.addClass('vjs-subtitles-on');
            } else {
              this.player.removeClass('vjs-subtitles-on');
              this.player.addClass('vjs-subtitles-off');
            }
            var tracks = this.player.textTracks();
            for (var i = 0; i < tracks.length; i++) {
              if ('subtitles' === tracks[i].kind) {
                tracks[i].mode = this.state.theSelectedSubtitleOption === tracks[i].language ? 'showing' : 'hidden';
              }
            }
          }
        }, {
          key: "changeVideoResolution",
          value: function changeVideoResolution() {
            this.isChangingResolution = true;
            var sources = [];
            var currentTime = this.player.currentTime();
            var duration = this.player.duration();
            this.wasPlayingOnResolutionChange = !this.player.paused();
            this.hadStartedOnResolutionChange = this.player.hasStarted();
            if (this.hadStartedOnResolutionChange) {
              this.player.addClass('vjs-changing-resolution');
            }
            var i = 0;
            while (i < this.videoResolutions[this.state.theSelectedQuality].src.length) {
              sources.push({
                src: this.videoResolutions[this.state.theSelectedQuality].src[i]
              });
              i += 1;
            }
            this.player.src(sources);
            this.player.techCall_('reset');
            this.player.currentTime(currentTime);
            this.player.duration(duration);
            this.player.playbackRate(this.state.theSelectedPlaybackSpeed);
          }
        }, {
          key: "changePlaybackSpeed",
          value: function changePlaybackSpeed() {
            this.player.playbackRate(this.state.theSelectedPlaybackSpeed);
          }
        }, {
          key: "onStateChange",
          value: function onStateChange(d) {
            if (d.changes.videoRatio || d.changes.playerRatio) {
              this.updateVideoElementPosition();
            }
            if (d.changes.volume) {
              this.onPublicStateUpdate();
            }
            if (d.changes.soundMuted) {
              this.onPublicStateUpdate();
            }
            if (d.changes.theaterMode) {
              this.onPublicStateUpdate();
            }
            if (d.changes.theaterMode) {
              this.updateTheaterModeClassname();
              setTimeout(function (ins) {
                ins.updateVideoPlayerRatios();
              }, 20, this);
            }
            if (d.changes.isOpenSettingsOptions) ;
            if (d.changes.isOpenQualityOptions) ;
            if (d.changes.isOpenPlaybackSpeedOptions) ;
            if (d.changes.theSelectedSubtitleOption) {
              this.changeVideoSubtitle();
              this.player.trigger('updatedSelectedSubtitleOption');
              this.onPublicStateUpdate();
            }
            if (d.changes.theSelectedQuality) {
              this.changeVideoResolution();
              this.player.trigger('updatedSelectedQuality');
              this.onPublicStateUpdate();
            }
            if (d.changes.theSelectedPlaybackSpeed) {
              this.changePlaybackSpeed();
              this.player.trigger('updatedSelectedPlaybackSpeed');
              this.onPublicStateUpdate();
            }
            if (d.changes.isOpenSettingsOptions || d.changes.isOpenQualityOptions || d.changes.theSelectedQuality || d.changes.isOpenPlaybackSpeedOptions || d.changes.theSelectedPlaybackSpeed) {
              this.player.trigger('updatedSettingsPanelsVisibility');
            }
            if (d.changes.isOpenSubtitlesOptions) {
              this.player.trigger('updatedSubtitlesPanelsVisibility');
            }
            if (d.changes.openSettings) {
              if (this.state.openSettings) {
                this.player.trigger('openedSettingsPanel', this.state.openSettingsFromKeyboard);
              }
            }
            if (d.changes.closeSettings) {
              if (this.state.closeSettings) {
                this.player.trigger('closedSettingsPanel', this.state.closeSettingsFromKeyboard);
              }
            }
            if (d.changes.openSubtitles) {
              if (this.state.openSubtitles) {
                this.player.trigger('openedSubtitlesPanel', this.state.openSubtitlesFromKeyboard);
              }
            }
            if (d.changes.closeSubtitles) {
              if (this.state.closeSubtitles) {
                this.player.trigger('closedSubtitlesPanel', this.state.closeSubtitlesFromKeyboard);
              }
            }
            if (d.changes.openQualities) {
              if (this.state.openQualities) {
                this.player.trigger('openedQualities', this.state.openQualitiesFromKeyboard);
              }
            }
            if (d.changes.closeQualities) {
              if (this.state.closeQualities) {
                this.player.trigger('closedQualities', this.state.closeQualitiesFromKeyboard);
              }
            }
            if (d.changes.openPlaybackSpeeds) {
              if (this.state.openPlaybackSpeeds) {
                this.player.trigger('openedPlaybackSpeeds', this.state.openPlaybackSpeedsFromKeyboard);
              }
            }
            if (d.changes.closePlaybackSpeeds) {
              if (this.state.closePlaybackSpeeds) {
                this.player.trigger('closedPlaybackSpeeds', this.state.closePlaybackSpeedsFromKeyboard);
              }
            }
          }
        }, {
          key: "onDispose",
          value: function onDispose() {
            window.removeEventListener('resize', this.onWindowResize);
          }
        }, {
          key: "onError",
          value: function onError(e) {
            if (!this.player.paused()) {
              this.player.pause();
            }
            this.player.techCall_('reset');
          }
        }, {
          key: "onEnded",
          value: function onEnded() {
            this.setState(this.state, {
              ended: !0
            });
          }
        }, {
          key: "onVolumeChange",
          value: function onVolumeChange() {
            this.setState({
              volume: this.player.volume(),
              soundMuted: this.player.muted()
            });
            this.actionAnimation('volume');
          }
        }, {
          key: "onPlayToggle",
          value: function onPlayToggle(ev) {
            var playing = 'playing' === ev.type;
            if (!this.seeking && 1 > Math.abs(this.updateTimeDiff)) {
              this.actionAnimation(!playing ? 'pause' : 'play');
            }
            this.setState({
              playing: playing
            });
          }
        }, {
          key: "onTimeUpdateChange",
          value: function onTimeUpdateChange(ev) {
            var ct = this.player.currentTime();
            this.updateTimeDiff = ct - this.updateTime;
            this.updateTime = ct;
          }
        }, {
          key: "onFullscreenChange",
          value: function onFullscreenChange() {
            this.player.addClass('vjs-fullscreen-change');
            setTimeout(function (plr) {
              plr.removeClass('vjs-fullscreen-change');
            }, 100, this.player);
            this.updateVideoElementPosition();
          }
        }, {
          key: "onTheaterModeChange",
          value: function onTheaterModeChange() {
            this.setState({
              theaterMode: !this.state.theaterMode
            });
          }
        }, {
          key: "openSettingsOptions",
          value: function openSettingsOptions(ev, triggeredFromKeyboard) {
            clearTimeout(this.timeoutSettingsPanelFocusout);
            this.setState({
              openSettings: new Date(),
              openSettingsFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
              isOpenSettingsOptions: !0,
              isOpenQualityOptions: !1,
              isOpenPlaybackSpeedOptions: !1,
              isOpenSubtitlesOptions: !1
            });
          }
        }, {
          key: "closeSettingsOptions",
          value: function closeSettingsOptions(ev, triggeredFromKeyboard) {
            clearTimeout(this.timeoutSettingsPanelFocusout);
            this.setState({
              closeSettings: new Date(),
              closeSettingsFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
              isOpenSettingsOptions: !1,
              isOpenQualityOptions: !1,
              isOpenPlaybackSpeedOptions: !1
            });
          }
        }, {
          key: "openSubtitlesOptions",
          value: function openSubtitlesOptions(ev, triggeredFromKeyboard) {
            clearTimeout(this.timeoutSubtitlesPanelFocusout);
            this.setState({
              openSubtitles: new Date(),
              openSubtitlesFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
              isOpenSubtitlesOptions: !0,
              isOpenSettingsOptions: !1,
              isOpenQualityOptions: !1,
              isOpenPlaybackSpeedOptions: !1
            });
          }
        }, {
          key: "closeSubtitlesOptions",
          value: function closeSubtitlesOptions(ev, triggeredFromKeyboard) {
            clearTimeout(this.timeoutSubtitlesPanelFocusout);
            this.setState({
              closeSubtitles: new Date(),
              closeSubtitlesFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
              isOpenSubtitlesOptions: !1
            });
          }
        }, {
          key: "openQualityOptions",
          value: function openQualityOptions(ev, triggeredFromKeyboard) {
            clearTimeout(this.timeoutResolutionsPanelFocusout);
            this.setState({
              openQualities: new Date(),
              openQualitiesFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
              isOpenSettingsOptions: !1,
              isOpenQualityOptions: !0
            });
          }
        }, {
          key: "openPlaybackSpeedOptions",
          value: function openPlaybackSpeedOptions(ev, triggeredFromKeyboard) {
            clearTimeout(this.timeoutPlaybackSpeedsPanelFocusout);
            this.setState({
              openPlaybackSpeeds: new Date(),
              openPlaybackSpeedsFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
              isOpenSettingsOptions: !1,
              isOpenPlaybackSpeedOptions: !0
            });
          }
        }, {
          key: "closeQualityOptions",
          value: function closeQualityOptions(ev, triggeredFromKeyboard) {
            clearTimeout(this.timeoutResolutionsPanelFocusout);
            this.setState({
              closeQualities: new Date(),
              closeQualitiesFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
              openSettings: new Date(),
              openSettingsFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
              isOpenSettingsOptions: !0,
              isOpenQualityOptions: !1
            });
          }
        }, {
          key: "closePlaybackSpeedOptions",
          value: function closePlaybackSpeedOptions(ev, triggeredFromKeyboard) {
            clearTimeout(this.timeoutPlaybackSpeedsPanelFocusout);
            this.setState({
              closePlaybackSpeeds: new Date(),
              closePlaybackSpeedsFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
              openSettings: new Date(),
              openSettingsFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
              isOpenSettingsOptions: !0,
              isOpenPlaybackSpeedOptions: !1
            });
          }
        }, {
          key: "onQualitySelection",
          value: function onQualitySelection(ev, newQuality) {
            this.setState({
              isOpenSettingsOptions: !1,
              isOpenQualityOptions: !1,
              theSelectedQuality: newQuality
            });
          }
        }, {
          key: "onSubtitleOptionSelection",
          value: function onSubtitleOptionSelection(ev, newSelection) {
            this.setState({
              isOpenSubtitlesOptions: !1,
              theSelectedSubtitleOption: newSelection
            });
          }
        }, {
          key: "onAutoQualitySelection",
          value: function onAutoQualitySelection(newAutoQuality) {
            if (newAutoQuality !== this.state.theSelectedAutoQuality) {
              this.setState({
                theSelectedAutoQuality: newAutoQuality
              });
              this.player.trigger('updatedSelectedQuality');
            }
          }
        }, {
          key: "onPlaybackSpeedSelection",
          value: function onPlaybackSpeedSelection(ev, newPlaybackSpeed) {
            this.setState({
              isOpenSettingsOptions: !1,
              isOpenPlaybackSpeedOptions: !1,
              theSelectedPlaybackSpeed: newPlaybackSpeed
            });
          }
        }, {
          key: "onFocusOutSubtitlesPanel",
          value: function onFocusOutSubtitlesPanel() {
            if (this.timeoutSubtitlesPanelFocusout) {
              return;
            }
            this.player.focus();
            this.timeoutSubtitlesPanelFocusout = setTimeout(function (ins) {
              ins.setState({
                isOpenSubtitlesOptions: !1
              });
              ins.timeoutSubtitlesPanelFocusout = null;
            }, 100, this);
          }
        }, {
          key: "onFocusOutSettingsPanel",
          value: function onFocusOutSettingsPanel() {
            if (this.timeoutSettingsPanelFocusout) {
              return;
            }
            if (!this.state.isOpenQualityOptions && !this.state.isOpenPlaybackSpeedOptions) {
              this.player.focus();
            }
            if (!this.state.isOpenQualityOptions) {
              this.timeoutSettingsPanelFocusout = setTimeout(function (ins) {
                if (ins.state.isOpenSettingsOptions && !ins.state.isOpenQualityOptions) {
                  ins.setState({
                    isOpenSettingsOptions: !1
                  });
                }
                ins.timeoutSettingsPanelFocusout = null;
              }, 100, this);
            } else if (!this.state.isOpenPlaybackSpeedOptions) {
              this.timeoutSettingsPanelFocusout = setTimeout(function (ins) {
                if (ins.state.isOpenSettingsOptions && !ins.state.isOpenPlaybackSpeedOptions) {
                  ins.setState({
                    isOpenSettingsOptions: !1
                  });
                }
                ins.timeoutSettingsPanelFocusout = null;
              }, 100, this);
            }
          }
        }, {
          key: "onFocusOutResolutionsPanel",
          value: function onFocusOutResolutionsPanel() {
            if (this.timeoutResolutionsPanelFocusout) {
              return;
            }
            if (!this.state.isOpenSettingsOptions && !this.state.isOpenPlaybackSpeedOptions) {
              this.player.focus();
            }
            if (!this.state.isOpenSettingsOptions) {
              this.timeoutResolutionsPanelFocusout = setTimeout(function (ins) {
                if (ins.state.isOpenQualityOptions && !ins.state.isOpenSettingsOptions) {
                  ins.setState({
                    isOpenQualityOptions: !1
                  });
                }
                ins.timeoutResolutionsPanelFocusout = null;
              }, 100, this);
            }
          }
        }, {
          key: "onFocusOutPlaybackSpeedsPanel",
          value: function onFocusOutPlaybackSpeedsPanel() {
            if (this.timeoutPlaybackSpeedsPanelFocusout) {
              return;
            }
            if (!this.state.isOpenQualityOptions && !this.state.isOpenSettingsOptions) {
              this.player.focus();
            }
            if (!this.state.isOpenSettingsOptions) {
              this.timeoutPlaybackSpeedsPanelFocusout = setTimeout(function (ins) {
                if (ins.state.isOpenPlaybackSpeedOptions && !ins.state.isOpenSettingsOptions) {
                  ins.setState({
                    isOpenPlaybackSpeedOptions: !1
                  });
                }
                ins.timeoutPlaybackSpeedsPanelFocusout = null;
              }, 100, this);
            }
          }
        }, {
          key: "onPublicStateUpdate",
          value: function onPublicStateUpdate() {
            if (this.stateUpdateCallback) {
              this.stateUpdateCallback({
                volume: this.state.volume,
                theaterMode: this.state.theaterMode,
                soundMuted: this.state.soundMuted,
                quality: this.state.theSelectedQuality,
                playbackSpeed: this.state.theSelectedPlaybackSpeed,
                subtitle: this.state.theSelectedSubtitleOption
              });
            }
          }
        }, {
          key: "onWindowResize",
          value: function onWindowResize() {
            this.updateVideoPlayerRatios();
          }
        }, {
          key: "updateVideoPlayerRatios",
          value: function updateVideoPlayerRatios() {
            this.setState({
              videoRatio: this.videoHtmlElem.offsetWidth / this.videoHtmlElem.offsetHeight,
              playerRatio: this.player.el_.offsetWidth / this.player.el_.offsetHeight
            });
            var settingsPanelInner = document.querySelectorAll('.vjs-settings-panel-inner');
            if (settingsPanelInner.length) {
              var i = 0;
              while (i < settingsPanelInner.length) {
                settingsPanelInner[i].style.maxHeight = this.videoHtmlElem.offsetHeight - 120 + 'px';
                i += 1;
              }
            }
          }
        }, {
          key: "updateTheaterModeClassname",
          value: function updateTheaterModeClassname() {
            this.player[this.state.theaterMode ? 'addClass' : 'removeClass']('vjs-theater-mode');
          }
        }, {
          key: "updateVideoElementPosition",
          value: function updateVideoElementPosition() {
            if (this.videoHtmlElem) {
              if (this.videoNativeDimensions) {
                var newval = centralizeBoxPosition(this.videoHtmlElem.offsetWidth, this.videoHtmlElem.offsetHeight, this.state.videoRatio, this.player.el_.offsetWidth, this.player.el_.offsetHeight, this.state.playerRatio);
                if (this.csstransforms) {
                  applyCssTransform(this.videoHtmlElem, 'translate(' + (newval.l > 0 ? newval.l : '0') + 'px,' + (newval.t > 0 ? newval.t : '0') + 'px)');
                } else {
                  this.videoHtmlElem.style.top = newval.t > 0 ? newval.t + 'px' : '';
                  this.videoHtmlElem.style.left = newval.l > 0 ? newval.l + 'px' : '';
                }
              }
            }
          }
        }, {
          key: "isTheaterMode",
          value: function isTheaterMode() {
            return this.state.theaterMode;
          }
        }, {
          key: "isFullscreen",
          value: function isFullscreen() {
            return this.player.isFullscreen();
          }
        }, {
          key: "isEnded",
          value: function isEnded() {
            return this.player.ended();
          }
        }, {
          key: "selectedQualityTitle",
          value: function selectedQualityTitle() {
            return this.state.theSelectedQuality + ('Auto' === this.state.theSelectedQuality && null !== this.state.theSelectedAutoQuality ? "&nbsp;<span class='auto-resolution-title'>" + this.state.theSelectedAutoQuality + '</span>' : '');
          }
        }, {
          key: "selectedPlaybackSpeedTitle",
          value: function selectedPlaybackSpeedTitle() {
            var k;
            for (k in this.playbackSpeeds) {
              if (this.playbackSpeeds.hasOwnProperty(k)) {
                if (this.state.theSelectedPlaybackSpeed === this.playbackSpeeds[k].speed) {
                  return this.playbackSpeeds[k].title || this.playbackSpeeds[k].speed;
                }
              }
            }
            return 'n/a';
          }
        }]);
        return MediaCmsVjsPlugin;
      }(VideojsPluginClass);
      MediaCmsVjsPlugin.defaultState = {
        volume: 1,
        theaterMode: !1,
        soundMuted: !1,
        ended: !1,
        playing: !1,
        videoRatio: 0,
        playerRatio: 0,
        isOpenSettingsOptions: !1,
        isOpenSubtitlesOptions: !1,
        isOpenQualityOptions: !1,
        theSelectedQuality: null,
        theSelectedSubtitleOption: 'off',
        theSelectedAutoQuality: null,
        theSelectedPlaybackSpeed: null,
        openSettings: !1,
        closeSettings: !1,
        openSettingsFromKeyboard: !1,
        closeSettingsFromKeyboard: !1,
        openSubtitles: !1,
        openSubtitlesFromKeyboard: !1,
        closeSubtitles: !1,
        closeSubtitlesFromKeyboard: !1,
        openQualities: !1,
        closeQualities: !1,
        openQualitiesFromKeyboard: !1,
        closeQualitiesFromKeyboard: !1
      };
      MediaCmsVjsPlugin.VERSION = version;
      videojs.registerPlugin('mediaCmsVjsPlugin', MediaCmsVjsPlugin);
      return MediaCmsVjsPlugin;
    }
    function generator() {
      if (null === Plugin) {
        Plugin = generatePlugin();
      }
      return Plugin;
    }
    var MediaCmsVjsPlugin = generator();
    return MediaCmsVjsPlugin;
  });
  }(mediacmsVjsPlugin));

  function isString(v) {
    return 'string' === typeof v || v instanceof String;
  }
  function isArray(v) {
    return !Array.isArray ? '[object Array]' === Object.prototype.toString.call(v) : Array.isArray(v);
  }
  function isBoolean(v) {
    return 'boolean' === typeof v || v instanceof Boolean;
  }
  function ifBooleanElse(bol, els) {
    return isBoolean(bol) ? bol : els;
  }
  var defaults = {
    options: {
      sources: [],
      keyboardControls: !0,
      enabledTouchControls: !0,
      nativeDimensions: !1,
      suppressNotSupportedError: !0,
      poster: '',
      loop: !1,
      controls: !0,
      preload: 'auto',
      autoplay: !1,
      bigPlayButton: !0,
      liveui: !1,
      controlBar: {
        bottomBackground: !0,
        progress: !0,
        play: !0,
        next: !1,
        previous: !1,
        volume: !0,
        pictureInPicture: !0,
        fullscreen: !0,
        theaterMode: !0,
        time: !0
      },
      cornerLayers: {
        topLeft: null,
        topRight: null,
        bottomLeft: null,
        bottomRight: null
      },
      videoPreviewThumb: {},
      subtitles: {
        on: false,
        default: null,
        languages: []
      }
    }
  };
  function filterPlayerOptions(domPlayer, opt) {
    var k, x, i;
    opt.sources = isArray(opt.sources) && opt.sources.length ? opt.sources : [];
    opt.loop = ifBooleanElse(opt.loop, defaults.options.loop);
    opt.controls = ifBooleanElse(opt.controls, defaults.options.controls);
    if (opt.subtitles && opt.subtitles instanceof Object) {
      opt.subtitles.default = void 0 !== opt.subtitles.default ? opt.subtitles.default : defaults.options.subtitles.default;
      opt.subtitles.languages = isArray(opt.subtitles.languages) ? opt.subtitles.languages : defaults.options.subtitles.languages;
      opt.subtitles.on = ifBooleanElse(opt.subtitles.on, defaults.options.subtitles.on);
    } else {
      opt.subtitles.default = defaults.options.subtitles;
    }
    opt.autoplay = 'any' === opt.autoplay || 'play' === opt.autoplay || 'muted' === opt.autoplay ? opt.autoplay : ifBooleanElse(opt.autoplay, defaults.options.autoplay);
    opt.bigPlayButton = ifBooleanElse(opt.bigPlayButton, defaults.options.bigPlayButton);
    opt.poster = isString(opt.poster) && '' !== opt.poster.trim() ? opt.poster : defaults.options.poster;
    opt.preload = isString(opt.preload) && -1 < ['auto', 'metadata', 'none'].indexOf(opt.preload.trim()) ? opt.preload : defaults.options.preload;
    if (opt.controlBar && opt.controlBar instanceof Object && Object.keys(opt.controlBar).length) {
      for (k in opt.controlBar) {
        if (opt.controlBar.hasOwnProperty(k)) {
          opt.controlBar[k] = ifBooleanElse(opt.controlBar[k], defaults.options.controlBar[k]);
        }
      }
    }
    if (opt.cornerLayers && opt.cornerLayers instanceof Object && Object.keys(opt.cornerLayers).length) {
      for (k in opt.cornerLayers) {
        if (opt.cornerLayers.hasOwnProperty(k)) {
          if ('string' === typeof opt.cornerLayers[k]) {
            opt.cornerLayers[k] = '' !== opt.cornerLayers[k] ? opt.cornerLayers[k] : defaults.options.cornerLayers[k];
          } else if (Node.prototype.isPrototypeOf(opt.cornerLayers[k]) || !isNaN(opt.cornerLayers[k])) {
            opt.cornerLayers[k] = opt.cornerLayers[k];
          } else {
            opt.cornerLayers[k] = opt.cornerLayers[k] || defaults.options.cornerLayers[k];
          }
        } else {
          opt.cornerLayers[k] = defaults.options.cornerLayers[k];
        }
      }
    }
    opt.previewSprite = 'object' === _typeof(opt.previewSprite) ? opt.previewSprite : {};
    var obj;
    var sources_el = domPlayer.querySelectorAll('source');
    i = 0;
    while (i < sources_el.length) {
      if (void 0 !== sources_el[i].attributes.src) {
        obj = {
          src: sources_el[i].src
        };
        if (void 0 !== sources_el[i].attributes.type) {
          obj.type = sources_el[i].type;
        }
        x = 0;
        while (x < opt.sources.length && obj.src !== opt.sources[x].src) {
          x += 1;
        }
        if (x >= opt.sources.length) {
          opt.sources.push(obj);
        }
      }
      i += 1;
    }
    var subs_el = domPlayer.querySelectorAll('track[kind="subtitles"]');
    var subtitles_options = {
      on: opt.subtitles.on,
      default: null,
      languages: []
    };
    var languages = {};
    function addSubtitle(track) {
      track.src = void 0 !== track.src && null !== track.src ? track.src.toString().trim() : '';
      track.srclang = void 0 !== track.srclang && null !== track.srclang ? track.srclang.toString().trim() : '';
      if (track.src.length && track.srclang.length) {
        track.label = void 0 !== track.label && null !== track.label ? track.label.toString().trim() : track.srclang;
        if (void 0 !== languages[track.srclang]) {
          languages[track.srclang].src = track.src;
          languages[track.srclang].label = track.label;
        } else {
          subtitles_options.languages.push({
            label: track.label,
            src: track.src,
            srclang: track.srclang
          });
          languages[track.srclang] = subtitles_options.languages[subtitles_options.languages.length - 1];
        }
        if (void 0 !== track.default && null !== track.default) {
          track.default = track.default.toString().trim();
          if (!track.default.length || '1' === track.default || 'true' === track.default) {
            subtitles_options.default = track.srclang;
          }
        }
      }
    }
    i = 0;
    while (i < subs_el.length) {
      addSubtitle({
        src: subs_el[i].getAttribute('src'),
        srclang: subs_el[i].getAttribute('srclang'),
        default: subs_el[i].getAttribute('default'),
        label: subs_el[i].getAttribute('label')
      });
      i += 1;
    }
    if (opt.subtitles.languages.length) {
      i = 0;
      while (i < opt.subtitles.languages.length) {
        addSubtitle({
          src: opt.subtitles.languages[i].src,
          srclang: opt.subtitles.languages[i].srclang,
          default: opt.subtitles.languages[i].default,
          label: opt.subtitles.languages[i].label
        });
        i += 1;
      }
    }
    if (null !== opt.subtitles.default && void 0 !== languages[opt.subtitles.default]) {
      subtitles_options.default = opt.subtitles.default;
    }
    if (null === subtitles_options.default && opt.subtitles.languages.length) {
      subtitles_options.default = opt.subtitles.languages[0].srclang;
    }
    opt.subtitles = subtitles_options;
    return opt;
  }
  function constructVideojsOptions(opt, vjopt) {
    vjopt.sources = opt.sources;
    vjopt.loop = opt.loop;
    vjopt.controls = opt.controls;
    vjopt.autoplay = opt.autoplay;
    vjopt.bigPlayButton = opt.bigPlayButton;
    vjopt.poster = opt.poster;
    vjopt.preload = opt.preload;
    vjopt.suppressNotSupportedError = opt.suppressNotSupportedError;
    return vjopt;
  }
  function MediaPlayer(domPlayer, pluginOptions, pluginState, videoResolutions, videoPlaybackSpeeds, pluginStateUpdateCallback, onNextButtonClick, onPrevButtonClick) {
    if (!Node.prototype.isPrototypeOf(domPlayer)) {
      console.error('Invalid player DOM element', domPlayer);
      return null;
    }
    function sourcesSrcs(urls) {
      var ret = [];
      var i = 0;
      while (i < urls.length) {
        if (!!urls[i]) {
          ret.push(urls[i]);
        }
        i += 1;
      }
      return ret;
    }
    function sourcesFormats(formats) {
      var ret = [];
      var i = 0;
      while (i < formats.length) {
        if (!!formats[i]) {
          ret.push(formats[i]);
        }
        i += 1;
      }
      return ret;
    }
    var k,
        pluginVideoResolutions = {},
        pluginVideoPlaybackSpeeds = {};
    if (!!videoResolutions) {
      for (k in videoResolutions) {
        if (videoResolutions.hasOwnProperty(k)) {
          if (isArray(videoResolutions[k].url) && videoResolutions[k].url.length && isArray(videoResolutions[k].format) && videoResolutions[k].format.length) {
            pluginVideoResolutions[k] = {
              title: k,
              src: sourcesSrcs(videoResolutions[k].url),
              format: sourcesFormats(videoResolutions[k].format)
            };
          }
        }
      }
    }
    if (!!videoPlaybackSpeeds) {
      k = 0;
      while (k < videoPlaybackSpeeds.length) {
        pluginVideoPlaybackSpeeds[k] = {
          title: 1 === videoPlaybackSpeeds[k] ? 'Normal' : videoPlaybackSpeeds[k],
          speed: videoPlaybackSpeeds[k].toString()
        };
        k += 1;
      }
    }
    pluginOptions = filterPlayerOptions(domPlayer, videojs.mergeOptions(defaults.options, pluginOptions && pluginOptions instanceof Object && Object.keys(pluginOptions).length ? pluginOptions : {}));
    if (null !== pluginOptions.subtitles.default && pluginOptions.subtitles.on) {
      pluginState.theSelectedSubtitleOption = pluginOptions.subtitles.default;
    }
    var passOptions = constructVideojsOptions(pluginOptions, {
      controlBar: {
        children: []
      }
    });
    this.player = videojs(domPlayer, passOptions);
    this.player.mediaCmsVjsPlugin(domPlayer, pluginOptions, pluginState, pluginVideoResolutions, pluginVideoPlaybackSpeeds, pluginStateUpdateCallback, onNextButtonClick, onPrevButtonClick);
    this.isEnded = this.player.mediaCmsVjsPlugin().isEnded;
    this.isFullscreen = this.player.mediaCmsVjsPlugin().isFullscreen;
    this.isTheaterMode = this.player.mediaCmsVjsPlugin().isTheaterMode;
    if (void 0 !== (typeof window === "undefined" ? "undefined" : _typeof(window))) {
      window.HELP_IMPROVE_VIDEOJS = false;
    }
  }

  return MediaPlayer;

})));
