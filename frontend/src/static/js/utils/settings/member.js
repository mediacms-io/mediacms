let MEMBER = null;

export function init(user, features) {
  MEMBER = {
    name: null,
    username: null,
    thumbnail: null,
    is: {
      admin: false,
      anonymous: true,
    },
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
    pages: {
      home: null,
      about: null,
      media: null,
      playlists: null,
    },
  };

  if (void 0 !== user) {
    MEMBER.is.anonymous = true === user.is.anonymous ? true : false;

    if (!MEMBER.is.anonymous) {
      MEMBER.is.admin = true === user.is.admin;

      MEMBER.name = 'string' === typeof user.name ? user.name.trim() : '';
      MEMBER.name = '' === MEMBER.name ? null : MEMBER.name;

      MEMBER.username = 'string' === typeof user.username ? user.username.trim() : '';
      MEMBER.username = '' === MEMBER.username ? null : MEMBER.username;

      MEMBER.thumbnail = 'string' === typeof user.thumbnail ? user.thumbnail.trim() : '';
      MEMBER.thumbnail = '' === MEMBER.thumbnail ? null : MEMBER.thumbnail;

      MEMBER.can.changePassword = false === user.can.changePassword ? false : MEMBER.can.changePassword;

      MEMBER.can.deleteProfile = true === user.can.deleteProfile;
      MEMBER.can.addComment = true === user.can.addComment;
      MEMBER.can.mentionComment = true === user.can.mentionComment;
      MEMBER.can.deleteComment = true === user.can.deleteComment;
      MEMBER.can.editMedia = true === user.can.editMedia;
      MEMBER.can.deleteMedia = true === user.can.deleteMedia;
      MEMBER.can.editSubtitle = true === user.can.editSubtitle;
      MEMBER.can.manageMedia = true === user.can.manageMedia;
      MEMBER.can.manageUsers = true === user.can.manageUsers;
      MEMBER.can.manageComments = true === user.can.manageComments;

      MEMBER.can.contactUser = true === user.can.contactUser;

      if (void 0 !== user.pages) {

        if ('string' === typeof user.pages.about) {
          MEMBER.pages.about = user.pages.about.trim();
          MEMBER.pages.about = '' === MEMBER.pages.about ? null : MEMBER.pages.about;
        }

        if ('string' === typeof user.pages.media) {
          MEMBER.pages.media = user.pages.media.trim();
          MEMBER.pages.media = '' === MEMBER.pages.media ? null : MEMBER.pages.media;
        }

        if ('string' === typeof user.pages.playlists) {
          MEMBER.pages.playlists = user.pages.playlists.trim();
          MEMBER.pages.playlists = '' === MEMBER.pages.playlists ? null : MEMBER.pages.playlists;
        }
      }
    }

    MEMBER.can.canSeeMembersPage = true === user.can.canSeeMembersPage;
    MEMBER.can.usersNeedsToBeApproved = true === user.can.usersNeedsToBeApproved;
    MEMBER.can.addMedia = true === user.can.addMedia;
    MEMBER.can.editProfile = true === user.can.editProfile;
    MEMBER.can.readComment = false === user.can.readComment ? false : true;
  }

  if (void 0 !== features) {
    if (void 0 !== features.media) {
      if (void 0 !== features.media.actions) {
        const mediaActions = features.media.actions;

        MEMBER.can.addComment = MEMBER.can.addComment && true === mediaActions.comment;
        MEMBER.can.mentionComment = MEMBER.can.mentionComment && true === mediaActions.comment_mention;

        MEMBER.can.likeMedia = false === mediaActions.like ? false : true;
        MEMBER.can.dislikeMedia = false === mediaActions.dislike ? false : true;
        MEMBER.can.reportMedia = false === mediaActions.report ? false : true;

        MEMBER.can.downloadMedia = true === mediaActions.download;
        MEMBER.can.saveMedia = true === mediaActions.save;
        MEMBER.can.shareMedia = true === mediaActions.share;
      }
    }

    if (void 0 !== features.headerBar) {
      if (true === features.headerBar.hideLogin) {
        MEMBER.can.login = false;
      }

      if (true === features.headerBar.hideRegister) {
        MEMBER.can.register = false;
      }
    }
  }
}

export function settings() {
  return MEMBER;
}
