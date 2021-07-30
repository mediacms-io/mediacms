export const videojsComponent = videojs.getComponent('Component');
export const videojsClickableComponent = videojs.getComponent('ClickableComponent');
export const videojsComponentButton = videojs.getComponent('Button');

export const __MediaCMSComponent__ =  videojs.extend(videojsComponent, {
    constructor() {
        videojsComponent.apply(this, arguments);
        this.setAttribute('class', this.buildCSSClass());
    },
    buildCSSClass() {
        return '';
    },
});

export const __MediaCMSButtonClickableComponent__ =  videojs.extend(videojsClickableComponent, {
    buildCSSClass() {
        return '';
    },
});

export const __SettingsPanelComponent__ = composeAndExtendCustomComp( 'vjs-settings-panel' );
export const __SettingsPanelInnerComponent__ = composeAndExtendCustomComp( 'vjs-settings-panel-inner' );
export const __SettingsPanelTitleComponent__ = composeAndExtendCustomComp( 'vjs-setting-panel-title');
export const __SettingsMenuComponent__ = composeAndExtendCustomComp( 'vjs-settings-menu' );
export const __SettingsMenuItemComponent__ = videojsComposeAndExtendCustomComp( __MediaCMSButtonClickableComponent__, 'vjs-settings-menu-item' );
export const __SettingsMenuItemLabelComponent__ = composeAndExtendCustomComp( 'vjs-setting-menu-item-label' );
export const __SettingsMenuItemContentComponent__ = composeAndExtendCustomComp( 'vjs-setting-menu-item-content' );

function composeCustomCompMethods(ret, extnd, innerHtml, extraCSSClass, htmlAttr){

    var innerHtmlIsHTMLElement = !! innerHtml && innerHtml.nodeType === 1;

    if( ! innerHtmlIsHTMLElement ){
        switch( typeof innerHtml ){
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

    switch( typeof extraCSSClass ){
        case 'string':
            extraCSSClass = extraCSSClass.trim();
            extraCSSClass = '' === extraCSSClass ? null : extraCSSClass;
            break;
        default:
            extraCSSClass = null;
    }

    if( ! htmlAttr || ! Object.keys( htmlAttr ).length ){
        htmlAttr = null;
    }

    if( innerHtml || htmlAttr ){
        ret.constructor = function(){

            extnd.apply(this, arguments);

            let k;

            if( innerHtml ){

                if( innerHtmlIsHTMLElement ){
                    this.el_.appendChild( innerHtml );
                }
                else{
                    this.el_.innerHTML = innerHtml;
                }
            }

            if( htmlAttr ){
                for(k in htmlAttr){
                    if( htmlAttr.hasOwnProperty(k) ){
                        this.el_.setAttribute( k, htmlAttr[k] );   
                    }
                }
            }
        };
    }

    if( extraCSSClass ){
        ret.buildCSSClass = function(){
            return extraCSSClass + ' ' + extnd.prototype.buildCSSClass.call(this);
        };
    }
}

function videosjsExtendCustomComp( parent, methods ){
    return videojs.extend( parent, methods );
}

function videosjsFormatExtendObj( parent, methods ){
    return {
        extend: parent,
        methods: methods
    };
}

export function videojsComposeAndExtendCustomComp( extnd, extraCSSClass, innerHtml, htmlAttr ){
    const ret = {};
    composeCustomCompMethods(ret, extnd, innerHtml, extraCSSClass, htmlAttr);
    return videosjsExtendCustomComp( extnd, ret );
}

export function composeCustomComp( extnd, extraCSSClass, innerHtml, htmlAttr ){
    const ret = {};
    composeCustomCompMethods(ret, extnd, innerHtml, extraCSSClass, htmlAttr);
    return videosjsFormatExtendObj( extnd, ret );    
}

export function composeAndExtendCustomComp( extraCSSClass, innerHtml, htmlAttr ){
    return videojsComposeAndExtendCustomComp( __MediaCMSComponent__, extraCSSClass, innerHtml, htmlAttr );
}
