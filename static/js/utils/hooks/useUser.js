import React, { useContext } from 'react';
import UserContext from '../contexts/UserContext';

export const useUser = () => useContext(UserContext);
