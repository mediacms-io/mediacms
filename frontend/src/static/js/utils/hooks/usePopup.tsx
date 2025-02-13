import { useRef } from 'react';
import { PopupContent } from '../../components/_shared/popup/PopupContent';
import { PopupTrigger } from '../../components/_shared/popup/PopupTrigger';

interface PopupRefMethods {
  tryToShow: () => void;
  tryToHide: () => void;
}

export function usePopup() {
  const popupContentRef = useRef<PopupRefMethods | null>(null);

  return [popupContentRef, PopupContent, PopupTrigger] as const;
}
