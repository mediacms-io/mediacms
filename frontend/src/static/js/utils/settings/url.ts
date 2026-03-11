import { GlobalMediaCMS, MediaCMSConfig } from '../../types';

export const urlConfig = ({
    profileId,
    site,
    url,
    user,
}: Pick<GlobalMediaCMS, 'profileId' | 'site' | 'url' | 'user'>): MediaCMSConfig['url'] => ({
    home: url.home,
    admin: !user.is.anonymous && user.is.admin ? url.admin : '',
    error404: url.error404,
    embed: site.url.replace(/\/+$/, '') + '/embed?m=',
    latest: url.latestMedia,
    featured: url.featuredMedia,
    recommended: url.recommendedMedia,
    signin: url.signin,
    signout: !user.is.anonymous ? url.signout : '',
    register: url.register,
    changePassword: !user.is.anonymous ? url.changePassword : '',
    members: url.members,
    search: {
        base: url.search,
        query: url.search + '?q=',
        tag: url.search + '?t=',
        category: url.search + '?c=',
    },
    profile:
        site.devEnv === true
            ? {
                  media: user.pages.media,
                  about: user.pages.about,
                  playlists: user.pages.playlists,
                  shared_by_me: user.pages.media + '/shared_by_me',
                  shared_with_me: user.pages.media + '/shared_with_me',
              }
            : {
                  media: site.url.replace(/\/$/, '') + '/user/' + profileId,
                  about: site.url.replace(/\/$/, '') + '/user/' + profileId + '/about',
                  playlists: site.url.replace(/\/$/, '') + '/user/' + profileId + '/playlists',
                  shared_by_me: site.url.replace(/\/$/, '') + '/user/' + profileId + '/shared_by_me',
                  shared_with_me: site.url.replace(/\/$/, '') + '/user/' + profileId + '/shared_with_me',
              },
    user: {
        liked: url.likedMedia,
        history: url.history,
        addMedia: url.addMedia,
        editChannel: url.editChannel,
        editProfile: url.editProfile,
    },
    archive: {
        tags: url.tags,
        categories: url.categories,
    },
    manage: {
        media: !user.is.anonymous ? url.manageMedia : '',
        users: !user.is.anonymous ? url.manageUsers : '',
        comments: !user.is.anonymous ? url.manageComments : '',
    },
});
