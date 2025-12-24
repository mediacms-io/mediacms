import React from 'react';
import PropTypes from 'prop-types';
import { PageStore, MediaPageStore } from '../../utils/stores/';
import { formatInnerLink, formatViewsNumber } from '../../utils/helpers/';
import { MemberContext, PlaylistsContext, SiteContext } from '../../utils/contexts/';
import { MediaLikeIcon, MediaDislikeIcon, OtherMediaDownloadLink, VideoMediaDownloadLink, MediaSaveButton, MediaShareButton, MediaMoreOptionsIcon } from '../media-actions/';

function Tooltip(el) {
  const parent = document.body;

  const tooltipElem = document.createElement('span');

  tooltipElem.innerText = el.getAttribute('data-tooltip');
  tooltipElem.setAttribute('class', 'tooltip');

  el.removeAttribute('data-tooltip');

  function onMouseenter() {
    const targetClientRect = el.getBoundingClientRect();
    parent.appendChild(tooltipElem);
    tooltipElem.style.top = targetClientRect.top - (0 + tooltipElem.offsetHeight) + 'px';
    tooltipElem.style.left = targetClientRect.left + 'px';
    document.addEventListener('scroll', onScroll);
  }

  function onMouseleave() {
    parent.removeChild(tooltipElem);
    tooltipElem.style.top = '';
    tooltipElem.style.left = '';
    document.removeEventListener('scroll', onScroll);
  }

  function onScroll() {
    const targetClientRect = el.getBoundingClientRect();
    tooltipElem.style.top = targetClientRect.top - (0 + tooltipElem.offsetHeight) + 'px';
    tooltipElem.style.left = targetClientRect.left + 'px';
  }

  el.addEventListener('mouseenter', onMouseenter);
  el.addEventListener('mouseleave', onMouseleave);
}

export default class ViewerInfoTitleBanner extends React.PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      likedMedia: MediaPageStore.get('user-liked-media'),
      dislikedMedia: MediaPageStore.get('user-disliked-media'),
    };

    this.downloadLink =
      'video' !== MediaPageStore.get('media-type')
        ? formatInnerLink(MediaPageStore.get('media-original-url'), SiteContext._currentValue.url)
        : null;

    // Extract actual filename from URL for non-video downloads
    const originalUrl = MediaPageStore.get('media-original-url');
    this.downloadFilename = originalUrl ? originalUrl.substring(originalUrl.lastIndexOf('/') + 1) : this.props.title;

    this.updateStateValues = this.updateStateValues.bind(this);
  }

  componentDidMount() {
    MediaPageStore.on('liked_media', this.updateStateValues);
    MediaPageStore.on('unliked_media', this.updateStateValues);
    MediaPageStore.on('disliked_media', this.updateStateValues);
    MediaPageStore.on('undisliked_media', this.updateStateValues);

    const tooltips = document.querySelectorAll('[data-tooltip]');

    if (tooltips.length) {
      tooltips.forEach((tooltipElem) => Tooltip(tooltipElem));
    }
  }

  updateStateValues() {
    this.setState({
      likedMedia: MediaPageStore.get('user-liked-media'),
      dislikedMedia: MediaPageStore.get('user-disliked-media'),
    });
  }

  mediaCategories(overTitle) {
    if (void 0 === this.props.categories || null === this.props.categories || !this.props.categories.length) {
      return null;
    }

    let i = 0;
    let cats = [];
    while (i < this.props.categories.length) {
      cats.push(
        <span key={i}>
          <a
            href={formatInnerLink(this.props.categories[i].url, SiteContext._currentValue.url)}
            title={this.props.categories[i].title}
          >
            {this.props.categories[i].title}
          </a>
        </span>
      );
      i += 1;
    }

    return <div className={'media-under-title-categories' + (!!overTitle ? ' over-title' : '')}>{cats}</div>;
  }

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
              {formatViewsNumber(this.props.views, true)} {1 >= this.props.views ? 'view' : 'views'}
            </div>
          ) : null}

          <div className="media-actions">
            <div>
              {MemberContext._currentValue.can.likeMedia ? <MediaLikeIcon /> : null}
              {MemberContext._currentValue.can.dislikeMedia ? <MediaDislikeIcon /> : null}
              {MemberContext._currentValue.can.shareMedia ? <MediaShareButton isVideo={false} /> : null}

              {!MemberContext._currentValue.is.anonymous &&
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

ViewerInfoTitleBanner.propTypes = {
  allowDownload: PropTypes.bool.isRequired,
};

ViewerInfoTitleBanner.defaultProps = {
  allowDownload: false,
};
