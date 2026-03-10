import { GlobalMediaCMS } from './GlobalMediaCMS';

type MediaCMSConfigApi = {
    archive: {
        tags: string;
        categories: string;
    };
    featured: string;
    manage: {
        media: string;
        users: string;
        comments: string;
    };
    media: string;
    playlists: string;
    recommended: string;
    search: {
        query: string;
        titles: string;
        tag: string;
        category: string;
    };
    user: {
        liked: string;
        history: string;
        playlists: string;
    };
    users: string; // @todo: "users" or "members"?
};

type MediaCMSConfigContents = Omit<GlobalMediaCMS['contents'], 'notifications' | 'sidebar'> & {
    sidebar: {
        belowNavMenu: GlobalMediaCMS['contents']['sidebar']['belowNavMenu'];
        belowThemeSwitcher: GlobalMediaCMS['contents']['sidebar']['belowThemeSwitcher'];
        footer: GlobalMediaCMS['contents']['sidebar']['footer'];
        mainMenuExtra: { items: GlobalMediaCMS['contents']['sidebar']['mainMenuExtraItems'] };
        navMenu: { items: GlobalMediaCMS['contents']['sidebar']['navMenuItems'] };
    };
};

type MediaCMSConfigEnabled = Pick<GlobalMediaCMS['site'], 'taxonomies'> & {
    pages: GlobalMediaCMS['site']['pages'] & GlobalMediaCMS['site']['userPages'];
};

type MediaCMSConfigMember = {
    name: GlobalMediaCMS['user']['name'] | null;
    username: GlobalMediaCMS['user']['username'] | null;
    thumbnail: GlobalMediaCMS['user']['thumbnail'] | null;
    is: GlobalMediaCMS['user']['is'];
    can: {
        // a
        addComment: boolean;
        addMedia: boolean;
        // c
        canSeeMembersPage: boolean; // @note: This sould be renamed
        changePassword: boolean;
        contactUser: boolean;
        // d
        deleteComment: boolean;
        deleteMedia: boolean;
        deleteProfile: boolean;
        dislikeMedia: boolean;
        downloadMedia: boolean;
        // e
        editMedia: boolean;
        editProfile: boolean;
        editSubtitle: boolean;
        // l
        likeMedia: boolean;
        login: boolean;
        // m
        manageComments: boolean;
        manageMedia: boolean;
        manageUsers: boolean;
        mentionComment: boolean;
        // r
        readComment: boolean;
        register: boolean;
        reportMedia: boolean;
        // s
        saveMedia: boolean;
        shareMedia: boolean;
        // u
        usersNeedsToBeApproved: boolean;
    };
    pages: {
        home: string | null; // @todo: Check this again
        about: GlobalMediaCMS['user']['pages']['about'] | null;
        media: GlobalMediaCMS['user']['pages']['media'] | null;
        playlists: GlobalMediaCMS['user']['pages']['playlists'] | null;
    };
};

type MediaCMSConfigMedia = {
    item: {
        displayAuthor: boolean;
        displayViews: boolean;
        displayPublishDate: boolean;
    };
    share: { options: string[] };
};

type MediaCMSConfigNotifications = GlobalMediaCMS['contents']['notifications'];

type MediaCMSConfigOptions = {
    pages: {
        home: GlobalMediaCMS['pages']['home'];
        search: GlobalMediaCMS['pages']['search'];
        media: Omit<GlobalMediaCMS['pages']['media'], 'hideViews'> & {
            displayViews: boolean;
        };
        profile: GlobalMediaCMS['pages']['profile'];
    };
    embedded: {
        video: {
            dimensions: {
                width: number;
                widthUnit: 'px';
                // widthUnit: 'px' | 'percent'; // @note: The unit value "percent" is not used
                height: number;
                heightUnit: 'px';
                // heightUnit: 'px' | 'percent'; // @note: The unit value "percent" is not used
            };
        };
    };
};

type MediaCMSConfigPlaylists = GlobalMediaCMS['features']['playlists'];

type MediaCMSConfigSidebar = GlobalMediaCMS['features']['sideBar'];

type MediaCMSConfigSite = {
    api: string;
    id: string;
    title: string;
    url: string;
    useRoundedCorners: boolean;
    version: string;
};

type MediaCMSConfigTheme = Pick<GlobalMediaCMS['site'], 'logo'> & GlobalMediaCMS['site']['theme'];

type MediaCMSConfigUrl = {
    admin: string; // eg: '/admin'
    archive: {
        categories: string; // eg: './categories.html'
        tags: string; // eg: './tags.html';
    };
    changePassword: string; // eg: './change-password.html';
    embed: string; // eg: 'http://localhost/embed?m=';
    error404: string; // eg: './error.html';
    featured: string; // eg: './featured.html';
    home: string; // eg: './index.html'
    latest: string; // eg: './latest.html';
    manage: {
        comments: string; // eg: './manage-comments.html'
        media: string; // eg: './manage-media.html';
        users: string; // eg: './manage-users.html';
    };
    members: string; // eg: './members.html';
    profile: {
        about: string; // eg: './profile-about.html';
        media: string; // eg: './profile-media.html';
        playlists: string; // eg: './profile-playlists.html';
        shared_by_me: string; // eg: './profile-media.html/shared_by_me';
        shared_with_me: string; // eg: './profile-media.html/shared_with_me';
    };
    recommended: string; // eg: './recommended.html';
    register: string; // eg: './register.html';
    search: {
        base: string; // eg: './search.html';
        category: string; // eg: './search.html?c=';
        query: string; // eg: './search.html?q=';
        tag: string; // eg: './search.html?t=';
    };
    signin: string; // eg: './signin.html';
    signout: string; // eg: './signout.html';
    user: {
        addMedia: string; // eg: './add-media.html';
        editChannel: string; // eg: './edit-channel.html';
        editProfile: string; // eg: './edit-profile.html';
        history: string; // eg: './history.html';
        liked: string; // eg: './liked.html';
    };
};

export type MediaCMSConfig = {
    api: MediaCMSConfigApi;
    contents: MediaCMSConfigContents;
    enabled: MediaCMSConfigEnabled;
    member: MediaCMSConfigMember;
    media: MediaCMSConfigMedia;
    notifications: MediaCMSConfigNotifications;
    options: MediaCMSConfigOptions;
    playlists: MediaCMSConfigPlaylists;
    sidebar: MediaCMSConfigSidebar;
    site: MediaCMSConfigSite;
    theme: MediaCMSConfigTheme;
    url: MediaCMSConfigUrl;
};
