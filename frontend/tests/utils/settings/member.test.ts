import { init, settings } from '../../../src/static/js/utils/settings/member';

const memberConfig = (user?: any, features?: any) => {
    init(user, features);
    return settings();
};

describe('utils/settings', () => {
    describe('member', () => {
        // @todo: Revisit this behavior
        test('Returns anonymous defaults when user not provided', () => {
            const cfg = memberConfig();

            expect(cfg).toStrictEqual({
                name: null,
                username: null,
                thumbnail: null,
                is: { admin: false, anonymous: true },
                can: {
                    login: true,
                    register: true,
                    addMedia: false,
                    editProfile: false,
                    canSeeMembersPage: true,
                    usersNeedsToBeApproved: true,
                    changePassword: true,
                    deleteProfile: false,
                    readComment: true,
                    addComment: false,
                    mentionComment: false,
                    deleteComment: false,
                    editMedia: false,
                    deleteMedia: false,
                    editSubtitle: false,
                    manageMedia: false,
                    manageUsers: false,
                    manageComments: false,
                    reportMedia: false,
                    downloadMedia: false,
                    saveMedia: false,
                    likeMedia: true,
                    dislikeMedia: true,
                    shareMedia: true,
                    contactUser: false,
                },
                pages: { home: null, about: null, media: null, playlists: null },
            });
        });

        test('Trims user strings and applies user capability booleans when authenticated', () => {
            const cfg = memberConfig({
                is: { anonymous: false, admin: true },
                name: ' John Doe ',
                username: ' johnd ',
                thumbnail: ' /img/j.png ',
                can: {
                    changePassword: true,
                    deleteProfile: true,
                    addComment: true,
                    mentionComment: true,
                    deleteComment: true,
                    editMedia: true,
                    deleteMedia: true,
                    editSubtitle: true,
                    manageMedia: true,
                    manageUsers: true,
                    manageComments: true,
                    contactUser: true,
                    addMedia: true,
                    editProfile: true,
                    readComment: true,
                    canSeeMembersPage: true,
                    usersNeedsToBeApproved: false,
                },
                pages: { about: ' /u/john/about ', media: ' /u/john ', playlists: ' /u/john/playlists ' },
            });

            expect(cfg).toStrictEqual({
                name: 'John Doe',
                username: 'johnd',
                thumbnail: '/img/j.png',
                is: { admin: true, anonymous: false },
                can: {
                    login: true,
                    register: true,
                    addMedia: true,
                    editProfile: true,
                    canSeeMembersPage: true,
                    usersNeedsToBeApproved: false,
                    changePassword: true,
                    deleteProfile: true,
                    readComment: true,
                    addComment: true,
                    mentionComment: true,
                    deleteComment: true,
                    editMedia: true,
                    deleteMedia: true,
                    editSubtitle: true,
                    manageMedia: true,
                    manageUsers: true,
                    manageComments: true,
                    reportMedia: false,
                    downloadMedia: false,
                    saveMedia: false,
                    likeMedia: true,
                    dislikeMedia: true,
                    shareMedia: true,
                    contactUser: true,
                },
                pages: { home: null, about: '/u/john/about', media: '/u/john', playlists: '/u/john/playlists' },
            });
        });

        test('Comment capabilities require both user.can and features.media.actions', () => {
            const cfg1 = memberConfig(
                { is: { anonymous: false }, can: { addComment: true, mentionComment: true } },
                { media: { actions: { comment: false, comment_mention: true } } }
            );
            expect(cfg1.can.addComment).toBe(false);
            expect(cfg1.can.mentionComment).toBe(true);

            const cfg2 = memberConfig(
                { is: { anonymous: false }, can: { addComment: true, mentionComment: true } },
                { media: { actions: { comment: true, comment_mention: true } } }
            );
            expect(cfg2.can.addComment).toBe(true);
            expect(cfg2.can.mentionComment).toBe(true);
        });

        test('Header login/register reflect headerBar feature flags', () => {
            expect(memberConfig(undefined, { headerBar: { hideLogin: true } }).can.login).toBe(false);
            expect(memberConfig(undefined, { headerBar: { hideRegister: true } }).can.register).toBe(false);
            expect(memberConfig(undefined, { headerBar: { hideLogin: false, hideRegister: false } }).can).toMatchObject(
                { login: true, register: true }
            );
        });

        test('Media actions flags set like/dislike/share/report/download/save with correct defaults', () => {
            const cfg1 = memberConfig(undefined, {
                media: {
                    actions: { like: false, dislike: false, share: false, report: true, download: true, save: true },
                },
            });
            expect(cfg1.can.likeMedia).toBe(false);
            expect(cfg1.can.dislikeMedia).toBe(false);
            expect(cfg1.can.shareMedia).toBe(false);
            expect(cfg1.can.reportMedia).toBe(true);
            expect(cfg1.can.downloadMedia).toBe(true);
            expect(cfg1.can.saveMedia).toBe(true);
        });

        test('User flags canSeeMembersPage/usersNeedsToBeApproved/readComment default handling', () => {
            const cfg1 = memberConfig({
                is: { anonymous: false },
                can: { canSeeMembersPage: false, usersNeedsToBeApproved: false, readComment: false },
            });
            expect(cfg1.can.canSeeMembersPage).toBe(false);
            expect(cfg1.can.usersNeedsToBeApproved).toBe(false);
            expect(cfg1.can.readComment).toBe(false);
        });
    });
});
