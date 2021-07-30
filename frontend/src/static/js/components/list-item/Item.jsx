import React from 'react';
import PropTypes from 'prop-types';
import { PositiveIntegerOrZero } from '../../utils/helpers/';

export function Item(props) { }

Item.propTypes = {
  order: PositiveIntegerOrZero,
  title: PropTypes.string.isRequired,
  link: PropTypes.string.isRequired,
  singleLinkContent: PropTypes.bool.isRequired,
  description: PropTypes.string,
  meta_description: PropTypes.string,
  thumbnail: PropTypes.string,
  onMount: PropTypes.func,
  publish_date: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  editLink: PropTypes.string,
};

Item.defaultProps = {
  title: '',
  link: '#',
  singleLinkContent: false,
  description: '',
  meta_description: '',
  thumbnail: '',
  publish_date: 0,
};
