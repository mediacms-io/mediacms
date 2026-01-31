import React, { useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { usePopup } from '../../utils/hooks/';
import { LinksContext, MemberContext, SiteContext } from '../../utils/contexts/';
import { PageStore, ProfilePageStore } from '../../utils/stores/';
import { PageActions, ProfilePageActions } from '../../utils/actions/';
import { CircleIconButton, PopupMain } from '../_shared';
import { translateString } from '../../utils/helpers/';

class ProfileSearchBar extends React.PureComponent {
    constructor(props) {
        super(props);

        this.state = {
            visibleForm: false,
            queryVal: ProfilePageStore.get('author-query') || '',
        };

        this.onChange = this.onChange.bind(this);
        this.onInputFocus = this.onInputFocus.bind(this);
        this.onInputBlur = this.onInputBlur.bind(this);
        this.showForm = this.showForm.bind(this);
        this.hideForm = this.hideForm.bind(this);
        this.onFormSubmit = this.onFormSubmit.bind(this);

        this.updateTimeout = null;
        this.pendingUpdate = false;
        this.justShown = false;
    }

    updateQuery(value) {
        this.pendingUpdateValue = null;

        this.setState(
            {
                queryVal: value,
            },
            function () {
                if ('function' === typeof this.props.onQueryChange) {
                    this.props.onQueryChange(this.state.queryVal);
                }
            }
        );
    }

    onChange(ev) {
        this.pendingEvent = ev;
        const newValue = ev.target.value || '';

        this.setState(
            {
                queryVal: newValue,
            },
            function () {
                if (this.updateTimeout) {
                    return;
                }

                this.pendingEvent = null;

                // Only trigger search if 3+ characters or empty (to reset)
                if ('function' === typeof this.props.onQueryChange) {
                    if (newValue.length >= 3 || newValue.length === 0) {
                        this.props.onQueryChange(newValue);
                    }
                }

                this.updateTimeout = setTimeout(
                    function () {
                        this.updateTimeout = null;

                        if (this.pendingEvent) {
                            this.onChange(this.pendingEvent);
                        }
                    }.bind(this),
                    100
                );
            }
        );
    }

    /*onKeydown(e){
    let found = false, key =  e.keyCode || e.charCode;
        switch( key ){
            case 38:    // Arrow Up.
              found = this.getItemsArr(this.state.predictionItems.length-1);
              break;
            case 40:    // Arrow Down.
              found = this.getItemsArr(0);
              break;
        }
        if( found ){
          found.focus();
            e.preventDefault();
            e.stopPropagation();
        }
    }*/

    onInputFocus() {
        // console.log('FOCUS');
        /*if( this.state.predictionItems.length ){
      this.refs.SearchInput.onkeydown = this.refs.SearchInput.onkeydown || this.onKeydown;
    }*/
    }

    onInputBlur() {
        // Don't hide immediately after showing to prevent race condition
        if (this.justShown) {
            return;
        }
        this.hideForm();
    }

    showForm() {
        this.justShown = true;
        this.setState(
            {
                visibleForm: true,
            },
            function () {
                if ('function' === typeof this.props.toggleSearchField) {
                    this.props.toggleSearchField();
                }
                // Reset the flag after a short delay
                setTimeout(() => {
                    this.justShown = false;
                }, 200);
            }
        );
    }

    hideForm() {
        this.setState(
            {
                visibleForm: false,
            },
            function () {
                if ('function' === typeof this.props.toggleSearchField) {
                    this.props.toggleSearchField();
                }
            }
        );
    }

    onFormSubmit(ev) {
        if ('' === this.refs.SearchInput.value.trim()) {
            ev.preventDefault();
            ev.stopPropagation();
        }
    }

    render() {
        const hasSearchText = this.state.queryVal && this.state.queryVal.length > 0;

        // Determine the correct action URL based on page type
        let actionUrl = LinksContext._currentValue.profile.media;
        if (this.props.type === 'shared_by_me') {
            actionUrl = LinksContext._currentValue.profile.shared_by_me;
        } else if (this.props.type === 'shared_with_me') {
            actionUrl = LinksContext._currentValue.profile.shared_with_me;
        }

        if (!this.state.visibleForm) {
            return (
                <span
                    style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative' }}
                    onClick={this.showForm}
                >
                    <CircleIconButton buttonShadow={false}>
                        <i className="material-icons">search</i>
                    </CircleIconButton>
                    {hasSearchText ? (
                        <span
                            style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--default-theme-color)',
                                border: '2px solid white',
                            }}
                        ></span>
                    ) : null}
                </span>
            );
        }

        return (
            <form method="get" action={actionUrl} onSubmit={this.onFormSubmit}>
                <span style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <CircleIconButton buttonShadow={false}>
                        <i className="material-icons">search</i>
                    </CircleIconButton>
                    {hasSearchText ? (
                        <span
                            style={{
                                position: 'absolute',
                                top: '8px',
                                right: '8px',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--default-theme-color)',
                                border: '2px solid white',
                            }}
                        ></span>
                    ) : null}
                </span>
                <span>
                    <input
                        autoFocus={true}
                        ref="SearchInput"
                        type="text"
                        name="aq"
                        placeholder="Search"
                        aria-label="Search"
                        value={this.state.queryVal}
                        onChange={this.onChange}
                        onFocus={this.onInputFocus}
                        onBlur={this.onInputBlur}
                    />
                </span>
            </form>
        );
    }
}

