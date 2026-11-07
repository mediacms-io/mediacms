import Dispatcher from '../../../src/static/js/utils/dispatcher';
import * as VideoViewerActions from '../../../src/static/js/utils/actions/VideoViewerActions';

describe('utils/actions', () => {
    describe('VideoViewerActions', () => {
        const received: any[] = [];
        let token: string;

        beforeAll(() => {
            token = (Dispatcher as any).register((payload: any) => received.push(payload));
        });

        afterAll(() => {
            (Dispatcher as any).unregister(token);
        });

        beforeEach(() => {
            received.length = 0;
        });

        test.each([
            ['set_viewer_mode', [true], { type: 'SET_VIEWER_MODE', inTheaterMode: true }],
            ['set_player_volume', [0.4], { type: 'SET_PLAYER_VOLUME', playerVolume: 0.4 }],
            ['set_player_sound_muted', [false], { type: 'SET_PLAYER_SOUND_MUTED', playerSoundMuted: false }],
            ['set_video_quality', [720], { type: 'SET_VIDEO_QUALITY', quality: 720 }],
            ['set_video_playback_speed', [1.5], { type: 'SET_VIDEO_PLAYBACK_SPEED', playbackSpeed: 1.5 }],
        ] as [string, any[], any][])('%s dispatches the expected payload', (name, args, expected) => {
            (VideoViewerActions as any)[name](...args);
            expect(received).toStrictEqual([expected]);
        });

    });
});
