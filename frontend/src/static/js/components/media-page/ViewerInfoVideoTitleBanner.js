import React from 'react';
import { formatViewsNumber, inEmbeddedApp } from '../../utils/helpers/';
import { PageStore, MediaPageStore } from '../../utils/stores/';
import { MemberContext, PlaylistsContext } from '../../utils/contexts/';
import {
    MediaLikeIcon,
    MediaDislikeIcon,
    OtherMediaDownloadLink,
    VideoMediaDownloadLink,
    MediaSaveButton,
    MediaShareButton,
    MediaMoreOptionsIcon,
} from '../media-actions/';
import ViewerInfoTitleBanner from './ViewerInfoTitleBanner';
import { translateString } from '../../utils/helpers/';

export default class ViewerInfoVideoTitleBanner extends ViewerInfoTitleBanner {
    render() {
        const displayViews = PageStore.get('config-options').pages.media.displayViews && void 0 !== this.props.views;

        const mediaData = MediaPageStore.get('media-data');
        const mediaState = mediaData.state;
        const isShared = mediaData.is_shared;

        let stateTooltip = '';

        switch (mediaState) {
            case 'private':
                stateTooltip = 'The site admins have to make its access public';
                break;
            case 'unlisted':
                stateTooltip = 'The site admins have to make it appear on listings';
                break;
        }

        const sharedTooltip = 'This media is shared with specific users or categories';

        return (
            <div className="media-title-banner">
                {displayViews && PageStore.get('config-options').pages.media.categoriesWithTitle
                    ? this.mediaCategories(true)
                    : null}

                {void 0 !== this.props.title ? <h1>{this.props.title}</h1> : null}

                {isShared || 'public' !== mediaState ? (
                    <div className="media-labels-area">
                        <div className="media-labels-area-inner">
                            {isShared ? (
                                <>
                                    <span className="media-label-state">
                                        <span>shared</span>
                                    </span>
                                    <span className="helper-icon" data-tooltip={sharedTooltip}>
                                        <i className="material-icons">help_outline</i>
                                    </span>
                                </>
                            ) : 'public' !== mediaState ? (
                                <>
                                    <span className="media-label-state">
                                        <span>{mediaState}</span>
                                    </span>
                                    <span className="helper-icon" data-tooltip={stateTooltip}>
                                        <i className="material-icons">help_outline</i>
                                    </span>
                                </>
                            ) : null}
                        </div>
                    </div>
                ) : null}

                <div
                    className={
                        'media-views-actions' +
                        (this.state.likedMedia ? ' liked-media' : '') +
                        (this.state.dislikedMedia ? ' disliked-media' : '')
                    }
                >
                    {!displayViews && PageStore.get('config-options').pages.media.categoriesWithTitle
                        ? this.mediaCategories()
                        : null}

                    {displayViews ? (
                        <div className="media-views">
                            {formatViewsNumber(this.props.views, true)}{' '}
                            {1 >= this.props.views ? translateString('view') : translateString('views')}
                        </div>
                    ) : null}

                    <div className="media-actions">
                        <div>
                            {MemberContext._currentValue.can.likeMedia ? <MediaLikeIcon /> : null}
                            {MemberContext._currentValue.can.dislikeMedia ? <MediaDislikeIcon /> : null}
                            {!inEmbeddedApp() && MemberContext._currentValue.can.shareMedia ? (
                                <MediaShareButton isVideo={true} />
                            ) : null}

                            {!inEmbeddedApp() &&
                            !MemberContext._currentValue.is.anonymous &&
                            MemberContext._currentValue.can.saveMedia &&
                            -1 < PlaylistsContext._currentValue.mediaTypes.indexOf(MediaPageStore.get('media-type')) ? (
                                <MediaSaveButton />
                            ) : null}

                            {!this.props.allowDownload || !MemberContext._currentValue.can.downloadMedia ? null : !this
                                  .downloadLink ? (
                                <VideoMediaDownloadLink />
                            ) : (
                                <OtherMediaDownloadLink link={this.downloadLink} title={this.downloadFilename} />
                            )}

                            <MediaMoreOptionsIcon allowDownload={this.props.allowDownload} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
