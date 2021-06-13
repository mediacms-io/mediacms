import React, { useRef, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { usePopup } from '../../../utils/hooks/';
import { PageStore } from '../../../utils/stores/';
import { PopupMain } from '../../_shared';
import { MaterialIcon } from '../../_shared/material-icon/MaterialIcon.jsx';
import { ManageItemDate } from './ManageMediaItem';

function ManageItemName(props) {
  if (void 0 !== props.url) {
    if (null !== props.name && '' !== props.name) {
      return (
        <a href={props.url} title={props.name}>
          {props.name}
        </a>
      );
    }
  } else if (null !== props.name && '' !== props.name) {
    return props.name;
  }

  return <i className="non-available">N/A</i>;
}

function ManageItemUsername(props) {
  if (void 0 !== props.url) {
    if (null !== props.username && '' !== props.username) {
      return (
        <a href={props.url} title={props.username}>
          {props.username}
        </a>
      );
    }
  } else if (null !== props.username && '' !== props.username) {
    return props.username;
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
      <PopupTrigger contentRef={popupContentRef}>
        <button title={'Delete "' + props.name + '"'}>Delete</button>
      </PopupTrigger>

      <PopupContent contentRef={popupContentRef} showCallback={onPopupShow} hideCallback={onPopupHide}>
        <PopupMain>
          <div className="popup-message">
            <span className="popup-message-title">Member removal</span>
            <span className="popup-message-main">{'You\'re willing to remove member "' + props.name + '"'}?</span>
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

export function ManageUsersItem(props) {
  const actionsContainerRef = useRef(null);

  const [selected, setSelected] = useState(false);

  function onRowCheck() {
    setSelected(!selected);
  }

  function onClickProceed() {
    if ('function' === typeof props.onProceedRemoval) {
      props.onProceedRemoval(props.username);
    }
  }

  useEffect(() => {
    if ('function' === typeof props.onCheckRow) {
      props.onCheckRow(props.username, selected);
    }
  }, [selected]);

  useEffect(() => {
    setSelected(props.selectedRow);
  }, [props.selectedRow]);

  return (
    <div className="item manage-item manage-users-item">
      <div className="mi-checkbox">
        <input type="checkbox" checked={selected} onChange={onRowCheck} />
      </div>
      <div className="mi-name">
        <ManageItemName name={props.name} url={props.url} />
        <ManageItemCommentActions
          containerRef={actionsContainerRef}
          name={props.name || props.username}
          onProceed={onClickProceed}
        />
      </div>
      <div className="mi-username">
        <ManageItemUsername username={props.username} url={props.url} />
      </div>
      <div className="mi-added">
        <ManageItemDate date={props.add_date} />
      </div>
      {props.has_roles ? (
        <div className="mi-role">
          {void 0 === props.roles ? (
            <i className="non-available">N/A</i>
          ) : props.roles.length ? (
            props.roles.join('\n')
          ) : (
            '-'
          )}
        </div>
      ) : null}
      {props.has_verified ? (
        <div className="mi-verified">
          {void 0 === props.is_verified ? (
            <i className="non-available">N/A</i>
          ) : props.is_verified ? (
            <MaterialIcon type="check_circle" />
          ) : (
            '-'
          )}
        </div>
      ) : null}
      {props.has_trusted ? (
        <div className="mi-trusted">
          {void 0 === props.is_trusted ? (
            <i className="non-available">N/A</i>
          ) : props.is_trusted ? (
            <MaterialIcon type="check_circle" />
          ) : (
            '-'
          )}
        </div>
      ) : null}
      <div className="mi-featured">
        {void 0 === props.is_featured ? (
          <i className="non-available">N/A</i>
        ) : props.is_featured ? (
          <MaterialIcon type="check_circle" />
        ) : (
          '-'
        )}
      </div>
    </div>
  );
}

ManageUsersItem.propTypes = {
  thumbnail_url: PropTypes.string,
  name: PropTypes.string,
  url: PropTypes.string,
  username: PropTypes.string,
  add_date: PropTypes.string,
  is_featured: PropTypes.bool,
  onCheckRow: PropTypes.func,
  selectedRow: PropTypes.bool.isRequired,
  hideDeleteAction: PropTypes.bool.isRequired,
  has_roles: PropTypes.bool,
  has_verified: PropTypes.bool,
  has_trusted: PropTypes.bool,
  roles: PropTypes.array,
  is_verified: PropTypes.bool,
  is_trusted: PropTypes.bool,
};

ManageUsersItem.defaultProps = {
  has_roles: false,
  has_verified: false,
  has_trusted: false,
};
