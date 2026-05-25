import * as MediaPageActions from '../../../src/static/js/utils/actions/MediaPageActions';
import dispatcher from '../../../src/static/js/utils/dispatcher';

// Mock the dispatcher module used by MediaPageActions
jest.mock('../../../src/static/js/utils/dispatcher', () => ({ dispatch: jest.fn() }));

describe('utils/actions', () => {
    describe('MediaPageActions', () => {
        const dispatch = dispatcher.dispatch;

        beforeEach(() => {
            (dispatcher.dispatch as jest.Mock).mockClear();
        });

        describe('loadMediaData', () => {
            it('Should dispatch LOAD_MEDIA_DATA action', () => {
                MediaPageActions.loadMediaData();
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'LOAD_MEDIA_DATA' });
            });
        });

        describe('likeMedia / dislikeMedia', () => {
            it('Should dispatch LIKE_MEDIA action', () => {
                MediaPageActions.likeMedia();
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'LIKE_MEDIA' });
            });

            it('Should dispatch DISLIKE_MEDIA action', () => {
                MediaPageActions.dislikeMedia();
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'DISLIKE_MEDIA' });
            });
        });

        describe('reportMedia', () => {
            it('Should dispatch REPORT_MEDIA with empty string when description is undefined', () => {
                MediaPageActions.reportMedia();
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'REPORT_MEDIA', reportDescription: '' });
            });

            // @todo: Revisit this behavior
            it('Should dispatch REPORT_MEDIA with stripped description when provided', () => {
                MediaPageActions.reportMedia('  some   text  ');
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'REPORT_MEDIA', reportDescription: 'sometext' });
            });

            // @todo: Revisit this behavior
            it('Should remove all whitespace characters including newlines and tabs', () => {
                MediaPageActions.reportMedia('\n\t spaced\ntext \t');
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'REPORT_MEDIA', reportDescription: 'spacedtext' });
            });
        });

        describe('copyShareLink / copyEmbedMediaCode', () => {
            it('Should dispatch COPY_SHARE_LINK carrying the provided input element', () => {
                const inputElem = document.createElement('input');
                MediaPageActions.copyShareLink(inputElem);
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'COPY_SHARE_LINK', inputElement: inputElem });
            });

            it('Should dispatch COPY_EMBED_MEDIA_CODE carrying the provided textarea element', () => {
                const textarea = document.createElement('textarea');
                MediaPageActions.copyEmbedMediaCode(textarea);
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'COPY_EMBED_MEDIA_CODE', inputElement: textarea });
            });
        });

        describe('removeMedia', () => {
            it('Should dispatch REMOVE_MEDIA action', () => {
                MediaPageActions.removeMedia();
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_MEDIA' });
            });
        });

        describe('comments', () => {
            it('Should dispatch SUBMIT_COMMENT with provided text', () => {
                const commentText = 'Nice one';
                MediaPageActions.submitComment(commentText);
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'SUBMIT_COMMENT', commentText });
            });

            it('Should dispatch DELETE_COMMENT with provided comment id', () => {
                const commentId = 'c-123';
                MediaPageActions.deleteComment(commentId);
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'DELETE_COMMENT', commentId });
            });

            // @todo: Revisit this behavior
            it('Should dispatch DELETE_COMMENT with numeric comment id', () => {
                const commentId = 42;
                MediaPageActions.deleteComment(commentId);
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'DELETE_COMMENT', commentId });
            });
        });

        describe('playlists', () => {
            it('Should dispatch CREATE_PLAYLIST with provided data', () => {
                const payload = { title: 'My list', description: 'Desc' };
                MediaPageActions.createPlaylist(payload);
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'CREATE_PLAYLIST', playlist_data: payload });
            });

            it('Should dispatch ADD_MEDIA_TO_PLAYLIST with ids', () => {
                const playlist_id = 'pl-1';
                const media_id = 'm-1';
                MediaPageActions.addMediaToPlaylist(playlist_id, media_id);
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_MEDIA_TO_PLAYLIST', playlist_id, media_id });
            });

            it('Should dispatch REMOVE_MEDIA_FROM_PLAYLIST with ids', () => {
                const playlist_id = 'pl-1';
                const media_id = 'm-1';
                MediaPageActions.removeMediaFromPlaylist(playlist_id, media_id);
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_MEDIA_FROM_PLAYLIST', playlist_id, media_id });
            });

            it('Should dispatch APPEND_NEW_PLAYLIST with provided playlist data', () => {
                const playlist_data = {
                    playlist_id: 'pl-2',
                    add_date: new Date('2020-01-01T00:00:00Z'),
                    description: 'Cool',
                    title: 'T',
                    media_list: ['a', 'b'],
                };
                MediaPageActions.addNewPlaylist(playlist_data);
                expect(dispatch).toHaveBeenCalledTimes(1);
                expect(dispatch).toHaveBeenCalledWith({ type: 'APPEND_NEW_PLAYLIST', playlist_data });
            });
        });
    });
});
