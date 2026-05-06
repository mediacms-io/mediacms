import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlContext, LinksConsumer, MemberContext } from '../utils/contexts';
import { PageStore, ProfilePageStore } from '../utils/stores';
import { ProfilePageActions, PageActions } from '../utils/actions';
import { inEmbeddedApp, inSelectMediaEmbedMode, translateString } from '../utils/helpers/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import ProfilePagesHeader from '../components/profile-page/ProfilePagesHeader';
import ProfilePagesContent from '../components/profile-page/ProfilePagesContent';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync';
import { BulkActionsModals } from '../components/BulkActionsModals';
import { ProfileMediaFilters } from '../components/search-filters/ProfileMediaFilters';
import { ProfileMediaTags } from '../components/search-filters/ProfileMediaTags';
import { ProfileMediaSharing } from '../components/search-filters/ProfileMediaSharing';
import { ProfileMediaSorting } from '../components/search-filters/ProfileMediaSorting';
import { withBulkActions } from '../utils/hoc/withBulkActions';

import { Page } from './_Page';

import '../components/profile-page/ProfilePage.scss';

class ProfileMediaPage extends Page {
    constructor(props, pageSlug) {
        super(props, 'string' === typeof pageSlug ? pageSlug : 'author-home');

        this.profilePageSlug = 'string' === typeof pageSlug ? pageSlug : 'author-home';

        this.state = {
            channelMediaCount: -1,
            author: ProfilePageStore.get('author-data'),
            uploadsPreviewItemsCount: 0,
            title: this.props.title,
            query: ProfilePageStore.get('author-query'),
            requestUrl: null,
            selectedMedia: new Set(), // For select media embed mode only
            hiddenFilters: true,
            hiddenTags: true,
            hiddenSorting: true,
            hiddenSharing: true,
            filterArgs: '',
            availableTags: [],
            selectedTag: 'all',
            selectedSort: 'date_added_desc',
            sharedUsers: [],
            sharedGroups: [],
            selectedSharingType: null,
            selectedSharingValue: null,
        };

        this.authorDataLoad = this.authorDataLoad.bind(this);
        this.onAuthorPreviewItemsCountCallback = this.onAuthorPreviewItemsCountCallback.bind(this);
        this.getCountFunc = this.getCountFunc.bind(this);
        this.changeRequestQuery = this.changeRequestQuery.bind(this);
        this.handleMediaSelection = this.handleMediaSelection.bind(this);
        this.onToggleFiltersClick = this.onToggleFiltersClick.bind(this);
        this.onToggleTagsClick = this.onToggleTagsClick.bind(this);
        this.onToggleSortingClick = this.onToggleSortingClick.bind(this);
        this.onToggleSharingClick = this.onToggleSharingClick.bind(this);
        this.onFiltersUpdate = this.onFiltersUpdate.bind(this);
        this.onTagSelect = this.onTagSelect.bind(this);
        this.onSortSelect = this.onSortSelect.bind(this);
        this.onSharingSelect = this.onSharingSelect.bind(this);
        this.onResponseDataLoaded = this.onResponseDataLoaded.bind(this);

        ProfilePageStore.on('load-author-data', this.authorDataLoad);
    }

    componentDidMount() {
        ProfilePageActions.load_author_data();
    }

    authorDataLoad() {
        const author = ProfilePageStore.get('author-data');

        let requestUrl = this.state.requestUrl;

        if (author) {
            if (this.state.query) {
                requestUrl =
                    ApiUrlContext._currentValue.media +
                    '?author=' +
                    author.id +
                    '&q=' +
                    encodeURIComponent(this.state.query) +
                    this.state.filterArgs;
            } else {
                requestUrl = ApiUrlContext._currentValue.media + '?author=' + author.id + this.state.filterArgs;
            }
        }

        this.setState({
            author: author,
            requestUrl: requestUrl,
        });
    }

    onAuthorPreviewItemsCountCallback(totalAuthorPreviewItems) {
        this.setState({
            uploadsPreviewItemsCount: totalAuthorPreviewItems,
        });
    }

