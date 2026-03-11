import { notificationsConfig } from '../../../src/static/js/utils/settings/notifications';

describe('utils/settings', () => {
    describe('notifications', () => {
        test('Returns defaults when no settings provided', () => {
            const cfg = notificationsConfig();
            expect(cfg).toStrictEqual({
                messages: {
                    addToLiked: 'Added to liked media',
                    removeFromLiked: 'Removed from liked media',
                    addToDisliked: 'Added to disliked media',
                    removeFromDisliked: 'Removed from disliked media',
                },
            });
        });

        test('Trims incoming message values and applies only when non-empty', () => {
            const cfg = notificationsConfig({
                messages: {
                    addToLiked: '  Yay  ',
                    removeFromLiked: '   ',
                    addToDisliked: '\nNope',
                    removeFromDisliked: '\t OK\t',
                },
            });
            expect(cfg.messages.addToLiked).toBe('Yay');
            // empty after trim -> keep default
            expect(cfg.messages.removeFromLiked).toBe('Removed from liked media');
            expect(cfg.messages.addToDisliked).toBe('Nope');
            expect(cfg.messages.removeFromDisliked).toBe('OK');
        });

        test('Ignores undefined or empty-string overrides, keeping defaults', () => {
            const cfg = notificationsConfig({
                messages: {
                    addToLiked: undefined,
                    removeFromLiked: '',
                    addToDisliked: '   ',
                    removeFromDisliked: undefined,
                },
            });
            expect(cfg.messages.addToLiked).toBe('Added to liked media');
            expect(cfg.messages.removeFromLiked).toBe('Removed from liked media');
            expect(cfg.messages.addToDisliked).toBe('Added to disliked media');
            expect(cfg.messages.removeFromDisliked).toBe('Removed from disliked media');
        });

        test('Allows partial overrides without affecting other keys', () => {
            const cfg = notificationsConfig({ messages: { addToLiked: 'Nice!' } });
            expect(cfg.messages.addToLiked).toBe('Nice!');
            expect(cfg.messages.removeFromLiked).toBe('Removed from liked media');
            expect(cfg.messages.addToDisliked).toBe('Added to disliked media');
            expect(cfg.messages.removeFromDisliked).toBe('Removed from disliked media');
        });

        test('Handles extraneous keys by passing them through while keeping known defaults intact', () => {
            const cfg = notificationsConfig({
                messages: {
                    addToLiked: 'A',
                    // Inject an unknown key; current implementation passes unknown keys through
                    ...{ notARealKey: 'x' },
                },
            });

            expect(cfg.messages.addToLiked).toBe('A');
            // extraneous key currently copied over
            expect((cfg.messages as any).notARealKey).toBe('x');
            // sanity check known defaults remain for untouched keys
            expect(cfg.messages.removeFromLiked).toBe('Removed from liked media');
            expect(cfg.messages.addToDisliked).toBe('Added to disliked media');
            expect(cfg.messages.removeFromDisliked).toBe('Removed from disliked media');
        });
    });
});
