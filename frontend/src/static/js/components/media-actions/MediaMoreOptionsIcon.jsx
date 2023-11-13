import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { formatInnerLink } from '../../utils/helpers/';
import { usePopup, useUser } from '../../utils/hooks/';
import { SiteContext } from '../../utils/contexts/';
import { PageActions, MediaPageActions } from '../../utils/actions/';
import { MediaPageStore } from '../../utils/stores/';
import { CircleIconButton, MaterialIcon, NavigationContentApp, NavigationMenuList, PopupMain } from '../_shared/';
import { ReportForm } from '../report-form/ReportForm';

function downloadOptions(mediaData, allowDownload) {
  const site = SiteContext._currentValue;

  const encodingsInfo = mediaData.encodings_info;

  const options = {};

  let k, g;

  for (k in encodingsInfo) {
    if (encodingsInfo.hasOwnProperty(k)) {
      if (Object.keys(encodingsInfo[k]).length) {
        for (g in encodingsInfo[k]) {
          if (encodingsInfo[k].hasOwnProperty(g)) {
            if ('success' === encodingsInfo[k][g].status && 100 === encodingsInfo[k][g].progress && null !== encodingsInfo[k][g].url) {
              options[encodingsInfo[k][g].title] = {
                text: k + ' - ' + g.toUpperCase() + ' (' + encodingsInfo[k][g].size + ')',
                link: formatInnerLink(encodingsInfo[k][g].url, site.url),
                linkAttr: {
                  target: '_blank',
                  download: mediaData.title + '_' + k + '_' + g.toUpperCase(),
                },
              };
            }
          }
        }
      }
    }
  }

  options.original_media_url = {
    text: 'Original file (' + mediaData.size + ')',
    link: formatInnerLink(mediaData.original_media_url, site.url),
    linkAttr: {
      target: '_blank',
      download: mediaData.title,
    },
  };

  return Object.values(options);
}

function optionsItems(userCan, mediaData, allowDownload, downloadLink, mediaReported) {

  const items = [];

  const mediaType = mediaData.media_type;
  const mediaIsVideo = 'video' === mediaType;
  const mediaReportedTimes = mediaData.reported_times;

  if (allowDownload && userCan.downloadMedia) {
    if (!mediaIsVideo) {
      if (downloadLink) {
        items.push({
          itemType: 'link',
          link: downloadLink,
          text: 'Download',
          icon: 'arrow_downward',
          itemAttr: {
            className: 'visible-only-in-small',
          },
          linkAttr: {
            target: '_blank',
            download: mediaData.title,
          },
        });
      }
    } else {
      items.push({
        itemType: 'open-subpage',
        text: 'Download',
        icon: 'arrow_downward',
        itemAttr: {
          className: 'visible-only-in-small',
        },
        buttonAttr: {
          className: 'change-page',
          'data-page-id': 'videoDownloadOptions',
        },
      });
    }
  }

  if (mediaIsVideo && userCan.editMedia) {
    items.push({
      itemType: 'open-subpage',
      text: 'Status info',
      icon: 'info',
      buttonAttr: {
        className: 'change-page',
        'data-page-id': 'mediaStatusInfo',
      },
    });
  }

  if (userCan.reportMedia) {
    if (mediaReported) {
      items.push({
        itemType: 'div',
        text: 'Reported',
        icon: 'flag',
        divAttr: {
          className: 'reported-label loggedin-media-reported',
        },
      });
    } else {
      items.push({
        itemType: 'open-subpage',
        text: 'Report',
        icon: 'flag',
        buttonAttr: {
          className: 'change-page' + (mediaReportedTimes ? ' loggedin-media-reported' : ''),
          'data-page-id': 'loggedInReportMedia',
        },
      });
    }
  }

  return items;
}

function getPopupPages(userCan, mediaData, allowDownload, downloadLink, mediaReported, submitReportForm, cancelReportForm) {

  const mediaUrl = mediaData.url;
  const mediaType = mediaData.media_type;
  const mediaState = mediaData.state || 'N/A';
  const mediaEncodingStatus = mediaData.encoding_status || 'N/A';
  const mediaReportedTimes = mediaData.reported_times;
  const mediaIsReviewed = mediaData.is_reviewed;

  const mediaIsVideo = 'video' === mediaType;

  const navItems = optionsItems(userCan, mediaData, allowDownload, downloadLink, mediaReported);

  const pages = {};

  if (navItems.length) {
    pages.main = (
      <div className="main-options">
        <PopupMain>
          <NavigationMenuList items={navItems} />
        </PopupMain>
      </div>
    );
  }

  if (userCan.reportMedia) {
    pages.loggedInReportMedia = mediaReported ? null : (
      <div className="popup-fullscreen">
        <PopupMain>
          <span className="popup-fullscreen-overlay"></span>
          <div>
            <ReportForm mediaUrl={mediaUrl} submitReportForm={submitReportForm} cancelReportForm={cancelReportForm} />
          </div>
        </PopupMain>
      </div>
    );
  }

  if (userCan.editMedia) {
    pages.mediaStatusInfo = (
      <div className="main-options">
        <PopupMain>
          <ul className="media-status-info">
            <li>
              Media type: <span>{mediaType}</span>
            </li>
            <li>
              State: <span>{mediaState}</span>
            </li>
            <li>
              Review state: <span>{mediaIsReviewed ? 'Is reviewed' : 'Pending review'}</span>
            </li>
            {mediaIsVideo ? (
              <li>
                Encoding Status: <span>{mediaEncodingStatus}</span>
              </li>
            ) : null}
            {mediaReportedTimes ? (
              <li className="reports">
                Reports: <span>{mediaReportedTimes}</span>
              </li>
            ) : null}
          </ul>
        </PopupMain>
      </div>
    );
  }

  if (allowDownload && userCan.downloadMedia && mediaIsVideo) {
    pages.videoDownloadOptions = (
      <div className="video-download-options">
        <PopupMain>
          <NavigationMenuList items={downloadOptions(mediaData, allowDownload)} />
        </PopupMain>
      </div>
    );
  }

  return pages;
}