    getCountFunc(count) {
        this.setState(
            {
                channelMediaCount: count,
            },
            () => {
                if (this.state.query) {
                    let title = '';

                    if (!count) {
                        title = translateString('No results for') + ' "' + this.state.query + '"';
                    } else if (1 === count) {
                        title = translateString('1 result for') + ' "' + this.state.query + '"';
                    } else {
                        title = count + ' ' + translateString('results for') + ' "' + this.state.query + '"';
                    }

                    this.setState({
                        title: title,
                    });
                }
            }
        );
    }

    changeRequestQuery(newQuery) {
        if (!this.state.author) {
            return;
        }

        let requestUrl;

        if (newQuery) {
            requestUrl =
                ApiUrlContext._currentValue.media +
                '?author=' +
                this.state.author.id +
                '&q=' +
                encodeURIComponent(newQuery) +
                this.state.filterArgs;
        } else {
            requestUrl = ApiUrlContext._currentValue.media + '?author=' + this.state.author.id + this.state.filterArgs;
        }

        let title = this.state.title;

        if ('' === newQuery) {
            title = this.props.title;
        }

        this.setState({
            requestUrl: requestUrl,
            query: newQuery,
            title: title,
        });
    }

    handleMediaSelection(mediaId, isSelected) {
        // Only used in select media embed mode; normal mode is handled by bulkActions
        this.setState(() => {
            const newSelectedMedia = new Set();
            if (isSelected) {
                newSelectedMedia.add(mediaId);
            }
            return { selectedMedia: newSelectedMedia };
        });

        if (isSelected) {
            const baseUrl = window.location.origin;
            const embedUrl = `${baseUrl}/embed?m=${mediaId}`;

            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'videoSelected',
                    embedUrl: embedUrl,
                    videoId: mediaId,
                }, '*');
            }
        }
    }

    onToggleFiltersClick() {
        this.setState({
            hiddenFilters: !this.state.hiddenFilters,
            hiddenTags: true,
            hiddenSorting: true,
            hiddenSharing: true,
        });
    }

    onToggleTagsClick() {
        this.setState({
            hiddenFilters: true,
            hiddenTags: !this.state.hiddenTags,
            hiddenSorting: true,
            hiddenSharing: true,
        });
    }

    onToggleSortingClick() {
        this.setState({
            hiddenFilters: true,
            hiddenTags: true,
            hiddenSorting: !this.state.hiddenSorting,
            hiddenSharing: true,
        });
    }

    onToggleSharingClick() {
        this.setState({
            hiddenFilters: true,
            hiddenTags: true,
            hiddenSorting: true,
            hiddenSharing: !this.state.hiddenSharing,
        });
    }

    onTagSelect(tag) {
        this.setState({ selectedTag: tag }, () => {
            this.onFiltersUpdate({
                media_type: this.state.filterArgs.includes('media_type')
                    ? this.state.filterArgs.match(/media_type=([^&]*)/)?.[1]
                    : null,
                upload_date: this.state.filterArgs.includes('upload_date')
                    ? this.state.filterArgs.match(/upload_date=([^&]*)/)?.[1]
                    : null,
                duration: this.state.filterArgs.includes('duration')
                    ? this.state.filterArgs.match(/duration=([^&]*)/)?.[1]
                    : null,
                publish_state: this.state.filterArgs.includes('publish_state')
                    ? this.state.filterArgs.match(/publish_state=([^&]*)/)?.[1]
                    : null,
                sort_by: this.state.selectedSort,
                tag: tag,
                sharing_type: this.state.selectedSharingType,
                sharing_value: this.state.selectedSharingValue,
            });
        });
    }

    onSortSelect(sortOption) {
        this.setState({ selectedSort: sortOption }, () => {
            this.onFiltersUpdate({
                media_type: this.state.filterArgs.includes('media_type')
                    ? this.state.filterArgs.match(/media_type=([^&]*)/)?.[1]
                    : null,
                upload_date: this.state.filterArgs.includes('upload_date')
                    ? this.state.filterArgs.match(/upload_date=([^&]*)/)?.[1]
                    : null,
                duration: this.state.filterArgs.includes('duration')
                    ? this.state.filterArgs.match(/duration=([^&]*)/)?.[1]
                    : null,
                publish_state: this.state.filterArgs.includes('publish_state')
                    ? this.state.filterArgs.match(/publish_state=([^&]*)/)?.[1]
                    : null,
                sort_by: sortOption,
                tag: this.state.selectedTag,
                sharing_type: this.state.selectedSharingType,
                sharing_value: this.state.selectedSharingValue,
            });
        });
    }

    onSharingSelect(type, value) {
        this.setState({ selectedSharingType: type, selectedSharingValue: value }, () => {
            this.onFiltersUpdate({
                media_type: this.state.filterArgs.includes('media_type')
                    ? this.state.filterArgs.match(/media_type=([^&]*)/)?.[1]
                    : null,
                upload_date: this.state.filterArgs.includes('upload_date')
                    ? this.state.filterArgs.match(/upload_date=([^&]*)/)?.[1]
                    : null,
                duration: this.state.filterArgs.includes('duration')
                    ? this.state.filterArgs.match(/duration=([^&]*)/)?.[1]
                    : null,
                publish_state: this.state.filterArgs.includes('publish_state')
                    ? this.state.filterArgs.match(/publish_state=([^&]*)/)?.[1]
                    : null,
                sort_by: this.state.selectedSort,
                tag: this.state.selectedTag,
                sharing_type: type,
                sharing_value: value,
            });
        });
    }

    onFiltersUpdate(updatedArgs) {
        const args = {
            media_type: null,
            upload_date: null,
            duration: null,
            publish_state: null,
            sort_by: null,
            ordering: null,
            t: null,
            shared_user: null,
            shared_group: null,
        };

        switch (updatedArgs.media_type) {
            case 'video':
            case 'audio':
            case 'image':
            case 'pdf':
                args.media_type = updatedArgs.media_type;
                break;
        }

        switch (updatedArgs.upload_date) {
            case 'today':
            case 'this_week':
            case 'this_month':
            case 'this_year':
                args.upload_date = updatedArgs.upload_date;
                break;
        }

        if (updatedArgs.duration && updatedArgs.duration !== 'all') {
            args.duration = updatedArgs.duration;
        }

        if (updatedArgs.publish_state && updatedArgs.publish_state !== 'all') {
            args.publish_state = updatedArgs.publish_state;
        }

        switch (updatedArgs.sort_by) {
            case 'date_added_desc':
                break;
            case 'date_added_asc':
                args.ordering = 'asc';
                break;
            case 'alphabetically_asc':
                args.sort_by = 'title_asc';
                break;
            case 'alphabetically_desc':
                args.sort_by = 'title_desc';
                break;
            case 'plays_least':
                args.sort_by = 'views_asc';
                break;
            case 'plays_most':
                args.sort_by = 'views_desc';
                break;
            case 'likes_least':
                args.sort_by = 'likes_asc';
                break;
            case 'likes_most':
                args.sort_by = 'likes_desc';
                break;
        }

        if (updatedArgs.tag && updatedArgs.tag !== 'all') {
            args.t = updatedArgs.tag;
        }

        if (updatedArgs.sharing_type === 'user' && updatedArgs.sharing_value) {
            args.shared_user = updatedArgs.sharing_value;
        } else if (updatedArgs.sharing_type === 'group' && updatedArgs.sharing_value) {
            args.shared_group = updatedArgs.sharing_value;
        }

        const newArgs = [];

        for (let arg in args) {
            if (null !== args[arg]) {
                newArgs.push(arg + '=' + args[arg]);
            }
        }

        this.setState(
            {
                filterArgs: newArgs.length ? '&' + newArgs.join('&') : '',
            },
            function () {
                if (!this.state.author) {
                    return;
                }

                let requestUrl;

                if (this.state.query) {
                    requestUrl =
                        ApiUrlContext._currentValue.media +
                        '?author=' +
                        this.state.author.id +
                        '&q=' +
                        encodeURIComponent(this.state.query) +
                        this.state.filterArgs;
                } else {
                    requestUrl =
                        ApiUrlContext._currentValue.media + '?author=' + this.state.author.id + this.state.filterArgs;
                }

                this.setState({
                    requestUrl: requestUrl,
                });
            }
        );
    }

    onResponseDataLoaded(responseData) {
        if (responseData && responseData.tags) {
            const tags = responseData.tags
                .split(',')
                .map((tag) => tag.trim())
                .filter((tag) => tag);
            this.setState({ availableTags: tags });
        }
        if (responseData && responseData.shared_users !== undefined) {
            this.setState({
                sharedUsers: responseData.shared_users || [],
                sharedGroups: responseData.shared_groups || [],
            });
        }
    }

    pageContent() {
        const authorData = ProfilePageStore.get('author-data');

        const isMediaAuthor = authorData && authorData.username === MemberContext._currentValue.username;
        const isSelectMediaMode = inSelectMediaEmbedMode();

        const hasActiveFilters =
            this.state.filterArgs &&
            (this.state.filterArgs.includes('media_type=') ||
                this.state.filterArgs.includes('upload_date=') ||
                this.state.filterArgs.includes('duration=') ||
                this.state.filterArgs.includes('publish_state='));

        const hasActiveTags = this.state.selectedTag && this.state.selectedTag !== 'all';
        const hasActiveSort = this.state.selectedSort && this.state.selectedSort !== 'date_added_desc';

        return [
            this.state.author ? (
                <ProfilePagesHeader
                    key="ProfilePagesHeader"
                    type="media"
                    author={this.state.author}
                    onQueryChange={this.changeRequestQuery}
                    onToggleFiltersClick={this.onToggleFiltersClick}
                    onToggleTagsClick={this.onToggleTagsClick}
                    onToggleSortingClick={this.onToggleSortingClick}
                    onToggleSharingClick={this.onToggleSharingClick}
                    hasActiveFilters={hasActiveFilters}
                    hasActiveTags={hasActiveTags}
                    hasActiveSort={hasActiveSort}
                    hasActiveSharing={!!this.state.selectedSharingValue}
                    hideChannelBanner={inEmbeddedApp()}
                />
            ) : null,
            this.state.author ? (
                <ProfilePagesContent key="ProfilePagesContent">
                    <MediaListWrapper
                        title={inEmbeddedApp() ? undefined : this.state.title}
                        className="items-list-ver"
                        style={inEmbeddedApp() ? { marginTop: '24px' } : undefined}
                        showBulkActions={!isSelectMediaMode && isMediaAuthor}
                        selectedCount={isSelectMediaMode ? this.state.selectedMedia.size : this.props.bulkActions.selectedMedia.size}
                        totalCount={isSelectMediaMode ? 0 : this.props.bulkActions.availableMediaIds.length}
                        onBulkAction={this.props.bulkActions.handleBulkAction}
                        onSelectAll={this.props.bulkActions.handleSelectAll}
                        onDeselectAll={this.props.bulkActions.handleDeselectAll}
                        showAddMediaButton={!isSelectMediaMode && isMediaAuthor}
                        hasContributorCourses={this.props.bulkActions.hasContributorCourses}
                    >
                        <ProfileMediaFilters
                            hidden={this.state.hiddenFilters}
                            tags={this.state.availableTags}
                            onFiltersUpdate={this.onFiltersUpdate}
                            selectedTag={this.state.selectedTag}
                            selectedSort={this.state.selectedSort}
                        />
                        <ProfileMediaTags
                            hidden={this.state.hiddenTags}
                            tags={this.state.availableTags}
                            onTagSelect={this.onTagSelect}
                        />
                        <ProfileMediaSorting hidden={this.state.hiddenSorting} onSortSelect={this.onSortSelect} />
                        <ProfileMediaSharing
                            hidden={this.state.hiddenSharing}
                            sharedUsers={this.state.sharedUsers}
                            sharedGroups={this.state.sharedGroups}
                            onSharingSelect={this.onSharingSelect}
                            selectedSharingType={this.state.selectedSharingType}
                            selectedSharingValue={this.state.selectedSharingValue}
                        />
                        <LazyLoadItemListAsync
                            key={`${this.state.requestUrl}-${this.props.bulkActions.listKey}`}
                            requestUrl={this.state.requestUrl}
                            hideAuthor={true}
                            itemsCountCallback={this.state.requestUrl ? this.getCountFunc : null}
                            hideViews={!PageStore.get('config-media-item').displayViews}
                            hideDate={!PageStore.get('config-media-item').displayPublishDate}
                            canEdit={isMediaAuthor}
                            showSelection={isMediaAuthor || isSelectMediaMode}
                            hasAnySelection={isSelectMediaMode ? this.state.selectedMedia.size > 0 : this.props.bulkActions.selectedMedia.size > 0}
                            selectedMedia={isSelectMediaMode ? this.state.selectedMedia : this.props.bulkActions.selectedMedia}
                            onMediaSelection={isSelectMediaMode ? this.handleMediaSelection : this.props.bulkActions.handleMediaSelection}
                            onItemsUpdate={!isSelectMediaMode ? this.props.bulkActions.handleItemsUpdate : undefined}
                            onResponseDataLoaded={this.onResponseDataLoaded}
                        />
                    </MediaListWrapper>
                </ProfilePagesContent>
            ) : null,
            this.state.author && isMediaAuthor && !isSelectMediaMode ? (
                <BulkActionsModals
                    key="BulkActionsModals"
                    {...this.props.bulkActions}
                    selectedMediaIds={Array.from(this.props.bulkActions.selectedMedia)}
                    csrfToken={this.props.bulkActions.getCsrfToken()}
                    username={this.state.author.username}
                    onConfirmCancel={this.props.bulkActions.handleConfirmCancel}
                    onConfirmProceed={this.props.bulkActions.handleConfirmProceed}
                    onPermissionModalCancel={this.props.bulkActions.handlePermissionModalCancel}
                    onPermissionModalSuccess={this.props.bulkActions.handlePermissionModalSuccess}
                    onPermissionModalError={this.props.bulkActions.handlePermissionModalError}
                    onPlaylistModalCancel={this.props.bulkActions.handlePlaylistModalCancel}
                    onPlaylistModalSuccess={this.props.bulkActions.handlePlaylistModalSuccess}
                    onPlaylistModalError={this.props.bulkActions.handlePlaylistModalError}
                    onChangeOwnerModalCancel={this.props.bulkActions.handleChangeOwnerModalCancel}
                    onChangeOwnerModalSuccess={this.props.bulkActions.handleChangeOwnerModalSuccess}
                    onChangeOwnerModalError={this.props.bulkActions.handleChangeOwnerModalError}
                    onPublishStateModalCancel={this.props.bulkActions.handlePublishStateModalCancel}
                    onPublishStateModalSuccess={this.props.bulkActions.handlePublishStateModalSuccess}
                    onPublishStateModalError={this.props.bulkActions.handlePublishStateModalError}
                    onCategoryModalCancel={this.props.bulkActions.handleCategoryModalCancel}
                    onCategoryModalSuccess={this.props.bulkActions.handleCategoryModalSuccess}
                    onCategoryModalError={this.props.bulkActions.handleCategoryModalError}
                    onTagModalCancel={this.props.bulkActions.handleTagModalCancel}
                    onTagModalSuccess={this.props.bulkActions.handleTagModalSuccess}
                    onTagModalError={this.props.bulkActions.handleTagModalError}
                    showCourseCleanupModal={this.props.bulkActions.showCourseCleanupModal}
                    onCourseCleanupModalCancel={this.props.bulkActions.handleCourseCleanupModalCancel}
                    onCourseCleanupModalSuccess={this.props.bulkActions.handleCourseCleanupModalSuccess}
                    onCourseCleanupModalError={this.props.bulkActions.handleCourseCleanupModalError}
                />
            ) : null,
        ];
    }
}

ProfileMediaPage.propTypes = {
    title: PropTypes.string.isRequired,
    bulkActions: PropTypes.object.isRequired,
};

ProfileMediaPage.defaultProps = {
    title: 'Uploads',
};

// Export the raw class for subclasses to extend
export { ProfileMediaPage as ProfileMediaPageBase };

// Export the HOC-wrapped version as the renderable component
const WrappedProfileMediaPage = withBulkActions(ProfileMediaPage);
export { WrappedProfileMediaPage as ProfileMediaPage };
export default WrappedProfileMediaPage;
