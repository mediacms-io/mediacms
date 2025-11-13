import React, { useState, useEffect } from 'react';
import { usePopup } from '../../utils/hooks/';
import { SiteContext } from '../../utils/contexts/';
import { MediaPageStore } from '../../utils/stores/';
import { formatInnerLink } from '../../utils/helpers/';
import { CircleIconButton, MaterialIcon, NavigationContentApp, NavigationMenuList, PopupMain } from '../_shared/';
import { translateString } from '../../utils/helpers/';

function attachmentsList() {
  const media_data = MediaPageStore.get('media-data');
  const attachments = media_data.attachments || [];

  const optionsList = {};

  attachments.forEach((attachment) => {
    optionsList[attachment.id] = {
      text: `${attachment.name} (${attachment.file_size})`,
      link: formatInnerLink(attachment.file_url, SiteContext._currentValue.url),
      linkAttr: {
        target: '_blank',
        download: attachment.name,
      },
    };
  });

  return Object.values(optionsList);
}

function attachmentsOptionsPages() {
  return {
    main: (
      <div className="main-options">
        <PopupMain>
          <NavigationMenuList items={attachmentsList()} />
        </PopupMain>
      </div>
    ),
  };
}

export function AttachmentDownloadLink(props) {
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();
  const [attachmentsCurrentPage, setAttachmentsCurrentPage] = useState('main');
  const [hasAttachments, setHasAttachments] = useState(false);

  useEffect(() => {
    const checkAttachments = () => {
      const media_data = MediaPageStore.get('media-data');
      const attachments = media_data?.attachments || [];
      setHasAttachments(attachments.length > 0);
    };

    checkAttachments();

    // Listen for media data load event
    MediaPageStore.on('loaded_media_data', checkAttachments);

    return () => {
      MediaPageStore.removeListener('loaded_media_data', checkAttachments);
    };
  }, []);

  if (!hasAttachments) {
    return null;
  }

  return (
    <div className="video-attachments hidden-only-in-small">
      <PopupTrigger contentRef={popupContentRef}>
        <button style={{ display: 'flex', alignItems: 'center'}}>
          <CircleIconButton type="span">
            <MaterialIcon type="attach_file" />
          </CircleIconButton>
          <span>{translateString("ATTACHMENTS")}</span>
        </button>
      </PopupTrigger>

      <div className={'nav-page-' + attachmentsCurrentPage}>
        <PopupContent contentRef={popupContentRef}>
          <NavigationContentApp
            pageChangeCallback={null}
            initPage="main"
            focusFirstItemOnPageChange={false}
            pages={attachmentsOptionsPages()}
            pageChangeSelector={'.change-page'}
            pageIdSelectorAttr={'data-page-id'}
          />
        </PopupContent>
      </div>
    </div>
  );
}
