var insertionQ = (function () {
    "use strict";

    var sequence = 100,
        isAnimationSupported = false,
        animation_string = 'animationName',
        keyframeprefix = '',
        domPrefixes = 'Webkit Moz O ms Khtml'.split(' '),
        pfx = '',
        elm = document.createElement('div'),
        options = {
            strictlyNew: true,
            timeout: 20
        };

    if (elm.style.animationName) {
        isAnimationSupported = true;
    }

    if (isAnimationSupported === false) {
        for (var i = 0; i < domPrefixes.length; i++) {
            if (elm.style[domPrefixes[i] + 'AnimationName'] !== undefined) {
                pfx = domPrefixes[i];
                animation_string = pfx + 'AnimationName';
                keyframeprefix = '-' + pfx.toLowerCase() + '-';
                isAnimationSupported = true;
                break;
            }
        }
    }


    function listen(selector, callback) {
        var styleAnimation, animationName = 'insQ_' + (sequence++);

        var eventHandler = function (event) {
            if (event.animationName === animationName || event[animation_string] === animationName) {
                if (!isTagged(event.target)) {
                    callback(event.target);
                }
            }
        };

        styleAnimation = document.createElement('style');
        styleAnimation.innerHTML = '@' + keyframeprefix + 'keyframes ' + animationName + ' {  from {  outline: 1px solid transparent  } to {  outline: 0px solid transparent }  }' +
            "\n" + selector + ' { animation-duration: 0.001s; animation-name: ' + animationName + '; ' +
            keyframeprefix + 'animation-duration: 0.001s; ' + keyframeprefix + 'animation-name: ' + animationName + '; ' +
            ' } ';

        document.head.appendChild(styleAnimation);

        var bindAnimationLater = setTimeout(function () {
            document.addEventListener('animationstart', eventHandler, false);
            document.addEventListener('MSAnimationStart', eventHandler, false);
            document.addEventListener('webkitAnimationStart', eventHandler, false);
            //event support is not consistent with DOM prefixes
        }, options.timeout); //starts listening later to skip elements found on startup. this might need tweaking

        return {
            destroy: function () {
                clearTimeout(bindAnimationLater);
                if (styleAnimation) {
                    document.head.removeChild(styleAnimation);
                    styleAnimation = null;
                }
                document.removeEventListener('animationstart', eventHandler);
                document.removeEventListener('MSAnimationStart', eventHandler);
                document.removeEventListener('webkitAnimationStart', eventHandler);
            }
        };
    }


    function tag(el) {
        el.QinsQ = true; //bug in V8 causes memory leaks when weird characters are used as field names. I don't want to risk leaking DOM trees so the key is not '-+-' anymore
    }

    function isTagged(el) {
        return (options.strictlyNew && (el.QinsQ === true));
    }

    function topmostUntaggedParent(el) {
        if (isTagged(el.parentNode)) {
            return el;
        } else {
            return topmostUntaggedParent(el.parentNode);
        }
    }

    function tagAll(e) {
        tag(e);
        e = e.firstChild;
        for (; e; e = e.nextSibling) {
            if (e !== undefined && e.nodeType === 1) {
                tagAll(e);
            }
        }
    }

    //aggregates multiple insertion events into a common parent
    function catchInsertions(selector, callback) {
        var insertions = [];
        //throttle summary
        var sumUp = (function () {
            var to;
            return function () {
                clearTimeout(to);
                to = setTimeout(function () {
                    insertions.forEach(tagAll);
                    callback(insertions);
                    insertions = [];
                }, 10);
            };
        })();

        return listen(selector, function (el) {
            if (isTagged(el)) {
                return;
            }
            tag(el);
            var myparent = topmostUntaggedParent(el);
            if (insertions.indexOf(myparent) < 0) {
                insertions.push(myparent);
            }
            sumUp();
        });
    }

    //insQ function
    var exports = function (selector) {
        if (isAnimationSupported && selector.match(/[^{}]/)) {

            if (options.strictlyNew) {
                tagAll(document.body); //prevents from catching things on show
            }
            return {
                every: function (callback) {
                    return listen(selector, callback);
                },
                summary: function (callback) {
                    return catchInsertions(selector, callback);
                }
            };
        } else {
            return false;
        }
    };

    //allows overriding defaults
    exports.config = function (opt) {
        for (var o in opt) {
            if (opt.hasOwnProperty(o)) {
                options[o] = opt[o];
            }
        }
    };

    return exports;
})();

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = insertionQ;
}
