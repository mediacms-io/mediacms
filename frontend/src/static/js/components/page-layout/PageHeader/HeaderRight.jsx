import React from 'react';
import { useLayout, usePopup } from '../../../utils/hooks/';
import { PageStore } from '../../../utils/stores/';
import { HeaderConsumer, MemberConsumer, LinksConsumer } from '../../../utils/contexts/';
import { CircleIconButton, MaterialIcon, NavigationContentApp, NavigationMenuList, PopupTop, PopupMain, UserThumbnail } from '../../_shared';
import { HeaderThemeSwitcher } from './HeaderThemeSwitcher';
import { translateString } from '../../../utils/helpers/';

function headerPopupPages(user, popupNavItems, hasHeaderThemeSwitcher) {
  const pages = {
    main: null,
  };

  if (user.is.anonymous) {
    pages.main = (
      <div>
        <PopupMain>
          <NavigationMenuList items={popupNavItems.middle} />
        </PopupMain>
      </div>
    );
  } else {
    const NavMenus = [];

    function insertNavMenus(id, arr) {
      if (arr.length) {
        if (NavMenus.length) {
          NavMenus.push(<hr key={id + '-nav-seperator'} />);
        }

        NavMenus.push(<NavigationMenuList key={id + '-nav'} items={arr} />);
      }
    }

    insertNavMenus('top', popupNavItems.top);
    insertNavMenus('middle', popupNavItems.middle);
    insertNavMenus('bottom', popupNavItems.bottom);

    pages.main = (
      <div>
        <PopupTop>
          <a className="user-menu-top-link" href={user.pages.about} title={user.username}>
            <span>
              <UserThumbnail size="medium" />
            </span>
            <span>
              <span className="username">{user.username}</span>
            </span>
          </a>
        </PopupTop>
        {NavMenus.length ? <PopupMain>{NavMenus}</PopupMain> : null}
      </div>
    );
  }

  if (hasHeaderThemeSwitcher) {
    pages['switch-theme'] = (
      <div>
        <PopupTop>
          <div>
            <span>
              <CircleIconButton className="menu-item-icon change-page" data-page-id="main" aria-label="Switch theme">
                <i className="material-icons">arrow_back</i>
              </CircleIconButton>
            </span>
            <span>Switch theme</span>
          </div>
        </PopupTop>
        <PopupMain>
          <HeaderThemeSwitcher />
        </PopupMain>
      </div>
    );
  }

  return pages;
}

function UploadMediaButton({ user, links }) {
  return !user.is.anonymous && user.can.addMedia ? (
    <div className={'hidden-only-in-small'}>
      <CircleIconButton type="link" href={links.user.addMedia} title="Upload media">
        <MaterialIcon type="video_call" />
        <span className="hidden-txt">Upload media</span>
      </CircleIconButton>
    </div>
  ) : null;
}

function LoginButton({ user, link, hasHeaderThemeSwitcher }) {
  return user.is.anonymous && user.can.login ? (
    <div className="sign-in-wrap">
      <a
        href={link}
        rel="noffolow"
        className={
          'button-link sign-in' + (hasHeaderThemeSwitcher ? ' hidden-only-in-small' : ' hidden-only-in-extra-small')
        }
        title={translateString('Sign in')}
      >
        {translateString('Sign in')}
      </a>
    </div>
  ) : null;
}

function RegisterButton({ user, link, hasHeaderThemeSwitcher }) {
  return user.is.anonymous && user.can.register ? (
    <div className="register-wrap">
      <a
        href={link}
        className={
          'button-link register-link' +
          (hasHeaderThemeSwitcher ? ' hidden-only-in-small' : ' hidden-only-in-extra-small')
        }
        title={translateString('Register')}
      >
        {translateString('Register')}
      </a>
    </div>
  ) : null;
}

export function HeaderRight(props) {
  const { toggleMobileSearch } = useLayout();
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

  return (
    <HeaderConsumer>
      {(header) => (
        <MemberConsumer>
          {(user) => (
            <LinksConsumer>
              {(links) => (
                <div className="page-header-right">
                  <div>
                    <div className="mobile-search-toggle">
                      <CircleIconButton onClick={toggleMobileSearch} aria-label="Search">
                        <MaterialIcon type="search" />
                      </CircleIconButton>
                    </div>

                    <UploadMediaButton user={user} links={links} />

                    <div
                      className={
                        (user.is.anonymous ? 'user-options' : 'user-thumb') +
                        (!user.is.anonymous || header.hasThemeSwitcher ? '' : ' visible-only-in-extra-small')
                      }
                    >
                      <PopupTrigger contentRef={popupContentRef}>
                        {user.is.anonymous ? (
                          <CircleIconButton aria-label="Settings">
                            <MaterialIcon type="more_vert" />
                          </CircleIconButton>
                        ) : (
                          <UserThumbnail size="small" isButton={true} />
                        )}
                      </PopupTrigger>

                      <PopupContent contentRef={popupContentRef}>
                        <NavigationContentApp
                          initPage="main"
                          pages={headerPopupPages(user, header.popupNavItems, header.hasThemeSwitcher)}
                          pageChangeSelector={'.change-page'}
                          pageIdSelectorAttr={'data-page-id'}
                        />
                      </PopupContent>
                    </div>

                    <LoginButton user={user} link={links.signin} hasHeaderThemeSwitcher={header.hasThemeSwitcher} />
                    <RegisterButton
                      user={user}
                      link={links.register}
                      hasHeaderThemeSwitcher={header.hasThemeSwitcher}
                    />

                    {PageStore.get('config-contents').header.right ? (
                      <div
                        className="on-header-right"
                        dangerouslySetInnerHTML={{ __html: PageStore.get('config-contents').header.right }}
                      ></div>
                    ) : null}
                  </div>
                </div>
              )}
            </LinksConsumer>
          )}
        </MemberConsumer>
      )}
    </HeaderConsumer>
  );
}
