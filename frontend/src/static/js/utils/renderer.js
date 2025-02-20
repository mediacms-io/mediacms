import React from 'react';
import ReactDOM from 'react-dom';
import { PageHeader, PageSidebar } from '../components/page-layout';
import { ThemeProvider } from './contexts/ThemeContext';
import { LayoutProvider } from './contexts/LayoutContext';
import { UserProvider } from './contexts/UserContext';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './stores/store';

const AppProviders = ({ children }) => (
  <ReduxProvider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <LayoutProvider>
        <ThemeProvider>
          <UserProvider>{children}</UserProvider>
        </ThemeProvider>
      </LayoutProvider>
    </PersistGate>
  </ReduxProvider>
);

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
