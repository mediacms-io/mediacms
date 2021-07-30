import React, { useRef, useState } from 'react';
import { usePopup } from './usePopup';

export function useMediaFilter(initialValue) {
  const containerRef = useRef(null);
  const [value, setValue] = useState(initialValue);
  const [popupContentRef, PopupContent, PopupTrigger] = usePopup();
  return [containerRef, value, setValue, popupContentRef, PopupContent, PopupTrigger];
}
