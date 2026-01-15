import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlContext, LinksConsumer, MemberContext } from '../utils/contexts';
import { PageStore, ProfilePageStore } from '../utils/stores';
import { ProfilePageActions, PageActions } from '../utils/actions';
import { inEmbeddedApp, translateString } from '../utils/helpers/';
import { MediaListWrapper } from '../components/MediaListWrapper';
import ProfilePagesHeader from '../components/profile-page/ProfilePagesHeader';
import ProfilePagesContent from '../components/profile-page/ProfilePagesContent';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync';
import { BulkActionConfirmModal } from '../components/BulkActionConfirmModal';
import { BulkActionPermissionModal } from '../components/BulkActionPermissionModal';
import { BulkActionPlaylistModal } from '../components/BulkActionPlaylistModal';
import { BulkActionChangeOwnerModal } from '../components/BulkActionChangeOwnerModal';
import { BulkActionPublishStateModal } from '../components/BulkActionPublishStateModal';
import { BulkActionCategoryModal } from '../components/BulkActionCategoryModal';
import { BulkActionTagModal } from '../components/BulkActionTagModal';
import { ProfileMediaFilters } from '../components/search-filters/ProfileMediaFilters';
import { ProfileMediaTags } from '../components/search-filters/ProfileMediaTags';
import { ProfileMediaSorting } from '../components/search-filters/ProfileMediaSorting';

import { Page } from './_Page';

import '../components/profile-page/ProfilePage.scss';

