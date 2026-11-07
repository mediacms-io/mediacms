import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { click } from '../../_support/compD_dom';
import { MediaPageStore } from '../../../src/static/js/utils/stores/';
import { MediaPageActions } from '../../../src/static/js/utils/actions/';
import { MediaSaveButton } from '../../../src/static/js/components/media-actions/MediaSaveButton';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());
jest.mock('../../../src/static/js/utils/actions/', () => require('../../_support/compD_storeMocks').mockActionsModule());

const mediaStore = MediaPageStore as any;

describe('components/media-actions', () => {
    describe('MediaSaveButton', () => {
        beforeEach(() => {
            jest.clearAllMocks();
            mediaStore.__reset({
                'media-id': 'abc',
                playlists: [
                    { playlist_id: 'p1', title: 'Fav', status: 'public', media_list: ['abc'] },
                    { playlist_id: 'p2', title: 'Later', status: 'public', media_list: [] },
                ],
            });
        });

        test('Opens playlist selection and toggles media membership', () => {
            const { container, unmount } = renderIntoContainer(<MediaSaveButton />);
            expect(container.querySelector('.save > button')?.textContent).toBe('SAVE');
            click(container.querySelector('.save > button'));
            const labels = Array.from(container.querySelectorAll('.saveto-select label')) as HTMLElement[];
            expect(labels.map((l) => l.textContent)).toEqual(['Fav', 'Later']);
            expect((labels[0].querySelector('input') as HTMLInputElement).checked).toBe(true);
            click(labels[0].querySelector('input'));
            expect((MediaPageActions as any).removeMediaFromPlaylist).toHaveBeenCalledWith('p1', 'abc');
            click(labels[1].querySelector('input'));
            expect((MediaPageActions as any).addMediaToPlaylist).toHaveBeenCalledWith('p2', 'abc');
            unmount();
        });

        test('Close button in the selection hides the popup', () => {
            const { container, unmount } = renderIntoContainer(<MediaSaveButton />);
            click(container.querySelector('.save > button'));
            click(container.querySelector('.saveto-title button'));
            expect(container.querySelector('.saveto-popup')).toBeNull();
            unmount();
        });

        test('Create playlist toggles the creation form', () => {
            const { container, unmount } = renderIntoContainer(<MediaSaveButton />);
            click(container.querySelector('.save > button'));
            click(container.querySelector('.saveto-create'));
            expect(container.querySelector('.saveto-new-playlist .playlist-form-wrap')).not.toBeNull();
            click(container.querySelector('.saveto-new-playlist .cancel-btn'));
            expect(container.querySelector('.saveto-new-playlist')).toBeNull();
            unmount();
        });
    });
});
