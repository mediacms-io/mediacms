import {
    getLtiContextId,
    getParentMediaBase,
    inEmbeddedApp,
    inSelectMediaEmbedMode,
    isDeepLinkSelection,
    isSelectMediaMode,
    isShareMediaDisabled,
    submitDeepLinkSelection,
} from '../../../src/static/js/utils/helpers/embeddedApp';

function visit(search: string) {
    window.history.replaceState(null, '', '/' + search);
}

describe('js/utils/helpers', () => {
    describe('embeddedApp', () => {
        beforeEach(() => {
            sessionStorage.clear();
            visit('');
            jest.restoreAllMocks();
        });

        describe('inEmbeddedApp', () => {
            test('Returns true and persists flag for lms_embed_mode', () => {
                visit('?mode=lms_embed_mode');
                expect(inEmbeddedApp()).toBe(true);
                expect(sessionStorage.getItem('lms_embed_mode')).toBe('true');
            });

            test('Keeps embedded mode across later navigation via sessionStorage', () => {
                visit('?mode=lms_embed_mode');
                inEmbeddedApp();
                visit('?other=1');
                expect(inEmbeddedApp()).toBe(true);
            });

            test('Standard mode clears the flag', () => {
                sessionStorage.setItem('lms_embed_mode', 'true');
                visit('?mode=standard');
                expect(inEmbeddedApp()).toBe(false);
                expect(sessionStorage.getItem('lms_embed_mode')).toBeNull();
            });

            test('Returns false without flag or mode', () => {
                expect(inEmbeddedApp()).toBe(false);
            });

            test('Returns false when sessionStorage throws', () => {
                jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                    throw new Error('denied');
                });
                expect(inEmbeddedApp()).toBe(false);
            });
        });

        describe('isShareMediaDisabled', () => {
            test('share_media=0 disables and persists', () => {
                visit('?share_media=0');
                expect(isShareMediaDisabled()).toBe(true);
                expect(sessionStorage.getItem('lms_share_media_disabled')).toBe('true');
                visit('');
                expect(isShareMediaDisabled()).toBe(true);
            });

            test('share_media=1 clears the flag', () => {
                sessionStorage.setItem('lms_share_media_disabled', 'true');
                visit('?share_media=1');
                expect(isShareMediaDisabled()).toBe(false);
                expect(sessionStorage.getItem('lms_share_media_disabled')).toBeNull();
            });

            test('Fresh LTI landing without share_media clears a stale flag', () => {
                sessionStorage.setItem('lms_share_media_disabled', 'true');
                visit('?mode=lms_embed_mode');
                expect(isShareMediaDisabled()).toBe(false);
            });

            test('Returns false when sessionStorage throws', () => {
                jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                    throw new Error('denied');
                });
                expect(isShareMediaDisabled()).toBe(false);
            });
        });

        describe('isSelectMediaMode and inSelectMediaEmbedMode', () => {
            test('Detects action=select_media', () => {
                visit('?action=select_media');
                expect(isSelectMediaMode()).toBe(true);
                expect(inSelectMediaEmbedMode()).toBe(false);
            });

            test('Requires embedded mode for select media embed mode', () => {
                visit('?action=select_media&mode=lms_embed_mode');
                expect(inSelectMediaEmbedMode()).toBe(true);
            });

            test('Returns false for other actions', () => {
                visit('?action=view');
                expect(isSelectMediaMode()).toBe(false);
            });

            test('Returns false when URL parsing fails', () => {
                const OriginalURL = globalThis.URL;
                (globalThis as any).URL = function () {
                    throw new Error('bad url');
                };
                try {
                    expect(isSelectMediaMode()).toBe(false);
                } finally {
                    globalThis.URL = OriginalURL;
                }
            });
        });

        describe('isDeepLinkSelection', () => {
            test('lti_deep_link=1 enables and persists', () => {
                visit('?lti_deep_link=1');
                expect(isDeepLinkSelection()).toBe(true);
                visit('');
                expect(isDeepLinkSelection()).toBe(true);
            });

            test('Standard mode clears the flag', () => {
                sessionStorage.setItem('lti_deep_link', 'true');
                visit('?mode=standard');
                expect(isDeepLinkSelection()).toBe(false);
                expect(sessionStorage.getItem('lti_deep_link')).toBeNull();
            });

            test('Returns false when sessionStorage throws', () => {
                jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                    throw new Error('denied');
                });
                expect(isDeepLinkSelection()).toBe(false);
            });
        });

        describe('submitDeepLinkSelection', () => {
            test('Posts a hidden form with the media token', () => {
                let submitted: HTMLFormElement | null = null;
                jest.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (this: HTMLFormElement) {
                    submitted = this;
                });

                expect(submitDeepLinkSelection('tok123')).toBe(true);

                const form = submitted as unknown as HTMLFormElement;
                expect(form.method).toBe('post');
                expect(form.getAttribute('action')).toBe('/lti/select-media/');
                const input = form.querySelector('input') as HTMLInputElement;
                expect(input.type).toBe('hidden');
                expect(input.name).toBe('media_ids[]');
                expect(input.value).toBe('tok123');
                form.remove();
            });

            test('Returns false when submit throws', () => {
                jest.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {
                    throw new Error('blocked');
                });
                expect(submitDeepLinkSelection('tok')).toBe(false);
                document.querySelectorAll('form').forEach((f) => f.remove());
            });
        });

        describe('getParentMediaBase', () => {
            test('Stores base from query and returns it later', () => {
                visit('?parent_media_base=' + encodeURIComponent('https://lms.example/media'));
                expect(getParentMediaBase()).toBe('https://lms.example/media');
                visit('');
                expect(getParentMediaBase()).toBe('https://lms.example/media');
            });

            test('Standard mode clears and returns null', () => {
                sessionStorage.setItem('parent_media_base', 'x');
                visit('?mode=standard&parent_media_base=y');
                expect(getParentMediaBase()).toBeNull();
                expect(sessionStorage.getItem('parent_media_base')).toBeNull();
            });

            test('Returns null when nothing stored or on error', () => {
                expect(getParentMediaBase()).toBeNull();
                jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                    throw new Error('denied');
                });
                expect(getParentMediaBase()).toBeNull();
            });
        });

        describe('getLtiContextId', () => {
            test('Stores context id from query and returns it later', () => {
                visit('?lti_context_id=course-7');
                expect(getLtiContextId()).toBe('course-7');
                visit('');
                expect(getLtiContextId()).toBe('course-7');
            });

            test('Returns null when nothing stored or on error', () => {
                expect(getLtiContextId()).toBeNull();
                jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                    throw new Error('denied');
                });
                expect(getLtiContextId()).toBeNull();
            });
        });
    });
});