ProfileSearchBar.propTypes = {
    onQueryChange: PropTypes.func,
    type: PropTypes.string,
};

ProfileSearchBar.defaultProps = {};

function InlineTab(props) {
    return (
        <li className={props.isActive ? 'active' : null}>
            <a href={props.link} title={props.label}>
                {props.label}
            </a>
        </li>
    );
}

InlineTab.propTypes = {
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    link: PropTypes.string.isRequired,
    isActive: PropTypes.bool.isRequired,
};

class NavMenuInlineTabs extends React.PureComponent {
    constructor(props) {
        super(props);

        this.state = {
            displayNext: false,
            displayPrev: false,
        };

        this.nextSlide = this.nextSlide.bind(this);
        this.prevSlide = this.prevSlide.bind(this);

        this.updateSlider = this.updateSlider.bind(this);
        this.updateSliderButtonsView = this.updateSliderButtonsView.bind(this);

        this.onToggleSearchField = this.onToggleSearchField.bind(this);

        PageStore.on('window_resize', this.updateSlider);

        this.sliderRecalTimeout = null;

        PageStore.on(
            'changed_page_sidebar_visibility',
            function () {
                clearTimeout(this.sliderRecalTimeout);

                // NOTE: 200ms is transition duration, set in CSS.
                this.sliderRecalTimeout = setTimeout(
                    function () {
                        this.updateSliderButtonsView();

                        this.sliderRecalTimeout = setTimeout(
                            function () {
                                this.sliderRecalTimeout = null;

                                this.updateSlider();
                            }.bind(this),
                            50
                        );
                    }.bind(this),
                    150
                );
            }.bind(this)
        );

        this.previousBtn = (
            <span className="previous-slide">
                <CircleIconButton buttonShadow={false} onClick={this.prevSlide}>
                    <i className="material-icons">keyboard_arrow_left</i>
                </CircleIconButton>
            </span>
        );
        this.nextBtn = (
            <span className="next-slide">
                <CircleIconButton buttonShadow={false} onClick={this.nextSlide}>
                    <i className="material-icons">keyboard_arrow_right</i>
                </CircleIconButton>
            </span>
        );

        this.userIsAuthor =
            !MemberContext._currentValue.is.anonymous &&
            ProfilePageStore.get('author-data').username === MemberContext._currentValue.username;
    }

    componentDidMount() {
        this.updateSlider();
        if (this.refs.itemsListWrap) {
            this.refs.itemsListWrap.addEventListener('scroll', this.updateSliderButtonsView.bind(this));
        }
    }

    componentWillUnmount() {
        if (this.refs.itemsListWrap) {
            this.refs.itemsListWrap.removeEventListener('scroll', this.updateSliderButtonsView.bind(this));
        }
    }

    nextSlide() {
        if (!this.refs.itemsListWrap) return;
        const scrollAmount = this.refs.itemsListWrap.offsetWidth * 0.7; // Scroll 70% of visible width
        this.refs.itemsListWrap.scrollLeft += scrollAmount;
        setTimeout(() => this.updateSliderButtonsView(), 50);
    }

    prevSlide() {
        if (!this.refs.itemsListWrap) return;
        const scrollAmount = this.refs.itemsListWrap.offsetWidth * 0.7; // Scroll 70% of visible width
        this.refs.itemsListWrap.scrollLeft -= scrollAmount;
        setTimeout(() => this.updateSliderButtonsView(), 50);
    }

    updateSlider(afterItemsUpdate) {
        this.updateSliderButtonsView();
    }

