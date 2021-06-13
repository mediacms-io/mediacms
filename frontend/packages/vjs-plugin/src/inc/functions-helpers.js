import {
	composeCustomComp,
	videojsComponent,
	videojsComponentButton,
	__MediaCMSComponent__,
	__MediaCMSButtonClickableComponent__,
	__SettingsPanelComponent__,
	__SettingsPanelInnerComponent__,
	__SettingsPanelTitleComponent__,
	__SettingsMenuComponent__,
	__SettingsMenuItemComponent__,
	__SettingsMenuItemLabelComponent__,
	__SettingsMenuItemContentComponent__
} from './components';

export function generateControlBarComponents(pluginInstanceRef) {

    function childrenGen( parentKey, child, allComps, parentsConn, level ){

        var k, addedChild = false;

        allComps[level]= void 0 === allComps[level] ? [] : allComps[level];

        for( k in child ){
        	
            if( child.hasOwnProperty(k) ){

                if( child[k] && child[k].children ){

                    if( childrenGen( k, child[k].children, allComps, parentsConn, level + 1 ) ){
                        addedChild = true;
                        allComps[level].push(k);
                        parentsConn[k] = parentKey;
                    }
                }
                else {

                    addedChild = true;
                    allComps[level].push(k);
                    parentsConn[k] = parentKey;
                }
            }
        }

        return addedChild;
    }

    function gen(parent, ControlBar) {
        const componentsToAppend = [], parentsConnections = {}, appendedComponents = {};
        let i, j, prnt, customCompKey, customCompName;
        if( parent.children ){

            childrenGen( 'controlBar', parent.children, componentsToAppend, parentsConnections, 0 );

            /*console.log( componentsToAppend );
            console.log( parentsConnections );*/

            i = 0;
            while(i<componentsToAppend.length){
                j = 0;
                while(j < componentsToAppend[i].length){
                    prnt = 0 === i ? pluginInstanceRef.player.getChild( parentsConnections[ componentsToAppend[i][j] ] ) : appendedComponents[ parentsConnections[ componentsToAppend[i][j] ] ];
                    prnt.addChild(componentsToAppend[i][j], {});
                    appendedComponents[ componentsToAppend[i][j] ] = prnt.getChild( componentsToAppend[i][j] );
                    j++;
                }
                i++;
            }
        }
    }

    return gen;
}

export function generateTouchControlComponents(pluginInstanceRef, options) {

	if( options.enabledTouchControls ){

		let TouchControls, 
			TouchControlsInner,
			TouchPrevious,
			TouchPlay,
			TouchNext;

		const previousButton = composeCustomComp( videojsComponentButton, 'vjs-icon-previous-item' );
		const playButton = composeCustomComp( videojsComponentButton, 'vjs-icon-play' );
    	const nextButton = composeCustomComp( videojsComponentButton, 'vjs-icon-next-item' );

    	playButton.methods.handleClick = function(ev){
    		if( this.player_.paused() ){
    			this.player_.play();
    			setTimeout( (function(){
    				this.player_.userActive(false);
    			}).bind(this), 250 );
	        }
	        else{
	        	this.player_.pause();
	        }
    	};

    	if( options.controlBar.next ){ nextButton.methods.handleClick = function(ev){ this.player_.trigger('clicked_next_button');  }; }
    	if( options.controlBar.previous ){ previousButton.methods.handleClick = function(ev){ this.player_.trigger('clicked_previous_button'); }; }

		videojs.registerComponent( 'TouchControls', videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__, 'vjs-touch-controls' ).methods ) );
        videojs.registerComponent( 'TouchControlsInner', videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__ ).methods ) );

        videojs.registerComponent( 'TouchPreviousButton', videojs.extend( previousButton.extend , previousButton.methods) );
		videojs.registerComponent( 'TouchPlayButton', videojs.extend( playButton.extend , playButton.methods) );
    	videojs.registerComponent( 'TouchNextButton', videojs.extend( nextButton.extend , nextButton.methods) );
    	
    	videojs.registerComponent( 'TouchPlay', videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__, 'vjs-touch-play-button' ).methods ) );

    	if( options.controlBar.next || options.controlBar.previous ){
    		videojs.registerComponent( 'TouchPrevious', videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__, 'vjs-touch-previous-button' + ( ! options.controlBar.previous ? ' vjs-touch-disabled-button' : '' ) ).methods ) );
	    	videojs.registerComponent( 'TouchNext', videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__, 'vjs-touch-next-button' + ( ! options.controlBar.next ? ' vjs-touch-disabled-button' : '' ) ).methods ) );
    	}
    	else{
    		videojs.registerComponent( 'TouchPrevious', videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__, 'vjs-touch-previous-button' + ( ! options.controlBar.previous ? ' vjs-touch-hidden-button' : '' ) ).methods ) );
    		videojs.registerComponent( 'TouchNext', videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__, 'vjs-touch-next-button' + ( ! options.controlBar.next ? ' vjs-touch-hidden-button' : '' ) ).methods ) );
    	}

        pluginInstanceRef.player.addChild( 'TouchControls' );

        TouchControls = pluginInstanceRef.player.getChild('TouchControls');
        
        TouchControls.addChild( 'TouchControlsInner' );

        TouchControlsInner = TouchControls.getChild('TouchControlsInner');
		
		TouchControlsInner.addChild( 'TouchPrevious' );
		TouchControlsInner.addChild( 'TouchPlay' );
		TouchControlsInner.addChild( 'TouchNext' );

        TouchPrevious = TouchControlsInner.getChild( 'TouchPrevious' );
    	TouchPlay = TouchControlsInner.getChild( 'TouchPlay' );
		TouchNext = TouchControlsInner.getChild( 'TouchNext' );

		TouchPrevious.addChild( 'TouchPreviousButton' );
		TouchPlay.addChild( 'TouchPlayButton' );
		TouchNext.addChild( 'TouchNextButton' );
	}	
}

