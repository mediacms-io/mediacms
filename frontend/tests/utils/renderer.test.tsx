import React, { act } from 'react';

jest.mock('../../src/static/js/components/page-layout', () => {
    const React = jest.requireActual('react');
    return {
        PageHeader: () => React.createElement('header', { id: 'mock-header' }, 'header'),
        PageSidebar: () => React.createElement('nav', { id: 'mock-sidebar' }, 'sidebar'),
    };
});

jest.mock('../../src/static/js/utils/contexts/ThemeContext', () => ({
    ThemeProvider: ({ children }: any) => children,
}));
jest.mock('../../src/static/js/utils/contexts/LayoutContext', () => ({
    LayoutProvider: ({ children }: any) => children,
}));
jest.mock('../../src/static/js/utils/contexts/UserContext', () => ({
    UserProvider: ({ children }: any) => children,
}));

jest.mock('../../src/static/js/utils/helpers', () => ({ inEmbeddedApp: jest.fn(() => false) }));

import { renderEmbedPage, renderPage } from '../../src/static/js/utils/renderer';
import { inEmbeddedApp } from '../../src/static/js/utils/helpers';

const Page = () => <main id="mock-page">page</main>;

function addContainer(id: string) {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
    return el;
}

describe('utils', () => {
    describe('renderer', () => {
        afterEach(() => {
            const ids = ['page-content', 'embed-content', 'app-sidebar', 'app-header'];
            ids.map((id) => document.getElementById(id)).forEach((el) => {
                if (!el) {
                    return;
                }
                el.remove();
            });
            document.body.className = '';
            (inEmbeddedApp as jest.Mock).mockReturnValue(false);
        });

        describe('renderPage', () => {
            test('Renders page with header and sidebar portals', () => {
                const content = addContainer('page-content');
                const header = addContainer('app-header');
                const sidebar = addContainer('app-sidebar');

                act(() => renderPage('page-content', Page));

                expect(content.querySelector('#mock-page')).not.toBeNull();
                expect(header.querySelector('#mock-header')).not.toBeNull();
                expect(sidebar.querySelector('#mock-sidebar')).not.toBeNull();
            });

            test('Renders page without header and sidebar containers', () => {
                const content = addContainer('page-content');
                act(() => renderPage('page-content', Page));
                expect(content.querySelector('#mock-page')).not.toBeNull();
                expect(document.querySelector('#mock-header')).toBeNull();
            });

            test('Renders header portal and sidebar when there is no page component', () => {
                const header = addContainer('app-header');
                const sidebar = addContainer('app-sidebar');

                act(() => renderPage(undefined as any, undefined as any));

                expect(header.querySelector('#mock-header')).not.toBeNull();
                expect(sidebar.querySelector('#mock-sidebar')).not.toBeNull();
            });

            test('Renders only the header when there is no sidebar or page', () => {
                const header = addContainer('app-header');
                act(() => renderPage('missing', Page));
                expect(header.querySelector('#mock-header')).not.toBeNull();
                expect(document.querySelector('#mock-page')).toBeNull();
            });

            test('The page is in the DOM as soon as renderPage returns', () => {
                (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
                try {
                    const content = addContainer('page-content');
                    const header = addContainer('app-header');
                    renderPage('page-content', Page);
                    expect(content.querySelector('#mock-page')).not.toBeNull();
                    expect(header.querySelector('#mock-header')).not.toBeNull();
                } finally {
                    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
                }
            });

            test('Rendering into the same container again reuses its root without warnings', () => {
                const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
                const content = addContainer('page-content');
                act(() => renderPage('page-content', Page));
                act(() => renderPage('page-content', Page));
                expect(content.querySelectorAll('#mock-page')).toHaveLength(1);
                expect(errors).not.toHaveBeenCalled();
                errors.mockRestore();
            });

            test('Renders only the sidebar when header is missing', () => {
                const sidebar = addContainer('app-sidebar');
                act(() => renderPage('missing', Page));
                expect(sidebar.querySelector('#mock-sidebar')).not.toBeNull();
                expect(document.querySelector('#mock-page')).toBeNull();
            });

            test('Renders nothing without any containers', () => {
                act(() => renderPage('missing', Page));
                expect(document.querySelector('#mock-page')).toBeNull();
            });

            test('In embedded app renders only the page and updates body classes', () => {
                (inEmbeddedApp as jest.Mock).mockReturnValue(true);
                document.body.classList.add('visible-sidebar');
                const content = addContainer('page-content');
                const header = addContainer('app-header');

                act(() => renderPage('page-content', Page));

                expect(document.body.classList.contains('embedded-app')).toBe(true);
                expect(document.body.classList.contains('visible-sidebar')).toBe(false);
                expect(content.querySelector('#mock-page')).not.toBeNull();
                expect(header.querySelector('#mock-header')).toBeNull();
            });

            test('In embedded app skips rendering without a container', () => {
                (inEmbeddedApp as jest.Mock).mockReturnValue(true);
                act(() => renderPage('missing', Page));
                expect(document.body.classList.contains('embedded-app')).toBe(true);
                expect(document.querySelector('#mock-page')).toBeNull();
            });
        });

        describe('renderEmbedPage', () => {
            test('Renders the page component without providers', () => {
                const content = addContainer('embed-content');
                act(() => renderEmbedPage('embed-content', Page));
                expect(content.querySelector('#mock-page')).not.toBeNull();
            });

            test('Does nothing without container or component', () => {
                addContainer('embed-content');
                act(() => renderEmbedPage('missing', Page));
                act(() => renderEmbedPage('embed-content', undefined as any));
                expect(document.querySelector('#mock-page')).toBeNull();
            });
        });
    });
});
