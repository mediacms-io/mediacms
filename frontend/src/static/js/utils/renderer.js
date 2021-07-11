import React from 'react';
import ReactDOM from 'react-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { UserProvider } from './contexts/UserContext';

const AppProviders = ({ children }) => (
  <LayoutProvider>
    <ThemeProvider>
      <UserProvider>{children}</UserProvider>
    </ThemeProvider>
  </LayoutProvider>
);

import { PageHeader, PageSidebar } from '../components/page-layout';

export function renderPage(idSelector, PageComponent) {
  const appHeader = document.getElementById('app-header');
  const appSidebar = document.getElementById('app-sidebar');
  const appContent = idSelector ? document.getElementById(idSelector) : undefined;

  if (appContent && PageComponent) {
    ReactDOM.render(
      <AppProviders>
        {appHeader ? ReactDOM.createPortal(<PageHeader />, appHeader) : null}
        {appSidebar ? ReactDOM.createPortal(<PageSidebar />, appSidebar) : null}
        <PageComponent />
      </AppProviders>,
      appContent
    );
  } else if (appHeader && appSidebar) {
    ReactDOM.render(
      <AppProviders>
        {ReactDOM.createPortal(<PageHeader />, appHeader)}
        <PageSidebar />
      </AppProviders>,
      appSidebar
    );
  } else if (appHeader) {
    ReactDOM.render(
      <LayoutProvider>
        <ThemeProvider>
          <UserProvider>
            <PageHeader />
          </UserProvider>
        </ThemeProvider>
      </LayoutProvider>,
      appSidebar
    );
  } else if (appSidebar) {
    ReactDOM.render(
      <AppProviders>
        <PageSidebar />
      </AppProviders>,
      appSidebar
    );
  }
}

export function renderEmbedPage(idSelector, PageComponent) {
  const appContent = idSelector ? document.getElementById(idSelector) : undefined;

  if (appContent && PageComponent) {
    ReactDOM.render(<PageComponent />, appContent);
  }
}