export function generateCornerLayersComponents(pluginInstanceRef, options) {

	const layers = {};
	const compPrefix = 'CornerLayer_';
	let k;

    if( options.cornerLayers.topLeft ){
	    layers.topLeft = {
	        className: 'vjs-corner-layer vjs-corner-top-left',
	        parent: pluginInstanceRef.player,
	        content: options.cornerLayers.topLeft,
	    };
	}

    if( options.cornerLayers.topRight ){
	    layers.topRight = {
	        className: 'vjs-corner-layer vjs-corner-top-right',
	        parent: pluginInstanceRef.player,
	        content: options.cornerLayers.topRight,
	    };
	}

    if( options.cornerLayers.bottomLeft ){
	    layers.bottomLeft = {
	        className: 'vjs-corner-layer vjs-corner-bottom-left',
	        parent: pluginInstanceRef.player,
	        content: options.cornerLayers.bottomLeft,
	    };
	}

    if( options.cornerLayers.bottomRight ){
	    layers.bottomRight = {
	        className: 'vjs-corner-layer vjs-corner-bottom-right',
	        parent: pluginInstanceRef.player,
	        content: options.cornerLayers.bottomRight,
	    };
	}

    for(k in layers){
    	if( layers.hasOwnProperty(k) ){
    		if( layers[k].content ){

	    		videojs.registerComponent( compPrefix + k, videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__, layers[k].className, layers[k].content ).methods ) );
	    		
	    		layers[k].parent.addChild( compPrefix + k );
	    	}
    	}
    }
}

export function generateActionsAnimationsComponents(pluginInstanceRef){
	videojs.registerComponent( 'ActionsAnimations', videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__, 'vjs-actions-anim', '<span></span>' ).methods ) );
	pluginInstanceRef.player.addChild( 'ActionsAnimations' );
}

