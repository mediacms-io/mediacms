import React from 'react';
import PropTypes from 'prop-types';
import { ApiUrlContext, LinksConsumer, MemberContext } from '../utils/contexts';
import { PageStore, ProfilePageStore } from '../utils/stores';
import { ProfilePageActions } from '../utils/actions';
import { MediaListWrapper } from '../components/MediaListWrapper';
import ProfilePagesHeader from '../components/profile-page/ProfilePagesHeader';
import ProfilePagesContent from '../components/profile-page/ProfilePagesContent';
import { LazyLoadItemListAsync } from '../components/item-list/LazyLoadItemListAsync';
import { ProfileMediaFilters } from '../components/search-filters/ProfileMediaFilters';
import { ProfileMediaTags } from '../components/search-filters/ProfileMediaTags';
import { ProfileMediaSorting } from '../components/search-filters/ProfileMediaSorting';
import { inEmbeddedApp, translateString } from '../utils/helpers';

import { Page } from './_Page';

import '../components/profile-page/ProfilePage.scss';

function EmptySharedWithMe(props) {
    return (
        <LinksConsumer>
            {(links) => (
                <div className="empty-media empty-channel-media">
                    <div className="welcome-title">No shared media</div>
                    <div className="start-uploading">Media that others have shared with you will show up here.</div>
                </div>
            )}
        </LinksConsumer>
    );
}

