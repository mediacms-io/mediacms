import {
    generateControlBarComponents,
    controlBarComponentsStructs,
    generateCornerLayersComponents,
    generateActionsAnimationsComponents,
    generateLoadingSpinnerComponent,
    generateTouchControlComponents
} from './functions-helpers';

export function setControlBarComponents(pluginInstncRef, options, player) {
    if ( isDefined( options ) && isDefined( options.controlBar ) ) {
        generateControlBarComponents(pluginInstncRef)( controlBarComponentsStructs(pluginInstncRef, options), player.getChild('controlBar') );
    }
}

export function setCornerLayersComponents(pluginInstncRef, options) {
    if ( isDefined( options ) ) {
        generateCornerLayersComponents(pluginInstncRef, options);
    }
}

export function setActionsAnimationsComponents(pluginInstncRef) {
    generateActionsAnimationsComponents(pluginInstncRef);
}

export function replaceLoadingSpinnerComponent(pluginInstncRef) {
    generateLoadingSpinnerComponent(pluginInstncRef);
}

export function setTouchControlComponents(pluginInstncRef, options) {
    generateTouchControlComponents(pluginInstncRef, options);
}

export function removeClassname(el, cls) {
    if (el.classList) {
        el.classList.remove(cls);
    } else {
        el.className = el.className.replace(new RegExp('(^|\\b)' + cls.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
    }
}

export function addClassname(el, cls) {
    if (el.classList) {
        el.classList.add(cls);
    } else {
        el.className += ' ' + cls;
    }
}

export function centralizeBoxPosition(vw, vh, vr, pw, ph, pr) {

    const ret = {};

    const videoRatio = isDefined( vr ) && ! isNull( vr ) ? vr : vw / vh,
        playerRatio = isDefined( pr ) && ! isNull( pr ) ? pr : pw / ph,
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
                ret.h = vw >= pw ? ph : (vh >= ph ? ph : vh);
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

export function isBoolean(v){
    return "boolean" === typeof v || v instanceof Boolean;
}

export function isString(v){
    return "string" === typeof v || v instanceof String;
}

export function isDefined(v){
    return void 0 != v;
}

export function isNull(v){
    return null === v;
}

export function isArray(v){
    return ! Array.isArray ? '[object Array]' === Object.prototype.toString.call(v) : Array.isArray(v);
}

export function ifBooleanElse(bol, els){
    return isBoolean(bol) ? bol : els;
}

export function applyCssTransform(elem, val){
    val = val.replace(/ /g,""); // Remove all blank characters, otherwise doesn't work in IE.
    elem.style.transform = val;
    elem.style.msTransform = val;
    elem.style.MozTransform = val;
    elem.style.WebkitTransform = val;
    elem.style.OTransform = val;
}

function browserSupports_csstransforms() {
    var i, v, b = document.body || document.documentElement, s = b.style, p = 'transition';
    if ( 'string' === typeof s[p] ) {
        return true;
    }
    v = ['Moz', 'webkit', 'Webkit', 'Khtml', 'O', 'ms'];
    p = p.charAt(0).toUpperCase() + p.substr(1);
    i=0;
    while(i<v.length){
        if (  'string' === typeof s[v[i]+p] ) {
            return true;
        }
        i+=1;
    }
    return false;
}

export function browserSupports(type){
    switch(type){
        case 'csstransforms':
            return browserSupports_csstransforms();
    }
    return null;
}
