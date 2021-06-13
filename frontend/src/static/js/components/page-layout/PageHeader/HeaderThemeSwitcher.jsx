import React, { useRef } from 'react';
import { useTheme } from '../../../utils/hooks/';

import './ThemeSwitchOption.scss';

export function HeaderThemeSwitcher() {
  const { currentThemeMode, changeThemeMode } = useTheme();

  const inputRef = useRef(null);

  function onKeyPress(ev) {
    if (0 === ev.keyCode) {
      changeThemeMode();
    }
  }

  function onClick(ev) {
    if (ev.target !== inputRef.current) {
      changeThemeMode();
    }
  }

  function onChange(ev) {
    ev.stopPropagation();
    changeThemeMode();
  }

  return (
    <div className="theme-switch" tabIndex={0} onKeyPress={onKeyPress} onClick={onClick}>
      <span>Dark Theme</span>
      <span>
        <label className="checkbox-label right-selectbox">
          <span className="checkbox-switcher-wrap">
            <span className="checkbox-switcher">
              <input
                ref={inputRef}
                type="checkbox"
                tabIndex={-1}
                checked={'dark' === currentThemeMode}
                onChange={onChange}
              />
            </span>
          </span>
        </label>
      </span>
    </div>
  );
}
