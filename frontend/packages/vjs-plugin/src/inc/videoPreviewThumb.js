function videoPreviewThumb(player, options){

    player.getChild('ControlBar').getChild('ProgressControl').getChild('SeekBar').removeChild('MouseTimeDisplay');

    var halfThumbWidth = -1;

    var defaults = {
        frame:{
            width: 160,
            height: 120,
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
        return function(prop) {
            return window.getComputedStyle ? window.getComputedStyle(el, pseudo)[prop] : el.currentStyle[prop];
        };
    }

    function offsetParent(el) {
        return 'HTML' !== el.nodeName && 'static' === getComputedStyle(el)('position') ? offsetParent(el.offsetParent) : el;
    }

    function updateDimensions(){
        if ( isFullscreen ){
            halfThumbWidth = ( innerBorderWidth.left + innerBorderWidth.right + ( 1.5 * settings.frame.width ) ) / 2 ;
            spriteDom.inner.style.height = ( innerBorderWidth.top + innerBorderWidth.bottom + ( 1.5 * settings.frame.height ) ) + 'px';
            spriteDom.inner.style.width = ( innerBorderWidth.left + innerBorderWidth.right + ( 1.5 * settings.frame.width ) ) + 'px';
        }
        else {
            halfThumbWidth = ( innerBorderWidth.left + innerBorderWidth.right + settings.frame.width ) / 2 ;
            spriteDom.inner.style.height = ( innerBorderWidth.top + innerBorderWidth.bottom + settings.frame.height ) + 'px';
            spriteDom.inner.style.width = ( innerBorderWidth.left + innerBorderWidth.right + settings.frame.width ) + 'px';
        }
        spriteDom.inner.style.left = ( -1 * halfThumbWidth ) + 'px';
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
    spriteDom.inner.style.backgroundImage = 'url(' + settings.url + ')'
    spriteDom.timeDisplay.className = 'vjs-preview-thumb-time-display';
    spriteDom.timeDisplayInner.innerHTML = '0:00';

    var spriteHeight = 0;

    player.on('durationchange', function(e) { duration = player.duration(); }); // when the container is MP4.
    player.on('loadedmetadata', function(e) { duration = player.duration(); }); // when the container is HLS.

    player.on('fullscreenchange', function(e) {
        setTimeout( function() {
            isFullscreen = player.isFullscreen();
            updateDimensions();
        }, 100);
    });

    player.one( 'playing', function(e) {    // @note: Listener bind once.

        updateDimensions();

        player.addClass('vjs-enabled-preview-thumb');   // @note: Enable preview functionality.

        spriteDom.img.onload = function() {

            var innerStyles = getAllComputedStyles(spriteDom.inner);
            
            if( void 0 !== innerStyles ){
                innerBorderWidth.top = parseFloat( innerStyles.borderTopWidth );
                innerBorderWidth.left = parseFloat( innerStyles.borderLeftWidth );
                innerBorderWidth.right = parseFloat( innerStyles.borderRightWidth );
                innerBorderWidth.bottom = parseFloat( innerStyles.borderBottomWidth );
            }

            spriteHeight = this.naturalHeight;
            
            spriteDom.img = void 0; // Unset image element.

            updateDimensions();
        };
        
        spriteDom.img.src = settings.url;
    });

    function moveListener(event) {

        progressControlElem = progressControlElem || progressControl.el();

        var progressControlClientRect = offsetParent( progressControlElem ).getBoundingClientRect();

        var pageXOffset = window.pageXOffset ? window.pageXOffset : document.documentElement.scrollLeft;
        var pageX = event.changedTouches ? event.changedTouches[0].pageX : event.pageX;
        
        var left = ( pageX || ( event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft ) ) - ( progressControlClientRect.left + pageXOffset );
        var right = ( progressControlClientRect.width || progressControlClientRect.right ) + pageXOffset;

        var mouseTime = ! spriteHeight ? 0 : Math.min( ( ( spriteHeight / settings.frame.height ) * settings.frame.seconds ) - 1, Math.floor( ( left - progressControlElem.offsetLeft ) / progressControl.width() * duration ) );

        spriteDom.timeDisplayInner.innerHTML = videojs.formatTime( duration * ( left / right ) );

        if( left < halfThumbWidth ){
            left = halfThumbWidth;
        }
        else if( left > right - halfThumbWidth ){
            left = right - halfThumbWidth;
        }

        spriteDom.wrap.style.transform = 'translate(' + Math.min( right - halfThumbWidth, left ) + 'px, 0px)';

        spriteDom.inner.style.backgroundPositionY = ( ( isFullscreen ? -1.5 : -1 ) * settings.frame.height * Math.floor( mouseTime / settings.frame.seconds ) ) + 'px';
    }

    progressControl.on('mouseover', moveListener);
    progressControl.on('mousemove', moveListener);

    spriteDom.timeDisplay.appendChild(spriteDom.timeDisplayInner);
    spriteDom.inner.appendChild(spriteDom.timeDisplay);
    spriteDom.wrap.appendChild(spriteDom.inner);

    progressControl.el_.appendChild(spriteDom.wrap);
}

export default videoPreviewThumb;
