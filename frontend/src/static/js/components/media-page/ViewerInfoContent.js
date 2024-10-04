import React, { useState, useEffect } from 'react';
import { SiteContext } from '../../utils/contexts/';
import { useUser, usePopup } from '../../utils/hooks/';
import { PageStore, MediaPageStore } from '../../utils/stores/';
import { PageActions, MediaPageActions } from '../../utils/actions/';
import { formatInnerLink, publishedOnDate } from '../../utils/helpers/';
import { PopupMain } from '../_shared/';
import CommentsList from '../comments/Comments';
import { replaceString } from '../../utils/helpers/';
import { translateString } from '../../utils/helpers/';

function metafield(arr) {
  let i;
  let sep;
  let ret = [];

  if (arr.length) {
    i = 0;
    sep = 1 < arr.length ? ', ' : '';
    while (i < arr.length) {
      ret[i] = (
        <div key={i}>
          <a href={arr[i].url} title={arr[i].title}>
            {arr[i].title}
          </a>
          {i < arr.length - 1 ? sep : ''}
        </div>
      );
      i += 1;
    }
  }

  return ret;
}

function MediaAuthorBanner(props) {
  return (
    <div className="media-author-banner">
      <div>
        <a className="author-banner-thumb" href={props.link || null} title={props.name}>
          <span style={{ backgroundImage: 'url(' + props.thumb + ')' }}>
            <img src={props.thumb} loading="lazy" alt={props.name} title={props.name} />
          </span>
        </a>
      </div>
      <div>
        <span>
          <a href={props.link} className="author-banner-name" title={props.name}>
            <span>{props.name}</span>
          </a>
        </span>
        {PageStore.get('config-media-item').displayPublishDate && props.published ? (
          <span className="author-banner-date">{translateString("Published on")} {replaceString(publishedOnDate(new Date(props.published)))}</span>
        ) : null}
      </div>
    </div>
  );
}

function MediaMetaField(props) {
  return (
    <div className={props.id.trim() ? 'media-content-' + props.id.trim() : null}>
      <div className="media-content-field">
        <div className="media-content-field-label">
          <h4>{props.title}</h4>
        </div>
        <div className="media-content-field-content">{props.value}</div>
      </div>
    </div>
  );
}

function EditMediaButton(props) {
  let link = props.link;

  if (window.MediaCMS.site.devEnv) {
    link = '/edit-media.html';
  }

  return (
    <a href={link} rel="nofollow" title={translateString("Edit media")} className="edit-media">
      {translateString("EDIT MEDIA")}
    </a>
  );
}

function EditSubtitleButton(props) {
  let link = props.link;

  if (window.MediaCMS.site.devEnv) {
    link = '#';
  }

  return (
    <a href={link} rel="nofollow" title={translateString("Edit subtitle")} className="edit-subtitle">
      {translateString("EDIT SUBTITLE")}
    </a>
  );
}

