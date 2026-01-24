import { VideoViewerActions } from '../../../src/static/js/utils/actions';
import dispatcher from '../../../src/static/js/utils/dispatcher';

// Mock the dispatcher module used by VideoViewerActions
jest.mock('../../../src/static/js/utils/dispatcher', () => ({ dispatch: jest.fn() }));

describe('utils/actions', () => {
    describe('VideoViewerActions', () => {
        const dispatch = dispatcher.dispatch;

        beforeEach(() => {
            (dispatcher.dispatch as jest.Mock).mockClear();
        });

        describe('set_viewer_mode', () => {
            it('Should dispatch SET_VIEWER_MODE with "true" and "false" for enabling and disabling theater mode', () => {
                VideoViewerActions.set_viewer_mode(true);
                VideoViewerActions.set_viewer_mode(false);
                expect(dispatch).toHaveBeenCalledTimes(2);
                expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'SET_VIEWER_MODE', inTheaterMode: true });
                expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'SET_VIEWER_MODE', inTheaterMode: false });
            });
        });

        describe('set_player_volume', () => {
            it('Should dispatch SET_PLAYER_VOLUME with provided volume numbers', () => {
                VideoViewerActions.set_player_volume(0);
                VideoViewerActions.set_player_volume(0.75);
                VideoViewerActions.set_player_volume(1);
                expect(dispatch).toHaveBeenCalledTimes(3);
                expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'SET_PLAYER_VOLUME', playerVolume: 0 });
                expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'SET_PLAYER_VOLUME', playerVolume: 0.75 });
                expect(dispatch).toHaveBeenNthCalledWith(3, { type: 'SET_PLAYER_VOLUME', playerVolume: 1 });
            });
        });

        describe('set_player_sound_muted', () => {
            it('Should dispatch SET_PLAYER_SOUND_MUTED with "true" and "false"', () => {
                VideoViewerActions.set_player_sound_muted(true);
                VideoViewerActions.set_player_sound_muted(false);
                expect(dispatch).toHaveBeenCalledTimes(2);
                expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'SET_PLAYER_SOUND_MUTED', playerSoundMuted: true });
                expect(dispatch).toHaveBeenNthCalledWith(2, {
                    type: 'SET_PLAYER_SOUND_MUTED',
                    playerSoundMuted: false,
                });
            });
        });

        describe('set_video_quality', () => {
            it('Should dispatch SET_VIDEO_QUALITY with "auto" and numeric quality', () => {
                VideoViewerActions.set_video_quality('auto');
                VideoViewerActions.set_video_quality(720);
                expect(dispatch).toHaveBeenCalledTimes(2);
                expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'SET_VIDEO_QUALITY', quality: 'auto' });
                expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'SET_VIDEO_QUALITY', quality: 720 });
            });
        });

        describe('set_video_playback_speed', () => {
            it('Should dispatch SET_VIDEO_PLAYBACK_SPEED with different speeds', () => {
                VideoViewerActions.set_video_playback_speed(1.5);
                VideoViewerActions.set_video_playback_speed(0.5);
                VideoViewerActions.set_video_playback_speed(2);
                expect(dispatch).toHaveBeenCalledTimes(3);
                expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'SET_VIDEO_PLAYBACK_SPEED', playbackSpeed: 1.5 });
                expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'SET_VIDEO_PLAYBACK_SPEED', playbackSpeed: 0.5 });
                expect(dispatch).toHaveBeenNthCalledWith(3, { type: 'SET_VIDEO_PLAYBACK_SPEED', playbackSpeed: 2 });
            });
        });
    });
});
