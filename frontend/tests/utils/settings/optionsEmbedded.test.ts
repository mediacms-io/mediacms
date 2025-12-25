import { init, settings } from '../../../src/static/js/utils/settings/optionsEmbedded';

const optionsEmbeddedConfig = (embeddedVideo?: any) => {
    init(embeddedVideo);
    return settings();
};

describe('utils/settings', () => {
    describe('optionsEmbedded', () => {
        test('Returns default dimensions when settings is undefined', () => {
            const cfg = optionsEmbeddedConfig(undefined);
            expect(cfg.video.dimensions).toStrictEqual({ width: 560, widthUnit: 'px', height: 315, heightUnit: 'px' });
        });

        test('Returns default dimensions when settings.initialDimensions is undefined', () => {
            const cfg = optionsEmbeddedConfig({});
            expect(cfg.video.dimensions).toStrictEqual({ width: 560, widthUnit: 'px', height: 315, heightUnit: 'px' });
        });

        test('Applies valid numeric width and height from initialDimensions', () => {
            const cfg = optionsEmbeddedConfig({ initialDimensions: { width: 640, height: 360 } });
            expect(cfg.video.dimensions).toStrictEqual({ width: 640, widthUnit: 'px', height: 360, heightUnit: 'px' });
        });

        // @todo: Revisit this behavior
        test('Ignores NaN and non-numeric width/height and keeps defaults', () => {
            const cfg1 = optionsEmbeddedConfig({ initialDimensions: { width: NaN, height: NaN } });
            expect(cfg1.video.dimensions).toStrictEqual({ width: 560, widthUnit: 'px', height: 315, heightUnit: 'px' });

            const cfg2 = optionsEmbeddedConfig({ initialDimensions: { width: '640', height: '360' } });
            expect(cfg2.video.dimensions).toStrictEqual({
                width: '640',
                widthUnit: 'px',
                height: '360',
                heightUnit: 'px',
            });
        });

        // @todo: Revisit this behavior
        test('Ignores provided widthUnit/heightUnit as they are not used', () => {
            const cfg = optionsEmbeddedConfig({
                initialDimensions: { width: 800, height: 450, widthUnit: 'percent', heightUnit: 'percent' },
            });
            expect(cfg.video.dimensions.width).toBe(800);
            expect(cfg.video.dimensions.height).toBe(450);
            expect(cfg.video.dimensions.widthUnit).toBe('px');
            expect(cfg.video.dimensions.heightUnit).toBe('px');
        });

        // @todo: Revisit this behavior
        test('Does not mutate the provided settings object', () => {
            const input = {
                initialDimensions: { width: 700, height: 400, widthUnit: 'percent', heightUnit: 'percent' },
            };
            const copy = JSON.parse(JSON.stringify(input));
            optionsEmbeddedConfig(input);
            expect(input).toStrictEqual(copy);
        });
    });
});