export default function ViewerInfoContent(props) {
  const { userCan } = useUser();

  const description = props.description.trim();
  const tagsContent =
    !PageStore.get('config-enabled').taxonomies.tags || PageStore.get('config-enabled').taxonomies.tags.enabled
      ? metafield(MediaPageStore.get('media-tags'))
      : [];
  const categoriesContent = PageStore.get('config-options').pages.media.categoriesWithTitle
    ? []
    : !PageStore.get('config-enabled').taxonomies.categories ||
      PageStore.get('config-enabled').taxonomies.categories.enabled
    ? metafield(MediaPageStore.get('media-categories'))
    : [];

  let summary = MediaPageStore.get('media-summary');

  summary = summary ? summary.trim() : '';

  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

  const [hasSummary, setHasSummary] = useState('' !== summary);
  const [isContentVisible, setIsContentVisible] = useState('' == summary);

  function proceedMediaRemoval() {
    MediaPageActions.removeMedia();
    popupContentRef.current.toggle();
  }

  function cancelMediaRemoval() {
    popupContentRef.current.toggle();
  }

  function onMediaDelete(mediaId) {
    // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(function () {
      PageActions.addNotification('Media removed. Redirecting...', 'mediaDelete');
      setTimeout(function () {
        window.location.href =
          SiteContext._currentValue.url + '/' + MediaPageStore.get('media-data').author_profile.replace(/^\//g, '');
      }, 2000);
    }, 100);

    if (void 0 !== mediaId) {
      console.info("Removed media '" + mediaId + '"');
    }
  }

  function onMediaDeleteFail(mediaId) {
    // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(function () {
      PageActions.addNotification('Media removal failed', 'mediaDeleteFail');
    }, 100);

    if (void 0 !== mediaId) {
      console.info('Media "' + mediaId + '"' + ' removal failed');
    }
  }

  function onClickLoadMore() {
    setIsContentVisible(!isContentVisible);
  }

  useEffect(() => {
    MediaPageStore.on('media_delete', onMediaDelete);
    MediaPageStore.on('media_delete_fail', onMediaDeleteFail);
    return () => {
      MediaPageStore.removeListener('media_delete', onMediaDelete);
      MediaPageStore.removeListener('media_delete_fail', onMediaDeleteFail);
    };
  }, []);

  const authorLink = formatInnerLink(props.author.url, SiteContext._currentValue.url);
  const authorThumb = formatInnerLink(props.author.thumb, SiteContext._currentValue.url);

  return (
    <div className="media-info-content">
      {void 0 === PageStore.get('config-media-item').displayAuthor ||
      null === PageStore.get('config-media-item').displayAuthor ||
      !!PageStore.get('config-media-item').displayAuthor ? (
        <MediaAuthorBanner link={authorLink} thumb={authorThumb} name={props.author.name} published={props.published} />
      ) : null}

      <div className="media-content-banner">
        <div className="media-content-banner-inner">
          {hasSummary ? <div className="media-content-summary">{summary}</div> : null}
          {(!hasSummary || isContentVisible) && description ? (
            PageStore.get('config-options').pages.media.htmlInDescription ? (
              <div className="media-content-description" dangerouslySetInnerHTML={{ __html: description }}></div>
            ) : (
              <div className="media-content-description">{description}</div>
            )
          ) : null}
          {hasSummary ? (
            <button className="load-more" onClick={onClickLoadMore}>
              {isContentVisible ? 'SHOW LESS' : 'SHOW MORE'}
            </button>
          ) : null}
          {tagsContent.length ? (
            <MediaMetaField value={tagsContent} title={1 < tagsContent.length ? translateString('Tags') : translateString('Tag')} id="tags" />
          ) : null}
          {categoriesContent.length ? (
            <MediaMetaField
              value={categoriesContent}
              title={1 < categoriesContent.length ? translateString('Categories') : translateString('Category')}
              id="categories"
            />
          ) : null}

          {userCan.editMedia || userCan.editSubtitle || userCan.deleteMedia ? (
            <div className="media-author-actions">
              {userCan.editMedia ? <EditMediaButton link={MediaPageStore.get('media-data').edit_url} /> : null}
              {userCan.editSubtitle && 'video' === MediaPageStore.get('media-data').media_type ? (
                <EditSubtitleButton
                  link={MediaPageStore.get('media-data').edit_url.replace('edit?', 'add_subtitle?')}
                />
              ) : null}

              <PopupTrigger contentRef={popupContentRef}>
                <button className="remove-media">{translateString("DELETE MEDIA")}</button>
              </PopupTrigger>

              <PopupContent contentRef={popupContentRef}>
                <PopupMain>
                  <div className="popup-message">
                    <span className="popup-message-title">Media removal</span>
                    <span className="popup-message-main">You're willing to remove media permanently?</span>
                  </div>
                  <hr />
                  <span className="popup-message-bottom">
                    <button className="button-link cancel-comment-removal" onClick={cancelMediaRemoval}>
                      CANCEL
                    </button>
                    <button className="button-link proceed-comment-removal" onClick={proceedMediaRemoval}>
                      PROCEED
                    </button>
                  </span>
                </PopupMain>
              </PopupContent>
            </div>
          ) : null}
        </div>
      </div>

      <CommentsList />
    </div>
  );
}