export class ProfileMediaPage extends Page {
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
            selectedMedia: new Set(),
            availableMediaIds: [],
            showConfirmModal: false,
            pendingAction: null,
            confirmMessage: '',
            listKey: 0,
            notificationMessage: '',
            showNotification: false,
            notificationType: 'success',
            hiddenFilters: true,
            hiddenTags: true,
            hiddenSorting: true,
            filterArgs: '',
            availableTags: [],
            selectedTag: 'all',
            selectedSort: 'date_added_desc',
            showPermissionModal: false,
            permissionType: null,
            showPlaylistModal: false,
            showChangeOwnerModal: false,
            showPublishStateModal: false,
            showCategoryModal: false,
            showTagModal: false,
        };

        this.authorDataLoad = this.authorDataLoad.bind(this);
        this.onAuthorPreviewItemsCountCallback = this.onAuthorPreviewItemsCountCallback.bind(this);
        this.getCountFunc = this.getCountFunc.bind(this);
        this.changeRequestQuery = this.changeRequestQuery.bind(this);
        this.handleMediaSelection = this.handleMediaSelection.bind(this);
        this.handleBulkAction = this.handleBulkAction.bind(this);
        this.handleConfirmCancel = this.handleConfirmCancel.bind(this);
        this.handleConfirmProceed = this.handleConfirmProceed.bind(this);
        this.clearSelectionAndRefresh = this.clearSelectionAndRefresh.bind(this);
        this.clearSelection = this.clearSelection.bind(this);
        this.executeEnableComments = this.executeEnableComments.bind(this);
        this.executeDisableComments = this.executeDisableComments.bind(this);
        this.executeEnableDownload = this.executeEnableDownload.bind(this);
        this.executeDisableDownload = this.executeDisableDownload.bind(this);
        this.executeCopyMedia = this.executeCopyMedia.bind(this);
        this.showNotification = this.showNotification.bind(this);
        this.handleSelectAll = this.handleSelectAll.bind(this);
        this.handleDeselectAll = this.handleDeselectAll.bind(this);
        this.handleItemsUpdate = this.handleItemsUpdate.bind(this);
        this.onToggleFiltersClick = this.onToggleFiltersClick.bind(this);
        this.onToggleTagsClick = this.onToggleTagsClick.bind(this);
        this.onToggleSortingClick = this.onToggleSortingClick.bind(this);
        this.onFiltersUpdate = this.onFiltersUpdate.bind(this);
        this.onTagSelect = this.onTagSelect.bind(this);
        this.onSortSelect = this.onSortSelect.bind(this);
        this.onResponseDataLoaded = this.onResponseDataLoaded.bind(this);
        this.handlePermissionModalCancel = this.handlePermissionModalCancel.bind(this);
        this.handlePermissionModalSuccess = this.handlePermissionModalSuccess.bind(this);
        this.handlePermissionModalError = this.handlePermissionModalError.bind(this);
        this.handlePlaylistModalCancel = this.handlePlaylistModalCancel.bind(this);
        this.handlePlaylistModalSuccess = this.handlePlaylistModalSuccess.bind(this);
        this.handlePlaylistModalError = this.handlePlaylistModalError.bind(this);
        this.handleChangeOwnerModalCancel = this.handleChangeOwnerModalCancel.bind(this);
        this.handleChangeOwnerModalSuccess = this.handleChangeOwnerModalSuccess.bind(this);
        this.handleChangeOwnerModalError = this.handleChangeOwnerModalError.bind(this);
        this.handlePublishStateModalCancel = this.handlePublishStateModalCancel.bind(this);
        this.handlePublishStateModalSuccess = this.handlePublishStateModalSuccess.bind(this);
        this.handlePublishStateModalError = this.handlePublishStateModalError.bind(this);
        this.handleCategoryModalCancel = this.handleCategoryModalCancel.bind(this);
        this.handleCategoryModalSuccess = this.handleCategoryModalSuccess.bind(this);
        this.handleCategoryModalError = this.handleCategoryModalError.bind(this);
        this.handleTagModalCancel = this.handleTagModalCancel.bind(this);
        this.handleTagModalSuccess = this.handleTagModalSuccess.bind(this);
        this.handleTagModalError = this.handleTagModalError.bind(this);

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
        this.setState((prevState) => {
            const newSelectedMedia = new Set(prevState.selectedMedia);
            if (isSelected) {
                newSelectedMedia.add(mediaId);
            } else {
                newSelectedMedia.delete(mediaId);
            }
            return { selectedMedia: newSelectedMedia };
        });
    }

    handleBulkAction(action) {
        const selectedCount = this.state.selectedMedia.size;

        if (selectedCount === 0) {
            return;
        }

        if (action === 'delete-media') {
            this.setState({
                showConfirmModal: true,
                pendingAction: action,
                confirmMessage:
                    translateString('You are going to delete') +
                    ` ${selectedCount} ` +
                    translateString('media, are you sure?'),
            });
        } else if (action === 'enable-comments') {
            this.setState({
                showConfirmModal: true,
                pendingAction: action,
                confirmMessage:
                    translateString('You are going to enable comments to') +
                    ` ${selectedCount} ` +
                    translateString('media, are you sure?'),
            });
        } else if (action === 'disable-comments') {
            this.setState({
                showConfirmModal: true,
                pendingAction: action,
                confirmMessage:
                    translateString('You are going to disable comments to') +
                    ` ${selectedCount} ` +
                    translateString('media, are you sure?'),
            });
        } else if (action === 'enable-download') {
            this.setState({
                showConfirmModal: true,
                pendingAction: action,
                confirmMessage:
                    translateString('You are going to enable download for') +
                    ` ${selectedCount} ` +
                    translateString('media, are you sure?'),
            });
        } else if (action === 'disable-download') {
            this.setState({
                showConfirmModal: true,
                pendingAction: action,
                confirmMessage:
                    translateString('You are going to disable download for') +
                    ` ${selectedCount} ` +
                    translateString('media, are you sure?'),
            });
        } else if (action === 'copy-media') {
            this.setState({
                showConfirmModal: true,
                pendingAction: action,
                confirmMessage:
                    translateString('You are going to copy') +
                    ` ${selectedCount} ` +
                    translateString('media, are you sure?'),
            });
        } else if (action === 'add-remove-coviewers') {
            this.setState({
                showPermissionModal: true,
                permissionType: 'viewer',
            });
        } else if (action === 'add-remove-coeditors') {
            this.setState({
                showPermissionModal: true,
                permissionType: 'editor',
            });
        } else if (action === 'add-remove-coowners') {
            this.setState({
                showPermissionModal: true,
                permissionType: 'owner',
            });
        } else if (action === 'add-remove-playlist') {
            this.setState({
                showPlaylistModal: true,
            });
        } else if (action === 'change-owner') {
            this.setState({
                showChangeOwnerModal: true,
            });
        } else if (action === 'publish-state') {
            this.setState({
                showPublishStateModal: true,
            });
        } else if (action === 'add-remove-category') {
            this.setState({
                showCategoryModal: true,
            });
        } else if (action === 'add-remove-tags') {
            this.setState({
                showTagModal: true,
            });
        } else {
            // Other actions can be implemented later
        }
    }

    handleConfirmCancel() {
        this.setState({
            showConfirmModal: false,
            pendingAction: null,
            confirmMessage: '',
        });
    }

    handleConfirmProceed() {
        const action = this.state.pendingAction;
        this.setState({
            showConfirmModal: false,
            pendingAction: null,
            confirmMessage: '',
        });

        if (action === 'delete-media') {
            this.executeDeleteMedia();
        } else if (action === 'enable-comments') {
            this.executeEnableComments();
        } else if (action === 'disable-comments') {
            this.executeDisableComments();
        } else if (action === 'enable-download') {
            this.executeEnableDownload();
        } else if (action === 'disable-download') {
            this.executeDisableDownload();
        } else if (action === 'copy-media') {
            this.executeCopyMedia();
        }
    }

    executeDeleteMedia() {
        const selectedIds = Array.from(this.state.selectedMedia);
        const selectedCount = selectedIds.length;

        fetch('/api/v1/media/user/bulk_actions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken(),
            },
            body: JSON.stringify({
                action: 'delete_media',
                media_ids: selectedIds,
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to delete media');
                }
                return response.json();
            })
            .then((data) => {
                const message =
                    selectedCount === 1
                        ? translateString('The media was deleted successfully.')
                        : translateString('Successfully deleted') + ` ${selectedCount} ` + translateString('media.');
                this.showNotification(message);
                this.clearSelectionAndRefresh();
            })
            .catch((error) => {
                this.showNotification(translateString('Failed to delete media. Please try again.'), 'error');
                this.clearSelectionAndRefresh();
            });
    }

    getCsrfToken() {
        const name = 'csrftoken';
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === name + '=') {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    clearSelectionAndRefresh() {
        // Clear selected media and increment listKey to force re-render
        this.setState((prevState) => ({
            selectedMedia: new Set(),
            listKey: prevState.listKey + 1,
        }));
    }

    clearSelection() {
        // Clear selected media without refreshing
        this.setState({
            selectedMedia: new Set(),
        });
    }

    executeEnableComments() {
        const selectedIds = Array.from(this.state.selectedMedia);

        fetch('/api/v1/media/user/bulk_actions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken(),
            },
            body: JSON.stringify({
                action: 'enable_comments',
                media_ids: selectedIds,
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to enable comments');
                }
                return response.json();
            })
            .then((data) => {
                this.showNotification(translateString('Successfully Enabled comments'));
                this.clearSelection();
            })
            .catch((error) => {
                this.showNotification(translateString('Failed to enable comments.'), 'error');
                this.clearSelection();
            });
    }

    executeDisableComments() {
        const selectedIds = Array.from(this.state.selectedMedia);

        fetch('/api/v1/media/user/bulk_actions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken(),
            },
            body: JSON.stringify({
                action: 'disable_comments',
                media_ids: selectedIds,
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to disable comments');
                }
                return response.json();
            })
            .then((data) => {
                this.showNotification(translateString('Successfully Disabled comments'));
                this.clearSelection();
            })
            .catch((error) => {
                this.showNotification(translateString('Failed to disable comments.'), 'error');
                this.clearSelection();
            });
    }

    executeEnableDownload() {
        const selectedIds = Array.from(this.state.selectedMedia);

        fetch('/api/v1/media/user/bulk_actions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken(),
            },
            body: JSON.stringify({
                action: 'enable_download',
                media_ids: selectedIds,
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to enable download');
                }
                return response.json();
            })
            .then((data) => {
                this.showNotification(translateString('Successfully Enabled Download'));
                this.clearSelection();
            })
            .catch((error) => {
                this.showNotification(translateString('Failed to enable download.'), 'error');
                this.clearSelection();
            });
    }

    executeDisableDownload() {
        const selectedIds = Array.from(this.state.selectedMedia);

        fetch('/api/v1/media/user/bulk_actions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken(),
            },
            body: JSON.stringify({
                action: 'disable_download',
                media_ids: selectedIds,
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to disable download');
                }
                return response.json();
            })
            .then((data) => {
                this.showNotification(translateString('Successfully Disabled Download'));
                this.clearSelection();
            })
            .catch((error) => {
                this.showNotification(translateString('Failed to disable download.'), 'error');
                this.clearSelection();
            });
    }

    executeCopyMedia() {
        const selectedIds = Array.from(this.state.selectedMedia);

        fetch('/api/v1/media/user/bulk_actions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken(),
            },
            body: JSON.stringify({
                action: 'copy_media',
                media_ids: selectedIds,
            }),
        })
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Failed to copy media');
                }
                return response.json();
            })
            .then((data) => {
                this.showNotification(translateString('Successfully Copied'));
                this.clearSelectionAndRefresh();
            })
            .catch((error) => {
                this.showNotification(translateString('Failed to copy media.'), 'error');
                this.clearSelection();
            });
    }

    showNotification(message, type = 'success') {
        this.setState({
            notificationMessage: message,
            showNotification: true,
            notificationType: type,
        });

        setTimeout(() => {
            this.setState({ showNotification: false });
        }, 5000);
    }

    handleItemsUpdate(items) {
        // Extract media IDs from loaded items
        const mediaIds = items.map((item) => item.friendly_token || item.uid || item.id);
        this.setState({ availableMediaIds: mediaIds });
    }

    handleSelectAll() {
        // Select all available media
        this.setState({
            selectedMedia: new Set(this.state.availableMediaIds),
        });
    }

    handleDeselectAll() {
        // Clear all selections
        this.setState({
            selectedMedia: new Set(),
        });
    }

    onToggleFiltersClick() {
        this.setState({
            hiddenFilters: !this.state.hiddenFilters,
            hiddenTags: true,
            hiddenSorting: true,
        });
    }

    onToggleTagsClick() {
        this.setState({
            hiddenFilters: true,
            hiddenTags: !this.state.hiddenTags,
            hiddenSorting: true,
        });
    }

    onToggleSortingClick() {
        this.setState({
            hiddenFilters: true,
            hiddenTags: true,
            hiddenSorting: !this.state.hiddenSorting,
        });
    }

    onTagSelect(tag) {
        this.setState({ selectedTag: tag }, () => {
            // Apply tag filter
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
            });
        });
    }

    onSortSelect(sortOption) {
        this.setState({ selectedSort: sortOption }, () => {
            // Apply sort filter
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

        // Handle duration filter
        if (updatedArgs.duration && updatedArgs.duration !== 'all') {
            args.duration = updatedArgs.duration;
        }

        // Handle publish state filter
        if (updatedArgs.publish_state && updatedArgs.publish_state !== 'all') {
            args.publish_state = updatedArgs.publish_state;
        }

        switch (updatedArgs.sort_by) {
            case 'date_added_desc':
                // Default sorting, no need to add parameters
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

        // Handle tag filter
        if (updatedArgs.tag && updatedArgs.tag !== 'all') {
            args.t = updatedArgs.tag;
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
                selectedMedia: new Set(), // Clear selected items when filter changes
            },
            function () {
                // Update the request URL with new filter args
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

    handlePermissionModalCancel() {
        this.setState({
            showPermissionModal: false,
            permissionType: null,
        });
    }

    handlePermissionModalSuccess(message) {
        this.showNotification(message);
        this.clearSelection();
        this.setState({
            showPermissionModal: false,
            permissionType: null,
        });
    }

    handlePermissionModalError(message) {
        this.showNotification(message, 'error');
        this.setState({
            showPermissionModal: false,
            permissionType: null,
        });
    }

    handlePlaylistModalCancel() {
        this.setState({
            showPlaylistModal: false,
        });
    }

    handlePlaylistModalSuccess(message) {
        this.showNotification(message);
        this.clearSelection();
        this.setState({
            showPlaylistModal: false,
        });
    }

    handlePlaylistModalError(message) {
        this.showNotification(message, 'error');
        this.setState({
            showPlaylistModal: false,
        });
    }

    handleChangeOwnerModalCancel() {
        this.setState({
            showChangeOwnerModal: false,
        });
    }

    handleChangeOwnerModalSuccess(message) {
        this.showNotification(message);
        this.clearSelectionAndRefresh();
        this.setState({
            showChangeOwnerModal: false,
        });
    }

    handleChangeOwnerModalError(message) {
        this.showNotification(message, 'error');
        this.setState({
            showChangeOwnerModal: false,
        });
    }

    handlePublishStateModalCancel() {
        this.setState({
            showPublishStateModal: false,
        });
    }

    handlePublishStateModalSuccess(message) {
        this.showNotification(message);
        this.clearSelectionAndRefresh();
        this.setState({
            showPublishStateModal: false,
        });
    }

    handlePublishStateModalError(message) {
        this.showNotification(message, 'error');
        this.setState({
            showPublishStateModal: false,
        });
    }

    handleCategoryModalCancel() {
        this.setState({
            showCategoryModal: false,
        });
    }

    handleCategoryModalSuccess(message) {
        this.showNotification(message);
        this.clearSelection();
        this.setState({
            showCategoryModal: false,
        });
    }

    handleCategoryModalError(message) {
        this.showNotification(message, 'error');
        this.setState({
            showCategoryModal: false,
        });
    }

    handleTagModalCancel() {
        this.setState({
            showTagModal: false,
        });
    }

    handleTagModalSuccess(message) {
        this.showNotification(message);
        this.clearSelection();
        this.setState({
            showTagModal: false,
        });
    }

    handleTagModalError(message) {
        this.showNotification(message, 'error');
        this.setState({
            showTagModal: false,
        });
    }

    onResponseDataLoaded(responseData) {
        // Extract tags from response
        if (responseData && responseData.tags) {
            const tags = responseData.tags
                .split(',')
                .map((tag) => tag.trim())
                .filter((tag) => tag);
            this.setState({ availableTags: tags });
        }
    }

    pageContent() {
        const authorData = ProfilePageStore.get('author-data');

        const isMediaAuthor = authorData && authorData.username === MemberContext._currentValue.username;

        // Check if any filters are active (excluding default sort and tags)
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
                    hasActiveFilters={hasActiveFilters}
                    hasActiveTags={hasActiveTags}
                    hasActiveSort={hasActiveSort}
                    hideChannelBanner={inEmbeddedApp()}
                />
            ) : null,
            this.state.author ? (
                <ProfilePagesContent key="ProfilePagesContent">
                    <MediaListWrapper
                        title={this.state.title}
                        className="items-list-ver"
                        showBulkActions={isMediaAuthor}
                        selectedCount={this.state.selectedMedia.size}
                        totalCount={this.state.availableMediaIds.length}
                        onBulkAction={this.handleBulkAction}
                        onSelectAll={this.handleSelectAll}
                        onDeselectAll={this.handleDeselectAll}
                        showAddMediaButton={isMediaAuthor}
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
                        <LazyLoadItemListAsync
                            key={`${this.state.requestUrl}-${this.state.listKey}`}
                            requestUrl={this.state.requestUrl}
                            hideAuthor={true}
                            itemsCountCallback={this.state.requestUrl ? this.getCountFunc : null}
                            hideViews={!PageStore.get('config-media-item').displayViews}
                            hideDate={!PageStore.get('config-media-item').displayPublishDate}
                            canEdit={isMediaAuthor}
                            showSelection={isMediaAuthor}
                            hasAnySelection={this.state.selectedMedia.size > 0}
                            selectedMedia={this.state.selectedMedia}
                            onMediaSelection={this.handleMediaSelection}
                            onItemsUpdate={this.handleItemsUpdate}
                            onResponseDataLoaded={this.onResponseDataLoaded}
                        />
                    </MediaListWrapper>
                </ProfilePagesContent>
            ) : null,
            <BulkActionConfirmModal
                key="BulkActionConfirmModal"
                isOpen={this.state.showConfirmModal}
                message={this.state.confirmMessage}
                onCancel={this.handleConfirmCancel}
                onProceed={this.handleConfirmProceed}
            />,
            <BulkActionPermissionModal
                key="BulkActionPermissionModal"
                isOpen={this.state.showPermissionModal}
                permissionType={this.state.permissionType}
                selectedMediaIds={Array.from(this.state.selectedMedia)}
                onCancel={this.handlePermissionModalCancel}
                onSuccess={this.handlePermissionModalSuccess}
                onError={this.handlePermissionModalError}
                csrfToken={this.getCsrfToken()}
            />,
            <BulkActionPlaylistModal
                key="BulkActionPlaylistModal"
                isOpen={this.state.showPlaylistModal}
                selectedMediaIds={Array.from(this.state.selectedMedia)}
                onCancel={this.handlePlaylistModalCancel}
                onSuccess={this.handlePlaylistModalSuccess}
                onError={this.handlePlaylistModalError}
                csrfToken={this.getCsrfToken()}
                username={this.state.author ? this.state.author.username : ''}
            />,
            <BulkActionChangeOwnerModal
                key="BulkActionChangeOwnerModal"
                isOpen={this.state.showChangeOwnerModal}
                selectedMediaIds={Array.from(this.state.selectedMedia)}
                onCancel={this.handleChangeOwnerModalCancel}
                onSuccess={this.handleChangeOwnerModalSuccess}
                onError={this.handleChangeOwnerModalError}
                csrfToken={this.getCsrfToken()}
            />,
            <BulkActionPublishStateModal
                key="BulkActionPublishStateModal"
                isOpen={this.state.showPublishStateModal}
                selectedMediaIds={Array.from(this.state.selectedMedia)}
                onCancel={this.handlePublishStateModalCancel}
                onSuccess={this.handlePublishStateModalSuccess}
                onError={this.handlePublishStateModalError}
                csrfToken={this.getCsrfToken()}
            />,
            <BulkActionCategoryModal
                key="BulkActionCategoryModal"
                isOpen={this.state.showCategoryModal}
                selectedMediaIds={Array.from(this.state.selectedMedia)}
                onCancel={this.handleCategoryModalCancel}
                onSuccess={this.handleCategoryModalSuccess}
                onError={this.handleCategoryModalError}
                csrfToken={this.getCsrfToken()}
            />,
            <BulkActionTagModal
                key="BulkActionTagModal"
                isOpen={this.state.showTagModal}
                selectedMediaIds={Array.from(this.state.selectedMedia)}
                onCancel={this.handleTagModalCancel}
                onSuccess={this.handleTagModalSuccess}
                onError={this.handleTagModalError}
                csrfToken={this.getCsrfToken()}
            />,
            this.state.showNotification ? (
                <div
                    key="SimpleNotification"
                    style={{
                        position: 'fixed',
                        bottom: '20px',
                        left: '260px',
                        backgroundColor: this.state.notificationType === 'error' ? '#f44336' : '#4CAF50',
                        color: 'white',
                        padding: '16px 24px',
                        borderRadius: '4px',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        zIndex: 1000,
                        fontSize: '14px',
                        fontWeight: '500',
                    }}
                >
                    {this.state.notificationMessage}
                </div>
            ) : null,
        ];
    }
}

ProfileMediaPage.propTypes = {
    title: PropTypes.string.isRequired,
};

ProfileMediaPage.defaultProps = {
    title: 'Uploads',
};
