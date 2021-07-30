import React, { useEffect } from 'react';
import { useTheme } from '../../../utils/hooks/';

export const SidebarThemeSwitcher: React.FC = () => {
  const { currentThemeMode, changeThemeMode, themeModeSwitcher } = useTheme();

  return (
    themeModeSwitcher.enabled &&
    'sidebar' === themeModeSwitcher.position && (
      <div className="sidebar-theme-switcher">
        <div className="sidebar-theme-switcher-inner">
          <span className={'theme-icon' + ('dark' === currentThemeMode ? '' : ' active')}>
            <i className="material-icons" data-icon="wb_sunny"></i>
          </span>
          <span>
            <span className="checkbox-switcher">
              <input type="checkbox" checked={'dark' === currentThemeMode} onChange={changeThemeMode} />
            </span>
          </span>
          <span className={'theme-icon' + ('dark' === currentThemeMode ? ' active' : '')}>
            <i className="material-icons" data-icon="brightness_3"></i>
          </span>
        </div>
      </div>
    )
  );
};