    updateSliderButtonsView() {
        if (!this.refs.itemsListWrap) return;

        const container = this.refs.itemsListWrap;
        const scrollLeft = container.scrollLeft;
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;

        // Show prev arrow if we can scroll left
        const canScrollLeft = scrollLeft > 1;

        // Show next arrow if we can scroll right
        const canScrollRight = scrollLeft < scrollWidth - clientWidth - 1;

        this.setState({
            displayPrev: canScrollLeft,
            displayNext: canScrollRight,
        });
    }

    onToggleSearchField() {
        setTimeout(() => this.updateSlider(), 100);
    }

    render() {
        return (
            <nav ref="tabsNav" className="profile-nav items-list-outer list-inline list-slider">
                <div className="profile-nav-inner items-list-outer">
                    {this.state.displayPrev ? this.previousBtn : null}

                    <ul className="items-list-wrap" ref="itemsListWrap">
                        <InlineTab
                            id="about"
                            isActive={'about' === this.props.type}
                            label={translateString('About')}
                            link={LinksContext._currentValue.profile.about}
                        />
                        <InlineTab
                            id="media"
                            isActive={'media' === this.props.type}
                            label={translateString(this.userIsAuthor ? 'Media I own' : 'Media')}
                            link={LinksContext._currentValue.profile.media}
                        />
                        {this.userIsAuthor ? (
                            <InlineTab
                                id="shared_by_me"
                                isActive={'shared_by_me' === this.props.type}
                                label={translateString('Shared by me')}
                                link={LinksContext._currentValue.profile.shared_by_me}
                            />
                        ) : null}
                        {this.userIsAuthor ? (
                            <InlineTab
                                id="shared_with_me"
                                isActive={'shared_with_me' === this.props.type}
                                label={translateString('Shared with me')}
                                link={LinksContext._currentValue.profile.shared_with_me}
                            />
                        ) : null}

                        {MemberContext._currentValue.can.saveMedia ? (
                            <InlineTab
                                id="playlists"
                                isActive={'playlists' === this.props.type}
                                label={translateString('Playlists')}
                                link={LinksContext._currentValue.profile.playlists}
                            />
                        ) : null}
                        {PageStore.get('config-options').pages.profile.includeHistory && this.userIsAuthor ? (
                            <InlineTab
                                id="history"
                                isActive={'history' === this.props.type}
                                label={PageStore.get('config-enabled').pages.history.title}
                                link={LinksContext._currentValue.user.history}
                            />
                        ) : null}
                        {PageStore.get('config-options').pages.profile.includeLikedMedia && this.userIsAuthor ? (
                            <InlineTab
                                id="liked"
                                isActive={'liked' === this.props.type}
                                label={PageStore.get('config-enabled').pages.liked.title}
                                link={LinksContext._currentValue.user.liked}
                            />
                        ) : null}

                        {!['about', 'playlists'].includes(this.props.type) ? (
                            <li className="media-search">
                                <ProfileSearchBar
                                    onQueryChange={this.props.onQueryChange}
                                    toggleSearchField={this.onToggleSearchField}
                                    type={this.props.type}
                                />
                            </li>
                        ) : null}
                        {this.props.onToggleFiltersClick &&
                        ['media', 'shared_by_me', 'shared_with_me'].includes(this.props.type) ? (
                            <li className="media-filters-toggle">
                                <span
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        position: 'relative',
                                    }}
                                    onClick={this.props.onToggleFiltersClick}
                                    title={translateString('Filters')}
                                >
                                    <CircleIconButton buttonShadow={false}>
                                        <i className="material-icons">filter_list</i>
                                    </CircleIconButton>
                                    {this.props.hasActiveFilters ? (
                                        <span
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--default-theme-color)',
                                                border: '2px solid white',
                                            }}
                                        ></span>
                                    ) : null}
                                </span>
                            </li>
                        ) : null}
                        {this.props.onToggleTagsClick &&
                        ['media', 'shared_by_me', 'shared_with_me'].includes(this.props.type) ? (
                            <li className="media-tags-toggle">
                                <span
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        position: 'relative',
                                    }}
                                    onClick={this.props.onToggleTagsClick}
                                    title={translateString('Tags')}
                                >
                                    <CircleIconButton buttonShadow={false}>
                                        <i className="material-icons">local_offer</i>
                                    </CircleIconButton>
                                    {this.props.hasActiveTags ? (
                                        <span
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--default-theme-color)',
                                                border: '2px solid white',
                                            }}
                                        ></span>
                                    ) : null}
                                </span>
                            </li>
                        ) : null}
                        {this.props.onToggleSortingClick &&
                        ['media', 'shared_by_me', 'shared_with_me'].includes(this.props.type) ? (
                            <li className="media-sorting-toggle">
                                <span
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        cursor: 'pointer',
                                        position: 'relative',
                                    }}
                                    onClick={this.props.onToggleSortingClick}
                                    title={translateString('Sort By')}
                                >
                                    <CircleIconButton buttonShadow={false}>
                                        <i className="material-icons">swap_vert</i>
                                    </CircleIconButton>
                                    {this.props.hasActiveSort ? (
                                        <span
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                backgroundColor: 'var(--default-theme-color)',
                                                border: '2px solid white',
                                            }}
                                        ></span>
                                    ) : null}
                                </span>
                            </li>
                        ) : null}
                    </ul>

                    {this.state.displayNext ? this.nextBtn : null}
                </div>
            </nav>
        );
    }
}

