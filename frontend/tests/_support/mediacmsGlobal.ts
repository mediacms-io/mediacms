type AnyObject = { [key: string]: any };

function isPlainObject(value: unknown): value is AnyObject {
    return null !== value && 'object' === typeof value && !Array.isArray(value);
}

export function deepMerge<T extends AnyObject>(base: T, overrides: AnyObject = {}): T {
    const result: AnyObject = { ...base };
    Object.keys(overrides).forEach((key) => {
        const value = overrides[key];
        result[key] = isPlainObject(value) && isPlainObject(result[key]) ? deepMerge(result[key], value) : value;
    });
    return result as T;
}

export function buildMediaCMSGlobal(overrides: AnyObject = {}): AnyObject {
    const base = {
        profileId: 'john',
        site: {
            id: 'mediacms-test',
            title: 'MediaCMS Test',
            url: 'https://example.com/',
            api: 'https://example.com/api/v1',
            useRoundedCorners: true,
            version: '1.0.0',
            devEnv: false,
            theme: { mode: 'light', switch: { enabled: true, position: 'sidebar' } },
            logo: {
                lightMode: { img: '/img/light.png', svg: '/img/light.svg' },
                darkMode: { img: '/img/dark.png', svg: '/img/dark.svg' },
            },
            pages: {
                latest: { enabled: true, title: 'Recent uploads' },
                featured: { enabled: true, title: 'Featured' },
                recommended: { enabled: true, title: 'Recommended' },
                members: { enabled: true, title: 'Members' },
            },
            userPages: {
                liked: { enabled: true, title: 'Liked media' },
                history: { enabled: true, title: 'History' },
            },
            taxonomies: {
                tags: { enabled: true, title: 'Tags' },
                categories: { enabled: true, title: 'Categories' },
            },
        },
        api: {
            media: '/media',
            playlists: '/playlists',
            comments: '/comments',
            search: '/search',
            tags: '/tags',
            categories: '/categories',
            members: '/users',
            liked: '/user/action/like',
            history: '/user/action/watch',
            actions: '/actions',
            manage_media: '/manage_media',
            manage_users: '/manage_users',
            manage_comments: '/manage_comments',
        },
        url: {
            home: '/',
            search: '/search',
            latestMedia: '/latest',
            featuredMedia: '/featured',
            recommendedMedia: '/recommended',
            members: '/members',
            error404: '/error',
            tags: '/tags',
            categories: '/categories',
            likedMedia: '/liked',
            history: '/history',
            addMedia: '/upload',
            editProfile: '/user/john/edit',
            signout: '/accounts/logout/',
            editChannel: '/channel/edit',
            changePassword: '/accounts/password/change/',
            admin: '/admin',
            migrations: '/migrations',
            manageMedia: '/manage/media',
            manageUsers: '/manage/users',
            manageComments: '/manage/comments',
            signin: '/accounts/login/',
            register: '/accounts/signup/',
        },
        user: {
            name: 'John',
            username: 'john',
            thumbnail: '/img/john.png',
            is: { admin: true, anonymous: false },
            can: {
                addMedia: true,
                editMedia: true,
                deleteMedia: true,
                editSubtitle: true,
                readComment: true,
                addComment: true,
                mentionComment: true,
                deleteComment: true,
                editProfile: true,
                deleteProfile: true,
                changePassword: true,
                canSeeMembersPage: true,
                manageMedia: true,
                manageUsers: true,
                manageComments: true,
                contactUser: true,
                usersNeedsToBeApproved: false,
            },
            pages: { media: '/user/john', about: '/user/john/about', playlists: '/user/john/playlists' },
        },
        contents: {
            header: { right: '', onLogoRight: '' },
            sidebar: {
                navMenuItems: [{ text: 'About', link: '/about', icon: 'contact_support' }],
                belowNavMenu: null,
                belowThemeSwitcher: '',
                footer: 'Powered by MediaCMS',
            },
            uploader: { belowUploadArea: '', postUploadMessage: '' },
            notifications: {
                messages: {
                    addToLiked: 'Added to liked media',
                    removeFromLiked: 'Removed from liked media',
                    addToDisliked: 'Added to disliked media',
                    removeFromDisliked: 'Removed from disliked media',
                },
            },
        },
        features: {
            embeddedVideo: { initialDimensions: { width: 560, height: 315 } },
            headerBar: { hideLogin: false, hideRegister: false },
            sideBar: { hideHomeLink: false, hideTagsLink: false, hideCategoriesLink: false },
            media: {
                actions: {
                    share: true,
                    report: true,
                    like: true,
                    dislike: true,
                    download: true,
                    comment: true,
                    timestampTimebar: false,
                    comment_mention: false,
                    save: true,
                    allowMediaReplacement: false,
                },
                shareOptions: ['embed', 'email'],
            },
            mediaItem: { hideDate: false, hideViews: false, hideAuthor: false },
            listings: { includeNumbers: false },
            playlists: { mediaTypes: ['audio', 'video'] },
        },
        pages: {
            home: { sections: { latest: { title: 'Latest' } } },
            search: { advancedFilters: true },
            media: { categoriesWithTitle: false, htmlInDescription: false, hideViews: false, related: { initialSize: 15 } },
            profile: { htmlInDescription: false, includeHistory: true, includeLikedMedia: true },
        },
    };

    return deepMerge(base, overrides);
}

export function installMediaCMSGlobal(overrides: AnyObject = {}): AnyObject {
    const glbl = buildMediaCMSGlobal(overrides);
    (window as any).MediaCMS = glbl;
    return glbl;
}