export class ProfileSharedWithMePage extends Page {
    constructor(props, pageSlug) {
        super(props, 'string' === typeof pageSlug ? pageSlug : 'author-shared-with-me');

        this.profilePageSlug = 'string' === typeof pageSlug ? pageSlug : 'author-shared-with-me';

        this.state = {
            channelMediaCount: -1,
            author: ProfilePageStore.get('author-data'),
            uploadsPreviewItemsCount: 0,
            title: this.props.title,
            query: ProfilePageStore.get('author-query'),
            requestUrl: null,
            hiddenFilters: true,
            hiddenTags: true,
            hiddenSorting: true,
            filterArgs: '',
            availableTags: [],
            selectedTag: 'all',
            selectedSort: 'date_added_desc',
        };

        this.authorDataLoad = this.authorDataLoad.bind(this);
        this.onAuthorPreviewItemsCountCallback = this.onAuthorPreviewItemsCountCallback.bind(this);
        this.getCountFunc = this.getCountFunc.bind(this);
        this.changeRequestQuery = this.changeRequestQuery.bind(this);
        this.onToggleFiltersClick = this.onToggleFiltersClick.bind(this);
        this.onToggleTagsClick = this.onToggleTagsClick.bind(this);
        this.onToggleSortingClick = this.onToggleSortingClick.bind(this);
        this.onFiltersUpdate = this.onFiltersUpdate.bind(this);
        this.onTagSelect = this.onTagSelect.bind(this);
        this.onSortSelect = this.onSortSelect.bind(this);
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
                    '&show=shared_with_me&q=' +
                    encodeURIComponent(this.state.query) +
                    this.state.filterArgs;
            } else {
                requestUrl =
                    ApiUrlContext._currentValue.media +
                    '?author=' +
                    author.id +
                    '&show=shared_with_me' +
                    this.state.filterArgs;
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
                        title = 'No results for "' + this.state.query + '"';
                    } else if (1 === count) {
                        title = '1 result for "' + this.state.query + '"';
                    } else {
                        title = count + ' results for "' + this.state.query + '"';
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
                '&show=shared_with_me&q=' +
                encodeURIComponent(newQuery) +
                this.state.filterArgs;
        } else {
            requestUrl =
                ApiUrlContext._currentValue.media +
                '?author=' +
                this.state.author.id +
                '&show=shared_with_me' +
                this.state.filterArgs;
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
            this.onFiltersUpdate({
                media_type: this.state.filterArgs.match(/media_type=([^&]+)/)?.[1],
                upload_date: this.state.filterArgs.match(/upload_date=([^&]+)/)?.[1],
                duration: this.state.filterArgs.match(/duration=([^&]+)/)?.[1],
                publish_state: this.state.filterArgs.match(/publish_state=([^&]+)/)?.[1],
                sort_by: this.state.selectedSort,
                tag: tag,
            });
        });
    }

    onSortSelect(sortBy) {
        this.setState({ selectedSort: sortBy }, () => {
            this.onFiltersUpdate({
                media_type: this.state.filterArgs.match(/media_type=([^&]+)/)?.[1],
                upload_date: this.state.filterArgs.match(/upload_date=([^&]+)/)?.[1],
                duration: this.state.filterArgs.match(/duration=([^&]+)/)?.[1],
                publish_state: this.state.filterArgs.match(/publish_state=([^&]+)/)?.[1],
                sort_by: sortBy,
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
                        '&show=shared_with_me&q=' +
                        encodeURIComponent(this.state.query) +
                        this.state.filterArgs;
                } else {
                    requestUrl =
                        ApiUrlContext._currentValue.media +
                        '?author=' +
                        this.state.author.id +
                        '&show=shared_with_me' +
                        this.state.filterArgs;
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
    }

    pageContent() {
        const authorData = ProfilePageStore.get('author-data');

        const isMediaAuthor = authorData && authorData.username === MemberContext._currentValue.username;

        // Check if any filters are active
        const hasActiveFilters =
            this.state.filterArgs &&
            (this.state.filterArgs.includes('media_type=') ||
                this.state.filterArgs.includes('upload_date=') ||
                this.state.filterArgs.includes('duration=') ||
                this.state.filterArgs.includes('publish_state='));

        return [
            this.state.author ? (
                <ProfilePagesHeader
                    key="ProfilePagesHeader"
                    author={this.state.author}
                    type="shared_with_me"
                    onQueryChange={this.changeRequestQuery}
                    onToggleFiltersClick={this.onToggleFiltersClick}
                    onToggleTagsClick={this.onToggleTagsClick}
                    onToggleSortingClick={this.onToggleSortingClick}
                    hasActiveFilters={hasActiveFilters}
                    hasActiveTags={this.state.selectedTag !== 'all'}
                    hasActiveSort={this.state.selectedSort !== 'date_added_desc'}
                    hideChannelBanner={inEmbeddedApp()}
                />
            ) : null,
            this.state.author ? (
                <ProfilePagesContent key="ProfilePagesContent">
                    <MediaListWrapper title={this.state.title} className="items-list-ver">
                        <ProfileMediaFilters
                            hidden={this.state.hiddenFilters}
                            tags={this.state.availableTags}
                            onFiltersUpdate={this.onFiltersUpdate}
                        />
                        <ProfileMediaTags
                            hidden={this.state.hiddenTags}
                            tags={this.state.availableTags}
                            onTagSelect={this.onTagSelect}
                        />
                        <ProfileMediaSorting hidden={this.state.hiddenSorting} onSortSelect={this.onSortSelect} />
                        <LazyLoadItemListAsync
                            key={this.state.requestUrl}
                            requestUrl={this.state.requestUrl}
                            hideAuthor={true}
                            itemsCountCallback={this.state.requestUrl ? this.getCountFunc : null}
                            hideViews={!PageStore.get('config-media-item').displayViews}
                            hideDate={!PageStore.get('config-media-item').displayPublishDate}
                            canEdit={false}
                            onResponseDataLoaded={this.onResponseDataLoaded}
                        />
                        {isMediaAuthor && 0 === this.state.channelMediaCount && !this.state.query ? (
                            <EmptySharedWithMe name={this.state.author.name} />
                        ) : null}
                    </MediaListWrapper>
                </ProfilePagesContent>
            ) : null,
        ];
    }
}

ProfileSharedWithMePage.propTypes = {
    title: PropTypes.string.isRequired,
};

ProfileSharedWithMePage.defaultProps = {
    title: 'Shared with me',
};
