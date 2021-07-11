import React from 'react';
import PropTypes from 'prop-types';

import { useUser } from '../../../utils/hooks/useUser';
import { CircleIconButton } from '../circle-icon-button/CircleIconButton.jsx';
import { MaterialIcon } from '../material-icon/MaterialIcon.jsx';

import './UserThumbnail.scss';

export function UserThumbnail(props) {
  const { thumbnail } = useUser();

  const attr = {
    'aria-label': 'Account profile photo that opens list of options and settings pages links',
    className: 'thumbnail',
  };

  if (props.isButton) {
    if (void 0 !== props.onClick) {
      attr.onClick = props.onClick;
    }
  } else {
    attr.type = 'span';
  }

  switch (props.size) {
    case 'small':
    case 'large':
      attr.className += ' ' + props.size + '-thumb';
      break;
  }

  return (
    <CircleIconButton {...attr}>
      {thumbnail ? <img src={thumbnail} alt="" /> : <MaterialIcon type="person" />}
    </CircleIconButton>
  );
}

UserThumbnail.propTypes = {
  isButton: PropTypes.bool,
  size: PropTypes.oneOf(['small', 'medium', 'large']),
  onClick: PropTypes.func,
};

UserThumbnail.defaultProps = {
  isButton: false,
  size: 'medium',
};
