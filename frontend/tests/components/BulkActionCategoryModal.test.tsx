import React from 'react';
import { renderIntoContainer } from '../_support/render';
import { click, flush, jsonResponse, findByText } from '../_support/compD_dom';
import { BulkActionCategoryModal } from '../../src/static/js/components/BulkActionCategoryModal';

describe('components', () => {
    describe('BulkActionCategoryModal', () => {
        let fetchMock: jest.Mock;
        const ids = ['m1', 'm2'];

        beforeEach(() => {
            fetchMock = jest.fn();
            (global as any).fetch = fetchMock;
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            delete (global as any).fetch;
            sessionStorage.clear();
            jest.restoreAllMocks();
        });

        async function setup(selectedMediaIds = ids) {
            const props = { onCancel: jest.fn(), onSuccess: jest.fn(), onError: jest.fn() };
            const view = renderIntoContainer(
                <BulkActionCategoryModal isOpen selectedMediaIds={selectedMediaIds} csrfToken="tok" {...props} />
            );
            await flush();
            return { ...view, ...props };
        }

        function load(existing: Array<[string, string]>, all: Array<[string, string]>, wrapAll = true) {
            const toCat = ([uid, title]: [string, string]) => ({ uid, title });
            fetchMock
                .mockReturnValueOnce(jsonResponse({ results: existing.map(toCat) }))
                .mockReturnValueOnce(jsonResponse(wrapAll ? { results: all.map(toCat) } : all.map(toCat)));
        }

        function titles(container: HTMLElement, panel: number) {
            return Array.from(container.querySelectorAll('.category-panel')[panel].querySelectorAll('.category-item span')).map((s) => s.textContent);
        }

        test('Renders nothing when closed', () => {
            const view = renderIntoContainer(
                <BulkActionCategoryModal isOpen={false} selectedMediaIds={ids} csrfToken="t" onCancel={jest.fn()} onSuccess={jest.fn()} onError={jest.fn()} />
            );
            expect(view.container.innerHTML).toBe('');
            view.unmount();
        });

        test('Loads categories into panels in standard mode', async () => {
            load([['c1', 'Science']], [['c1', 'Science'], ['c2', 'Art']]);
            const { container, unmount } = await setup();
            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'category_membership', media_ids: ids });
            expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/categories');
            expect(container.querySelector('h2')?.textContent).toBe('Add / Remove from Categories');
            expect(container.querySelector('.category-modal-subtitle')).toBeNull();
            expect(titles(container, 0)).toEqual(['Art']);
            expect(titles(container, 1)).toEqual(['Science']);
            unmount();
        });

        test('Uses course endpoint and filters existing to courses in LMS mode', async () => {
            sessionStorage.setItem('lms_embed_mode', 'true');
            load([['c1', 'Science'], ['x', 'Not a course']], [['c1', 'Science'], ['c2', 'Math']], false);
            const { container, unmount } = await setup(['solo']);
            expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/categories/contributor?lms_courses_only=true');
            expect(container.querySelector('h2')?.textContent).toBe('Share with Course');
            expect(container.querySelector('.category-modal-subtitle')).not.toBeNull();
            expect(titles(container, 1)).toEqual(['Science']);
            expect((container.querySelectorAll('.category-panel')[1].querySelector('.remove-btn') as HTMLElement).title).toBe('Remove course');
            expect(container.querySelector('.info-tooltip')).toBeNull();
            unmount();
        });

        test('Reports LMS specific load error', async () => {
            sessionStorage.setItem('lms_embed_mode', 'true');
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            const { onError, unmount } = await setup();
            expect(onError).toHaveBeenCalledWith('Failed to load courses');
            unmount();
        });

        test('Shows empty messages', async () => {
            load([], []);
            const { container, unmount } = await setup();
            expect(Array.from(container.querySelectorAll('.empty-message')).map((e) => e.textContent)).toEqual([
                'All categories already added',
                'No categories',
            ]);
            unmount();
        });

        test('Proceed posts add_to_category and remove_from_category', async () => {
            load([['c1', 'Science']], [['c1', 'Science'], ['c2', 'Art']]);
            const { container, onSuccess, onCancel, unmount } = await setup();
            click(findByText(container, '.category-item.clickable', 'Art+'));
            const removeButtons = () => container.querySelectorAll('.category-panel')[1].querySelectorAll('.remove-btn');
            click(removeButtons()[0]);
            expect((removeButtons()[0] as HTMLElement).title).toBe('Undo removal');
            expect((removeButtons()[1] as HTMLElement).title).toBe('Remove from list');
            fetchMock.mockReturnValueOnce(jsonResponse({})).mockReturnValueOnce(jsonResponse({}));
            click(container.querySelector('.category-btn-proceed'));
            await flush();
            expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ action: 'add_to_category', media_ids: ids, category_uids: ['c2'] });
            expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ action: 'remove_from_category', media_ids: ids, category_uids: ['c1'] });
            expect(onSuccess).toHaveBeenCalledWith('Successfully updated categories');
            expect(onCancel).toHaveBeenCalled();
            unmount();
        });

        test('Undo and remove from list restore the initial state', async () => {
            load([['c1', 'Science']], [['c1', 'Science'], ['c2', 'Art']]);
            const { container, unmount } = await setup();
            click(findByText(container, '.category-item.clickable', 'Art+'));
            const removeButtons = () => container.querySelectorAll('.category-panel')[1].querySelectorAll('.remove-btn');
            click(removeButtons()[0]);
            click(removeButtons()[0]);
            click(removeButtons()[1]);
            expect(titles(container, 1)).toEqual(['Science']);
            expect((container.querySelector('.category-btn-proceed') as HTMLButtonElement).disabled).toBe(true);
            unmount();
        });

        test('Proceed failure reports an error', async () => {
            load([], [['c2', 'Art']]);
            const { container, onError, unmount } = await setup();
            click(findByText(container, '.category-item.clickable', 'Art+'));
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            click(container.querySelector('.category-btn-proceed'));
            await flush();
            expect(onError).toHaveBeenCalledWith('Failed to update categories. Please try again.');
            unmount();
        });
    });
});
