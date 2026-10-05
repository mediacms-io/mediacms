import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { click } from '../../_support/compD_dom';
import { MediaPageStore } from '../../../src/static/js/utils/stores/';
import { MediaPageActions, PageActions } from '../../../src/static/js/utils/actions/';
import { MediaLikeIcon } from '../../../src/static/js/components/media-actions/MediaLikeIcon';
import { MediaDislikeIcon } from '../../../src/static/js/components/media-actions/MediaDislikeIcon';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());
jest.mock('../../../src/static/js/utils/actions/', () => require('../../_support/compD_storeMocks').mockActionsModule());

const store = MediaPageStore as any;
const actions = MediaPageActions as any;

describe('components/media-actions', () => {
    beforeEach(() => {
        store.__reset({ 'user-liked-media': false, 'media-likes': 1500, 'user-disliked-media': false, 'media-dislikes': 3 });
        jest.clearAllMocks();
    });

    describe('MediaLikeIcon', () => {
        test('Renders formatted likes counter', () => {
            const { container, unmount } = renderIntoContainer(<MediaLikeIcon />);
            expect(container.querySelector('.like .likes-counter')?.textContent).toBe('1.5K');
            expect(container.querySelector('.like i')?.getAttribute('data-icon')).toBe('thumb_up');
            unmount();
        });

        test('Click on not yet liked media dispatches likeMedia', () => {
            const { container, unmount } = renderIntoContainer(<MediaLikeIcon />);
            click(container.querySelector('.like button'));
            expect(actions.likeMedia).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Click on already liked media does nothing, since a like cannot be taken back', () => {
            store.__set('user-liked-media', true);
            const { container, unmount } = renderIntoContainer(<MediaLikeIcon />);
            expect(() => click(container.querySelector('.like button'))).not.toThrow();
            expect(actions.likeMedia).not.toHaveBeenCalled();
            unmount();
        });

        test('A completed like shows the liked notification text', () => {
            const { unmount } = renderIntoContainer(<MediaLikeIcon />);
            act(() => {
                store.emit('liked_media');
            });
            expect((PageActions as any).addNotification).toHaveBeenCalledWith('Added to liked media', 'likedMedia');
            unmount();
        });

        test('Subscribes to store events while mounted', () => {
            const { unmount } = renderIntoContainer(<MediaLikeIcon />);
            expect(store.listenerCount('liked_media')).toBe(1);
            expect(store.listenerCount('unliked_media')).toBe(1);
            expect(store.listenerCount('liked_media_failed_request')).toBe(1);
            unmount();
            expect(store.listenerCount('liked_media')).toBe(0);
            expect(store.listenerCount('liked_media_failed_request')).toBe(0);
        });
    });

    describe('MediaDislikeIcon', () => {
        test('Renders dislikes counter and dispatches dislikeMedia', () => {
            const { container, unmount } = renderIntoContainer(<MediaDislikeIcon />);
            expect(container.querySelector('.dislikes-counter')?.textContent).toBe('3');
            expect(container.querySelector('.like i')?.getAttribute('data-icon')).toBe('thumb_down');
            click(container.querySelector('.like button'));
            expect(actions.dislikeMedia).toHaveBeenCalledTimes(1);
            unmount();
            expect(store.listenerCount('disliked_media')).toBe(0);
        });

        test('Click on already disliked media does nothing, since a dislike cannot be taken back', () => {
            store.__set('user-disliked-media', true);
            const { container, unmount } = renderIntoContainer(<MediaDislikeIcon />);
            expect(() => click(container.querySelector('.like button'))).not.toThrow();
            expect(actions.dislikeMedia).not.toHaveBeenCalled();
            unmount();
        });

        test('A completed dislike shows the disliked notification text', () => {
            const { unmount } = renderIntoContainer(<MediaDislikeIcon />);
            expect(() =>
                act(() => {
                    store.emit('disliked_media');
                })
            ).not.toThrow();
            expect((PageActions as any).addNotification).toHaveBeenCalledWith('Added to disliked media', 'mediaDislike');
            unmount();
        });
    });
});