NavMenuInlineTabs.propTypes = {
    type: PropTypes.string.isRequired,
    onQueryChange: PropTypes.func,
    onToggleFiltersClick: PropTypes.func,
    onToggleTagsClick: PropTypes.func,
    onToggleSortingClick: PropTypes.func,
    hasActiveFilters: PropTypes.bool,
    hasActiveTags: PropTypes.bool,
    hasActiveSort: PropTypes.bool,
};

function AddBannerButton(props) {
    let link = props.link;

    if (window.MediaCMS.site.devEnv) {
        link = '/edit-channel.html';
    }
    return (
        <a href={link} className="edit-channel-icon" title="Add banner">
            <i className="material-icons">add_photo_alternate</i>
        </a>
    );
}

function EditBannerButton(props) {
    let link = props.link;

    if (window.MediaCMS.site.devEnv) {
        link = '/edit-channel.html';
    }
    return (
        <a href={link} className="edit-channel-icon" title="Edit banner">
            <i className="material-icons">edit</i>
        </a>
    );
}

function EditProfileButton(props) {
    let link = props.link;

    if (window.MediaCMS.site.devEnv) {
        link = '/edit-profile.html';
    }

    return (
        <a href={link} className="edit-profile-icon" title="Edit profile">
            <i className="material-icons">edit</i>
        </a>
    );
}