const defaultContainerClassname = 'more-options active-options';

export function MediaMoreOptionsIcon(props) {
  const { userCan } = useUser();

  const site = SiteContext._currentValue;

  const downloadLink = formatInnerLink(MediaPageStore.get('media-original-url'), site.url);
  const mediaData = MediaPageStore.get('media-data');
  const mediaIsVideo = 'video' === mediaData.media_type;

  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();

  const [visible, setVisible] = useState(false);
  const [reported, setReported] = useState(false);
  const [popupPages, setPopupPages] = useState({});
  const [popupCurrentPage, setPopupCurrentPage] = useState('main');
  const [containerClassname, setContainerClassname] = useState(defaultContainerClassname);

  function submitReportForm(reportDescription) {
    MediaPageActions.reportMedia(reportDescription);
  }
  function cancelReportFormSubmission() {
    popupContentRef.current.toggle();
  }
  function onPopupPageChange(newPage) {
    setPopupCurrentPage(newPage);
  }
  function onPopupHide() {
    setPopupCurrentPage('main');
  }

  function onCompleteMediaReport() {
    popupContentRef.current.tryToHide();
    // FIXME: Without delay creates conflict [ Uncaught Error: Dispatch.dispatch(...): Cannot dispatch in the middle of a dispatch. ].
    setTimeout(function () {
      PageActions.addNotification('Media Reported', 'reportedMedia');
      setReported(true);
      MediaPageStore.removeListener('reported_media', onCompleteMediaReport);
    }, 100);
  }

  useEffect(() => {
    if (!reported) {
      if (visible) {
        MediaPageStore.on('reported_media', onCompleteMediaReport);
      } else {
        MediaPageStore.removeListener('reported_media', onCompleteMediaReport);
      }
    }
  }, [visible]);

  useEffect(() => {
    setVisible(Object.keys(popupPages).length && props.allowDownload && userCan.downloadMedia);
  }, [popupPages]);

  useEffect(() => {
    let classname = defaultContainerClassname;
    if (props.allowDownload && userCan.downloadMedia && 'videoDownloadOptions' === popupCurrentPage) {
      classname += ' video-downloads';
    }
    if (
      1 === Object.keys(popupPages).length &&
      props.allowDownload &&
      userCan.downloadMedia &&
      (mediaIsVideo || downloadLink)
    ) {
      classname += ' visible-only-in-small';
    }
    setContainerClassname(classname);
  }, [popupCurrentPage]);

  useEffect(() => {
    setPopupPages(
      getPopupPages(
        userCan,
        mediaData,
        props.allowDownload,
        downloadLink,
        reported,
        submitReportForm,
        cancelReportFormSubmission
      )
    );
  }, [reported]);

  useEffect(() => {
    setPopupPages(
      getPopupPages(
        userCan,
        mediaData,
        props.allowDownload,
        downloadLink,
        reported,
        submitReportForm,
        cancelReportFormSubmission
      )
    );
    return () => {
      if (visible && !reported) {
        MediaPageStore.removeListener('reported_media', onCompleteMediaReport);
      }
    };
  }, []);

  return !visible ? null : (
    <div className={containerClassname}>
      <PopupTrigger contentRef={popupContentRef}>
        <span>
          <CircleIconButton type="button">
            <MaterialIcon type="more_horiz" />
          </CircleIconButton>
        </span>
      </PopupTrigger>

      <div className={'nav-page-' + popupCurrentPage}>
        <PopupContent contentRef={popupContentRef} hideCallback={onPopupHide}>
          <NavigationContentApp
            pageChangeCallback={onPopupPageChange}
            initPage={popupCurrentPage}
            focusFirstItemOnPageChange={false}
            pages={popupPages}
            pageChangeSelector={'.change-page'}
            pageIdSelectorAttr={'data-page-id'}
          />
        </PopupContent>
      </div>
    </div>
  );
}

MediaMoreOptionsIcon.propTypes = {
  allowDownload: PropTypes.bool.isRequired,
};

MediaMoreOptionsIcon.defaultProps = {
  allowDownload: false,
};
