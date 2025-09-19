import React, { useRef, useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { usePopup, useUser } from '../../../utils/hooks/';
import { PageStore } from '../../../utils/stores/';
import { csrfToken } from '../../../utils/helpers/';
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

function ManageUsersItemActions(props) {
  const { userCan } = useUser();
  const [deletePopupRef, DeletePopupContent, DeletePopupTrigger] = usePopup();
  const [passwordPopupRef, PasswordPopupContent, PasswordPopupTrigger] = usePopup();
  const [approvePopupRef, ApprovePopupContent, ApprovePopupTrigger] = usePopup();

  const [newPassword, setNewPassword] = useState('');

  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const [isPasswordOpen, setPasswordOpen] = useState(false);
  const [isApproveOpen, setApproveOpen] = useState(false);

  function onProceedDelete() {
    deletePopupRef.current.tryToHide();
    if ('function' === typeof props.onProceed) {
      props.onProceed();
    }
  }
  function onCancelDelete() {
    deletePopupRef.current.tryToHide();
  }

  function handlePasswordChangeSubmit(e) {
    e.preventDefault();
    props.setMessage({ type: '', text: '' });

    const formData = new FormData();
    formData.append('action', 'change_password');
    formData.append('password', newPassword);

    fetch(`/api/v1/users/${props.username}`, {
      method: 'PUT',
      body: formData,
      headers: { 'X-CSRFToken': csrfToken() },
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        return res.json().then((data) => {
          throw new Error(data.detail || 'Failed to change password.');
        });
      })
      .then(() => {
        sessionStorage.setItem('user-management-message', JSON.stringify({ type: 'success', text: 'Password changed successfully.' }));
        window.location.reload();
      })
      .catch((err) => {
        props.setMessage({ type: 'error', text: err.message });
      });
  }

  function handleApproveUser() {
    props.setMessage({ type: '', text: '' });
    const formData = new FormData();
    formData.append('action', 'approve_user');

    fetch(`/api/v1/users/${props.username}`, {
      method: 'PUT',
      body: formData,
      headers: { 'X-CSRFToken': csrfToken() },
    })
      .then((res) => {
        if (res.ok) {
          return res.json();
        }
        return res.json().then((data) => {
          throw new Error(data.detail || 'Failed to approve user.');
        });
      })
      .then(() => {
        sessionStorage.setItem('user-management-message', JSON.stringify({ type: 'success', text: 'User approved successfully.' }));
        window.location.reload();
      })
      .catch((err) => {
        props.setMessage({ type: 'error', text: err.message });
      });
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

  const isOpenPopup = isDeleteOpen || isPasswordOpen || isApproveOpen;

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
      <PasswordPopupTrigger contentRef={passwordPopupRef}>
        <button>Change password</button>
      </PasswordPopupTrigger>
      {userCan.usersNeedsToBeApproved && !props.is_approved && (
        <>
          <span className="seperator">|</span>
          <ApprovePopupTrigger contentRef={approvePopupRef}>
            <button>Approve</button>
          </ApprovePopupTrigger>
        </>
      )}
      <span className="seperator">|</span>
      <DeletePopupTrigger contentRef={deletePopupRef}>
        <button title={'Delete "' + props.name + '"'}>Delete</button>
      </DeletePopupTrigger>

      <PasswordPopupContent
        contentRef={passwordPopupRef}
        showCallback={() => setPasswordOpen(true)}
        hideCallback={() => {
          setPasswordOpen(false);
          props.setMessage({ type: '', text: '' });
        }}
      >
        <PopupMain>
          <form onSubmit={handlePasswordChangeSubmit}>
            <div className="popup-message">
              <span className="popup-message-title">Change Password for {props.name}</span>
              <span className="popup-message-main">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New Password"
                  required
                  style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                />
              </span>
            </div>
            <hr />
            <span className="popup-message-bottom">
              <button
                type="button"
                className="button-link cancel-profile-removal"
                onClick={() => passwordPopupRef.current.tryToHide()}
              >
                CANCEL
              </button>
              <button type="submit" className="button-link proceed-profile-removal">
                SUBMIT
              </button>
            </span>
          </form>
        </PopupMain>
      </PasswordPopupContent>

      <ApprovePopupContent
        contentRef={approvePopupRef}
        showCallback={() => setApproveOpen(true)}
        hideCallback={() => {
          setApproveOpen(false);
          props.setMessage({ type: '', text: '' });
        }}
      >
        <PopupMain>
          <div className="popup-message">
            <span className="popup-message-title">Approve User</span>
            <span className="popup-message-main">
              {'Are you sure you want to approve "' + props.name + '"?'}
            </span>
          </div>
          <hr />
          <span className="popup-message-bottom">
            <button className="button-link cancel-profile-removal" onClick={() => approvePopupRef.current.tryToHide()}>
              CANCEL
            </button>
            <button className="button-link proceed-profile-removal" onClick={handleApproveUser}>
              PROCEED
            </button>
          </span>
        </PopupMain>
      </ApprovePopupContent>

      <DeletePopupContent
        contentRef={deletePopupRef}
        showCallback={() => setDeleteOpen(true)}
        hideCallback={() => setDeleteOpen(false)}
      >
        <PopupMain>
          <div className="popup-message">
            <span className="popup-message-title">Member removal</span>
            <span className="popup-message-main">{'You\'re willing to remove member "' + props.name + '"'}?</span>
          </div>
          <hr />
          <span className="popup-message-bottom">
            <button className="button-link cancel-profile-removal" onClick={onCancelDelete}>
              CANCEL
            </button>
            <button className="button-link proceed-profile-removal" onClick={onProceedDelete}>
              PROCEED
            </button>
          </span>
        </PopupMain>
      </DeletePopupContent>
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
        <ManageUsersItemActions
          containerRef={actionsContainerRef}
          name={props.name || props.username}
          username={props.username}
          is_approved={props.is_approved}
          onProceed={onClickProceed}
          onUserUpdate={props.onUserUpdate}
          setMessage={props.setMessage}
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
      {props.has_approved ? (
        <div className="mi-approved">
          {void 0 === props.is_approved || props.is_approved === null ? (
            <i className="non-available">N/A</i>
          ) : props.is_approved ? (
            <MaterialIcon type="check_circle" />
          ) : (
            <MaterialIcon type="cancel" />
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
  onUserUpdate: PropTypes.func,
  setMessage: PropTypes.func,
  selectedRow: PropTypes.bool.isRequired,
  hideDeleteAction: PropTypes.bool.isRequired,
  has_roles: PropTypes.bool,
  has_verified: PropTypes.bool,
  has_trusted: PropTypes.bool,
  has_approved: PropTypes.bool,
  roles: PropTypes.array,
  is_verified: PropTypes.bool,
  is_trusted: PropTypes.bool,
  is_approved: PropTypes.bool,
};

ManageUsersItem.defaultProps = {
  has_roles: false,
  has_verified: false,
  has_trusted: false,
  has_approved: false,
  onUserUpdate: () => {},
  setMessage: () => {},
};
