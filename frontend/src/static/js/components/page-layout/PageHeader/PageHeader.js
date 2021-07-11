import React, { useEffect } from 'react';
import { PageStore } from '../../../utils/stores/';
import { useUser, useLayout } from '../../../utils/hooks/';
import { addClassname } from '../../../utils/helpers/';
import { SearchField } from './SearchField';
import { HeaderRight } from './HeaderRight';
import { HeaderLeft } from './HeaderLeft';

import '../../../../css/styles.scss';
import './PageHeader.scss';
import '../PageMain.scss';

function Alerts() {
  function onClickAlertClose() {
    const alertElem = this.parentNode;

    addClassname(alertElem, 'hiding');

    setTimeout(
      function () {
        if (alertElem && alertElem.parentNode) {
          alertElem.parentNode.removeChild(alertElem);
        }
      }.bind(this),
      400
    );
  }

  setTimeout(
    function () {
      const closeBtn = document.querySelectorAll('.alert.alert-dismissible .close');

      let i;
      if (closeBtn.length) {
        i = 0;
        while (i < closeBtn.length) {
          closeBtn[i].addEventListener('click', onClickAlertClose);
          i += 1;
        }
      }
    }.bind(this),
    1000
  ); // TODO: Improve this.
}

function MediaUploader() {
  let uploaderWrap = document.querySelector('.media-uploader-wrap');

  if (uploaderWrap) {
    let preUploadMsgEl = document.createElement('div');

    preUploadMsgEl.setAttribute('class', 'pre-upload-msg');
    preUploadMsgEl.innerHTML = PageStore.get('config-contents').uploader.belowUploadArea;

    uploaderWrap.appendChild(preUploadMsgEl);
  }
}

export function PageHeader(props) {
  const { isAnonymous } = useUser();
  const { visibleMobileSearch } = useLayout();

  useEffect(() => {
    Alerts();

    if (void 0 === PageStore.get('current-page') || 'add-media' === PageStore.get('current-page')) {
      MediaUploader();
    }
  }, []);

  return (
    <header
      className={
        'page-header' + (visibleMobileSearch ? ' mobile-search-field' : '') + (isAnonymous ? ' anonymous-user' : '')
      }
    >
      <HeaderLeft />
      <SearchField />
      <HeaderRight />
    </header>
  );
}
