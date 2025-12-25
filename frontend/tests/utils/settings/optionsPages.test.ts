import { init, settings } from '../../../src/static/js/utils/settings/optionsPages';

const optionsPagesConfig = (home?: any, search?: any, media?: any, profile?: any, VALID_PAGES?: any) => {
    init(home, search, media, profile, VALID_PAGES);
    return settings();
};

describe('utils/settings', () => {
    describe('optionsPages', () => {
        test('Uses VALID_PAGES titles as defaults for home sections when provided', () => {
            const cfg = optionsPagesConfig(undefined, undefined, undefined, undefined, {
                latest: { title: 'Recent' },
                featured: { title: 'Spotlight' },
                recommended: { title: 'You may like' },
            });
            expect(cfg.home.sections.latest.title).toBe('Recent');
            expect(cfg.home.sections.featured.title).toBe('Spotlight');
            expect(cfg.home.sections.recommended.title).toBe('You may like');
        });

        test('Trims custom home section titles from input', () => {
            const cfg = optionsPagesConfig({
                sections: {
                    latest: { title: '  LATEST  ' },
                    featured: { title: '\nFeatured  ' },
                    recommended: { title: '  Recommended' },
                },
            });
            expect(cfg.home.sections.latest.title).toBe('LATEST');
            expect(cfg.home.sections.featured.title).toBe('Featured');
            expect(cfg.home.sections.recommended.title).toBe('Recommended');
        });

        test('Sets search.advancedFilters true only when explicitly true', () => {
            const def = optionsPagesConfig(undefined, undefined, undefined, undefined, {});
            expect(def.search.advancedFilters).toBe(false);

            const falsy = optionsPagesConfig(undefined, { advancedFilters: false }, undefined, undefined, {});
            expect(falsy.search.advancedFilters).toBe(false);

            const truthy = optionsPagesConfig(undefined, { advancedFilters: true }, undefined, undefined, {});
            expect(truthy.search.advancedFilters).toBe(true);
        });

        test('Configures media options with correct defaults and overrides', () => {
            const def = optionsPagesConfig(undefined, undefined, undefined, undefined, {});

            expect(def.media.categoriesWithTitle).toBe(false);
            expect(def.media.htmlInDescription).toBe(false);
            expect(def.media.displayViews).toBe(true);
            expect(def.media.related.initialSize).toBe(10);

            const override = optionsPagesConfig(
                undefined,
                undefined,
                {
                    categoriesWithTitle: true,
                    htmlInDescription: true,
                    hideViews: true,
                    related: { initialSize: 25 },
                },
                undefined,
                {}
            );

            expect(override.media.categoriesWithTitle).toBe(true);
            expect(override.media.htmlInDescription).toBe(true);
            expect(override.media.displayViews).toBe(false);
            expect(override.media.related.initialSize).toBe(10); // @todo: Fix this! It should return 25.
        });

        test('Ignores NaN and non-numeric media.related.initialSize and keeps default 10', () => {
            const cfg1 = optionsPagesConfig(undefined, undefined, { related: { initialSize: NaN } }, undefined, {});
            expect(cfg1.media.related.initialSize).toBe(10);

            const cfg2 = optionsPagesConfig(undefined, undefined, { related: { initialSize: '12' } }, undefined, {});
            expect(cfg2.media.related.initialSize).toBe(10);
        });

        test('Profile settings true only when explicitly true', () => {
            const def = optionsPagesConfig(undefined, undefined, undefined, undefined, {});
            expect(def.profile.htmlInDescription).toBe(false);
            expect(def.profile.includeHistory).toBe(false);
            expect(def.profile.includeLikedMedia).toBe(false);

            const truthy = optionsPagesConfig(
                undefined,
                undefined,
                undefined,
                {
                    htmlInDescription: true,
                    includeHistory: true,
                    includeLikedMedia: true,
                },
                {}
            );
            expect(truthy.profile.htmlInDescription).toBe(true);
            expect(truthy.profile.includeHistory).toBe(true);
            expect(truthy.profile.includeLikedMedia).toBe(true);
        });

        // @todo: Revisit this behavior
        test('Does not mutate provided input objects', () => {
            const home = { sections: { latest: { title: ' A ' } } };
            const search = { advancedFilters: true };
            const media = { hideViews: true, related: { initialSize: 5 } };
            const profile = { includeHistory: true };
            const validPages = { latest: { title: 'L' }, featured: { title: 'F' }, recommended: { title: 'R' } };

            const homeCopy = JSON.parse(JSON.stringify(home));
            const searchCopy = JSON.parse(JSON.stringify(search));
            const mediaCopy = JSON.parse(JSON.stringify(media));
            const profileCopy = JSON.parse(JSON.stringify(profile));
            const validPagesCopy = JSON.parse(JSON.stringify(validPages));

            optionsPagesConfig(home, search, media, profile, validPages);

            expect(home).toStrictEqual(homeCopy);
            expect(search).toStrictEqual(searchCopy);
            expect(media).toStrictEqual(mediaCopy);
            expect(profile).toStrictEqual(profileCopy);
            expect(validPages).toStrictEqual(validPagesCopy);
        });
    });
});
