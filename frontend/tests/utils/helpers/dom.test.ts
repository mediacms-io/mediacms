import {
    supportsSvgAsImg,
    removeClassname,
    addClassname,
    hasClassname,
    BrowserEvents,
} from '../../../src/static/js/utils/helpers/dom';

declare global {
    interface Window {
        mozRequestAnimationFrame?: Window['requestAnimationFrame'];
        webkitRequestAnimationFrame?: Window['requestAnimationFrame'];
        msRequestAnimationFrame?: Window['requestAnimationFrame'];
        mozCancelAnimationFrame?: Window['cancelAnimationFrame'];
    }
}

describe('js/utils/helpers', () => {
    describe('dom', () => {
        describe('supportsSvgAsImg', () => {
            test('Delegates to document.implementation.hasFeature', () => {
                const spy = jest.spyOn(document.implementation as any, 'hasFeature').mockReturnValueOnce(true);
                expect(supportsSvgAsImg()).toBe(true);
                expect(spy).toHaveBeenCalledWith('http://www.w3.org/TR/SVG11/feature#Image', '1.1');
                spy.mockRestore();
            });

            test('Returns false when feature detection fails', () => {
                const spy = jest.spyOn(document.implementation as any, 'hasFeature').mockReturnValueOnce(false);
                expect(supportsSvgAsImg()).toBe(false);
                spy.mockRestore();
            });
        });

        describe('BrowserEvents', () => {
            beforeEach(() => {
                jest.spyOn(document, 'addEventListener').mockClear();
                jest.spyOn(window, 'addEventListener').mockClear();
                document.addEventListener = jest.fn();
                window.addEventListener = jest.fn();
            });

            test('Registers global listeners on construction and invokes callbacks on events', () => {
                const be = BrowserEvents();

                const visCb = jest.fn();
                const resizeCb = jest.fn();
                const scrollCb = jest.fn();

                // Register callbacks
                be.doc(visCb);
                be.win(resizeCb, scrollCb);

                // Capture the callback passed to addEventListener for each event
                const docHandler = (document.addEventListener as jest.Mock).mock.calls.find(
                    (c) => c[0] === 'visibilitychange'
                )?.[1] as Function;

                const resizeHandler = (window.addEventListener as jest.Mock).mock.calls.find(
                    (c) => c[0] === 'resize'
                )?.[1] as Function;

                const scrollHandler = (window.addEventListener as jest.Mock).mock.calls.find(
                    (c) => c[0] === 'scroll'
                )?.[1] as Function;

                // Fire handlers to simulate events
                docHandler();
                resizeHandler();
                scrollHandler();

                expect(visCb).toHaveBeenCalledTimes(1);
                expect(resizeCb).toHaveBeenCalledTimes(1);
                expect(scrollCb).toHaveBeenCalledTimes(1);
            });

            // @todo: Revisit this behavior
            test('Does not register non-function callbacks', () => {
                const be = BrowserEvents();

                be.win('not-a-fn', null);
                be.doc(undefined);

                // Should still have registered the listeners on construction
                expect(
                    (document.addEventListener as jest.Mock).mock.calls.some((c) => c[0] === 'visibilitychange')
                ).toBe(true);
                expect((window.addEventListener as jest.Mock).mock.calls.some((c) => c[0] === 'resize')).toBe(true);
                expect((window.addEventListener as jest.Mock).mock.calls.some((c) => c[0] === 'scroll')).toBe(true);
            });
        });

        describe('BrowserEvents (edge cases)', () => {
            beforeEach(() => {
                (document.addEventListener as jest.Mock).mockClear();
                (window.addEventListener as jest.Mock).mockClear();
                document.addEventListener = jest.fn();
                window.addEventListener = jest.fn();
            });

            test('Multiple callbacks are invoked in order for each event type', () => {
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

                // Fire events twice to ensure each call triggers callbacks once per firing
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

            // @todo: Check again this behavior
            test('Ignores non-function values without throwing and still registers listeners once', () => {
                const be = BrowserEvents();

                be.doc('noop');
                be.win(null, undefined);

                const docCount = (document.addEventListener as jest.Mock).mock.calls.filter(
                    (c) => c[0] === 'visibilitychange'
                ).length;
                const resizeCount = (window.addEventListener as jest.Mock).mock.calls.filter(
                    (c) => c[0] === 'resize'
                ).length;
                const scrollCount = (window.addEventListener as jest.Mock).mock.calls.filter(
                    (c) => c[0] === 'scroll'
                ).length;

                expect(docCount).toBe(1);
                expect(resizeCount).toBe(1);
                expect(scrollCount).toBe(1);
            });
        });

        describe('classname helpers', () => {
            test('addClassname uses classList.add when available', () => {
                const el = document.createElement('div') as any;
                const mockAdd = jest.fn();
                el.classList.add = mockAdd;

                addClassname(el, 'active');
                expect(mockAdd).toHaveBeenCalledWith('active');
            });

            test('removeClassname uses classList.remove when available', () => {
                const el = document.createElement('div') as any;
                const mockRemove = jest.fn();
                el.classList.remove = mockRemove;
                removeClassname(el, 'active');
                expect(mockRemove).toHaveBeenCalledWith('active');
            });

            test('addClassname fallback appends class to className', () => {
                const el = document.createElement('div') as any;
                el.className = 'one';
                // Remove classList to test fallback behavior
                delete el.classList;
                addClassname(el, 'two');
                expect(el.className).toBe('one two');
            });

            test('removeClassname fallback removes class via regex', () => {
                const el = document.createElement('div') as any;
                el.className = 'one two three two';
                // Remove classList to test fallback behavior
                delete el.classList;
                removeClassname(el, 'two');
                // The regex replacement may leave extra spaces
                expect(el.className.replaceAll(/\s+/g, ' ').trim()).toBe('one three');
            });

            test('hasClassname checks for exact class match boundaries', () => {
                const el = document.createElement('div');
                el.className = 'one two-three';
                expect(hasClassname(el, 'one')).toBe(true);
                expect(hasClassname(el, 'two')).toBe(false); // Should not match within two-three
                expect(hasClassname(el, 'two-three')).toBe(true);
            });
        });
    });
});
