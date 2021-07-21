import React, { useRef } from 'react';
import { PopupContent } from '../../components/_shared/popup/PopupContent.jsx';
import { PopupTrigger } from '../../components/_shared/popup/PopupTrigger.jsx';

export function usePopup() {
  const popupContentRef = useRef(null);

  return [popupContentRef, PopupContent, PopupTrigger];
}
