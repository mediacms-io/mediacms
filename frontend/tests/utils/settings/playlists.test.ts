import { playlistsConfig } from '../../../src/static/js/utils/settings/playlists';

describe('utils/settings', () => {
    describe('playlists', () => {
        test('Defaults to both audio and video when no settings provided', () => {
            const cfg = playlistsConfig();
            expect(cfg.mediaTypes).toEqual(['audio', 'video']);
        });

        test('Returns default when provided mediaTypes array is empty', () => {
            const cfg = playlistsConfig({ mediaTypes: [] });
            expect(cfg.mediaTypes).toEqual(['audio', 'video']);
        });

        test('Includes only valid media types when both valid and invalid are provided', () => {
            const cfg = playlistsConfig({ mediaTypes: ['audio', 'invalid', 'video', 'something'] as any });
            expect(cfg.mediaTypes).toEqual(['audio', 'video']);
        });

        test('Returns default when provided mediaTypes is non-array or undefined/null', () => {
            expect(playlistsConfig({} as any).mediaTypes).toEqual(['audio', 'video']);
            expect(playlistsConfig({ mediaTypes: undefined } as any).mediaTypes).toEqual(['audio', 'video']);
            expect(playlistsConfig({ mediaTypes: null as any }).mediaTypes).toEqual(['audio', 'video']);
            expect(playlistsConfig({ mediaTypes: 'audio' as any }).mediaTypes).toEqual(['audio', 'video']);
            expect(playlistsConfig({ mediaTypes: 123 as any }).mediaTypes).toEqual(['audio', 'video']);
        });

        test('Handles duplicates and preserves order among valid items', () => {
            const cfg = playlistsConfig({ mediaTypes: ['video', 'audio', 'video', 'audio', 'invalid'] as any });
            // Implementation preserves order and includes duplicates; however, it later enforces default if empty only.
            // Since duplicates are allowed by implementation, expect duplicates to be preserved.
            expect(cfg.mediaTypes).toEqual(['video', 'audio', 'video', 'audio']);
        });

        test('Rejects non-exact case values (e.g., \"Audio\")', () => {
            const cfg = playlistsConfig({ mediaTypes: ['Audio', 'Video'] as any });
            // None match exactly, so default should apply.
            expect(cfg.mediaTypes).toEqual(['audio', 'video']);
        });

        test('does not mutate the input object', () => {
            const input: any = { mediaTypes: ['audio', 'video', 'invalid'] };
            const copy = JSON.parse(JSON.stringify(input));
            playlistsConfig(input);
            expect(input).toEqual(copy);
        });
    });
});
