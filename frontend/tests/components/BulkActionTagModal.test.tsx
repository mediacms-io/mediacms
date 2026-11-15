import React from 'react';
import { renderIntoContainer } from '../_support/render';
import { click, flush, jsonResponse, findByText } from '../_support/compD_dom';
import { BulkActionTagModal } from '../../src/static/js/components/BulkActionTagModal';

describe('components', () => {
    describe('BulkActionTagModal', () => {
        let fetchMock: jest.Mock;
        const ids = ['m1', 'm2'];

        beforeEach(() => {
            fetchMock = jest.fn();
            (global as any).fetch = fetchMock;
            jest.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            delete (global as any).fetch;
            jest.restoreAllMocks();
        });

        async function setup(selectedMediaIds = ids) {
            const props = { onCancel: jest.fn(), onSuccess: jest.fn(), onError: jest.fn() };
            const view = renderIntoContainer(
                <BulkActionTagModal isOpen selectedMediaIds={selectedMediaIds} csrfToken="tok" {...props} />
            );
            await flush();
            return { ...view, ...props };
        }

        function panelTitles(container: HTMLElement, index: number) {
            return Array.from(container.querySelectorAll('.tag-panel')[index].querySelectorAll('.tag-item span')).map((s) => s.textContent);
        }

        function loadTags(existing: string[], all: string[]) {
            fetchMock
                .mockReturnValueOnce(jsonResponse({ results: existing.map((title) => ({ title })) }))
                .mockReturnValueOnce(jsonResponse({ results: all.map((title) => ({ title })) }));
        }

        test('Renders nothing and does not fetch when closed', () => {
            const view = renderIntoContainer(
                <BulkActionTagModal isOpen={false} selectedMediaIds={ids} csrfToken="t" onCancel={jest.fn()} onSuccess={jest.fn()} onError={jest.fn()} />
            );
            expect(view.container.innerHTML).toBe('');
            expect(fetchMock).not.toHaveBeenCalled();
            view.unmount();
        });

        test('Loads membership and all tags into the two panels', async () => {
            loadTags(['news'], ['news', 'music', 'art']);
            const { container, unmount } = await setup();
            expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/media/user/bulk_actions');
            expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'tag_membership', media_ids: ids });
            expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/tags');
            expect(panelTitles(container, 0)).toEqual(['music', 'art']);
            expect(panelTitles(container, 1)).toEqual(['news']);
            expect(container.querySelector('.info-tooltip')).not.toBeNull();
            expect((container.querySelector('.tag-btn-proceed') as HTMLButtonElement).disabled).toBe(true);
            unmount();
        });

        test('Shows empty messages and hides tooltip for single media', async () => {
            loadTags([], []);
            const { container, unmount } = await setup(['only']);
            const empties = Array.from(container.querySelectorAll('.empty-message')).map((e) => e.textContent);
            expect(empties).toEqual(['All tags already added', 'No tags']);
            expect(container.querySelector('.info-tooltip')).toBeNull();
            unmount();
        });

        test('Reports load errors', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            const { onError, unmount } = await setup();
            expect(onError).toHaveBeenCalledWith('Failed to load tags');
            unmount();
        });

        test('Adds, removes, marks and unmarks tags', async () => {
            loadTags(['news'], ['news', 'music']);
            const { container, unmount } = await setup();
            const music = findByText(container.querySelectorAll('.tag-panel')[0], '.tag-item', 'music+');
            click(music);
            click(music);
            expect(panelTitles(container, 1)).toEqual(['news', 'music']);

            const rightItems = () => container.querySelectorAll('.tag-panel')[1].querySelectorAll('.tag-item');
            const newsBtn = () => rightItems()[0].querySelector('.remove-btn') as HTMLButtonElement;
            expect(newsBtn().title).toBe('Remove tag');
            click(newsBtn());
            expect(rightItems()[0].className).toContain('marked-for-removal');
            expect(newsBtn().title).toBe('Undo removal');
            click(newsBtn());
            expect(rightItems()[0].className).not.toContain('marked-for-removal');

            const musicBtn = rightItems()[1].querySelector('.remove-btn') as HTMLButtonElement;
            expect(musicBtn.title).toBe('Remove from list');
            click(musicBtn);
            expect(panelTitles(container, 1)).toEqual(['news']);
            unmount();
        });

        test('Proceed posts add_tags then remove_tags and reports success', async () => {
            loadTags(['news'], ['news', 'music']);
            const { container, onSuccess, onCancel, unmount } = await setup();
            click(findByText(container, '.tag-item.clickable', 'music+'));
            click(container.querySelectorAll('.tag-panel')[1].querySelector('.remove-btn'));
            fetchMock.mockReturnValueOnce(jsonResponse({})).mockReturnValueOnce(jsonResponse({}));
            click(container.querySelector('.tag-btn-proceed'));
            await flush();
            expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ action: 'add_tags', media_ids: ids, tag_titles: ['music'] });
            expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ action: 'remove_tags', media_ids: ids, tag_titles: ['news'] });
            expect(fetchMock.mock.calls[3][1].headers['X-CSRFToken']).toBe('tok');
            expect(onSuccess).toHaveBeenCalledWith('Successfully updated tags');
            expect(onCancel).toHaveBeenCalled();
            unmount();
        });

        test('Proceed reports failure', async () => {
            loadTags([], ['music']);
            const { container, onError, onSuccess, unmount } = await setup();
            click(findByText(container, '.tag-item.clickable', 'music+'));
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            click(container.querySelector('.tag-btn-proceed'));
            await flush();
            expect(onError).toHaveBeenCalledWith('Failed to update tags. Please try again.');
            expect(onSuccess).not.toHaveBeenCalled();
            unmount();
        });
    });
});
