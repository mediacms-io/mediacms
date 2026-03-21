import { DeepPartial, GlobalMediaCMS, MediaCMSConfig } from '../../types';

export function memberConfig(
    user?: DeepPartial<GlobalMediaCMS['user']>,
    features?: {
        headerBar?: DeepPartial<GlobalMediaCMS['features']['headerBar']>;
        media?: { actions?: DeepPartial<GlobalMediaCMS['features']['media']['actions']> };
    }
) {
    const ret: MediaCMSConfig['member'] = {
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
    };

    if (user) {
        ret.is.anonymous = user.is?.anonymous === false ? false : true;

        if (!ret.is.anonymous) {
            ret.is.admin = user.is?.admin === true;

            ret.name = (user.name ? user.name.trim() : null) || null;
            ret.username = (user.username ? user.username.trim() : null) || null;
            ret.thumbnail = (user.thumbnail ? user.thumbnail.trim() : null) || null;
            ret.can.changePassword = user.can?.changePassword === false ? false : true;

            ret.can.deleteProfile = user.can?.deleteProfile === true;
            ret.can.addComment = user.can?.addComment === true;
            ret.can.mentionComment = user.can?.mentionComment === true;
            ret.can.deleteComment = user.can?.deleteComment === true;
            ret.can.editMedia = user.can?.editMedia === true;
            ret.can.deleteMedia = user.can?.deleteMedia === true;
            ret.can.editSubtitle = user.can?.editSubtitle === true;
            ret.can.manageMedia = user.can?.manageMedia === true;
            ret.can.manageUsers = user.can?.manageUsers === true;
            ret.can.manageComments = user.can?.manageComments === true;
            ret.can.contactUser = user.can?.contactUser === true;

            ret.pages.about = (user.pages?.about ? user.pages.about.trim() : null) || null;
            ret.pages.media = (user.pages?.media ? user.pages.media.trim() : null) || null;
            ret.pages.playlists = (user.pages?.playlists ? user.pages.playlists.trim() : null) || null;
        }

        ret.can.canSeeMembersPage = user.can?.canSeeMembersPage === false ? false : true;
        ret.can.usersNeedsToBeApproved = user.can?.usersNeedsToBeApproved === false ? false : true;
        ret.can.addMedia = user.can?.addMedia === true;
        ret.can.editProfile = user.can?.editProfile === true;
        ret.can.readComment = user.can?.readComment === false ? false : true;
    }

    const mediaActions = features?.media?.actions;
    if (mediaActions) {
        ret.can.addComment = ret.can.addComment && mediaActions?.comment === true;
        ret.can.mentionComment = ret.can.mentionComment && mediaActions?.comment_mention === true;

        ret.can.likeMedia = mediaActions?.like === false ? false : true;
        ret.can.dislikeMedia = mediaActions?.dislike === false ? false : true;
        ret.can.reportMedia = mediaActions?.report === false ? false : true;

        ret.can.downloadMedia = mediaActions?.download === true;
        ret.can.saveMedia = mediaActions?.save === true;
        ret.can.shareMedia = mediaActions?.share === true;
    }

    ret.can.login = features?.headerBar?.hideLogin === true ? false : true;
    ret.can.register = features?.headerBar?.hideRegister === true ? false : true;

    return ret;
}
