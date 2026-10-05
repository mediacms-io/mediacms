import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { PlaylistPageMedia } from '../../../src/static/js/components/playlist-page/PlaylistPageMedia';

jest.mock('../../../src/static/js/components/item-list/ItemList', () => require('../../_support/compD_itemListMock'));

const { __calls: itemListCalls } = require('../../_support/compD_itemListMock');

describe('components/playlist-page', () => {
    describe('PlaylistPageMedia', () => {
        test('Passes playlist page options to ItemList', () => {
            const media = [{ id: 1 }];
            const itemsCountCallback = jest.fn();
            const { unmount } = renderIntoContainer(<PlaylistPageMedia media={media} playlistId="p1" itemsCountCallback={itemsCountCallback} />);
            expect(itemListCalls[itemListCalls.length - 1]).toEqual(
                expect.objectContaining({ items: media, playlistId: 'p1', hidePlaylistOptions: true, inPlaylistPage: true, itemsCountCallback, pageItems: 99999 })
            );
            unmount();
        });

        test('Allows showing playlist options', () => {
            const { unmount } = renderIntoContainer(<PlaylistPageMedia media={[]} playlistId="p1" hidePlaylistOptions={false} />);
            expect(itemListCalls[itemListCalls.length - 1].hidePlaylistOptions).toBe(false);
            unmount();
        });
    });
});
