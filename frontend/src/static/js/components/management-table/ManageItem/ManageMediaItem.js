import React, { useRef, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { usePopup } from '../../../utils/hooks/usePopup';
import { formatManagementTableDate } from '../../../utils/helpers/';
import { PageStore } from '../../../utils/stores/';
import { PopupMain } from '../../_shared';
import { MaterialIcon } from '../../_shared/material-icon/MaterialIcon';

function ManageItemTitle(props) {
  if (void 0 !== props.title && void 0 !== props.url) {
    return (
      <a href={props.url} title={props.title}>
        {props.title}
      </a>
    );
  }

  if (void 0 !== props.title) {
    return props.title;
  }

  if (void 0 !== props.url) {
    return props.url;
  }

  return <i className="non-available">N/A</i>;
}

export function ManageItemDate(props) {
  if (void 0 !== props.date) {
    return formatManagementTableDate(new Date(Date.parse(props.date)));
  }

  return <i className="non-available">N/A</i>;
}

function ManageItemMediaAuthor(props) {
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

function ManageItemMediaActions(props) {
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
      <PopupTrigger contentRef={popupContentRef}>
        <button title={'Delete' + (void 0 !== props.title ? ' "' + props.title + '"' : '')}>Delete</button>
      </PopupTrigger>

      <PopupContent contentRef={popupContentRef} showCallback={onPopupShow} hideCallback={onPopupHide}>
        <PopupMain>
          <div className="popup-message">
            <span className="popup-message-title">Media removal</span>
            <span className="popup-message-main">
              {"You're willing to remove media" + (void 0 !== props.title ? ' "' + props.title + '"' : '')}?
            </span>
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

export function ManageMediaItem(props) {
  const actionsContainerRef = useRef(null);

  const [selected, setSelected] = useState(false);

  function onRowCheck() {
    setSelected(!selected);
  }

  function onClickProceed() {
    if ('function' === typeof props.onProceedRemoval) {
      props.onProceedRemoval(props.token);
    }
  }

  useEffect(() => {
    if ('function' === typeof props.onCheckRow) {
      props.onCheckRow(props.token, selected);
    }
  }, [selected]);

  useEffect(() => {
    setSelected(props.selectedRow);
  }, [props.selectedRow]);

  return (
    <div className="item manage-item manage-media-item">
      <div className="mi-checkbox">
        <input type="checkbox" checked={selected} onChange={onRowCheck} />
      </div>
      <div className="mi-title">
        <ManageItemTitle title={props.title} url={props.url} />
        {props.hideDeleteAction ? null : (
          <ManageItemMediaActions containerRef={actionsContainerRef} title={props.title} onProceed={onClickProceed} />
        )}
      </div>
      <div className="mi-added">
        <ManageItemDate date={props.add_date} />
      </div>
      <div className="mi-author">
        <ManageItemMediaAuthor name={props.author_name} url={props.author_url} />
      </div>
      <div className="mi-type">
        {void 0 === props.media_type ? <i className="non-available">N/A</i> : props.media_type}
      </div>
      <div className="mi-encoding">
        {void 0 === props.encoding_status ? <i className="non-available">N/A</i> : props.encoding_status}
      </div>
      <div className="mi-state">{void 0 === props.state ? <i className="non-available">N/A</i> : props.state}</div>
      <div className="mi-reviewed">
        {void 0 === props.is_reviewed ? (
          <i className="non-available">N/A</i>
        ) : props.is_reviewed ? (
          <MaterialIcon type="check_circle" />
        ) : (
          <MaterialIcon type="cancel" />
        )}
      </div>
      <div className="mi-featured">
        {void 0 === props.featured ? (
          <i className="non-available">N/A</i>
        ) : props.featured ? (
          <MaterialIcon type="check_circle" />
        ) : (
          '-'
        )}
      </div>
      <div className="mi-reported">
        {void 0 === props.reported_times ? (
          <i className="non-available">N/A</i>
        ) : 0 === props.reported_times ? (
          <span>-</span>
        ) : (
          <span className="reported-number">
            {props.reported_times} {'time' + (1 < props.reported_times ? 's' : '')}
          </span>
        )}
      </div>
    </div>
  );
}

ManageMediaItem.propTypes = {
  thumbnail_url: PropTypes.string,
  token: PropTypes.string,
  title: PropTypes.string,
  url: PropTypes.string,
  author_name: PropTypes.string,
  author_url: PropTypes.string,
  add_date: PropTypes.string,
  media_type: PropTypes.string,
  encoding_status: PropTypes.string,
  state: PropTypes.string,
  is_reviewed: PropTypes.bool,
  featured: PropTypes.bool,
  reported_times: PropTypes.number,
  onCheckRow: PropTypes.func,
  selectedRow: PropTypes.bool.isRequired,
  hideDeleteAction: PropTypes.bool.isRequired,
};