export function generateLoadingSpinnerComponent(pluginInstanceRef){

	pluginInstanceRef.player.removeChild('LoadingSpinner');

	videojs.registerComponent(
		'LoadingSpinner',
		videojs.extend(
			__MediaCMSComponent__ ,
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

	pluginInstanceRef.player.addChild( 'LoadingSpinner' );
}

function initComponents(pluginInstanceRef, which, struct, args){
	let k;
	let tmp;
	switch(which){
		case 'bottomBackground':
			struct.bottomBackground = null;
	        videojs.registerComponent("BottomBackground", videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__, 'vjs-bottom-bg' ).methods));
			break;
		case 'progressControl':
			struct.progressControl = null;
			break;
		case '__settings':

			struct.settingsPanel = {
	            children: {
	                settingsPanelInner: {
	                    children: {
	                        settingsMenu: { children:{} },
	                    },
	                },
	            },
	        };

	        tmp = composeCustomComp( __SettingsPanelComponent__, 'vjs-settings-root');

	        tmp.methods.constructor = function() {

		        videojsComponent.apply(this, arguments);

		        this.setAttribute('class', this.buildCSSClass());

		        const that = this;

		        function onFocusout(ev){
		        	if (that.el_.contains(ev.relatedTarget)) {
				        return;
				    }
				    that.player_.trigger('focusoutSettingsPanel');
		        }

		        pluginInstanceRef.on(this.player_, ['updatedSettingsPanelsVisibility'], function(){
		        	videojs.dom[ this.state.isOpenSettingsOptions ? 'addClass' : 'removeClass' ]( that.el_, 'vjs-visible-panel' );
		        });

		        pluginInstanceRef.on(this.player_, ['openedSettingsPanel'], function( ev, openedFromKeyboard ){
		        	that.el_.setAttribute('tabindex', '-1');
		        	that.el_.addEventListener('focusout', onFocusout );
		        	if( !!openedFromKeyboard ){
		        		that.el_.querySelector('.vjs-settings-menu-item').focus();
		        	}
		        	else{
		        		that.el_.focus();
		        	}
		        });

		        pluginInstanceRef.on(this.player_, ['closedSettingsPanel'], function( ev, closedFromKeyboard ){
		        	that.el_.removeAttribute('tabindex');
		        	that.el_.removeEventListener('focusout', onFocusout );
		        	if( !!closedFromKeyboard ){
		        		that.el_.querySelector('.vjs-settings-menu-item').focus();
		        	}
		        });
		    };

		    videojs.registerComponent('SettingsPanel', videojs.extend( tmp.extend , tmp.methods));
	        
	        videojs.registerComponent('SettingsPanelInner', videojs.extend( __SettingsPanelInnerComponent__, composeCustomComp( __SettingsPanelInnerComponent__ ).methods));

	        videojs.registerComponent('SettingsMenu', videojs.extend( __SettingsMenuComponent__, composeCustomComp( __SettingsMenuComponent__ ).methods));

		    if( args.enabledPlaybackSpeedPanel ){

		        struct.settingsPanel.children.settingsPanelInner.children.settingsMenu.children.selectedPlaybackSpeed = {
		        	children: {
		        		selectedPlaybackSpeedLabel: null,
		        		selectedPlaybackSpeedContent: null,
		        	}
		        };

		        tmp = composeCustomComp( __SettingsMenuItemComponent__, 'vjs-selected-speed' );

		        tmp.methods.handleClick = function(ev){
		            this.player_.trigger('openPlaybackSpeedOptions', ! ev.screenX && ! ev.screenY );
		        };

		        videojs.registerComponent('SelectedPlaybackSpeed', videojs.extend( tmp.extend , tmp.methods));
		        videojs.registerComponent('SelectedPlaybackSpeedLabel', videojs.extend( __SettingsMenuItemLabelComponent__, composeCustomComp( __SettingsMenuItemLabelComponent__, null, 'Playback speed' ).methods));

		        tmp = composeCustomComp( __SettingsMenuItemContentComponent__, null, args.selectedPlaybackSpeed );

		        tmp.methods.constructor = function() {
			        videojsComponent.apply(this, arguments);
			        const that = this;
			        that.el_.innerHTML = pluginInstanceRef.selectedPlaybackSpeedTitle();
			        this.setAttribute('class', this.buildCSSClass());
			        pluginInstanceRef.on(this.player_, ['updatedSelectedPlaybackSpeed'], function(){
			        	that.el_.innerHTML = this.selectedPlaybackSpeedTitle();
			        });
			    };

			    videojs.registerComponent('SelectedPlaybackSpeedContent', videojs.extend( tmp.extend , tmp.methods));
		    }

	        if( args.enabledResolutionsPanel ){

		        struct.settingsPanel.children.settingsPanelInner.children.settingsMenu.children.selectedResolution = {
		        	children: {
		        		selectedResolutionLabel: null,
		        		selectedResolutionContent: null,
		        	}
		        };

		        tmp = composeCustomComp( __SettingsMenuItemComponent__, 'vjs-selected-quality' );

		        tmp.methods.handleClick = function(ev){
		            this.player_.trigger('openQualityOptions', ! ev.screenX && ! ev.screenY );
		        };

		        videojs.registerComponent('SelectedResolution', videojs.extend( tmp.extend , tmp.methods));
		        videojs.registerComponent('SelectedResolutionLabel', videojs.extend( __SettingsMenuItemLabelComponent__, composeCustomComp( __SettingsMenuItemLabelComponent__, null, 'Quality' ).methods));

		        tmp = composeCustomComp( __SettingsMenuItemContentComponent__, null, args.selectedResolution );

		        tmp.methods.constructor = function() {
			        videojsComponent.apply(this, arguments);
			        const that = this;
			        that.el_.innerHTML = args.selectedResolution;
			        this.setAttribute('class', this.buildCSSClass());
			        pluginInstanceRef.on(this.player_, ['updatedSelectedQuality'], function(){
			        	that.el_.innerHTML = this.selectedQualityTitle();
			        });
			    };

			    videojs.registerComponent('SelectedResolutionContent', videojs.extend( tmp.extend , tmp.methods));
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
	                        resolutionsMenu: { children: {} }
	                    }
	                }
	            }
	        };

	        tmp = composeCustomComp( __SettingsPanelComponent__, 'vjs-resolutions-panel');

	        tmp.methods.constructor = function() {

		        videojsComponent.apply(this, arguments);

		        this.setAttribute('class', this.buildCSSClass());

		        const that = this;

		        function onFocusout(ev){
		        	if (that.el_.contains(ev.relatedTarget)) {
				        return;
				    }
				    that.player_.trigger('focusoutResolutionsPanel');
		        }

		        pluginInstanceRef.on(this.player_, ['updatedSettingsPanelsVisibility'], function(){
		        	videojs.dom[ this.state.isOpenQualityOptions ? 'addClass' : 'removeClass' ]( that.el_, 'vjs-visible-panel' );
		        });

		        pluginInstanceRef.on(this.player_, ['openedQualities'], function(ev, openedFromKeyboard){
		        	that.el_.setAttribute('tabindex', '-1');
		        	that.el_.addEventListener('focusout', onFocusout);
		        	if( !!openedFromKeyboard ){
		        		that.el_.querySelector('.vjs-setting-panel-title > *[role="button"]').focus();
		        	}
		        	else{
		        		that.el_.focus();
		        	}
		        });

		        pluginInstanceRef.on(this.player_, ['closedQualities'], function(ev, closedFromKeyboard){
		        	that.el_.removeAttribute('tabindex');
		        	that.el_.removeEventListener('focusout', onFocusout);
		        	if( !!closedFromKeyboard ){
		        		that.el_.querySelector('.vjs-settings-menu-item').focus();
		        	}
		        });
		    };

		    videojs.registerComponent('ResolutionsPanel', videojs.extend( tmp.extend , tmp.methods));

	        videojs.registerComponent('ResolutionsPanelInner', videojs.extend( __SettingsPanelInnerComponent__, composeCustomComp( __SettingsPanelInnerComponent__ ).methods));

	        videojs.registerComponent('ResolutionsMenu', videojs.extend( __SettingsMenuComponent__, composeCustomComp( __SettingsMenuComponent__ ).methods));

	        videojs.registerComponent('ResolutionsMenuTitle', videojs.extend( __SettingsPanelTitleComponent__ , composeCustomComp( __SettingsPanelTitleComponent__, 'vjs-settings-back' ).methods));

	        tmp = composeCustomComp( __MediaCMSButtonClickableComponent__, null, 'Quality' );
	        tmp.methods.handleClick = function(ev){
	            this.player_.trigger('closeQualityOptions', ! ev.screenX && ! ev.screenY );

	        };

	        videojs.registerComponent('ResolutionsMenuBackButton', videojs.extend( tmp.extend , tmp.methods));

	        const resolutionKeys = (function(){

	        	let i;
	        	const ret = [];
	        	const keys = Object.keys( args.resolutions );
	        	const stringKeys = [];
		        const numericKeys = [];

		        i = 0;
		        while( i < keys.length ){

		            if( isNaN( 0 + keys[i] ) ){
		                stringKeys.push( keys[i] );
		            }
		            else{
		                numericKeys.push( [ parseFloat( keys[i] ), keys[i] ] );
		            }
		            i += 1;
		        }

		        numericKeys.sort( (a, b) => b[0] - a[0] );

		        i = 0;
		        while( i < numericKeys.length ){
		            ret.push( numericKeys[i][1] );
		            i += 1;
		        }

		        i = 0;
		        while( i < stringKeys.length ){
		            ret.push( stringKeys[i] );
		            i += 1;
		        }

		        return ret;
	        }());

	        let i = 0;
	        while( i < resolutionKeys.length ){

	            k = resolutionKeys[i];

	            struct.resolutionsPanel.children.resolutionsPanelInner.children.resolutionsMenu.children[ 'resolutionOption_' + k ] = {
        			children: {
		        		['resolutionOption_' + k + '_content'] : null
		        	}
        		};

        		(function( key, title ){

	                tmp = composeCustomComp( __SettingsMenuItemComponent__, key.toString() === pluginInstanceRef.state.theSelectedQuality.toString() ? 'vjs-selected-menu-item' : null, null/*, { 'data-opt': key }*/ );

	                tmp.methods.constructor = function(){
	                	__SettingsMenuItemComponent__.apply(this, arguments);
	                	const that = this;
	                	this.qualityKey = key;
	                	this.setAttribute('data-opt', key);
	                	pluginInstanceRef.on(this.player_, ['updatedSelectedQuality'], function(){
				        	videojs.dom[ that.qualityKey === this.state.theSelectedQuality ? 'addClass' : 'removeClass' ]( that.el_, 'vjs-selected-menu-item' );
				        });
	                };

	                tmp.methods.handleClick = function(){
			            this.player_.trigger('selectedQuality', this.el_.getAttribute('data-opt'));
			        };

			        videojs.registerComponent('ResolutionOption_' + key, videojs.extend( tmp.extend , tmp.methods));

			        tmp = composeCustomComp( __SettingsMenuItemContentComponent__, null, title );
			        videojs.registerComponent('ResolutionOption_' + key + '_content', videojs.extend( tmp.extend , tmp.methods));

	            }( k, args.resolutions[k].title || k ));
	        	
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
	                        playbackSpeedsMenu: { children: {} }
	                    }
	                }
	            }
	        };

	        tmp = composeCustomComp( __SettingsPanelComponent__, 'vjs-playback-speed-panel');

	        tmp.methods.constructor = function() {

		        videojsComponent.apply(this, arguments);

		        this.setAttribute('class', this.buildCSSClass());

		        const that = this;

		        function onFocusout(ev){
		        	if (that.el_.contains(ev.relatedTarget)) {
				        return;
				    }
				    that.player_.trigger('focusoutPlaybackSpeedsPanel');
		        }

		        pluginInstanceRef.on(this.player_, ['updatedSettingsPanelsVisibility'], function(){
		        	videojs.dom[ this.state.isOpenPlaybackSpeedOptions ? 'addClass' : 'removeClass' ]( that.el_, 'vjs-visible-panel' );
		        });

		        pluginInstanceRef.on(this.player_, ['openedPlaybackSpeeds'], function(ev, openedFromKeyboard){
		        	that.el_.setAttribute('tabindex', '-1');
		        	that.el_.addEventListener('focusout', onFocusout);
		        	if( !!openedFromKeyboard ){
		        		that.el_.querySelector('.vjs-setting-panel-title > *[role="button"]').focus();
		        	}
		        	else{
		        		that.el_.focus();
		        	}
		        });

		        pluginInstanceRef.on(this.player_, ['closedPlaybackSpeeds'], function(ev, closedFromKeyboard){
		        	that.el_.removeAttribute('tabindex');
		        	that.el_.removeEventListener('focusout', onFocusout);
		        	if( !!closedFromKeyboard ){
		        		that.el_.querySelector('.vjs-settings-menu-item').focus();
		        	}
		        });

		    };

		    videojs.registerComponent('PlaybackSpeedsPanel', videojs.extend( tmp.extend , tmp.methods));

	        videojs.registerComponent('PlaybackSpeedsPanelInner', videojs.extend( __SettingsPanelInnerComponent__, composeCustomComp( __SettingsPanelInnerComponent__ ).methods));

	        videojs.registerComponent('PlaybackSpeedsMenu', videojs.extend( __SettingsMenuComponent__, composeCustomComp( __SettingsMenuComponent__ ).methods));

	        videojs.registerComponent('PlaybackSpeedsMenuTitle', videojs.extend( __SettingsPanelTitleComponent__ , composeCustomComp( __SettingsPanelTitleComponent__, 'vjs-settings-back' ).methods));

	        tmp = composeCustomComp( __MediaCMSButtonClickableComponent__, null, 'Playback speed' );
	        tmp.methods.handleClick = function(ev){
	            this.player_.trigger('closePlaybackSpeedOptions', ! ev.screenX && ! ev.screenY );

	        };

	        videojs.registerComponent('PlaybackSpeedsMenuBackButton', videojs.extend( tmp.extend , tmp.methods));

	        for(k in args.playbackSpeeds){

	        	if( args.playbackSpeeds.hasOwnProperty(k) ){

	        		struct.playbackSpeedsPanel.children.playbackSpeedsPanelInner.children.playbackSpeedsMenu.children[ 'playbackSpeedOption_' + args.playbackSpeeds[k].speed ] = {
	        			children: {
			        		['playbackSpeedOption_' + args.playbackSpeeds[k].speed + '_content'] : null
			        	}
	        		};

	        		(function( key, title ){

		                tmp = composeCustomComp( __SettingsMenuItemComponent__, key.toString() === pluginInstanceRef.state.theSelectedPlaybackSpeed.toString() ? 'vjs-selected-menu-item' : null, null/*, { 'data-opt': key }*/ );

		                tmp.methods.constructor = function(){
		                	__SettingsMenuItemComponent__.apply(this, arguments);
		                	const that = this;
		                	this.playbackSpeedKey = key;
		                	this.setAttribute('data-opt', key);
		                	pluginInstanceRef.on(this.player_, ['updatedSelectedPlaybackSpeed'], function(){
					        	videojs.dom[ that.playbackSpeedKey === this.state.theSelectedPlaybackSpeed ? 'addClass' : 'removeClass' ]( that.el_, 'vjs-selected-menu-item' );
					        });
		                };

		                tmp.methods.handleClick = function(){
				            this.player_.trigger('selectedPlaybackSpeed', this.el_.getAttribute('data-opt'));
				        };

				        videojs.registerComponent('PlaybackSpeedOption_' + key, videojs.extend( tmp.extend , tmp.methods));

				        tmp = composeCustomComp( __SettingsMenuItemContentComponent__, null, title );
				        videojs.registerComponent('PlaybackSpeedOption_' + key + '_content', videojs.extend( tmp.extend , tmp.methods));

		            }( args.playbackSpeeds[k].speed, args.playbackSpeeds[k].title || k ));
	        	}
	        }

			break;
		case '__leftControls':
	        struct.leftControls = { children: {} };

	        if( args.options.controlBar.previous ){

	            tmp = composeCustomComp( videojsComponentButton, 'vjs-previous-button' );

	            tmp.methods.handleClick = function(ev){
	            	this.player_.trigger('clicked_previous_button');
		        };

	            videojs.registerComponent("PreviousButton", videojs.extend( tmp.extend , tmp.methods));

	            struct.leftControls.children.previousButton = null;
	        }

	        if( args.options.controlBar.play ){
	            struct.leftControls.children.playToggle = null;
	        }

	        if( args.options.controlBar.next ){

	            tmp = composeCustomComp( videojsComponentButton, 'vjs-next-button' );

	            tmp.methods.handleClick = function(ev){
	            	this.player_.trigger('clicked_next_button');
		        };

	            videojs.registerComponent("NextButton", videojs.extend( tmp.extend , tmp.methods));

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

	        if( args.options.controlBar.volume ){
	            struct.leftControls.children.volumePanel = null;
	        }

	        if( args.options.controlBar.time ){
	            struct.leftControls.children.currentTimeDisplay = null;
	            struct.leftControls.children.timeDivider = null;
	            struct.leftControls.children.durationDisplay = null;
	        }

	        /*console.log( struct.leftControls.children );*/

	        videojs.registerComponent("LeftControls", videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__, 'vjs-left-controls' ).methods));

			break;
		case '__rightControls':
			struct.rightControls = { children: {} };

	        if( args.enabledSettingsPanel ){
	            struct.rightControls.children.settingsToggle = null;
	        }

	        if( args.options.controlBar.theaterMode ){
	            struct.rightControls.children.theaterModeToggle = null;
	        }

	        if( args.options.controlBar.pictureInPicture ){
	            struct.rightControls.children.pictureInPictureToggle = null;
	        }

	        if( args.options.controlBar.fullscreen ){
	            struct.rightControls.children.fullscreenToggle = null;
	        }

	        videojs.registerComponent("RightControls", videojs.extend( __MediaCMSComponent__ , composeCustomComp( __MediaCMSComponent__, 'vjs-right-controls' ).methods));

	        if( args.enabledSettingsPanel ){

		        tmp = composeCustomComp( videojsComponentButton, 'vjs-settings-control vjs-icon-cog' );

		        tmp.methods.handleClick = function(ev){
		        	this.player_.trigger( pluginInstanceRef.state.isOpenSettingsOptions ? 'closeSettingsPanel' : 'openSettingsPanel', ! ev.screenX && ! ev.screenY );
		        };

	            videojs.registerComponent("SettingsToggle", videojs.extend( tmp.extend , tmp.methods));
		    }

	        if( args.options.controlBar.theaterMode ){

	            tmp = composeCustomComp( videojsComponentButton, 'vjs-theater-mode-control' );

	            tmp.methods.handleClick = function(){
	                this.player_.trigger('theatermodechange');
	                this.updateControlText();
	            };

	            tmp.methods.updateControlText = function(){
	                this.controlText(this.player_.localize(pluginInstanceRef.isTheaterMode() ? 'Default mode' : 'Theater mode'));
	            };

	            videojs.registerComponent("TheaterModeToggle", videojs.extend( tmp.extend , tmp.methods));
	        }
			break;
	}
}

