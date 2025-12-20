import {
    supportsSvgAsImg,
    removeClassname,
    addClassname,
    hasClassname,
    BrowserEvents,
    requestAnimationFrame as reqAF,
    cancelAnimationFrame as cancelAF,
} from '../../../../../src/static/js/utils/helpers/dom';

// Ensure a minimal DOM-like environment if not provided by Jest environment
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof document === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.document = {
        implementation: {
            hasFeature: jest.fn().mockReturnValue(true),
        },
        addEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        createElement: (tag: string) => ({ tagName: tag.toUpperCase(), className: '', classList: undefined }) as any,
    } as unknown as Document;
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
if (typeof window === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global.window = {
        addEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        // vendor-prefixed polyfills used in the module
        mozRequestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0),
        webkitRequestAnimationFrame: undefined,
        msRequestAnimationFrame: undefined,
        cancelAnimationFrame: (id: number) => clearTimeout(id),
        mozCancelAnimationFrame: (id: number) => clearTimeout(id),
    } as unknown as Window & typeof global;
}

describe('utils/helpers/dom.supportsSvgAsImg', () => {
    test('delegates to document.implementation.hasFeature', () => {
        const spy = jest.spyOn(document.implementation as any, 'hasFeature').mockReturnValueOnce(true);
        expect(supportsSvgAsImg()).toBe(true);
        expect(spy).toHaveBeenCalledWith('http://www.w3.org/TR/SVG11/feature#Image', '1.1');
        spy.mockRestore();
    });

    test('returns false when feature detection fails', () => {
        const spy = jest.spyOn(document.implementation as any, 'hasFeature').mockReturnValueOnce(false);
        expect(supportsSvgAsImg()).toBe(false);
        spy.mockRestore();
    });
});

describe('utils/helpers/dom classname helpers', () => {
    test('addClassname uses classList.add when available', () => {
        const el = document.createElement('div');
        (el as any).classList = { add: jest.fn(), remove: jest.fn() };
        addClassname(el as any, 'active');
        expect((el as any).classList.add).toHaveBeenCalledWith('active');
    });

    test('removeClassname uses classList.remove when available', () => {
        const el = document.createElement('div');
        (el as any).classList = { add: jest.fn(), remove: jest.fn() };
        removeClassname(el as any, 'active');
        expect((el as any).classList.remove).toHaveBeenCalledWith('active');
    });

    test('addClassname fallback appends class to className', () => {
        const el = document.createElement('div') as any;
        el.className = 'one';
        el.classList = undefined;
        addClassname(el, 'two');
        expect(el.className).toBe('one two');
    });

    test('removeClassname fallback removes class via regex', () => {
        const el = document.createElement('div') as any;
        el.className = 'one two three two';
        el.classList = undefined;
        removeClassname(el, 'two');
        // the regex replacement may leave extra spaces
        expect(el.className.replace(/\s+/g, ' ').trim()).toBe('one three');
    });

    test('hasClassname checks for exact class match boundaries', () => {
        const el = document.createElement('div') as any;
        el.className = 'one two-three';
        expect(hasClassname(el, 'one')).toBe(true);
        expect(hasClassname(el, 'two')).toBe(false); // should not match within two-three
        expect(hasClassname(el, 'two-three')).toBe(true);
    });
});

