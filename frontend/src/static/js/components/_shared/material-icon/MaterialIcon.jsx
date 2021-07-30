import React from 'react';
import './MaterialIcon.scss';
export const MaterialIcon = ({ type }) => (type ? <i className="material-icons" data-icon={type}></i> : null);
