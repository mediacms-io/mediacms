import React, { useContext } from 'react';
import { LayoutContext } from '../contexts/';

export const useLayout = () => useContext(LayoutContext);