export function controlBarComponentsStructs( pluginInstanceRef, options ){

	let struct = {};

    const enabledResolutionsPanel = void 0 !== options.resolutions && void 0 !== options.resolutions.options && !!Object.keys( options.resolutions.options ).length;
    const enabledPlaybackSpeedPanel = void 0 !== options.playbackSpeeds && void 0 !== options.playbackSpeeds.options && !!Object.keys( options.playbackSpeeds.options ).length;

    const enabledSettingsPanel = enabledResolutionsPanel || enabledPlaybackSpeedPanel;   // @note: At the moment the only setting option is video resolution.

    if( options.controlBar.bottomBackground ){
    	initComponents(pluginInstanceRef, 'bottomBackground', struct);
    }

    if( options.controlBar.progress ){
    	initComponents(pluginInstanceRef, 'progressControl', struct);
    }

    if( enabledResolutionsPanel ){
    	initComponents(pluginInstanceRef, '__resolution', struct, { resolutions: options.resolutions.options } );
    }

    if( enabledPlaybackSpeedPanel ){
    	initComponents(pluginInstanceRef, '__playbackSpeed', struct, { playbackSpeeds: options.playbackSpeeds.options } );
    }

    if( enabledSettingsPanel ){

    	if( enabledResolutionsPanel && enabledPlaybackSpeedPanel ){

	    	initComponents(pluginInstanceRef, '__settings', struct, {
	    		enabledResolutionsPanel: enabledResolutionsPanel,
	    		selectedResolution: enabledResolutionsPanel ? options.resolutions.default : null,
	    		enabledPlaybackSpeedPanel: enabledPlaybackSpeedPanel,
	    		selectedPlaybackSpeed: enabledPlaybackSpeedPanel ? options.playbackSpeeds.default : null,
	    	});
    	}
    	else if( enabledResolutionsPanel ){
	    	initComponents(pluginInstanceRef, '__settings', struct, {
	    		enabledResolutionsPanel: enabledResolutionsPanel,
	    		selectedResolution: enabledResolutionsPanel ? options.resolutions.default : null,
	    	});
    	}
    	else if( enabledPlaybackSpeedPanel ){

	    	initComponents(pluginInstanceRef, '__settings', struct, {
	    		enabledPlaybackSpeedPanel: enabledPlaybackSpeedPanel,
	    		selectedPlaybackSpeed: enabledPlaybackSpeedPanel ? options.playbackSpeeds.default : null,
	    	});
    	}
    }

    if( options.controlBar.play || options.controlBar.previous || options.controlBar.next || options.controlBar.volume || options.controlBar.time ){
    	initComponents(pluginInstanceRef, '__leftControls', struct, { options: options } );
    }

    if( enabledSettingsPanel || options.controlBar.theaterMode || options.controlBar.fullscreen || options.controlBar.pictureInPictureToggle ){
    	initComponents(pluginInstanceRef, '__rightControls', struct, { options: options, enabledSettingsPanel: enabledSettingsPanel } );
    }

    return { children: struct };
}