describe('utils/helpers/dom animation frame helpers', () => {
    test('requestAnimationFrame falls back to vendor-prefixed implementations', () => {
        const backup: any = {
            requestAnimationFrame: (window as any).requestAnimationFrame,
            mozRequestAnimationFrame: (window as any).mozRequestAnimationFrame,
            webkitRequestAnimationFrame: (window as any).webkitRequestAnimationFrame,
            msRequestAnimationFrame: (window as any).msRequestAnimationFrame,
        };

        (window as any).requestAnimationFrame = undefined;
        (window as any).mozRequestAnimationFrame = jest.fn((cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
        (window as any).webkitRequestAnimationFrame = undefined;
        (window as any).msRequestAnimationFrame = undefined;

        const raf = reqAF();
        expect(typeof raf).toBe('function');
        raf(() => undefined);
        expect((window as any).mozRequestAnimationFrame).toHaveBeenCalled();

        (window as any).requestAnimationFrame = backup.requestAnimationFrame;
        (window as any).mozRequestAnimationFrame = backup.mozRequestAnimationFrame;
        (window as any).webkitRequestAnimationFrame = backup.webkitRequestAnimationFrame;
        (window as any).msRequestAnimationFrame = backup.msRequestAnimationFrame;
    });

    test('cancelAnimationFrame falls back to vendor-prefixed implementations', () => {
        const backup: any = {
            cancelAnimationFrame: (window as any).cancelAnimationFrame,
            mozCancelAnimationFrame: (window as any).mozCancelAnimationFrame,
        };

        (window as any).cancelAnimationFrame = undefined;
        (window as any).mozCancelAnimationFrame = jest.fn();

        const caf = cancelAF();
        expect(typeof caf).toBe('function');
        caf(1);
        expect((window as any).mozCancelAnimationFrame).toHaveBeenCalledWith(1);

        (window as any).cancelAnimationFrame = backup.cancelAnimationFrame;
        (window as any).mozCancelAnimationFrame = backup.mozCancelAnimationFrame;
    });
});

describe('utils/helpers/dom.BrowserEvents', () => {
    beforeEach(() => {
        jest.spyOn(document, 'addEventListener').mockClear();
        jest.spyOn(window, 'addEventListener').mockClear();
        (document as any).addEventListener = jest.fn();
        (window as any).addEventListener = jest.fn();
    });

    test('registers global listeners on construction and invokes callbacks on events', () => {
        const be = BrowserEvents();

        const visCb = jest.fn();
        const resizeCb = jest.fn();
        const scrollCb = jest.fn();

        // register callbacks
        be.doc(visCb);
        be.win(resizeCb, scrollCb);

        // capture the callback passed to addEventListener for each event
        const docHandler = (document.addEventListener as jest.Mock).mock.calls.find(
            (c) => c[0] === 'visibilitychange'
        )?.[1] as Function;
        const resizeHandler = (window.addEventListener as jest.Mock).mock.calls.find(
            (c) => c[0] === 'resize'
        )?.[1] as Function;
        const scrollHandler = (window.addEventListener as jest.Mock).mock.calls.find(
            (c) => c[0] === 'scroll'
        )?.[1] as Function;

        // fire handlers to simulate events
        docHandler();
        resizeHandler();
        scrollHandler();

        expect(visCb).toHaveBeenCalledTimes(1);
        expect(resizeCb).toHaveBeenCalledTimes(1);
        expect(scrollCb).toHaveBeenCalledTimes(1);
    });

    test('does not register non-function callbacks', () => {
        const be = BrowserEvents();
        // @ts-expect-error intentional wrong types to ensure guard clauses
        be.win('not-a-fn', null);
        be.doc(undefined);

        // Should still have registered the listeners on construction
        expect((document.addEventListener as jest.Mock).mock.calls.some((c) => c[0] === 'visibilitychange')).toBe(true);
        expect((window.addEventListener as jest.Mock).mock.calls.some((c) => c[0] === 'resize')).toBe(true);
        expect((window.addEventListener as jest.Mock).mock.calls.some((c) => c[0] === 'scroll')).toBe(true);
    });
});

describe('utils/helpers/dom.BrowserEvents edge cases', () => {
    beforeEach(() => {
        (document.addEventListener as jest.Mock).mockClear();
        (window.addEventListener as jest.Mock).mockClear();
        (document as any).addEventListener = jest.fn();
        (window as any).addEventListener = jest.fn();
    });

    test('multiple callbacks are invoked in order for each event type', () => {
        const be = BrowserEvents();
        const v1 = jest.fn();
        const v2 = jest.fn();
        const r1 = jest.fn();
        const r2 = jest.fn();
        const s1 = jest.fn();
        const s2 = jest.fn();

        be.doc(v1);
        be.doc(v2);
        be.win(r1, s1);
        be.win(r2, s2);

        const docHandler = (document.addEventListener as jest.Mock).mock.calls.find(
            (c) => c[0] === 'visibilitychange'
        )?.[1] as Function;
        const resizeHandler = (window.addEventListener as jest.Mock).mock.calls.find(
            (c) => c[0] === 'resize'
        )?.[1] as Function;
        const scrollHandler = (window.addEventListener as jest.Mock).mock.calls.find(
            (c) => c[0] === 'scroll'
        )?.[1] as Function;

        // fire events twice to ensure each call triggers callbacks once per firing
        docHandler();
        resizeHandler();
        scrollHandler();

        docHandler();
        resizeHandler();
        scrollHandler();

        expect(v1).toHaveBeenCalledTimes(2);
        expect(v2).toHaveBeenCalledTimes(2);
        expect(r1).toHaveBeenCalledTimes(2);
        expect(r2).toHaveBeenCalledTimes(2);
        expect(s1).toHaveBeenCalledTimes(2);
        expect(s2).toHaveBeenCalledTimes(2);

        // Ensure order of invocation within each firing respects registration order
        // Jest mock call order grows monotonically; validate the first calls were in the expected sequence
        expect(v1.mock.invocationCallOrder[0]).toBeLessThan(v2.mock.invocationCallOrder[0]);
        expect(r1.mock.invocationCallOrder[0]).toBeLessThan(r2.mock.invocationCallOrder[0]);
        expect(s1.mock.invocationCallOrder[0]).toBeLessThan(s2.mock.invocationCallOrder[0]);
    });

    test('ignores non-function values without throwing and still registers listeners once', () => {
        const be = BrowserEvents();
        // @ts-expect-error
        be.doc('noop');
        // @ts-expect-error
        be.win(null, undefined);

        const docCount = (document.addEventListener as jest.Mock).mock.calls.filter(
            (c) => c[0] === 'visibilitychange'
        ).length;
        const resizeCount = (window.addEventListener as jest.Mock).mock.calls.filter((c) => c[0] === 'resize').length;
        const scrollCount = (window.addEventListener as jest.Mock).mock.calls.filter((c) => c[0] === 'scroll').length;

        expect(docCount).toBe(1);
        expect(resizeCount).toBe(1);
        expect(scrollCount).toBe(1);
    });
});
