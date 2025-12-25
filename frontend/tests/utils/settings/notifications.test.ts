import { init, settings } from '../../../src/static/js/utils/settings/notifications';

const notificationsConfig = (sett?: any) => {
    init(sett);
    return settings();
};

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

        // @todo: Revisit this behavior
        test('Keep incoming message values ​​without processing', () => {
            const cfg = notificationsConfig({
                messages: {
                    addToLiked: '  Yay  ',
                    removeFromLiked: '   ',
                    addToDisliked: '\nNope',
                    removeFromDisliked: '\t OK\t',
                },
            });
            expect(cfg.messages.addToLiked).toBe('  Yay  ');
            expect(cfg.messages.removeFromLiked).toBe('   ');
            expect(cfg.messages.addToDisliked).toBe('\nNope');
            expect(cfg.messages.removeFromDisliked).toBe('\t OK\t');
        });

        test('Ignores undefined, keeping defaults', () => {
            const cfg = notificationsConfig({
                messages: {
                    addToLiked: undefined,
                    removeFromLiked: undefined,
                    addToDisliked: undefined,
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
            const cfg = notificationsConfig({ messages: { addToLiked: 'A', notARealKey: 'x' } });
            expect(cfg.messages.notARealKey).toBeUndefined();
            expect(cfg.messages.addToLiked).toBe('A');
            expect(cfg.messages.removeFromLiked).toBe('Removed from liked media');
            expect(cfg.messages.addToDisliked).toBe('Added to disliked media');
            expect(cfg.messages.removeFromDisliked).toBe('Removed from disliked media');
        });
    });
});