export default function ProfilePagesHeader(props) {
    const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

    const profilePageHeaderRef = useRef(null);
    const profileNavRef = useRef(null);

    const [fixedNav, setFixedNav] = useState(false);

    const positions = {
        profileNavTop: 0,
    };

    const userIsAdmin = !MemberContext._currentValue.is.anonymous && MemberContext._currentValue.is.admin;
    const userIsAuthor =
        !MemberContext._currentValue.is.anonymous &&
        ProfilePageStore.get('author-data').username === MemberContext._currentValue.username;
    const userCanEditProfile =
        userIsAuthor || (!MemberContext._currentValue.is.anonymous && MemberContext._currentValue.can.editProfile);
    const userCanDeleteProfile =
        userIsAdmin ||
        userIsAuthor ||
        (!MemberContext._currentValue.is.anonymous && MemberContext._currentValue.can.deleteProfile);

    function updateProfileNavTopPosition() {
        positions.profileHeaderTop = profilePageHeaderRef.current.offsetTop;
        positions.profileNavTop =
            positions.profileHeaderTop +
            profilePageHeaderRef.current.offsetHeight -
            profileNavRef.current.refs.tabsNav.offsetHeight;
    }

    function updateFixedNavPosition() {
        setFixedNav(positions.profileHeaderTop + window.scrollY > positions.profileNavTop);
    }

    function cancelProfileRemoval() {
        popupContentRef.current.toggle();
    }

    function proceedMediaRemoval() {
        ProfilePageActions.remove_profile();
        popupContentRef.current.toggle();
    }

    function onProfileDelete(username) {
        // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
        setTimeout(function () {
            PageActions.addNotification('Profile removed. Redirecting...', 'profileDelete');
            setTimeout(function () {
                window.location.href = SiteContext._currentValue.url;
            }, 2000);
        }, 100);

        if (void 0 !== username) {
            console.info("Removed user's profile '" + username + '"');
        }
    }

    function onProfileDeleteFail(username) {
        // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
        setTimeout(function () {
            PageActions.addNotification('Profile removal failed', 'profileDeleteFail');
        }, 100);

        if (void 0 !== username) {
            console.info('Profile "' + username + '"' + ' removal failed');
        }
    }

    function onWindowResize() {
        updateProfileNavTopPosition();
        updateFixedNavPosition();
    }

    function onWindowScroll() {
        updateFixedNavPosition();
    }

    useEffect(() => {
        if (userCanDeleteProfile) {
            ProfilePageStore.on('profile_delete', onProfileDelete);
            ProfilePageStore.on('profile_delete_fail', onProfileDeleteFail);
        }

        PageStore.on('resize', onWindowResize);
        PageStore.on('changed_page_sidebar_visibility', onWindowResize);
        PageStore.on('window_scroll', onWindowScroll);

        updateProfileNavTopPosition();
        updateFixedNavPosition();

        return () => {
            if (userCanDeleteProfile) {
                ProfilePageStore.removeListener('profile_delete', onProfileDelete);
                ProfilePageStore.removeListener('profile_delete_fail', onProfileDeleteFail);
            }

            PageStore.removeListener('resize', onWindowResize);
            PageStore.removeListener('changed_page_sidebar_visibility', onWindowResize);
            PageStore.removeListener('window_scroll', onWindowScroll);
        };
    }, []);

    return (
        <div ref={profilePageHeaderRef} className={'profile-page-header' + (fixedNav ? ' fixed-nav' : '')}>
            {!props.hideChannelBanner && (
                <span className="profile-banner-wrap">
                    {props.author.banner_thumbnail_url ? (
                        <span
                            className="profile-banner"
                            style={{
                                backgroundImage:
                                    'url(' +
                                    SiteContext._currentValue.url +
                                    '/' +
                                    props.author.banner_thumbnail_url.replace(/^\//g, '') +
                                    ')',
                            }}
                        ></span>
                    ) : null}

                    {userCanDeleteProfile && !userIsAuthor ? (
                        <span className="delete-profile-wrap">
                            <PopupTrigger contentRef={popupContentRef}>
                                <button className="delete-profile" title="Remove profile">
                                    <i className="material-icons">delete</i>
                                </button>
                            </PopupTrigger>

                            <PopupContent contentRef={popupContentRef}>
                                <PopupMain>
                                    <div className="popup-message">
                                        <span className="popup-message-title">Profile removal</span>
                                        <span className="popup-message-main">
                                            You're willing to remove profile permanently?
                                        </span>
                                    </div>
                                    <hr />
                                    <span className="popup-message-bottom">
                                        <button
                                            className="button-link cancel-profile-removal"
                                            onClick={cancelProfileRemoval}
                                        >
                                            CANCEL
                                        </button>
                                        <button
                                            className="button-link proceed-profile-removal"
                                            onClick={proceedMediaRemoval}
                                        >
                                            PROCEED
                                        </button>
                                    </span>
                                </PopupMain>
                            </PopupContent>
                        </span>
                    ) : null}

                    {userCanEditProfile && userIsAuthor ? (
                        props.author.banner_thumbnail_url ? (
                            <EditBannerButton link={ProfilePageStore.get('author-data').default_channel_edit_url} />
                        ) : (
                            <AddBannerButton link={ProfilePageStore.get('author-data').default_channel_edit_url} />
                        )
                    ) : null}
                </span>
            )}

            <div className="profile-info-nav-wrap">
                {props.author.thumbnail_url || props.author.name ? (
                    <div className="profile-info">
                        <div className="profile-info-inner">
                            <div>
                                {props.author.thumbnail_url ? <img src={props.author.thumbnail_url} alt="" /> : null}
                            </div>
                            <div>
                                {props.author.name ? (
                                    <div className="profile-name-edit-wrapper">
                                        <h1>{props.author.name}</h1>
                                        {userCanEditProfile && !userIsAuthor ? (
                                            <EditProfileButton link={ProfilePageStore.get('author-data').edit_url} />
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                ) : null}

                <NavMenuInlineTabs
                    ref={profileNavRef}
                    type={props.type}
                    onQueryChange={props.onQueryChange}
                    onToggleFiltersClick={props.onToggleFiltersClick}
                    onToggleTagsClick={props.onToggleTagsClick}
                    onToggleSortingClick={props.onToggleSortingClick}
                    hasActiveFilters={props.hasActiveFilters}
                    hasActiveTags={props.hasActiveTags}
                    hasActiveSort={props.hasActiveSort}
                />
            </div>
        </div>
    );
}

ProfilePagesHeader.propTypes = {
    author: PropTypes.object.isRequired,
    type: PropTypes.string.isRequired,
    onQueryChange: PropTypes.func,
    onToggleFiltersClick: PropTypes.func,
    onToggleTagsClick: PropTypes.func,
    onToggleSortingClick: PropTypes.func,
    hasActiveFilters: PropTypes.bool,
    hasActiveTags: PropTypes.bool,
    hasActiveSort: PropTypes.bool,
};

ProfilePagesHeader.defaultProps = {
    type: 'media',
};
