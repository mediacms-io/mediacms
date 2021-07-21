import { version as VERSION } from '../package.json';

import 'mediacms-vjs-plugin-font-icons/dist/mediacms-vjs-icons.css';
import './styles.scss';

let Plugin = null;

function generatePlugin() {
	const videojsComponent = videojs.getComponent('Component');
	const videojsClickableComponent = videojs.getComponent('ClickableComponent');
	const videojsComponentButton = videojs.getComponent('Button');

	const __MediaCMSComponent__ = videojs.extend(videojsComponent, {
		constructor() {
			videojsComponent.apply(this, arguments);
			this.setAttribute('class', this.buildCSSClass());
		},
		buildCSSClass() {
			return '';
		},
	});

	const __MediaCMSButtonClickableComponent__ = videojs.extend(videojsClickableComponent, {
		buildCSSClass() {
			return '';
		},
	});

	const __SettingsPanelComponent__ = composeAndExtendCustomComp('vjs-settings-panel');
	const __SettingsPanelInnerComponent__ = composeAndExtendCustomComp('vjs-settings-panel-inner');
	const __SettingsPanelTitleComponent__ = composeAndExtendCustomComp('vjs-setting-panel-title');
	const __SettingsMenuComponent__ = composeAndExtendCustomComp('vjs-settings-menu');
	const __SettingsMenuItemComponent__ = videojsComposeAndExtendCustomComp(
		__MediaCMSButtonClickableComponent__,
		'vjs-settings-menu-item'
	);
	const __SettingsMenuItemLabelComponent__ = composeAndExtendCustomComp('vjs-setting-menu-item-label');
	const __SettingsMenuItemContentComponent__ = composeAndExtendCustomComp('vjs-setting-menu-item-content');

	function composeCustomCompMethods(ret, extnd, innerHtml, extraCSSClass, htmlAttr) {
		var innerHtmlIsHTMLElement = !!innerHtml && innerHtml.nodeType === 1;

		if (!innerHtmlIsHTMLElement) {
			switch (typeof innerHtml) {
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

		switch (typeof extraCSSClass) {
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

				let k;

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
			methods: methods,
		};
	}

	function videojsComposeAndExtendCustomComp(extnd, extraCSSClass, innerHtml, htmlAttr) {
		const ret = {};
		composeCustomCompMethods(ret, extnd, innerHtml, extraCSSClass, htmlAttr);
		return videosjsExtendCustomComp(extnd, ret);
	}

	function composeCustomComp(extnd, extraCSSClass, innerHtml, htmlAttr) {
		const ret = {};
		composeCustomCompMethods(ret, extnd, innerHtml, extraCSSClass, htmlAttr);
		return videosjsFormatExtendObj(extnd, ret);
	}

	function composeAndExtendCustomComp(extraCSSClass, innerHtml, htmlAttr) {
		return videojsComposeAndExtendCustomComp(__MediaCMSComponent__, extraCSSClass, innerHtml, htmlAttr);
	}

	/* ################################################## */

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
			const componentsToAppend = [],
				parentsConnections = {},
				appendedComponents = {};
			let i, j, prnt, customCompKey, customCompName;
			if (parent.children) {
				childrenGen('controlBar', parent.children, componentsToAppend, parentsConnections, 0);

				/*console.log( componentsToAppend );
                console.log( parentsConnections );*/

				i = 0;
				while (i < componentsToAppend.length) {
					j = 0;
					while (j < componentsToAppend[i].length) {
						prnt =
							0 === i
								? pluginInstanceRef.player.getChild(parentsConnections[componentsToAppend[i][j]])
								: appendedComponents[parentsConnections[componentsToAppend[i][j]]];
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
			let TouchControls, TouchControlsInner, TouchPrevious, TouchPlay, TouchNext;

			const previousButton = composeCustomComp(videojsComponentButton, 'vjs-icon-previous-item');
			const playButton = composeCustomComp(videojsComponentButton, 'vjs-icon-play');
			const nextButton = composeCustomComp(videojsComponentButton, 'vjs-icon-next-item');

			playButton.methods.handleClick = function (ev) {
				if (this.player_.paused()) {
					this.player_.play();
					setTimeout(
						function () {
							this.player_.userActive(false);
						}.bind(this),
						250
					);
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

			videojs.registerComponent(
				'TouchControls',
				videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-touch-controls').methods)
			);
			videojs.registerComponent(
				'TouchControlsInner',
				videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__).methods)
			);

			videojs.registerComponent('TouchPreviousButton', videojs.extend(previousButton.extend, previousButton.methods));
			videojs.registerComponent('TouchPlayButton', videojs.extend(playButton.extend, playButton.methods));
			videojs.registerComponent('TouchNextButton', videojs.extend(nextButton.extend, nextButton.methods));

			videojs.registerComponent(
				'TouchPlay',
				videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-touch-play-button').methods)
			);

			if (options.controlBar.next || options.controlBar.previous) {
				videojs.registerComponent(
					'TouchPrevious',
					videojs.extend(
						__MediaCMSComponent__,
						composeCustomComp(
							__MediaCMSComponent__,
							'vjs-touch-previous-button' + (!options.controlBar.previous ? ' vjs-touch-disabled-button' : '')
						).methods
					)
				);
				videojs.registerComponent(
					'TouchNext',
					videojs.extend(
						__MediaCMSComponent__,
						composeCustomComp(
							__MediaCMSComponent__,
							'vjs-touch-next-button' + (!options.controlBar.next ? ' vjs-touch-disabled-button' : '')
						).methods
					)
				);
			} else {
				videojs.registerComponent(
					'TouchPrevious',
					videojs.extend(
						__MediaCMSComponent__,
						composeCustomComp(
							__MediaCMSComponent__,
							'vjs-touch-previous-button' + (!options.controlBar.previous ? ' vjs-touch-hidden-button' : '')
						).methods
					)
				);
				videojs.registerComponent(
					'TouchNext',
					videojs.extend(
						__MediaCMSComponent__,
						composeCustomComp(
							__MediaCMSComponent__,
							'vjs-touch-next-button' + (!options.controlBar.next ? ' vjs-touch-hidden-button' : '')
						).methods
					)
				);
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
		const layers = {};
		const compPrefix = 'CornerLayer_';
		let k;

		if (options.cornerLayers.topLeft) {
			layers.topLeft = {
				className: 'vjs-corner-layer vjs-corner-top-left',
				parent: pluginInstanceRef.player,
				content: options.cornerLayers.topLeft,
			};
		}

		if (options.cornerLayers.topRight) {
			layers.topRight = {
				className: 'vjs-corner-layer vjs-corner-top-right',
				parent: pluginInstanceRef.player,
				content: options.cornerLayers.topRight,
			};
		}

		if (options.cornerLayers.bottomLeft) {
			layers.bottomLeft = {
				className: 'vjs-corner-layer vjs-corner-bottom-left',
				parent: pluginInstanceRef.player,
				content: options.cornerLayers.bottomLeft,
			};
		}

		if (options.cornerLayers.bottomRight) {
			layers.bottomRight = {
				className: 'vjs-corner-layer vjs-corner-bottom-right',
				parent: pluginInstanceRef.player,
				content: options.cornerLayers.bottomRight,
			};
		}

		for (k in layers) {
			if (layers.hasOwnProperty(k)) {
				if (layers[k].content) {
					videojs.registerComponent(
						compPrefix + k,
						videojs.extend(
							__MediaCMSComponent__,
							composeCustomComp(__MediaCMSComponent__, layers[k].className, layers[k].content).methods
						)
					);

					layers[k].parent.addChild(compPrefix + k);
				}
			}
		}
	}

	function generateActionsAnimationsComponents(pluginInstanceRef) {
		videojs.registerComponent(
			'ActionsAnimations',
			videojs.extend(
				__MediaCMSComponent__,
				composeCustomComp(__MediaCMSComponent__, 'vjs-actions-anim', '<span></span>').methods
			)
		);
		pluginInstanceRef.player.addChild('ActionsAnimations');
	}

	function generateLoadingSpinnerComponent(pluginInstanceRef) {
		pluginInstanceRef.player.removeChild('LoadingSpinner');

		videojs.registerComponent(
			'LoadingSpinner',
			videojs.extend(
				__MediaCMSComponent__,
				composeCustomComp(
					__MediaCMSComponent__,
					'vjs-loading-spinner',
					'<div class="spinner">\
                        <div class="spinner-container">\
                            <div class="spinner-rotator">\
                                <div class="spinner-left"><div class="spinner-circle"></div></div>\
                                <div class="spinner-right"><div class="spinner-circle"></div></div>\
                            </div>\
                        </div>\
                    </div>'
				).methods
			)
		);

		pluginInstanceRef.player.addChild('LoadingSpinner');
	}

	function initComponents(pluginInstanceRef, which, struct, args) {
		let k, i;
		let tmp;
		switch (which) {
			case 'bottomBackground':
				struct.bottomBackground = null;
				videojs.registerComponent(
					'BottomBackground',
					videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-bottom-bg').methods)
				);
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
								subtitlesMenu: { children: {} },
							},
						},
					},
				};

				tmp = composeCustomComp(__SettingsPanelComponent__, 'vjs-subtitles-panel');

				tmp.methods.constructor = function () {
					videojsComponent.apply(this, arguments);

					this.setAttribute('class', this.buildCSSClass());

					const that = this;

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

				videojs.registerComponent(
					'SubtitlesPanelInner',
					videojs.extend(__SettingsPanelInnerComponent__, composeCustomComp(__SettingsPanelInnerComponent__).methods)
				);

				videojs.registerComponent(
					'SubtitlesMenu',
					videojs.extend(__SettingsMenuComponent__, composeCustomComp(__SettingsMenuComponent__).methods)
				);
				videojs.registerComponent(
					'SubtitlesMenuTitle',
					videojs.extend(
						__SettingsPanelTitleComponent__,
						composeCustomComp(__SettingsPanelTitleComponent__, null, '<span>Subtitles</span>').methods
					)
				);

				i = 0;
				while (i < args.options.subtitles.languages.length) {
					k = args.options.subtitles.languages[i];

					struct.subtitlesPanel.children.subtitlesPanelInner.children.subtitlesMenu.children['subtitleOption_' + k.srclang] =
						{
							children: {
								['subtitleOption_' + k.srclang + '_content']: null,
							},
						};

					(function (key, title) {
						tmp = composeCustomComp(
							__SettingsMenuItemComponent__,
							key === pluginInstanceRef.state.theSelectedSubtitleOption ? 'vjs-selected-menu-item' : null,
							null
						);

						tmp.methods.constructor = function () {
							__SettingsMenuItemComponent__.apply(this, arguments);

							this.subtitleKey = key;

							const that = this;

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
								settingsMenu: { children: {} },
							},
						},
					},
				};

				tmp = composeCustomComp(__SettingsPanelComponent__, 'vjs-settings-root');

				tmp.methods.constructor = function () {
					videojsComponent.apply(this, arguments);

					this.setAttribute('class', this.buildCSSClass());

					const that = this;

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

				videojs.registerComponent(
					'SettingsPanelInner',
					videojs.extend(__SettingsPanelInnerComponent__, composeCustomComp(__SettingsPanelInnerComponent__).methods)
				);

				videojs.registerComponent(
					'SettingsMenu',
					videojs.extend(__SettingsMenuComponent__, composeCustomComp(__SettingsMenuComponent__).methods)
				);

				if (args.enabledPlaybackSpeedPanel) {
					struct.settingsPanel.children.settingsPanelInner.children.settingsMenu.children.selectedPlaybackSpeed = {
						children: {
							selectedPlaybackSpeedLabel: null,
							selectedPlaybackSpeedContent: null,
						},
					};

					tmp = composeCustomComp(__SettingsMenuItemComponent__, 'vjs-selected-speed');

					tmp.methods.handleClick = function (ev) {
						this.player_.trigger('openPlaybackSpeedOptions', !ev.screenX && !ev.screenY);
					};

					videojs.registerComponent('SelectedPlaybackSpeed', videojs.extend(tmp.extend, tmp.methods));
					videojs.registerComponent(
						'SelectedPlaybackSpeedLabel',
						videojs.extend(
							__SettingsMenuItemLabelComponent__,
							composeCustomComp(__SettingsMenuItemLabelComponent__, null, 'Playback speed').methods
						)
					);

					tmp = composeCustomComp(__SettingsMenuItemContentComponent__, null, args.selectedPlaybackSpeed);

					tmp.methods.constructor = function () {
						videojsComponent.apply(this, arguments);
						const that = this;
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
							selectedResolutionContent: null,
						},
					};

					tmp = composeCustomComp(__SettingsMenuItemComponent__, 'vjs-selected-quality');

					tmp.methods.handleClick = function (ev) {
						this.player_.trigger('openQualityOptions', !ev.screenX && !ev.screenY);
					};

					videojs.registerComponent('SelectedResolution', videojs.extend(tmp.extend, tmp.methods));
					videojs.registerComponent(
						'SelectedResolutionLabel',
						videojs.extend(
							__SettingsMenuItemLabelComponent__,
							composeCustomComp(__SettingsMenuItemLabelComponent__, null, 'Quality').methods
						)
					);

					tmp = composeCustomComp(__SettingsMenuItemContentComponent__, null, args.selectedResolution);

					tmp.methods.constructor = function () {
						videojsComponent.apply(this, arguments);
						const that = this;
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
										resolutionsMenuBackButton: null,
									},
								},
								resolutionsMenu: { children: {} },
							},
						},
					},
				};

				tmp = composeCustomComp(__SettingsPanelComponent__, 'vjs-resolutions-panel');

				tmp.methods.constructor = function () {
					videojsComponent.apply(this, arguments);

					this.setAttribute('class', this.buildCSSClass());

					const that = this;

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

				videojs.registerComponent(
					'ResolutionsPanelInner',
					videojs.extend(__SettingsPanelInnerComponent__, composeCustomComp(__SettingsPanelInnerComponent__).methods)
				);

				videojs.registerComponent(
					'ResolutionsMenu',
					videojs.extend(__SettingsMenuComponent__, composeCustomComp(__SettingsMenuComponent__).methods)
				);

				videojs.registerComponent(
					'ResolutionsMenuTitle',
					videojs.extend(
						__SettingsPanelTitleComponent__,
						composeCustomComp(__SettingsPanelTitleComponent__, 'vjs-settings-back').methods
					)
				);

				tmp = composeCustomComp(__MediaCMSButtonClickableComponent__, null, 'Quality');
				tmp.methods.handleClick = function (ev) {
					this.player_.trigger('closeQualityOptions', !ev.screenX && !ev.screenY);
				};

				videojs.registerComponent('ResolutionsMenuBackButton', videojs.extend(tmp.extend, tmp.methods));

				const resolutionKeys = (function () {
					let i;
					const ret = [];
					const keys = Object.keys(args.resolutions);
					const stringKeys = [];
					const numericKeys = [];

					i = 0;
					while (i < keys.length) {
						if (isNaN(0 + keys[i])) {
							stringKeys.push(keys[i]);
						} else {
							numericKeys.push([parseFloat(keys[i]), keys[i]]);
						}
						i += 1;
					}

					numericKeys.sort((a, b) => b[0] - a[0]);

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
				})();

				i = 0;
				while (i < resolutionKeys.length) {
					k = resolutionKeys[i];

					struct.resolutionsPanel.children.resolutionsPanelInner.children.resolutionsMenu.children['resolutionOption_' + k] =
						{
							children: {
								['resolutionOption_' + k + '_content']: null,
							},
						};

					(function (key, title) {
						tmp = composeCustomComp(
							__SettingsMenuItemComponent__,
							key.toString() === pluginInstanceRef.state.theSelectedQuality.toString() ? 'vjs-selected-menu-item' : null,
							null /*, { 'data-opt': key }*/
						);

						tmp.methods.constructor = function () {
							__SettingsMenuItemComponent__.apply(this, arguments);
							const that = this;
							this.qualityKey = key;
							this.setAttribute('data-opt', key);
							pluginInstanceRef.on(this.player_, ['updatedSelectedQuality'], function () {
								videojs.dom[that.qualityKey === this.state.theSelectedQuality ? 'addClass' : 'removeClass'](
									that.el_,
									'vjs-selected-menu-item'
								);
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
										playbackSpeedsMenuBackButton: null,
									},
								},
								playbackSpeedsMenu: { children: {} },
							},
						},
					},
				};

				tmp = composeCustomComp(__SettingsPanelComponent__, 'vjs-playback-speed-panel');

				tmp.methods.constructor = function () {
					videojsComponent.apply(this, arguments);

					this.setAttribute('class', this.buildCSSClass());

					const that = this;

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

				videojs.registerComponent(
					'PlaybackSpeedsPanelInner',
					videojs.extend(__SettingsPanelInnerComponent__, composeCustomComp(__SettingsPanelInnerComponent__).methods)
				);

				videojs.registerComponent(
					'PlaybackSpeedsMenu',
					videojs.extend(__SettingsMenuComponent__, composeCustomComp(__SettingsMenuComponent__).methods)
				);

				videojs.registerComponent(
					'PlaybackSpeedsMenuTitle',
					videojs.extend(
						__SettingsPanelTitleComponent__,
						composeCustomComp(__SettingsPanelTitleComponent__, 'vjs-settings-back').methods
					)
				);

				tmp = composeCustomComp(__MediaCMSButtonClickableComponent__, null, 'Playback speed');
				tmp.methods.handleClick = function (ev) {
					this.player_.trigger('closePlaybackSpeedOptions', !ev.screenX && !ev.screenY);
				};

				videojs.registerComponent('PlaybackSpeedsMenuBackButton', videojs.extend(tmp.extend, tmp.methods));

				for (k in args.playbackSpeeds) {
					if (args.playbackSpeeds.hasOwnProperty(k)) {
						struct.playbackSpeedsPanel.children.playbackSpeedsPanelInner.children.playbackSpeedsMenu.children[
							'playbackSpeedOption_' + args.playbackSpeeds[k].speed
						] = {
							children: {
								['playbackSpeedOption_' + args.playbackSpeeds[k].speed + '_content']: null,
							},
						};

						(function (key, title) {
							tmp = composeCustomComp(
								__SettingsMenuItemComponent__,
								key.toString() === pluginInstanceRef.state.theSelectedPlaybackSpeed.toString()
									? 'vjs-selected-menu-item'
									: null,
								null /*, { 'data-opt': key }*/
							);

							tmp.methods.constructor = function () {
								__SettingsMenuItemComponent__.apply(this, arguments);
								const that = this;
								this.playbackSpeedKey = key;
								this.setAttribute('data-opt', key);
								pluginInstanceRef.on(this.player_, ['updatedSelectedPlaybackSpeed'], function () {
									videojs.dom[that.playbackSpeedKey === this.state.theSelectedPlaybackSpeed ? 'addClass' : 'removeClass'](
										that.el_,
										'vjs-selected-menu-item'
									);
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
				struct.leftControls = { children: {} };

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

				/*if( args.options.controlBar.previous ){

                    struct.leftControls.children.previous = null;
                }

                if( args.options.controlBar.next ){
                    // videojs.registerComponent("Next", videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__, 'vjs-bottom-bg' ).methods));
                    videojs.registerComponent("Next", videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__, 'vjs-bottom-bg' ).methods));

                    struct.leftControls.children.next = null;
                }*/

				if (args.options.controlBar.volume) {
					struct.leftControls.children.volumePanel = null;
				}

				if (args.options.controlBar.time) {
					struct.leftControls.children.currentTimeDisplay = null;
					struct.leftControls.children.timeDivider = null;
					struct.leftControls.children.durationDisplay = null;
				}

				/*console.log( struct.leftControls.children );*/

				videojs.registerComponent(
					'LeftControls',
					videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-left-controls').methods)
				);

				break;
			case '__rightControls':
				struct.rightControls = { children: {} };

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

				videojs.registerComponent(
					'RightControls',
					videojs.extend(__MediaCMSComponent__, composeCustomComp(__MediaCMSComponent__, 'vjs-right-controls').methods)
				);

				if (args.options.subtitles) {
					tmp = composeCustomComp(videojsComponentButton, 'vjs-subtitles-control');

					tmp.methods.handleClick = function (ev) {
						this.player_.trigger(
							pluginInstanceRef.state.isOpenSubtitlesOptions ? 'closeSubtitlesPanel' : 'openSubtitlesPanel',
							!ev.screenX && !ev.screenY
						);
					};

					videojs.registerComponent('SubtitlesToggle', videojs.extend(tmp.extend, tmp.methods));
				}

				if (args.enabledSettingsPanel) {
					tmp = composeCustomComp(videojsComponentButton, 'vjs-settings-control vjs-icon-cog');

					tmp.methods.handleClick = function (ev) {
						this.player_.trigger(
							pluginInstanceRef.state.isOpenSettingsOptions ? 'closeSettingsPanel' : 'openSettingsPanel',
							!ev.screenX && !ev.screenY
						);
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
		let struct = {};

		const enabledResolutionsPanel =
			void 0 !== options.resolutions &&
			void 0 !== options.resolutions.options &&
			!!Object.keys(options.resolutions.options).length;
		const enabledPlaybackSpeedPanel =
			void 0 !== options.playbackSpeeds &&
			void 0 !== options.playbackSpeeds.options &&
			!!Object.keys(options.playbackSpeeds.options).length;

		const enabledSettingsPanel = enabledResolutionsPanel || enabledPlaybackSpeedPanel; // @note: At the moment the only setting option is video resolution.

		if (options.controlBar.bottomBackground) {
			initComponents(pluginInstanceRef, 'bottomBackground', struct);
		}

		if (options.controlBar.progress) {
			initComponents(pluginInstanceRef, 'progressControl', struct);
		}

		if (enabledResolutionsPanel) {
			initComponents(pluginInstanceRef, '__resolution', struct, { resolutions: options.resolutions.options });
		}

		if (enabledPlaybackSpeedPanel) {
			initComponents(pluginInstanceRef, '__playbackSpeed', struct, { playbackSpeeds: options.playbackSpeeds.options });
		}

		if (options.subtitles) {
			initComponents(pluginInstanceRef, '__subtitles', struct, { options: options });
		}

		if (enabledSettingsPanel) {
			if (enabledResolutionsPanel && enabledPlaybackSpeedPanel) {
				initComponents(pluginInstanceRef, '__settings', struct, {
					enabledResolutionsPanel: enabledResolutionsPanel,
					selectedResolution: enabledResolutionsPanel ? options.resolutions.default : null,
					enabledPlaybackSpeedPanel: enabledPlaybackSpeedPanel,
					selectedPlaybackSpeed: enabledPlaybackSpeedPanel ? options.playbackSpeeds.default : null,
				});
			} else if (enabledResolutionsPanel) {
				initComponents(pluginInstanceRef, '__settings', struct, {
					enabledResolutionsPanel: enabledResolutionsPanel,
					selectedResolution: enabledResolutionsPanel ? options.resolutions.default : null,
				});
			} else if (enabledPlaybackSpeedPanel) {
				initComponents(pluginInstanceRef, '__settings', struct, {
					enabledPlaybackSpeedPanel: enabledPlaybackSpeedPanel,
					selectedPlaybackSpeed: enabledPlaybackSpeedPanel ? options.playbackSpeeds.default : null,
				});
			}
		}

		if (
			options.controlBar.play ||
			options.controlBar.previous ||
			options.controlBar.next ||
			options.controlBar.volume ||
			options.controlBar.time
		) {
			initComponents(pluginInstanceRef, '__leftControls', struct, { options: options });
		}

		if (
			enabledSettingsPanel ||
			options.subtitles ||
			options.controlBar.theaterMode ||
			options.controlBar.fullscreen ||
			options.controlBar.pictureInPictureToggle
		) {
			initComponents(pluginInstanceRef, '__rightControls', struct, {
				options: options,
				enabledSettingsPanel: enabledSettingsPanel,
			});
		}

		return { children: struct };
	}

	/* ################################################## */

	function setControlBarComponents(pluginInstncRef, options, player) {
		if (isDefined(options) && isDefined(options.controlBar)) {
			generateControlBarComponents(pluginInstncRef)(
				controlBarComponentsStructs(pluginInstncRef, options),
				player.getChild('controlBar')
			);
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

	function removeClassname(el, cls) {
		if (el.classList) {
			el.classList.remove(cls);
		} else {
			el.className = el.className.replace(new RegExp('(^|\\b)' + cls.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
		}
	}

	function addClassname(el, cls) {
		if (el.classList) {
			el.classList.add(cls);
		} else {
			el.className += ' ' + cls;
		}
	}

	function centralizeBoxPosition(vw, vh, vr, pw, ph, pr) {
		const ret = {};

		const videoRatio = isDefined(vr) && !isNull(vr) ? vr : vw / vh,
			playerRatio = isDefined(pr) && !isNull(pr) ? pr : pw / ph,
			playerVerticalOrientation = 1 > playerRatio,
			videoVerticalOrientation = 1 > videoRatio;

		if (!playerVerticalOrientation) {
			if (!videoVerticalOrientation) {
				// Both ARE NOT "vertical";

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
				// Video IS "vertical" and player IS NOT "vertical";

				if (vh >= ph) {
					ret.h = ph;
					ret.w = ret.h * videoRatio;
				} else {
					ret.w = vw;
					ret.h = vh;
				}
			}
		} else if (!videoVerticalOrientation) {
			// Player IS "vertical" and video IS NOT "vertical";

			if (vw >= pw) {
				ret.w = pw;
				ret.h = ret.w / videoRatio;
			} else {
				ret.w = vw;
				ret.h = vh;
			}
		} else {
			// Both ARE "vertical";

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

	function isString(v) {
		return 'string' === typeof v || v instanceof String;
	}

	function isDefined(v) {
		return void 0 != v;
	}

	function isNull(v) {
		return null === v;
	}

	function isArray(v) {
		return !Array.isArray ? '[object Array]' === Object.prototype.toString.call(v) : Array.isArray(v);
	}

	function ifBooleanElse(bol, els) {
		return isBoolean(bol) ? bol : els;
	}

	function applyCssTransform(elem, val) {
		val = val.replace(/ /g, ''); // Remove all blank characters, otherwise doesn't work in IE.
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
			const x = availabeResolutions[defaultResolution];
			let i = 0;
			while (i < x.src.length) {
				if (defaultSource === x.src[i] /*|| -1 < defaultSource.indexOf( x.src[i] )*/) {
					// console.log( "C", { defaultResolution: defaultResolution, format: x.format[i], order: i } );

					return { defaultResolution: defaultResolution, format: x.format[i], order: i };
				}
				i += 1;
			}
		}
		// console.warn( 'Default Source: ', defaultSource );
		// console.warn( 'Selected resolution: ', defaultResolution );
		// console.warn( 'Video Resolutions: ', availabeResolutions );
		// console.log( availabeResolutions[defaultResolution].format[0] );
		// return null;

		let k, j;
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

						// console.log( "A", { defaultResolution: k, format: availabeResolutions[k].format[j], order: j }, defaultSource );

						return { defaultResolution: k, format: availabeResolutions[k].format[j], order: j };
					}

					j += 1;
				}
			}
		}

		// console.log( "B", { defaultResolution: defaultResolution, format: availabeResolutions[defaultResolution].format[0], order: 0 } );

		return { defaultResolution: defaultResolution, format: availabeResolutions[defaultResolution].format[0], order: 0 };
	}

	function initElementsFocus(player) {
		var controlBar = player.getChild('controlBar');

		var progressControl = void 0 === controlBar ? controlBar : controlBar.getChild('progressControl');
		var leftControls = void 0 === controlBar ? controlBar : controlBar.getChild('leftControls');
		var rightControls = void 0 === controlBar ? controlBar : controlBar.getChild('rightControls');

		var volumePanel = void 0 === leftControls ? leftControls : leftControls.getChild('volumePanel');
		var volumeControl = void 0 === volumePanel ? volumePanel : volumePanel.getChild('volumeControl');

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
			seekBar: void 0 === progressControl ? progressControl : progressControl.getChild('seekBar'),
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

	/* ################################################## */

	function videoPreviewThumb(player, options) {
		player.getChild('ControlBar').getChild('ProgressControl').getChild('SeekBar').removeChild('MouseTimeDisplay');

		var halfThumbWidth = -1;

		var defaults = {
			frame: {
				width: 160,
				height: 120,
			},
		};

		function extend() {
			var args = Array.prototype.slice.call(arguments);
			var target = args.shift() || {};
			var i, obj, prop;
			for (i in args) {
				obj = args[i];
				for (prop in obj) {
					if (obj.hasOwnProperty(prop)) {
						target[prop] = 'object' === typeof obj[prop] ? extend(target[prop], obj[prop]) : obj[prop];
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
			timeDisplayInner: document.createElement('div'),
		};

		var innerBorderWidth = {
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
		};

		var progressControl = player.controlBar.childNameIndex_.ProgressControl;
		var progressControlElem;

		var seekBar = progressControl.childNameIndex_.SeekBar;

		var duration = player.duration();
		var isFullscreen = player.isFullscreen();

		var settings = extend({}, defaults, options);

		/*settings.frame.height = defaults.width / ( settings.frame.width / settings.frame.height );
        settings.frame.width = defaults.width;*/

		/*settings.frame.width = ( settings.frame.width / settings.frame.height ) * defaults.width;
        settings.frame.height = defaults.height;*/

		/*settings.frame.height = 192 / ( settings.frame.width / settings.frame.height );
        settings.frame.width = 192;*/

		spriteDom.wrap.className = 'vjs-preview-thumb';
		spriteDom.inner.className = 'vjs-preview-thumb-inner';
		spriteDom.inner.style.backgroundImage = 'url(' + settings.url + ')';
		spriteDom.timeDisplay.className = 'vjs-preview-thumb-time-display';
		spriteDom.timeDisplayInner.innerHTML = '0:00';

		var spriteHeight = 0;

		player.on('durationchange', function (e) {
			duration = player.duration();
		}); // when the container is MP4.
		player.on('loadedmetadata', function (e) {
			duration = player.duration();
		}); // when the container is HLS.

		player.on('fullscreenchange', function (e) {
			setTimeout(function () {
				isFullscreen = player.isFullscreen();
				updateDimensions();
			}, 100);
		});

		player.one('playing', function (e) {
			// @note: Listener bind once.

			updateDimensions();

			player.addClass('vjs-enabled-preview-thumb'); // @note: Enable preview functionality.

			spriteDom.img.onload = function () {
				var innerStyles = getAllComputedStyles(spriteDom.inner);

				if (void 0 !== innerStyles) {
					innerBorderWidth.top = parseFloat(innerStyles.borderTopWidth);
					innerBorderWidth.left = parseFloat(innerStyles.borderLeftWidth);
					innerBorderWidth.right = parseFloat(innerStyles.borderRightWidth);
					innerBorderWidth.bottom = parseFloat(innerStyles.borderBottomWidth);
				}

				spriteHeight = this.naturalHeight;

				spriteDom.img = void 0; // Unset image element.

				updateDimensions();
			};

			spriteDom.img.src = settings.url;
		});

		function moveListener(event) {
			progressControlElem = progressControlElem || progressControl.el();

			var progressControlClientRect = offsetParent(progressControlElem).getBoundingClientRect();

			var pageXOffset = window.pageXOffset ? window.pageXOffset : document.documentElement.scrollLeft;
			var pageX = event.changedTouches ? event.changedTouches[0].pageX : event.pageX;

			var left =
				(pageX || event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft) -
				(progressControlClientRect.left + pageXOffset);
			var right = (progressControlClientRect.width || progressControlClientRect.right) + pageXOffset;

			var mouseTime = !spriteHeight
				? 0
				: Math.min(
						(spriteHeight / settings.frame.height) * settings.frame.seconds - 1,
						Math.floor(((left - progressControlElem.offsetLeft) / progressControl.width()) * duration)
				  );

			spriteDom.timeDisplayInner.innerHTML = videojs.formatTime(duration * (left / right));

			if (left < halfThumbWidth) {
				left = halfThumbWidth;
			} else if (left > right - halfThumbWidth) {
				left = right - halfThumbWidth;
			}

			spriteDom.wrap.style.transform = 'translate(' + Math.min(right - halfThumbWidth, left) + 'px, 0px)';

			spriteDom.inner.style.backgroundPositionY =
				(isFullscreen ? -1.5 : -1) * settings.frame.height * Math.floor(mouseTime / settings.frame.seconds) + 'px';
		}

		progressControl.on('mouseover', moveListener);
		progressControl.on('mousemove', moveListener);

		spriteDom.timeDisplay.appendChild(spriteDom.timeDisplayInner);
		spriteDom.inner.appendChild(spriteDom.timeDisplay);
		spriteDom.wrap.appendChild(spriteDom.inner);

		progressControl.el_.appendChild(spriteDom.wrap);
	}

	/* ################################################## */

	const VideojsPluginClass = videojs.getPlugin('plugin');

	class MediaCmsVjsPlugin extends VideojsPluginClass {
		/**
		 * Create a MediaCmsVjsPlugin plugin instance.
		 *
		 * @param  {Player} player              VideoJs Player instance.
		 * @param  {Object} options             Optional plugin options value.
		 * @param  {Object} state               Optional initial player state values.
		 * @param  {Function} stateUpdateCallback The function that will be triggered on state values change.
		 * @return {void}
		 */
		constructor(
			player,
			domElem,
			options,
			state,
			resolutions,
			playbackSpeeds,
			stateUpdateCallback,
			nextButtonClickCallback,
			previousButtonClickCallback
		) {
			super(player, options);

			if (!options.sources.length) {
				console.warn('Missing media source');
				return;
			}

			options.enabledTouchControls = !!videojs.TOUCH_ENABLED ? true : options.enabledTouchControls;

			/**
			 * Filter input state values.
			 *
			 * @param  {Object} st Plugin state values.
			 * @return {Object}    Plugin state filtered/validated values.
			 */
			function filterState(st) {
				const ret = {};

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
					let resolutionKeys = Object.keys(resolutions);
					ret.theSelectedQuality =
						!st || void 0 === st.theSelectedQuality || void 0 === resolutions[st.theSelectedQuality]
							? resolutionKeys[Math.floor(resolutionKeys.length / 2)]
							: st.theSelectedQuality;
				}

				if (Object.keys(playbackSpeeds).length) {
					if (!!st.theSelectedPlaybackSpeed) {
						let k;
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

			this.videoHtmlElem = domElem;

			this.initedVideoPreviewThumb = false;

			this.videoPreviewThumb = null;

			if (
				!!!videojs.TOUCH_ENABLED &&
				!!options.videoPreviewThumb &&
				void 0 !== options.videoPreviewThumb.url &&
				void 0 !== options.videoPreviewThumb.frame &&
				!isNaN(options.videoPreviewThumb.frame.width) &&
				!isNaN(options.videoPreviewThumb.frame.height) &&
				!isNaN(options.videoPreviewThumb.frame.seconds)
			) {
				this.videoPreviewThumb = options.videoPreviewThumb;
			}

			this.enabledFullscreenToggle = options.controlBar.fullscreen;
			this.enabledTheaterMode = options.controlBar.theaterMode;

			this.playbackSpeeds = playbackSpeeds;

			this.videoResolutions = null;
			this.videoPlaybackSpeeds = null;

			this.timeoutSettingsPanelFocusout = null;
			this.timeoutSubtitlesPanelFocusout = null;
			this.timeoutResolutionsPanelFocusout = null;
			this.timeoutPlaybackSpeedsPanelFocusout = null;

			this.actionAnimationTimeout = null;

			this.seekingTimeout = null;

			this.updateTime = 0;
			this.pausedTime = -1;

			this.seeking = false;
			this.wasPlayingOnResolutionChange = false;
			this.hadStartedOnResolutionChange = false;

			this.isChangingResolution = false;

			this.videoNativeDimensions = options.nativeDimensions;

			// Filter state object values.

			this.setState(videojs.mergeOptions(this.state, filterState(state)));

			// Set state values update callback function.

			this.stateUpdateCallback = stateUpdateCallback instanceof Function ? stateUpdateCallback : null;
			this.nextButtonClickCallback = nextButtonClickCallback instanceof Function ? nextButtonClickCallback : null;
			this.previousButtonClickCallback =
				previousButtonClickCallback instanceof Function ? previousButtonClickCallback : null;

			// Set video resolutions info.

			if (this.state.theSelectedQuality) {
				this.videoResolutions = resolutions;

				this.videoFormat = extractSupportedAndUsedVideoFormat(
					this.player.src(),
					this.state.theSelectedQuality,
					this.videoResolutions
				);

				this.state.theSelectedQuality = this.videoFormat.defaultResolution;

				this.videoFormat = { format: this.videoFormat.format, order: this.videoFormat.order };

				options.resolutions = {
					default: this.state.theSelectedQuality,
					options: this.videoResolutions,
				};
			}

			// Set video playback speed info.

			if (this.state.theSelectedPlaybackSpeed) {
				this.videoPlaybackSpeeds = playbackSpeeds;

				options.playbackSpeeds = {
					default: this.state.theSelectedPlaybackSpeed,
					options: this.videoPlaybackSpeeds,
				};
			}

			// Set video subtitles info.

			if (void 0 !== state.theSelectedSubtitleOption && null !== state.theSelectedSubtitleOption) {
				this.state.theSelectedSubtitleOption = state.theSelectedSubtitleOption;
			}

			if (
				!!!options.subtitles ||
				!!!options.subtitles.languages ||
				!!!options.subtitles.languages.length ||
				!options.subtitles.languages.length
			) {
				options.subtitles = null;
			} else {
				options.subtitles.languages.unshift({ label: 'Off', srclang: 'off', src: null });
			}

			this.subtitles = options.subtitles;

			// Set player actions animations components.

			setActionsAnimationsComponents(this, options, player);

			// Replace LoadingSpinner component.

			replaceLoadingSpinnerComponent(this);

			// Set corner layers components.

			setCornerLayersComponents(this, options);

			if (options.enabledTouchControls) {
				// Set player touch actions components.

				setTouchControlComponents(this, options);
			}

			// Set control bar components.

			setControlBarComponents(this, options, player);

			// Initial...

			this.csstransforms = browserSupports('csstransforms');

			player.addClass('vjs-loading-video');

			if (this.videoNativeDimensions) {
				player.addClass('vjs-native-dimensions');
			}

			if (options.enabledTouchControls) {
				player.addClass('vjs-enabled-touch-controls');
			}

			this.progressBarLine = null;

			this.onBandwidthUpdate = null;
			this.onHlsRetryPlaylist = null;

			// Set events listeners.

			if (options.keyboardControls) {
				this.player.el_.onkeyup = this.onKeyUp.bind(this);
				this.player.el_.onkeydown = this.onKeyDown.bind(this);
			}

			this.onError = this.onError.bind(this);

			this.on(player, ['error'], this.onError);

			this.on(player, ['dispose'], this.onDispose); // @todo: Make improvements based on 'dispose' result.

			this.on(player, ['ended'], this.onEnded);
			this.on(player, ['volumechange'], this.onVolumeChange);
			this.on(player, ['playing', 'pause'], this.onPlayToggle);

			this.on(player, ['timeupdate'], this.onTimeUpdateChange);

			this.on(player, ['fullscreenchange'], this.onFullscreenChange);

			this.on(player, ['theatermodechange'], this.onTheaterModeChange);

			this.on(player, ['openSettingsPanel'], this.openSettingsOptions);
			this.on(player, ['closeSettingsPanel'], this.closeSettingsOptions);

			this.on(player, ['openSubtitlesPanel'], this.openSubtitlesOptions);
			this.on(player, ['closeSubtitlesPanel'], this.closeSubtitlesOptions);

			this.on(player, ['openQualityOptions'], this.openQualityOptions);
			this.on(player, ['closeQualityOptions'], this.closeQualityOptions);

			this.on(player, ['openPlaybackSpeedOptions'], this.openPlaybackSpeedOptions);
			this.on(player, ['closePlaybackSpeedOptions'], this.closePlaybackSpeedOptions);

			this.on(player, ['selectedQuality'], this.onQualitySelection);
			this.on(player, ['selectedSubtitleOption'], this.onSubtitleOptionSelection);
			this.on(player, ['selectedPlaybackSpeed'], this.onPlaybackSpeedSelection);

			this.on(player, ['focusoutSettingsPanel'], this.onFocusOutSettingsPanel);
			this.on(player, ['focusoutSubtitlesPanel'], this.onFocusOutSubtitlesPanel);
			this.on(player, ['focusoutResolutionsPanel'], this.onFocusOutResolutionsPanel);
			this.on(player, ['focusoutPlaybackSpeedsPanel'], this.onFocusOutPlaybackSpeedsPanel);

			this.on(player, ['moveforward'], this.onMoveForward);
			this.on(player, ['movebackward'], this.onMoveBackward);

			this.on(player, ['userinactive'], this.onUserInactive);

			this.on(player, ['seeked'], this.onSeeked);
			this.on(player, ['seeking'], this.onSeeking);

			this.on('statechanged', this.onStateChange);

			this.hasPrevious = !!options.controlBar.previous;
			this.hasNext = !!options.controlBar.next;

			if (this.hasPrevious /*&& 'function' === typeof onPrevButtonClick*/) {
				this.on(player, ['clicked_previous_button'], this.onPreviousButtonClick);
			}

			if (this.hasNext /*&& 'function' === typeof onNextButtonClick*/) {
				this.on(player, ['clicked_next_button'], this.onNextButtonClick);
			}

			this.onPlayerReady = this.onPlayerReady.bind(this);

			player.ready(this.onPlayerReady);

			initElementsFocus(player);
		}

		onPreviousButtonClick() {
			if (this.hasPrevious) {
				this.actionAnimation('play_previous');

				if (this.previousButtonClickCallback) {
					this.previousButtonClickCallback();
				}
			}
		}

		onNextButtonClick() {
			if (this.hasNext) {
				this.actionAnimation('play_next');

				if (this.nextButtonClickCallback) {
					this.nextButtonClickCallback();
				}
			}
		}

		actionAnimation(action) {
			if (!this.player.hasStarted_) {
				return;
			}

			this.actionAnimElem = this.actionAnimElem || this.player.el_.querySelector('.vjs-actions-anim');

			if (!this.actionAnimElem) {
				return;
			}

			let cls;

			switch (action) {
				case 'play':
					if (
						void 0 !== this.previousActionAnim &&
						'forward' !== this.previousActionAnim &&
						'backward' !== this.previousActionAnim
					) {
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

			setTimeout(
				function () {
					this.previousActionAnim = action;

					cls += ' active-anim';

					clearTimeout(this.actionAnimationTimeout);

					this.actionAnimElem.setAttribute('class', 'vjs-actions-anim ' + cls);

					this.actionAnimationTimeout = setTimeout(
						function (ins) {
							ins.actionAnimElem.setAttribute('class', 'vjs-actions-anim');
							ins.actionAnimationTimeout = null;
							ins.previousActionAnim = null;
						},
						750,
						this
					);
				}.bind(this),
				this.actionAnimationTimeout ? 20 : 0
			);
		}

		onMoveForward() {
			this.actionAnimation('forward');
		}

		onMoveBackward() {
			this.actionAnimation('backward');
		}

		onKeyDown(e) {
			if (this.player.ended()) {
				// @todo: Should be better to unbind listeners on ended ...? Maybe not ...?
				return;
			}

			const key = e.keyCode || e.charCode;
			let found = false;

			switch (key) {
				case 32: // Play/Pause [Space].
					this.player[this.player.paused() ? 'play' : 'pause']();
					found = true;
					break;
				case 37: // Move backward [Arrow Left].
					this.player.currentTime(this.player.currentTime() - 5 * this.state.theSelectedPlaybackSpeed);
					this.player.trigger('movebackward');
					found = true;
					break;
				case 38: // Volume Up [Arrow Up].
					if (this.player.muted()) {
						this.player.muted(false);
					} else {
						this.player.volume(Math.min(1, this.player.volume() + 0.03));
					}
					found = true;
					break;
				case 39: // Move forward [Arrow Right].
					this.player.currentTime(this.player.currentTime() + 5 * this.state.theSelectedPlaybackSpeed);
					this.player.trigger('moveforward');
					found = true;
					break;
				case 40: // Volume Down [Arrow Down].
					this.player.volume(Math.max(0, this.player.volume() - 0.03));
					found = true;
					break;
			}

			if (found) {
				e.preventDefault();
				e.stopPropagation();
			}
		}

		onKeyUp(e) {
			if (this.player.ended()) {
				// @todo: Should be better to unbind listeners on ended ...? Maybe not ...?
				return;
			}

			const key = e.keyCode || e.charCode;
			let found = false;

			if (e.shiftKey) {
				switch (key) {
					case 78: // Next media [ shift + n ].
						this.onNextButtonClick();
						break;
					case 80: // Previous media [ shift + p ].
						this.onPreviousButtonClick();
						break;
				}
			} else if ((48 <= key && 57 >= key) || (96 <= key && 105 >= key)) {
				// Numbers from 0 to 9.
				this.player.currentTime(0.1 * (57 < key ? key - 96 : key - 48) * this.player.duration());

				this.player.trigger({ type: 'timeupdate', target: this, manuallyTriggered: true });
			} else {
				switch (key) {
					case 75: // Play/Pause [k].
						this.player[this.player.paused() ? 'play' : 'pause']();
						found = true;
						break;
					case 70: // Enter - exit fullscreen mode [f].
						if (this.enabledFullscreenToggle) {
							if (this.player.isFullscreen()) {
								this.player.exitFullscreen();
							} else {
								this.player.requestFullscreen();
							}
							found = true;
						}
						break;
					case 77: // Mute - unmute sound [m].
						this.player.muted(!this.player.muted());
						found = true;
						break;
					case 84: // Enable - disable theater mode [t].
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

		onUserInactive() {
			if (this.state.isOpenQualityOptions || this.state.isOpenPlaybackSpeedOptions || this.state.isOpenSettingsOptions) {
				this.player.trigger('closeSettingsPanel');
			}
		}

		onSeeked() {
			this.seekingTimeout = setTimeout(
				function (ins) {
					ins.seeking = false;
				},
				300,
				this
			);
		}

		onSeeking() {
			// console.log( "1." );

			clearTimeout(this.seekingTimeout);

			this.seeking = true;

			if (!!this.progressBarLine) {
				this.progressBarLine.style.width = ((100 * this.player.currentTime()) / this.player.duration()).toFixed(2) + '%';
			}
		}

		initDomEvents() {
			this.onWindowResize = this.onWindowResize.bind(this);

			window.addEventListener('resize', this.onWindowResize);

			this.videoHtmlElem.onloadeddata = this.onVideoDataLoad.bind(this);

			// Video has already loaded.
			if (4 === this.videoHtmlElem.readyState) {
				this.onVideoDataLoad();
			}
		}

		onVideoMetaDataLoad() {}

		onVideoDataLoad() {
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
					// @note: Catch invalid playlists when selected resolution is not "Auto".
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

		onBandwidthUpdateCallback(ev) {
			this.onAutoQualitySelection(this.player.tech_.hls.playlists.media_.attributes.RESOLUTION.height);
		}

		onHlsRetryPlaylistCallback(ev) {
			if ('Auto' !== this.state.theSelectedQuality && void 0 !== this.videoResolutions['Auto']) {
				this.setState({
					theSelectedQuality: 'Auto',
				});
			}
		}

		/**
		 * The method that'll be called when player is ready.
		 *
		 */
		onPlayerReady() {
			// console.log( this.player.textTracks(), this.subtitles );

			if (null !== this.subtitles) {
				const subtitleLanguages = [];
				let i;
				let track;
				let tracks = this.player.textTracks();

				for (i = 0; i < tracks.length; i++) {
					subtitleLanguages.push(tracks[i].language);
				}

				i = 1; // Exclude 'off' language option.
				while (i < this.subtitles.languages.length) {
					if (-1 === subtitleLanguages.indexOf(this.subtitles.languages[i].srclang)) {
						// console.log('-A-');

						this.player.addRemoteTextTrack({
							kind: 'subtitles',
							label: this.subtitles.languages[i].label,
							language: this.subtitles.languages[i].srclang,
							src: this.subtitles.languages[i].src,
						});
					}

					i += 1;
				}
			}

			// console.log( this.player.textTracks() );
			// console.log( this.player.remoteTextTracks() );

			this.changeVideoSubtitle();

			this.progressBarLine = this.player.el_.querySelector('.video-js .vjs-progress-holder .vjs-play-progress');

			// Initialize events.

			this.initDomEvents();

			// Apply player settings.

			this.player.volume(this.state.volume);
			this.player.muted(this.state.soundMuted);
			this.player.playbackRate(this.state.theSelectedPlaybackSpeed);

			// Apply classname in DOM elements.

			this.player.addClass('vjs-mediacms-plugin');

			this.updateTheaterModeClassname();

			// Trigger states changes, if need.

			setTimeout(
				function (ins) {
					ins.updateVideoPlayerRatios();
				},
				100,
				this
			);
		}

		changeVideoSubtitle() {
			// console.log( this.player.textTracks() );
			// console.log( this.player.textTrackDisplay );
			// console.log( this.player.textTrackSettings );

			if ('off' !== this.state.theSelectedSubtitleOption) {
				this.player.removeClass('vjs-subtitles-off');
				this.player.addClass('vjs-subtitles-on');
			} else {
				this.player.removeClass('vjs-subtitles-on');
				this.player.addClass('vjs-subtitles-off');
			}

			const tracks = this.player.textTracks();

			for (let i = 0; i < tracks.length; i++) {
				// console.log( tracks[i].kind, tracks[i].language, tracks[i].label );

				if ('subtitles' === tracks[i].kind) {
					tracks[i].mode = this.state.theSelectedSubtitleOption === tracks[i].language ? 'showing' : 'hidden';
					// console.log( tracks[i].mode );
				}
			}
		}

		changeVideoResolution() {
			this.isChangingResolution = true;

			const sources = [];
			const currentTime = this.player.currentTime();
			const duration = this.player.duration();

			this.wasPlayingOnResolutionChange = !this.player.paused();
			this.hadStartedOnResolutionChange = this.player.hasStarted();

			if (this.hadStartedOnResolutionChange) {
				this.player.addClass('vjs-changing-resolution');
			}

			/*if( this.wasPlayingOnResolutionChange ){
                this.player.pause();
            }*/

			let i = 0;
			while (i < this.videoResolutions[this.state.theSelectedQuality].src.length) {
				sources.push({ src: this.videoResolutions[this.state.theSelectedQuality].src[i] });
				i += 1;
			}

			this.player.src(sources); // @note: Load all sources (with provided order).
			this.player.techCall_('reset');
			this.player.currentTime(currentTime);
			this.player.duration(duration);
			this.player.playbackRate(this.state.theSelectedPlaybackSpeed);
		}

		changePlaybackSpeed() {
			this.player.playbackRate(this.state.theSelectedPlaybackSpeed);
		}

		onStateChange(d) {
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

				// @note: Need this delay to allow complete function 'updateTheaterModeClassname'.
				setTimeout(
					function (ins) {
						ins.updateVideoPlayerRatios();
					},
					20,
					this
				);
			}

			if (d.changes.isOpenSettingsOptions) {
			}

			if (d.changes.isOpenQualityOptions) {
			}

			if (d.changes.isOpenPlaybackSpeedOptions) {
			}

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

			if (
				d.changes.isOpenSettingsOptions ||
				d.changes.isOpenQualityOptions ||
				d.changes.theSelectedQuality ||
				d.changes.isOpenPlaybackSpeedOptions ||
				d.changes.theSelectedPlaybackSpeed
			) {
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

		onDispose() {
			window.removeEventListener('resize', this.onWindowResize);
		}

		onError(e) {
			if (!this.player.paused()) {
				this.player.pause();
			}
			this.player.techCall_('reset');
		}

		/**
		 * The method that will be called on playback complete.
		 *
		 */
		onEnded() {
			this.setState(this.state, {
				ended: !0,
			});
		}

		/**
		 * The method that will be called on player's volume change.
		 *
		 */
		onVolumeChange() {
			this.setState({
				volume: this.player.volume(),
				soundMuted: this.player.muted(),
			});
			this.actionAnimation('volume');
		}

		/**
		 * The method that will be called on player's "playing" state change.
		 *
		 */
		onPlayToggle(ev) {
			const playing = 'playing' === ev.type;

			if (!this.seeking && 1 > Math.abs(this.updateTimeDiff)) {
				this.actionAnimation(!playing ? 'pause' : 'play');
			}

			this.setState({
				playing: playing,
			});
		}

		onTimeUpdateChange(ev) {
			const ct = this.player.currentTime();
			this.updateTimeDiff = ct - this.updateTime;
			this.updateTime = ct;
		}

		/**
		 * Appends in player's classname the class "vjs-fullscreen-change" for 0.1 second on changing fullscreen state.
		 *
		 */
		onFullscreenChange() {
			this.player.addClass('vjs-fullscreen-change');
			setTimeout(
				function (plr) {
					plr.removeClass('vjs-fullscreen-change');
				},
				100,
				this.player
			);
			this.updateVideoElementPosition();
		}

		/**
		 * The method that will be called on player's "theater mode" state change.
		 *
		 */
		onTheaterModeChange() {
			this.setState({
				theaterMode: !this.state.theaterMode,
			});
		}

		openSettingsOptions(ev, triggeredFromKeyboard) {
			clearTimeout(this.timeoutSettingsPanelFocusout);

			this.setState({
				openSettings: new Date(),
				openSettingsFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
				isOpenSettingsOptions: !0,
				isOpenQualityOptions: !1,
				isOpenPlaybackSpeedOptions: !1,
				isOpenSubtitlesOptions: !1,
			});
		}

		closeSettingsOptions(ev, triggeredFromKeyboard) {
			clearTimeout(this.timeoutSettingsPanelFocusout);

			this.setState({
				closeSettings: new Date(),
				closeSettingsFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
				isOpenSettingsOptions: !1,
				isOpenQualityOptions: !1,
				isOpenPlaybackSpeedOptions: !1,
			});
		}

		openSubtitlesOptions(ev, triggeredFromKeyboard) {
			clearTimeout(this.timeoutSubtitlesPanelFocusout);

			this.setState({
				openSubtitles: new Date(),
				openSubtitlesFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
				isOpenSubtitlesOptions: !0,
				isOpenSettingsOptions: !1,
				isOpenQualityOptions: !1,
				isOpenPlaybackSpeedOptions: !1,
			});
		}

		closeSubtitlesOptions(ev, triggeredFromKeyboard) {
			clearTimeout(this.timeoutSubtitlesPanelFocusout);

			this.setState({
				closeSubtitles: new Date(),
				closeSubtitlesFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
				isOpenSubtitlesOptions: !1,
			});
		}

		openQualityOptions(ev, triggeredFromKeyboard) {
			clearTimeout(this.timeoutResolutionsPanelFocusout);

			this.setState({
				openQualities: new Date(),
				openQualitiesFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
				isOpenSettingsOptions: !1,
				isOpenQualityOptions: !0,
			});
		}

		openPlaybackSpeedOptions(ev, triggeredFromKeyboard) {
			clearTimeout(this.timeoutPlaybackSpeedsPanelFocusout);

			this.setState({
				openPlaybackSpeeds: new Date(),
				openPlaybackSpeedsFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
				isOpenSettingsOptions: !1,
				isOpenPlaybackSpeedOptions: !0,
			});
		}

		closeQualityOptions(ev, triggeredFromKeyboard) {
			clearTimeout(this.timeoutResolutionsPanelFocusout);

			this.setState({
				closeQualities: new Date(),
				closeQualitiesFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
				openSettings: new Date(),
				openSettingsFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
				isOpenSettingsOptions: !0,
				isOpenQualityOptions: !1,
			});
		}

		closePlaybackSpeedOptions(ev, triggeredFromKeyboard) {
			clearTimeout(this.timeoutPlaybackSpeedsPanelFocusout);

			this.setState({
				closePlaybackSpeeds: new Date(),
				closePlaybackSpeedsFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
				openSettings: new Date(),
				openSettingsFromKeyboard: triggeredFromKeyboard ? new Date() : !1,
				isOpenSettingsOptions: !0,
				isOpenPlaybackSpeedOptions: !1,
			});
		}

		onQualitySelection(ev, newQuality) {
			this.setState({
				isOpenSettingsOptions: !1,
				isOpenQualityOptions: !1,
				theSelectedQuality: newQuality,
			});
		}

		onSubtitleOptionSelection(ev, newSelection) {
			this.setState({
				isOpenSubtitlesOptions: !1,
				theSelectedSubtitleOption: newSelection,
			});
		}

		onAutoQualitySelection(newAutoQuality) {
			if (newAutoQuality !== this.state.theSelectedAutoQuality) {
				this.setState({
					theSelectedAutoQuality: newAutoQuality,
				});

				this.player.trigger('updatedSelectedQuality');
			}
		}

		onPlaybackSpeedSelection(ev, newPlaybackSpeed) {
			this.setState({
				isOpenSettingsOptions: !1,
				isOpenPlaybackSpeedOptions: !1,
				theSelectedPlaybackSpeed: newPlaybackSpeed,
			});
		}

		onFocusOutSubtitlesPanel() {
			if (this.timeoutSubtitlesPanelFocusout) {
				return;
			}

			this.player.focus(); // TODO: Remove all this kind of focus(es). Before removal, test the players in MediaCMS, while the window has scrolled down.

			this.timeoutSubtitlesPanelFocusout = setTimeout(
				function (ins) {
					ins.setState({
						isOpenSubtitlesOptions: !1,
					});

					ins.timeoutSubtitlesPanelFocusout = null;
				},
				100,
				this
			);
		}

		onFocusOutSettingsPanel() {
			if (this.timeoutSettingsPanelFocusout) {
				return;
			}

			if (!this.state.isOpenQualityOptions && !this.state.isOpenPlaybackSpeedOptions) {
				this.player.focus();
			}

			if (!this.state.isOpenQualityOptions) {
				this.timeoutSettingsPanelFocusout = setTimeout(
					function (ins) {
						if (ins.state.isOpenSettingsOptions && !ins.state.isOpenQualityOptions) {
							ins.setState({
								isOpenSettingsOptions: !1,
							});
						}
						ins.timeoutSettingsPanelFocusout = null;
					},
					100,
					this
				);
			} else if (!this.state.isOpenPlaybackSpeedOptions) {
				this.timeoutSettingsPanelFocusout = setTimeout(
					function (ins) {
						if (ins.state.isOpenSettingsOptions && !ins.state.isOpenPlaybackSpeedOptions) {
							ins.setState({
								isOpenSettingsOptions: !1,
							});
						}
						ins.timeoutSettingsPanelFocusout = null;
					},
					100,
					this
				);
			}
		}

		onFocusOutResolutionsPanel() {
			if (this.timeoutResolutionsPanelFocusout) {
				return;
			}

			if (!this.state.isOpenSettingsOptions && !this.state.isOpenPlaybackSpeedOptions) {
				this.player.focus();
			}

			if (!this.state.isOpenSettingsOptions) {
				this.timeoutResolutionsPanelFocusout = setTimeout(
					function (ins) {
						if (ins.state.isOpenQualityOptions && !ins.state.isOpenSettingsOptions) {
							ins.setState({
								isOpenQualityOptions: !1,
							});
						}
						ins.timeoutResolutionsPanelFocusout = null;
					},
					100,
					this
				);
			}
		}

		onFocusOutPlaybackSpeedsPanel() {
			if (this.timeoutPlaybackSpeedsPanelFocusout) {
				return;
			}

			if (!this.state.isOpenQualityOptions && !this.state.isOpenSettingsOptions) {
				this.player.focus();
			}

			if (!this.state.isOpenSettingsOptions) {
				this.timeoutPlaybackSpeedsPanelFocusout = setTimeout(
					function (ins) {
						if (ins.state.isOpenPlaybackSpeedOptions && !ins.state.isOpenSettingsOptions) {
							ins.setState({
								isOpenPlaybackSpeedOptions: !1,
							});
						}
						ins.timeoutPlaybackSpeedsPanelFocusout = null;
					},
					100,
					this
				);
			}
		}

		/**
		 * The method that will be called on change one of public (accessible from plugin's instance) state values.
		 *
		 */
		onPublicStateUpdate() {
			if (this.stateUpdateCallback) {
				this.stateUpdateCallback({
					volume: this.state.volume,
					theaterMode: this.state.theaterMode,
					soundMuted: this.state.soundMuted,
					quality: this.state.theSelectedQuality,
					playbackSpeed: this.state.theSelectedPlaybackSpeed,
					subtitle: this.state.theSelectedSubtitleOption,
				});
			}
		}

		onWindowResize() {
			this.updateVideoPlayerRatios();
		}

		updateVideoPlayerRatios() {
			this.setState({
				videoRatio: this.videoHtmlElem.offsetWidth / this.videoHtmlElem.offsetHeight,
				playerRatio: this.player.el_.offsetWidth / this.player.el_.offsetHeight,
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

		/**
		 * Updates player's class attribute value (in DOM), based on "theater mode" state value.
		 *
		 */
		updateTheaterModeClassname() {
			this.player[this.state.theaterMode ? 'addClass' : 'removeClass']('vjs-theater-mode');
		}

		updateVideoElementPosition() {
			if (this.videoHtmlElem) {
				if (this.videoNativeDimensions) {
					const newval = centralizeBoxPosition(
						this.videoHtmlElem.offsetWidth,
						this.videoHtmlElem.offsetHeight,
						this.state.videoRatio,
						this.player.el_.offsetWidth,
						this.player.el_.offsetHeight,
						this.state.playerRatio
					);

					// @note: Don't need because we are set in CSS the properties "max-width:100%;" and "max-height:100%;" of <video> element and wont exceed available player space.
					/* this.videoHtmlElem.style.width = newval.w + 'px';
                    this.videoHtmlElem.style.height = newval.h + 'px';*/

					if (this.csstransforms) {
						applyCssTransform(
							this.videoHtmlElem,
							'translate(' + (newval.l > 0 ? newval.l : '0') + 'px,' + (newval.t > 0 ? newval.t : '0') + 'px)'
						);
					} else {
						this.videoHtmlElem.style.top = newval.t > 0 ? newval.t + 'px' : '';
						this.videoHtmlElem.style.left = newval.l > 0 ? newval.l + 'px' : '';
					}
				} else {
				}
			}
		}

		/**
		 * Get the value of "theater mode" state.
		 *
		 * @return {boolean}  Value of "theater mode" state.
		 */
		isTheaterMode() {
			return this.state.theaterMode;
		}

		/**
		 * Get the value of "fullscreen" state.
		 *
		 * @return {boolean}  Value of "fullscreen" state.
		 */
		isFullscreen() {
			return this.player.isFullscreen();
		}

		/**
		 * Check if media is ended.
		 *
		 * @return {boolean}  Media is ended.
		 */
		isEnded() {
			return this.player.ended();
		}

		selectedQualityTitle() {
			return (
				this.state.theSelectedQuality +
				('Auto' === this.state.theSelectedQuality && null !== this.state.theSelectedAutoQuality
					? "&nbsp;<span class='auto-resolution-title'>" + this.state.theSelectedAutoQuality + '</span>'
					: '')
			);
		}

		selectedPlaybackSpeedTitle() {
			let k;
			for (k in this.playbackSpeeds) {
				if (this.playbackSpeeds.hasOwnProperty(k)) {
					if (this.state.theSelectedPlaybackSpeed === this.playbackSpeeds[k].speed) {
						return this.playbackSpeeds[k].title || this.playbackSpeeds[k].speed;
					}
				}
			}
			return 'n/a';
		}
	}

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
		closeQualitiesFromKeyboard: !1,
	};

	MediaCmsVjsPlugin.VERSION = VERSION;

	videojs.registerPlugin('mediaCmsVjsPlugin', MediaCmsVjsPlugin);

	return MediaCmsVjsPlugin;
}

function generator(/*videojs*/) {
	if (null === Plugin) {
		Plugin = generatePlugin(/*videojs*/);
	}

	return Plugin;
}

const MediaCmsVjsPlugin = generator(/*videsojs*/);

export { MediaCmsVjsPlugin };
