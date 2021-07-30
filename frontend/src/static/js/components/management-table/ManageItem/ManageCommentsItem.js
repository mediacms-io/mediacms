import React, { useRef, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { usePopup } from '../../../utils/hooks/';
import { PageStore } from '../../../utils/stores/';
import { PopupMain } from '../../_shared';
import { ManageItemDate } from './ManageMediaItem';

function ManageItemCommentAuthor(props) {
  if (void 0 !== props.name && void 0 !== props.url) {
    return (
      <a href={props.url} title={props.name}>
        {props.name}
      </a>
    );
  }

  if (void 0 !== props.name) {
    return props.name;
  }

  if (void 0 !== props.url) {
    return props.url;
  }

  return <i className="non-available">N/A</i>;
}

function ManageItemCommentActions(props) {
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();
  const [isOpenPopup, setIsOpenPopup] = useState(false);

  function onPopupShow() {
    setIsOpenPopup(true);
  }

  function onPopupHide() {
    setIsOpenPopup(false);
  }

  function onCancel() {
    popupContentRef.current.tryToHide();
    if ('function' === typeof props.onCancel) {
      props.onCancel();
    }
  }

  function onProceed() {
    popupContentRef.current.tryToHide();
    if ('function' === typeof props.onProceed) {
      props.onProceed();
    }
  }

  const positionState = { updating: false, pending: 0 };

  const onWindowResize = useCallback(function () {
    if (positionState.updating) {
      positionState.pending = positionState.pending + 1;
    } else {
      positionState.updating = true;

      const popupElem = props.containerRef.current.querySelector('.popup');

      if (popupElem) {
        const containerClientRect = props.containerRef.current.getBoundingClientRect();

        popupElem.style.position = 'fixed';
        popupElem.style.left = containerClientRect.x + 'px';

        if (document.body.offsetHeight < 32 + popupElem.offsetHeight + window.scrollY + containerClientRect.top) {
          popupElem.style.top = containerClientRect.y - popupElem.offsetHeight + 'px';
        } else {
          popupElem.style.top = containerClientRect.y + containerClientRect.height + 'px';
        }
      }

      setTimeout(() => {
        positionState.updating = false;

        if (positionState.pending) {
          positionState.pending = 0;
          onWindowResize();
        }
      }, 8);
    }
  }, []);

  useEffect(() => {
    if (isOpenPopup) {
      PageStore.on('window_scroll', onWindowResize);
      PageStore.on('window_resize', onWindowResize);
      onWindowResize();
    } else {
      PageStore.removeListener('window_scroll', onWindowResize);
      PageStore.removeListener('window_resize', onWindowResize);
    }
  }, [isOpenPopup]);

  return (
    <div ref={props.containerRef} className="actions">
      {void 0 === props.media_url ? null : (
        <span>
          <a href={props.media_url}>View media</a>
        </span>
      )}
      {void 0 === props.media_url || props.hideDeleteAction ? null : <span className="seperator">|</span>}

      <PopupTrigger contentRef={popupContentRef}>
        <button title="Delete comment">Delete</button>
      </PopupTrigger>

      <PopupContent contentRef={popupContentRef} showCallback={onPopupShow} hideCallback={onPopupHide}>
        <PopupMain>
          <div className="popup-message">
            <span className="popup-message-title">Comment removal</span>
            <span className="popup-message-main">You're willing to remove comment?</span>
          </div>
          <hr />
          <span className="popup-message-bottom">
            <button className="button-link cancel-profile-removal" onClick={onCancel}>
              CANCEL
            </button>
            <button className="button-link proceed-profile-removal" onClick={onProceed}>
              PROCEED
            </button>
          </span>
        </PopupMain>
      </PopupContent>
    </div>
  );
}

export function ManageCommentsItem(props) {
  const actionsContainerRef = useRef(null);

  const [selected, setSelected] = useState(false);

  function onRowCheck() {
    setSelected(!selected);
  }

  function onClickProceed() {
    if ('function' === typeof props.onProceedRemoval) {
      props.onProceedRemoval(props.uid);
    }
  }

  useEffect(() => {
    if ('function' === typeof props.onCheckRow) {
      props.onCheckRow(props.uid, selected);
    }
  }, [selected]);

  useEffect(() => {
    setSelected(props.selectedRow);
  }, [props.selectedRow]);

  return (
    <div className="item manage-item manage-comments-item">
      <div className="mi-checkbox">
        <input type="checkbox" checked={selected} onChange={onRowCheck} />
      </div>
      <div className="mi-author">
        <ManageItemCommentAuthor name={props.author_name} url={props.author_url} />
      </div>
      <div className="mi-comment">
        {void 0 === props.text ? <i className="non-available">N/A</i> : props.text}
        {void 0 === props.text || (void 0 === props.media_url && props.hideDeleteAction) ? null : (
          <ManageItemCommentActions
            containerRef={actionsContainerRef}
            title={props.title}
            onProceed={onClickProceed}
            media_url={props.media_url}
            hideDeleteAction={props.hideDeleteAction}
          />
        )}
      </div>
      <div className="mi-added">
        <ManageItemDate date={props.add_date} />
      </div>
    </div>
  );
}

ManageCommentsItem.propTypes = {
  author_name: PropTypes.string,
  author_url: PropTypes.string,
  author_thumbnail_url: PropTypes.string,
  add_date: PropTypes.string,
  text: PropTypes.string,
  selectedRow: PropTypes.bool.isRequired,
  hideDeleteAction: PropTypes.bool.isRequired,
  uid: PropTypes.string.isRequired,
};
