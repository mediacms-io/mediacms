import React from 'react';
import { formatViewsNumber } from '../../utils/helpers/';
import { PageStore, MediaPageStore } from '../../utils/stores/';
import { MemberContext, PlaylistsContext } from '../../utils/contexts/';
import { MediaLikeIcon, MediaDislikeIcon, OtherMediaDownloadLink, VideoMediaDownloadLink, MediaSaveButton, MediaShareButton, MediaMoreOptionsIcon } from '../media-actions/';
import ViewerInfoTitleBanner from './ViewerInfoTitleBanner';
import { translateString } from '../../utils/helpers/';

export default class ViewerInfoVideoTitleBanner extends ViewerInfoTitleBanner {
  render() {
    const displayViews = PageStore.get('config-options').pages.media.displayViews && void 0 !== this.props.views;

    const mediaState = MediaPageStore.get('media-data').state;

    let stateTooltip = '';

    switch (mediaState) {
      case 'private':
        stateTooltip = 'The site admins have to make its access public';
        break;
      case 'unlisted':
        stateTooltip = 'The site admins have to make it appear on listings';
        break;
    }

    return (
      <div className="media-title-banner">
        {displayViews && PageStore.get('config-options').pages.media.categoriesWithTitle
          ? this.mediaCategories(true)
          : null}

        {void 0 !== this.props.title ? <h1>{this.props.title}</h1> : null}

        {'public' !== mediaState ? (
          <div className="media-labels-area">
            <div className="media-labels-area-inner">
              <span className="media-label-state">
                <span>{mediaState}</span>
              </span>
              <span className="helper-icon" data-tooltip={stateTooltip}>
                <i className="material-icons">help_outline</i>
              </span>
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
              {formatViewsNumber(this.props.views, true)} {1 >= this.props.views ? translateString('view') : translateString('views')}
            </div>
          ) : null}

          <div className="media-actions">
            <div>
              {MemberContext._currentValue.can.likeMedia ? <MediaLikeIcon /> : null}
              {MemberContext._currentValue.can.dislikeMedia ? <MediaDislikeIcon /> : null}
              {MemberContext._currentValue.can.shareMedia ? <MediaShareButton isVideo={true} /> : null}

              {!MemberContext._currentValue.is.anonymous &&
                MemberContext._currentValue.can.saveMedia &&
                -1 < PlaylistsContext._currentValue.mediaTypes.indexOf(MediaPageStore.get('media-type')) ? (
                <MediaSaveButton />
              ) : null}

              {!this.props.allowDownload || !MemberContext._currentValue.can.downloadMedia ? null : !this
                .downloadLink ? (
                <VideoMediaDownloadLink />
              ) : (
                <OtherMediaDownloadLink link={this.downloadLink} title={this.props.title} />
              )}

              <MediaMoreOptionsIcon allowDownload={this.props.allowDownload} />
            </div>
          </div>
        </div>
      </div>
    );
  }
}
