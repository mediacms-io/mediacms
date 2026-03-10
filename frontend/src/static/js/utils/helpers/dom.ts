export function supportsSvgAsImg() {
    // @link: https://github.com/Modernizr/Modernizr/blob/master/feature-detects/svg/asimg.js
    return document.implementation.hasFeature('http://www.w3.org/TR/SVG11/feature#Image', '1.1');
}

export function removeClassname(el: HTMLElement, cls: string) {
    if (el.classList) {
        el.classList.remove(cls);
    } else {
        el.className = el.className.replace(new RegExp('(^|\\b)' + cls.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
    }
}

export function addClassname(el: HTMLElement, cls: string) {
    if (el.classList) {
        el.classList.add(cls);
    } else {
        el.className += ' ' + cls;
    }
}

export function hasClassname(el: HTMLElement, cls: string) {
    return el.className && new RegExp('(\\s|^)' + cls + '(\\s|$)').test(el.className);
}

type LegacyWindow = Window & {
    mozCancelAnimationFrame?: Window['cancelAnimationFrame'];
    mozRequestAnimationFrame?: Window['requestAnimationFrame'];
    msRequestAnimationFrame?: Window['requestAnimationFrame'];
    webkitRequestAnimationFrame?: Window['requestAnimationFrame'];
};

const legacyWindow = window as LegacyWindow;

export const cancelAnimationFrame: Window['cancelAnimationFrame'] =
    legacyWindow.cancelAnimationFrame ||
    legacyWindow.mozCancelAnimationFrame ||
    ((id: number) => window.clearTimeout(id));

export const requestAnimationFrame: Window['requestAnimationFrame'] =
    legacyWindow.requestAnimationFrame ||
    legacyWindow.mozRequestAnimationFrame ||
    legacyWindow.webkitRequestAnimationFrame ||
    legacyWindow.msRequestAnimationFrame ||
    ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16));

export function BrowserEvents() {
    const callbacks = {
        document: {
            visibility: [] as Function[],
        },
        window: {
            resize: [] as Function[],
            scroll: [] as Function[],
        },
    };

    function onDocumentVisibilityChange() {
        callbacks.document.visibility.map((fn) => fn());
    }

    function onWindowResize() {
        callbacks.window.resize.map((fn) => fn());
    }

    function onWindowScroll() {
        callbacks.window.scroll.map((fn) => fn());
    }

    function windowEvents(resizeCallback?: Function, scrollCallback?: Function) {
        if ('function' === typeof resizeCallback) {
            callbacks.window.resize.push(resizeCallback);
        }

        if ('function' === typeof scrollCallback) {
            callbacks.window.scroll.push(scrollCallback);
        }
    }

    function documentEvents(visibilityChangeCallback?: Function) {
        if ('function' === typeof visibilityChangeCallback) {
            callbacks.document.visibility.push(visibilityChangeCallback);
        }
    }

    document.addEventListener('visibilitychange', onDocumentVisibilityChange);

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('scroll', onWindowScroll);

    return {
        doc: documentEvents,
        win: windowEvents,
    };
}
