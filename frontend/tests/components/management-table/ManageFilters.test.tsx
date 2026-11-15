import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { click, findByText } from '../../_support/compD_dom';
import { installMediaCMSGlobal } from '../../_support/mediacmsGlobal';
import { PageStore } from '../../../src/static/js/utils/stores/';
import { UserProvider } from '../../../src/static/js/utils/contexts/UserContext';
import { ManageMediaFilters } from '../../../src/static/js/components/management-table/ManageMediaFilters';
import { ManageUsersFilters } from '../../../src/static/js/components/management-table/ManageUsersFilters';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());

const pageStore = PageStore as any;

function filterGroup(container: HTMLElement, title: string) {
    return Array.from(container.querySelectorAll('.mi-filter')).find((f) => f.querySelector('.mi-filter-title')?.textContent === title) as HTMLElement;
}

function activeOption(group: HTMLElement) {
    return group.querySelector('.active span')?.textContent;
}

describe('components/management-table', () => {
    beforeEach(() => {
        pageStore.__reset();
    });

    describe('ManageMediaFilters', () => {
        test('Renders all filter groups with All selected', () => {
            const { container, unmount } = renderIntoContainer(<ManageMediaFilters onFiltersUpdate={jest.fn()} />);
            const titles = Array.from(container.querySelectorAll('.mi-filter-title')).map((t) => t.textContent);
            expect(titles).toEqual(['STATE', 'MEDIA TYPE', 'ENCODING STATUS', 'REVIEWED', 'FEATURED', 'CATEGORY']);
            titles.forEach((t) => expect(activeOption(filterGroup(container, t as string))).toBe('All'));
            expect(filterGroup(container, 'CATEGORY').querySelectorAll('button').length).toBe(1);
            expect(container.firstElementChild?.className).toBe('mi-filters-row');
            unmount();
        });

        test('Hidden prop adds the hidden class', () => {
            const { container, rerender, unmount } = renderIntoContainer(<ManageMediaFilters hidden onFiltersUpdate={jest.fn()} />);
            expect(container.firstElementChild?.className).toBe('mi-filters-row hidden');
            rerender(<ManageMediaFilters hidden={false} onFiltersUpdate={jest.fn()} />);
            expect(container.firstElementChild?.className).toBe('mi-filters-row');
            unmount();
        });

        test.each([
            ['STATE', 'Private', { state: 'private' }],
            ['MEDIA TYPE', 'Pdf', { media_type: 'pdf' }],
            ['ENCODING STATUS', 'Fail', { encoding_status: 'fail' }],
            ['REVIEWED', 'No', { is_reviewed: 'false' }],
            ['FEATURED', 'Yes', { featured: 'true' }],
        ])('Selecting %s %s reports merged filters', (group, option, changed) => {
            const onFiltersUpdate = jest.fn();
            const { container, unmount } = renderIntoContainer(<ManageMediaFilters onFiltersUpdate={onFiltersUpdate} />);
            click(findByText(filterGroup(container, group), 'button', option));
            expect(onFiltersUpdate).toHaveBeenCalledWith({
                state: 'all',
                media_type: 'all',
                encoding_status: 'all',
                featured: 'all',
                is_reviewed: 'all',
                category: 'all',
                ...changed,
            });
            expect(activeOption(filterGroup(container, group))).toBe(option);
            unmount();
        });

        test('Keeps previous selections when another filter changes', () => {
            const onFiltersUpdate = jest.fn();
            const { container, unmount } = renderIntoContainer(<ManageMediaFilters onFiltersUpdate={onFiltersUpdate} />);
            click(findByText(filterGroup(container, 'STATE'), 'button', 'Public'));
            click(findByText(filterGroup(container, 'MEDIA TYPE'), 'button', 'Video'));
            expect(onFiltersUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ state: 'public', media_type: 'video' }));
            unmount();
        });

        test('Subscribes to window resize while mounted', () => {
            const { unmount } = renderIntoContainer(<ManageMediaFilters onFiltersUpdate={jest.fn()} />);
            expect(pageStore.listenerCount('window_resize')).toBe(1);
            act(() => {
                pageStore.emit('window_resize');
            });
            unmount();
            expect(pageStore.listenerCount('window_resize')).toBe(0);
        });

        test('Reads categories from window.CATEGORIES at load time', () => {
            (window as any).CATEGORIES = [{ uid: 'c1', title: 'Science' }];
            jest.isolateModules(() => {
                const React_ = require('react');
                const { renderIntoContainer: isolatedRender, act: isolatedAct } = require('../../_support/render');
                const { ManageMediaFilters: Isolated } = require('../../../src/static/js/components/management-table/ManageMediaFilters');
                const onFiltersUpdate = jest.fn();
                const { container, unmount } = isolatedRender(React_.createElement(Isolated, { onFiltersUpdate }));
                const group = filterGroup(container, 'CATEGORY');
                expect(Array.from(group.querySelectorAll('button span')).map((s) => s.textContent)).toEqual(['All', 'Science']);
                isolatedAct(() => (findByText(group, 'button', 'Science') as HTMLElement).click());
                expect(onFiltersUpdate).toHaveBeenCalledWith(expect.objectContaining({ category: 'c1' }));
                unmount();
            });
            delete (window as any).CATEGORIES;
        });
    });

    describe('ManageUsersFilters', () => {
        test('Shows role filter only when users need no approval', () => {
            const onFiltersUpdate = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <UserProvider>
                    <ManageUsersFilters onFiltersUpdate={onFiltersUpdate} />
                </UserProvider>
            );
            expect(Array.from(container.querySelectorAll('.mi-filter-title')).map((t) => t.textContent)).toEqual(['ROLE']);
            click(findByText(container, 'button', 'Manager'));
            expect(onFiltersUpdate).toHaveBeenCalledWith({ role: 'manager', is_approved: 'all' });
            expect(activeOption(filterGroup(container, 'ROLE'))).toBe('Manager');
            unmount();
        });

        test('Shows approved filter when users need approval', () => {
            jest.isolateModules(() => {
                const previous = (window as any).MediaCMS;
                installMediaCMSGlobal({ user: { can: { usersNeedsToBeApproved: true } } });
                const { UserProvider: IsolatedProvider } = require('../../../src/static/js/utils/contexts/UserContext');
                const { ManageUsersFilters: IsolatedFilters } = require('../../../src/static/js/components/management-table/ManageUsersFilters');
                const React_ = require('react');
                const { renderIntoContainer: isolatedRender, act: isolatedAct } = require('../../_support/render');
                const isolatedClick = (el: Element | undefined) => isolatedAct(() => (el as HTMLElement).click());
                const onFiltersUpdate = jest.fn();
                const { container, unmount } = isolatedRender(
                    React_.createElement(IsolatedProvider, null, React_.createElement(IsolatedFilters, { onFiltersUpdate, hidden: true }))
                );
                expect(container.firstElementChild?.className).toBe('mi-filters-row hidden');
                isolatedClick(findByText(filterGroup(container, 'ROLE'), 'button', 'Editor'));
                isolatedClick(findByText(filterGroup(container, 'APPROVED'), 'button', 'No'));
                expect(onFiltersUpdate).toHaveBeenLastCalledWith({ role: 'editor', is_approved: 'false' });
                unmount();
                (window as any).MediaCMS = previous;
            });
        });
    });
});
