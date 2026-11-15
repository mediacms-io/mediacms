import { renderHook, act } from '../../_support/render';
import { usePopup } from '../../../src/static/js/utils/hooks/usePopup';
import { useMediaFilter } from '../../../src/static/js/utils/hooks/useMediaFilter';
import { PopupContent } from '../../../src/static/js/components/_shared/popup/PopupContent';
import { PopupTrigger } from '../../../src/static/js/components/_shared/popup/PopupTrigger';

describe('utils/hooks', () => {
    describe('usePopup', () => {
        test('Returns a stable content ref and the popup components', () => {
            const { result, rerender, unmount } = renderHook(() => usePopup());
            const [ref, Content, Trigger] = result.current;
            expect(ref).toStrictEqual({ current: null });
            expect(Content).toBe(PopupContent);
            expect(Trigger).toBe(PopupTrigger);
            rerender();
            expect(result.current[0]).toBe(ref);
            unmount();
        });
    });

    describe('useMediaFilter', () => {
        test('Holds the filter value and exposes popup helpers', () => {
            const { result, unmount } = renderHook(() => useMediaFilter('all'));
            const [containerRef, value, setValue, popupContentRef, Content, Trigger] = result.current as any[];
            expect(containerRef).toStrictEqual({ current: null });
            expect(value).toBe('all');
            expect(popupContentRef).toStrictEqual({ current: null });
            expect(Content).toBe(PopupContent);
            expect(Trigger).toBe(PopupTrigger);

            act(() => setValue('video'));
            expect(result.current[1]).toBe('video');
            unmount();
        });
    });
});
