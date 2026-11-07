import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { getRequest } from '../../../src/static/js/utils/helpers/requests';
import { ItemListAsync } from '../../../src/static/js/components/item-list/ItemListAsync';
import { buildMediaItems } from '../../_support/compC_mediaItems';

jest.mock('../../../src/static/js/utils/helpers/requests', () => ({
    ...jest.requireActual('../../../src/static/js/utils/helpers/requests'),
    getRequest: jest.fn(),
}));

const mockedGetRequest = getRequest as jest.Mock;
const List = ItemListAsync as any;

describe('components/item-list', () => {
    describe('ItemListAsync', () => {
        let pending: { url: string; cb: (r: any) => void }[];

        beforeEach(() => {
            pending = [];
            mockedGetRequest.mockReset();
            mockedGetRequest.mockImplementation((url: string, _sync: boolean, cb: (r: any) => void) => {
                pending.push({ url, cb });
            });
        });

        function respond(data: any) {
            const next = pending.shift() as { url: string; cb: (r: any) => void };
            act(() => {
                next.cb({ data });
            });
            return next.url;
        }

        test('Shows pending list until the response arrives then renders items', () => {
            const itemsCountCallback = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <List requestUrl="https://example.com/api/v1/media" pageItems={2} itemsCountCallback={itemsCountCallback} />
            );
            expect(container.querySelector('.items-list-wrap-waiting')).not.toBeNull();

            const items = buildMediaItems(3);
            expect(respond({ count: 3, next: null, results: items })).toBe('https://example.com/api/v1/media');
            expect(itemsCountCallback).toHaveBeenCalledWith(3);
            expect(container.querySelectorAll('.item')).toHaveLength(2);

            act(() => {
                (container.querySelector('button.load-more') as HTMLButtonElement).click();
            });
            expect(container.querySelectorAll('.item')).toHaveLength(3);
            expect(container.querySelector('button.load-more')).toBeNull();
            unmount();
        });

        test('Renders nothing when the response has no results', () => {
            const { container, unmount } = renderIntoContainer(<List requestUrl="https://example.com/api/v1/media" />);
            respond({ count: 0, results: [] });
            expect(container.innerHTML).toBe('');
            unmount();
        });
    });
});
