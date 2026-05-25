import { BrowserCache } from '../../../src/static/js/utils/classes/';
import store from '../../../src/static/js/utils/stores/VideoViewerStore';

jest.mock('../../../src/static/js/utils/classes/', () => ({
    BrowserCache: jest.fn().mockImplementation(() => ({
        get: (key: string) => {
            let result: any = undefined;
            switch (key) {
                case 'player-volume':
                    result = 0.6;
                    break;
                case 'player-sound-muted':
                    result = false;
                    break;
                case 'in-theater-mode':
                    result = true;
                    break;
                case 'video-quality':
                    result = 720;
                    break;
                case 'video-playback-speed':
                    result = 2;
                    break;
            }
            return result;
        },
        set: jest.fn(),
    })),
}));

jest.mock('../../../src/static/js/utils/settings/config', () => ({
    config: jest.fn(() => jest.requireActual('../../tests-constants').sampleMediaCMSConfig),
}));

jest.mock('../../../src/static/js/utils/helpers', () => ({
    BrowserEvents: jest.fn().mockImplementation(() => ({
        doc: jest.fn(),
        win: jest.fn(),
    })),
    exportStore: jest.fn((store) => store),
}));

describe('utils/store', () => {
    describe('VideoViewerStore', () => {
        const browserCacheInstance = (BrowserCache as jest.Mock).mock.results[0].value;
        const browserCacheSetSpy = browserCacheInstance.set;

        const handler = store.actions_handler.bind(store);

        const onChangedViewerMode = jest.fn();
        const onChangedPlayerVolume = jest.fn();
        const onChangedPlayerSoundMuted = jest.fn();
        const onChangedVideoQuality = jest.fn();
        const onChangedVideoPlaybackSpeed = jest.fn();

        store.on('changed_viewer_mode', onChangedViewerMode);
        store.on('changed_player_volume', onChangedPlayerVolume);
        store.on('changed_player_sound_muted', onChangedPlayerSoundMuted);
        store.on('changed_video_quality', onChangedVideoQuality);
        store.on('changed_video_playback_speed', onChangedVideoPlaybackSpeed);

        test('Validate initial values', () => {
            expect(store.get('player-volume')).toBe(0.6);
            expect(store.get('player-sound-muted')).toBe(false);
            expect(store.get('in-theater-mode')).toBe(true);
            expect(store.get('video-data')).toBe(undefined); // @todo: Revisit this behavior
            expect(store.get('video-quality')).toBe(720);
            expect(store.get('video-playback-speed')).toBe(2);
        });

        describe('Trigger and validate actions behavior', () => {
            test('Action type: "TOGGLE_VIEWER_MODE"', () => {
                const initialValue = store.get('in-theater-mode');

                handler({ type: 'TOGGLE_VIEWER_MODE' });

                expect(onChangedViewerMode).toHaveBeenCalledWith();
                expect(onChangedViewerMode).toHaveBeenCalledTimes(1);

                expect(store.get('in-theater-mode')).toBe(!initialValue);
                expect(browserCacheSetSpy).toHaveBeenCalledWith('in-theater-mode', !initialValue);
            });

            test('Action type: "SET_VIEWER_MODE"', () => {
                const initialValue = store.get('in-theater-mode');
                const newValue = !initialValue;

                handler({ type: 'SET_VIEWER_MODE', inTheaterMode: newValue });

                expect(onChangedViewerMode).toHaveBeenCalledWith();
                expect(onChangedViewerMode).toHaveBeenCalledTimes(2); // The first time called by 'TOGGLE_VIEWER_MODE' action.

                expect(store.get('in-theater-mode')).toBe(newValue);
                expect(browserCacheSetSpy).toHaveBeenCalledWith('in-theater-mode', newValue);
            });

            test('Action type: "SET_PLAYER_VOLUME"', () => {
                const newValue = 0.3;

                handler({ type: 'SET_PLAYER_VOLUME', playerVolume: newValue });

                expect(onChangedPlayerVolume).toHaveBeenCalledWith();
                expect(onChangedPlayerVolume).toHaveBeenCalledTimes(1);

                expect(store.get('player-volume')).toBe(newValue);
                expect(browserCacheSetSpy).toHaveBeenCalledWith('player-volume', newValue);
            });

            test('Action type: "SET_PLAYER_SOUND_MUTED"', () => {
                const initialValue = store.get('player-sound-muted');
                const newValue = !initialValue;

                handler({ type: 'SET_PLAYER_SOUND_MUTED', playerSoundMuted: newValue });

                expect(onChangedPlayerSoundMuted).toHaveBeenCalledWith();
                expect(onChangedPlayerSoundMuted).toHaveBeenCalledTimes(1);

                expect(store.get('player-sound-muted')).toBe(newValue);
                expect(browserCacheSetSpy).toHaveBeenCalledWith('player-sound-muted', newValue);
            });

            test('Action type: "SET_VIDEO_QUALITY"', () => {
                const newValue = 1080;

                handler({ type: 'SET_VIDEO_QUALITY', quality: newValue });

                expect(onChangedVideoQuality).toHaveBeenCalledWith();
                expect(onChangedVideoQuality).toHaveBeenCalledTimes(1);

                expect(store.get('video-quality')).toBe(newValue);
                expect(browserCacheSetSpy).toHaveBeenCalledWith('video-quality', newValue);
            });

            test('Action type: "SET_VIDEO_PLAYBACK_SPEED"', () => {
                const newValue = 1.5;

                handler({ type: 'SET_VIDEO_PLAYBACK_SPEED', playbackSpeed: newValue });

                expect(onChangedVideoPlaybackSpeed).toHaveBeenCalledWith();
                expect(onChangedVideoPlaybackSpeed).toHaveBeenCalledTimes(1);

                expect(store.get('video-playback-speed')).toBe(newValue);
                expect(browserCacheSetSpy).toHaveBeenCalledWith('video-playback-speed', newValue);
            });
        });
    });
});
