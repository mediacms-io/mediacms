type GlobalMediaCMSApi = {
    actions: string;
    categories: string;
    comments: string;
    history: string;
    liked: string;
    manage_comments: string;
    manage_media: string;
    manage_users: string;
    media: string;
    members: string;
    playlists: string;
    search: string;
    tags: string;
};

type GlobalMediaCMSContents = {
    header: {
        right: string;
        onLogoRight: string;
    };
    notifications: {
        messages: {
            addToLiked: string;
            removeFromLiked: string;
            addToDisliked: string;
            removeFromDisliked: string;
        };
    };
    sidebar: {
        belowNavMenu: string;
        belowThemeSwitcher: string;
        footer: string;
        mainMenuExtraItems: { text: string; link: string; icon: string; className?: string }[]; // @todo: Check "className"
        navMenuItems: { text: string; link: string; icon: string; className?: string }[]; // @todo: Check "className"
    };
    uploader: {
        belowUploadArea: string;
        postUploadMessage: string;
    };
};

type GlobalMediaCMSFeatures = {
    embeddedVideo: {
        initialDimensions: {
            width: number;
            height: number;
        };
    };
    headerBar: {
        hideLogin: boolean;
        hideRegister: boolean;
    };
    sideBar: {
        hideHomeLink: boolean;
        hideTagsLink: boolean;
        hideCategoriesLink: boolean;
    };
    media: {
        actions: {
            share: boolean;
            report: boolean;
            like: boolean;
            dislike: boolean;
            download: boolean;
            comment: boolean;
            comment_mention: boolean;
            save: boolean;
        };
        shareOptions: ('embed' | 'email')[];
    };
    mediaItem: {
        hideDate: boolean;
        hideViews: boolean;
        hideAuthor: boolean;
    };
    playlists: {
        mediaTypes: ('audio' | 'video')[];
    };
};

type GlobalCMSPages = {
    home: {
        sections: {
            latest: { title: string };
            featured: { title: string };
            recommended: { title: string };
        };
    };
    media: {
        categoriesWithTitle: boolean;
        htmlInDescription: boolean;
        hideViews: boolean;
        related: { initialSize: number };
    };
    profile: {
        htmlInDescription: boolean;
        includeHistory: boolean;
        includeLikedMedia: boolean;
    };
    search: { advancedFilters: boolean };
};

type GlobalCMSSite = {
    api: string;
    devEnv: boolean;
    id: string;
    logo: {
        lightMode: { img: string; svg: string };
        darkMode: { img: string; svg: string };
    };
    pages: {
        featured: { enabled: boolean; title: string };
        latest: { enabled: boolean; title: string };
        members: { enabled: boolean; title: string };
        recommended: { enabled: boolean; title: string };
    };
    taxonomies: {
        categories: { enabled: boolean; title: string };
        tags: { enabled: boolean; title: string };
    };
    theme: {
        mode: 'light' | 'dark';
        switch: { enabled: boolean; position: 'header' | 'sidebar' };
    };
    title: string;
    url: string;
    useRoundedCorners: boolean;
    userPages: {
        history: { enabled: boolean; title: string };
        liked: { enabled: boolean; title: string };
    };
    version: string;
};

type GlobalCMSUrl = {
    addMedia: string; // eg: "./add-media.html";
    admin: string; // eg: "/admin";
    categories: string; // eg: "./categories.html";
    changePassword: string; // eg: "./change-password.html";
    editChannel: string; // eg: "./edit-channel.html";
    editProfile: string; // eg: "./edit-profile.html";
    error404: string; // eg: "./error.html";
    featuredMedia: string; // eg: "./featured.html";
    history: string; // eg: "./history.html";
    home: string; // eg: "./index.html";
    latestMedia: string; // eg: "./latest.html";
    likedMedia: string; // eg: "./liked.html";
    manageComments: string; // eg: "./manage-comments.html";
    manageMedia: string; // eg: "./manage-media.html";
    manageUsers: string; // eg: "./manage-users.html";
    members: string; // eg: "./members.html";
    recommendedMedia: string; // eg: "./recommended.html";
    register: string; // eg: "./register.html";
    search: string; // eg: "./search.html";
    signin: string; // eg: "./signin.html";
    signout: string; // eg: "./signout.html";
    tags: string; // eg: "./tags.html";
};

type GlobalCMSUser = {
    name: string;
    username: string;
    thumbnail: string;
    is: {
        admin: boolean;
        anonymous: boolean;
    };
    can: {
        // a
        addComment: boolean;
        addMedia: boolean;
        // c
        canSeeMembersPage: boolean;
        changePassword: boolean;
        contactUser: boolean;
        // d
        deleteComment: boolean;
        deleteMedia: boolean;
        deleteProfile: boolean;
        // e
        editMedia: boolean;
        editProfile: boolean;
        editSubtitle: boolean;
        // l
        // m
        manageComments: boolean;
        manageMedia: boolean;
        manageUsers: boolean;
        mentionComment: boolean;
        // r
        readComment: boolean;
        // u
        usersNeedsToBeApproved: boolean;
    };
    pages: {
        about: string;
        media: string;
        playlists: string;
    };
};

export type GlobalMediaCMS = {
    api: GlobalMediaCMSApi;
    contents: GlobalMediaCMSContents;
    features: GlobalMediaCMSFeatures;
    pages: GlobalCMSPages;
    profileId?: string;
    site: GlobalCMSSite;
    url: GlobalCMSUrl;
    user: GlobalCMSUser;
};
