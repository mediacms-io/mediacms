import '../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../_support/render';
import { MediaMultiListWrapper } from '../../src/static/js/components/MediaMultiListWrapper';
import { MediaListRow } from '../../src/static/js/components/MediaListRow';
import { MediaListHeader } from '../../src/static/js/components/MediaListHeader';
import { MediaListWrapper } from '../../src/static/js/components/MediaListWrapper';

describe('components', () => {
    afterEach(() => {
        sessionStorage.clear();
        window.history.replaceState(null, '', '/');
    });

    describe('MediaMultiListWrapper', () => {
        test('Renders base class, extra class, style and children', () => {
            const { container, unmount } = renderIntoContainer(
                <MediaMultiListWrapper className="extra" style={{ color: 'red' }}>
                    <span className="child">x</span>
                </MediaMultiListWrapper>
            );
            const root = container.firstElementChild as HTMLElement;
            expect(root.className).toBe('extra media-list-wrapper');
            expect(root.style.color).toBe('red');
            expect(root.querySelector('.child')).not.toBeNull();
            unmount();
        });

        test('Renders empty wrapper without className or children', () => {
            const { container, unmount } = renderIntoContainer(<MediaMultiListWrapper />);
            expect(container.innerHTML).toBe('<div class="media-list-wrapper"></div>');
            unmount();
        });
    });

    describe('MediaListHeader', () => {
        test('Renders title and default view all link text', () => {
            const { container, unmount } = renderIntoContainer(<MediaListHeader title="Latest" viewAllLink="/latest" />);
            expect(container.querySelector('h2')?.textContent).toBe('Latest');
            const link = container.querySelector('h3 a') as HTMLAnchorElement;
            expect(link.getAttribute('href')).toBe('/latest');
            expect(link.title).toBe('VIEW ALL');
            expect(link.textContent?.trim()).toBe('VIEW ALL');
            unmount();
        });

        test('Uses custom view all text and class name', () => {
            const { container, unmount } = renderIntoContainer(
                <MediaListHeader title="T" className="c" viewAllLink="/x" viewAllText="More" />
            );
            expect(container.firstElementChild?.className).toBe('c media-list-header');
            expect(container.querySelector('h3 a')?.textContent?.trim()).toBe('More');
            unmount();
        });

        test('Omits view all link when no link is given', () => {
            const { container, unmount } = renderIntoContainer(<MediaListHeader title="T" />);
            expect(container.querySelector('h3')).toBeNull();
            unmount();
        });

        test('Omits view all link in LMS select media mode', () => {
            window.history.replaceState(null, '', '/?mode=lms_embed_mode&action=select_media');
            const { container, unmount } = renderIntoContainer(<MediaListHeader title="T" viewAllLink="/x" />);
            expect(container.querySelector('h3')).toBeNull();
            unmount();
        });
    });

    describe('MediaListRow', () => {
        test('Renders header only when title is given', () => {
            const withTitle = renderIntoContainer(
                <MediaListRow title="Row" className="r">
                    <i />
                </MediaListRow>
            );
            expect(withTitle.container.firstElementChild?.className).toBe('r media-list-row');
            expect(withTitle.container.querySelector('.media-list-header h2')?.textContent).toBe('Row');
            expect(withTitle.container.querySelector('i')).not.toBeNull();
            withTitle.unmount();

            const noTitle = renderIntoContainer(<MediaListRow />);
            expect(noTitle.container.querySelector('.media-list-header')).toBeNull();
            noTitle.unmount();
        });
    });

    describe('MediaListWrapper', () => {
        test('Renders children without bulk actions by default', () => {
            const { container, unmount } = renderIntoContainer(
                <MediaListWrapper title="List" className="w">
                    <p className="kid" />
                </MediaListWrapper>
            );
            expect(container.firstElementChild?.className).toBe('w media-list-wrapper');
            expect(container.querySelector('.bulk-actions-container')).toBeNull();
            expect(container.querySelector('.kid')).not.toBeNull();
            unmount();
        });

        test('Renders bulk actions and select all controls wired to callbacks', () => {
            const onSelectAll = jest.fn();
            const onBulkAction = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <MediaListWrapper showBulkActions selectedCount={0} totalCount={3} onSelectAll={onSelectAll} onBulkAction={onBulkAction} />
            );
            expect(container.querySelector('.bulk-actions-dropdown')).not.toBeNull();
            expect(container.querySelector('.add-media-button')).toBeNull();
            act(() => {
                (container.querySelector('.select-all-checkbox input') as HTMLInputElement).click();
            });
            expect(onSelectAll).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Renders add media popup with upload and record links', () => {
            const { container, unmount } = renderIntoContainer(<MediaListWrapper showBulkActions showAddMediaButton />);
            expect(container.querySelector('.add-media-button')).not.toBeNull();
            act(() => {
                (container.querySelector('.add-media-button button') as HTMLElement).click();
            });
            const hrefs = Array.from(container.querySelectorAll('.add-media-button a')).map((a) => a.getAttribute('href'));
            expect(hrefs).toEqual(['/upload', '/record_screen']);
            unmount();
        });
    });
});
