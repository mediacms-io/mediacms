import React, { useContext, useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { usePopup } from '../../utils/hooks';
import { MemberContext, SiteContext } from '../../utils/contexts';
import { PageStore } from '../../utils/stores';
import { PageActions } from '../../utils/actions';
import { AppDispatch, RootState } from '../../utils/stores/store';
import { PopupMain } from '../_shared';
import NavMenuInlineTabs from './NavMenuInlineTabs';
import { loadAuthorData, removeProfile } from '../../utils/stores/actions/profile';

const AddBannerButton: React.FC<{ link: string }> = ({ link }) => (
  <a href={link} className="edit-channel" title="Add banner">
    ADD BANNER
  </a>
);

const EditBannerButton: React.FC<{ link: string }> = ({ link }) => (
  <a href={link} className="edit-channel" title="Edit banner">
    EDIT BANNER
  </a>
);

const EditProfileButton: React.FC<{ link: string }> = ({ link }) => (
  <a href={link} className="edit-profile" title="Edit profile">
    EDIT PROFILE
  </a>
);

interface ProfilePagesHeaderProps {
  type: string;
  onQueryChange?: (query: string) => void;
}

const ProfilePagesHeader: React.FC<ProfilePagesHeaderProps> = ({ type = 'media', onQueryChange }) => {
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();
  const profilePageHeaderRef = useRef<HTMLDivElement>(null);
  const profileNavRef = useRef<HTMLDivElement>(null);
  const [fixedNav, setFixedNav] = useState(false);
  const dispatch = useDispatch<AppDispatch>();

  const memberContext = useContext(MemberContext);
  const siteContext = useContext(SiteContext);

  const author = useSelector((state: RootState) => state.profile.authorData);
  const isLoading = useSelector((state: RootState) => state.profile.loading);
  const userIsAdmin = !memberContext.is.anonymous && memberContext.is.admin;
  const userIsAuthor = !memberContext.is.anonymous && author?.username === memberContext.username;
  const userCanEditProfile = userIsAuthor || (!memberContext.is.anonymous && memberContext.can.editProfile);
  const userCanDeleteProfile =
    userIsAdmin || userIsAuthor || (memberContext.is.anonymous && memberContext.can.deleteProfile);

  useEffect(() => {
    dispatch(loadAuthorData());
  }, [dispatch]);

  useEffect(() => {
    const updateFixedNavPosition = () => {
      if (profilePageHeaderRef.current && profileNavRef.current) {
        const headerTop = profilePageHeaderRef.current.offsetTop;
        const navTop = headerTop + profilePageHeaderRef.current.offsetHeight - profileNavRef.current.offsetHeight;
        setFixedNav(window.scrollY > navTop);
      }
    };

    PageStore.on('resize', updateFixedNavPosition);
    PageStore.on('changed_page_sidebar_visibility', updateFixedNavPosition);
    PageStore.on('window_scroll', updateFixedNavPosition);

    updateFixedNavPosition();

    return () => {
      PageStore.removeListener('resize', updateFixedNavPosition);
      PageStore.removeListener('changed_page_sidebar_visibility', updateFixedNavPosition);
      PageStore.removeListener('window_scroll', updateFixedNavPosition);
    };
  }, []);

  const handleProfileRemoval = () => {
    if (author?.username) {
      dispatch(removeProfile(author.username));
      popupContentRef.current?.toggle();
      setTimeout(() => {
        PageActions.addNotification('Profile removed. Redirecting...', 'profileDelete');
        setTimeout(() => {
          window.location.href = siteContext.url;
        }, 2000);
      }, 100);
    }
  };

  return (
    <div ref={profilePageHeaderRef} className={`profile-page-header ${fixedNav ? 'fixed-nav' : ''}`}>
      <span className="profile-banner-wrap">
        {author?.banner_thumbnail_url && (
          <span
            className="profile-banner"
            style={{
              backgroundImage: `url(${siteContext.url}/${author.banner_thumbnail_url.replace(/^\//g, '')})`,
            }}
          ></span>
        )}

        {userCanDeleteProfile && (
          <span className="delete-profile-wrap">
            <PopupTrigger contentRef={popupContentRef}>
              <button className="delete-profile" title="REMOVE PROFILE">
                REMOVE PROFILE
              </button>
            </PopupTrigger>

            <PopupContent contentRef={popupContentRef}>
              <PopupMain>
                <div className="popup-message">
                  <span className="popup-message-title">Profile removal</span>
                  <span className="popup-message-main">Are you sure you want to remove this profile permanently?</span>
                </div>
                <hr />
                <span className="popup-message-bottom">
                  <button
                    className="button-link cancel-profile-removal"
                    onClick={() => popupContentRef.current?.toggle()}
                  >
                    CANCEL
                  </button>
                  <button className="button-link proceed-profile-removal" onClick={handleProfileRemoval}>
                    PROCEED
                  </button>
                </span>
              </PopupMain>
            </PopupContent>
          </span>
        )}

        {userCanEditProfile &&
          (author?.banner_thumbnail_url ? (
            <EditBannerButton link={author.default_channel_edit_url} />
          ) : (
            <AddBannerButton link={author?.default_channel_edit_url!} />
          ))}
      </span>

      <div className="profile-info-nav-wrap">
        {(author?.thumbnail_url || author?.name) && (
          <div className="profile-info">
            <div className="profile-info-inner">
              {author?.thumbnail_url && <img src={author.thumbnail_url} alt={author.name || 'Profile'} />}
              <div>
                {author?.name && <h1>{author.name}</h1>}
                {userCanEditProfile && <EditProfileButton link={author.edit_url} />}
              </div>
            </div>
          </div>
        )}

        <NavMenuInlineTabs ref={profileNavRef} type={type} onQueryChange={onQueryChange} />
      </div>
    </div>
  );
};

export default ProfilePagesHeader;
