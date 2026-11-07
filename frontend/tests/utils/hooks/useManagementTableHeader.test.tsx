import { renderHook, act } from '../../_support/render';
import { useManagementTableHeader } from '../../../src/static/js/utils/hooks/useManagementTableHeader';

function columnEvent(id: string) {
    const el = document.createElement('th');
    el.setAttribute('id', id);
    return { currentTarget: el };
}

describe('utils/hooks', () => {
    describe('useManagementTableHeader', () => {
        test('Initialises from props', () => {
            const { result, unmount } = renderHook(() =>
                useManagementTableHeader({ sort: 'title', order: 'asc', selected: false })
            );
            const [sort, order, isSelected] = result.current;
            expect([sort, order, isSelected]).toStrictEqual(['title', 'asc', false]);
            unmount();
        });

        test('Clicking the sorted column flips the order', () => {
            const onClickColumnSort = jest.fn();
            const { result, unmount } = renderHook(() =>
                useManagementTableHeader({ sort: 'title', order: 'asc', selected: false, onClickColumnSort })
            );

            act(() => result.current[3](columnEvent('title')));
            expect(result.current[0]).toBe('title');
            expect(result.current[1]).toBe('desc');
            expect(onClickColumnSort).toHaveBeenLastCalledWith('title', 'desc');

            act(() => result.current[3](columnEvent('title')));
            expect(result.current[1]).toBe('asc');
            expect(onClickColumnSort).toHaveBeenLastCalledWith('title', 'asc');
            unmount();
        });

        test('Clicking another column sorts it descending', () => {
            const onClickColumnSort = jest.fn();
            const { result, unmount } = renderHook(() =>
                useManagementTableHeader({ sort: 'title', order: 'asc', selected: false, onClickColumnSort })
            );
            act(() => result.current[3](columnEvent('add_date')));
            expect(result.current[0]).toBe('add_date');
            expect(result.current[1]).toBe('desc');
            expect(onClickColumnSort).toHaveBeenCalledWith('add_date', 'desc');
            unmount();
        });

        test('Sorting works without a callback', () => {
            const { result, unmount } = renderHook(() =>
                useManagementTableHeader({ sort: 'title', order: 'desc', selected: false })
            );
            act(() => result.current[3](columnEvent('title')));
            expect(result.current[1]).toBe('asc');
            unmount();
        });

        test('checkAll reports the toggled selection and type', () => {
            const onCheckAllRows = jest.fn();
            const { result, unmount } = renderHook(() =>
                useManagementTableHeader({ sort: 'a', order: 'asc', selected: false, type: 'media', onCheckAllRows })
            );
            act(() => result.current[4]());
            expect(onCheckAllRows).toHaveBeenCalledWith(true, 'media');
            unmount();
        });

        test('checkAll without a callback does not throw', () => {
            const { result, unmount } = renderHook(() =>
                useManagementTableHeader({ sort: 'a', order: 'asc', selected: true })
            );
            expect(() => act(() => result.current[4]())).not.toThrow();
            unmount();
        });

        test('Syncs state when props change', () => {
            let props: any = { sort: 'a', order: 'asc', selected: false };
            const { result, rerender, unmount } = renderHook(() => useManagementTableHeader(props));
            props = { sort: 'b', order: 'desc', selected: true };
            rerender();
            expect(result.current.slice(0, 3)).toStrictEqual(['b', 'desc', true]);
            unmount();
        });
    });
});
