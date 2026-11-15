import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { click, findByText } from '../../_support/compD_dom';
import { PageStore } from '../../../src/static/js/utils/stores/';
import { SearchResultsFilters } from '../../../src/static/js/components/search-filters/SearchResultsFilters';
import { ProfileMediaSorting } from '../../../src/static/js/components/search-filters/ProfileMediaSorting';
import { ProfileMediaTags } from '../../../src/static/js/components/search-filters/ProfileMediaTags';
import { ProfileMediaSharing } from '../../../src/static/js/components/search-filters/ProfileMediaSharing';
import { ProfileMediaFilters } from '../../../src/static/js/components/search-filters/ProfileMediaFilters';
import { SearchMediaFiltersRow } from '../../../src/static/js/components/search-filters/SearchMediaFiltersRow';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());

const pageStore = PageStore as any;

function group(container: HTMLElement, title: string) {
    return Array.from(container.querySelectorAll('.mi-filter')).find((f) => f.querySelector('.mi-filter-title')?.textContent === title) as HTMLElement;
}

function active(el: HTMLElement) {
    return Array.from(el.querySelectorAll('.active span')).map((s) => s.textContent);
}

function pick(el: HTMLElement, label: string) {
    click(findByText(el, 'button', label));
}

describe('components/search-filters', () => {
    beforeEach(() => {
        pageStore.__reset();
    });

    describe('SearchResultsFilters', () => {
        test('Reports merged filter values and tracks the selection', () => {
            const onFiltersUpdate = jest.fn();
            const { container, unmount } = renderIntoContainer(<SearchResultsFilters onFiltersUpdate={onFiltersUpdate} />);
            expect(active(container)).toEqual(['All', 'All', 'Upload date (newest)']);
            pick(group(container, 'MEDIA TYPE'), 'Audio');
            expect(onFiltersUpdate).toHaveBeenLastCalledWith({ media_type: 'audio', upload_date: 'all', sort_by: 'date_added_desc' });
            pick(group(container, 'UPLOAD DATE'), 'This week');
            expect(onFiltersUpdate).toHaveBeenLastCalledWith({ media_type: 'audio', upload_date: 'this_week', sort_by: 'date_added_desc' });
            pick(group(container, 'SORT BY'), 'Like count');
            expect(onFiltersUpdate).toHaveBeenLastCalledWith({ media_type: 'audio', upload_date: 'this_week', sort_by: 'most_likes' });
            expect(active(container)).toEqual(['Audio', 'This week', 'Like count']);
            act(() => {
                pageStore.emit('window_resize');
            });
            expect((container.firstElementChild as HTMLElement).style.height).toBe('24px');
            unmount();
            expect(pageStore.listenerCount('window_resize')).toBe(0);
        });

        test('Applies hidden class', () => {
            const { container, unmount } = renderIntoContainer(<SearchResultsFilters hidden onFiltersUpdate={jest.fn()} />);
            expect(container.firstElementChild?.className).toBe('mi-filters-row hidden');
            unmount();
        });
    });

    describe('ProfileMediaSorting', () => {
        test('Selects a sort option and calls back', () => {
            const onSortSelect = jest.fn();
            const { container, unmount } = renderIntoContainer(<ProfileMediaSorting onSortSelect={onSortSelect} />);
            expect(container.querySelector('.mi-filter-title')?.textContent).toBe('SORT BY');
            expect(container.querySelectorAll('.mi-filter-options button').length).toBe(8);
            pick(container, 'Plays - Most');
            expect(onSortSelect).toHaveBeenCalledWith('plays_most');
            expect(active(container)).toEqual(['Plays - Most']);
            act(() => {
                pageStore.emit('window_resize');
            });
            unmount();
        });
    });

    describe('ProfileMediaTags', () => {
        test('Selects a tag and deselects it on second click', () => {
            const onTagSelect = jest.fn();
            const { container, unmount } = renderIntoContainer(<ProfileMediaTags tags={['news', 'art']} onTagSelect={onTagSelect} />);
            expect(Array.from(container.querySelectorAll('button span')).map((s) => s.textContent)).toEqual(['All', 'news', 'art']);
            pick(container, 'art');
            expect(onTagSelect).toHaveBeenLastCalledWith('art');
            expect(active(container)).toEqual(['art']);
            pick(container, 'art');
            expect(onTagSelect).toHaveBeenLastCalledWith('all');
            expect(active(container)).toEqual(['All']);
            act(() => {
                pageStore.emit('window_resize');
            });
            unmount();
        });
    });

    describe('ProfileMediaSharing', () => {
        const users = [{ username: 'ann', name: 'Ann' }];
        const groups = [{ name: 'Staff' }];

        test('Shows a placeholder when nothing is shared', () => {
            const { container, unmount } = renderIntoContainer(<ProfileMediaSharing onSharingSelect={jest.fn()} />);
            expect(container.querySelector('.mi-filter-title')?.textContent).toBe('NOT SHARED WITH ANYONE');
            act(() => {
                pageStore.emit('window_resize');
            });
            unmount();
        });

        test('Uses titles per mode', () => {
            const byMe = renderIntoContainer(<ProfileMediaSharing sharedUsers={users} sharedGroups={groups} onSharingSelect={jest.fn()} />);
            expect(Array.from(byMe.container.querySelectorAll('.mi-filter-title')).map((t) => t.textContent)).toEqual(['SHARED WITH USERS', 'SHARED WITH GROUPS']);
            byMe.unmount();
            const withMe = renderIntoContainer(<ProfileMediaSharing mode="shared_with_me" sharedUsers={users} sharedGroups={groups} onSharingSelect={jest.fn()} />);
            expect(Array.from(withMe.container.querySelectorAll('.mi-filter-title')).map((t) => t.textContent)).toEqual(['USERS SHARING', 'GROUPS SHARING']);
            withMe.unmount();
        });

        test('Selecting users and groups reports type and value and toggles off', () => {
            const onSharingSelect = jest.fn();
            const { container, rerender, unmount } = renderIntoContainer(
                <ProfileMediaSharing sharedUsers={users} sharedGroups={groups} onSharingSelect={onSharingSelect} />
            );
            expect(active(container)).toEqual(['All', 'All']);
            pick(group(container, 'SHARED WITH USERS'), 'Ann');
            expect(onSharingSelect).toHaveBeenLastCalledWith('user', 'ann');
            rerender(
                <ProfileMediaSharing sharedUsers={users} sharedGroups={groups} onSharingSelect={onSharingSelect} selectedSharingType="user" selectedSharingValue="ann" />
            );
            expect(active(container)).toEqual(['Ann', 'All']);
            pick(group(container, 'SHARED WITH USERS'), 'Ann');
            expect(onSharingSelect).toHaveBeenLastCalledWith(null, null);
            pick(group(container, 'SHARED WITH GROUPS'), 'Staff');
            expect(onSharingSelect).toHaveBeenLastCalledWith('group', 'Staff');
            pick(group(container, 'SHARED WITH GROUPS'), 'All');
            expect(onSharingSelect).toHaveBeenLastCalledWith(null, null);
            unmount();
        });
    });

    describe('ProfileMediaFilters', () => {
        test('Selecting toggles filters and includes sort and tag props', () => {
            const onFiltersUpdate = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <ProfileMediaFilters onFiltersUpdate={onFiltersUpdate} selectedSort="most_views" selectedTag="news" />
            );
            expect(Array.from(container.querySelectorAll('.mi-filter-title')).map((t) => t.textContent)).toEqual([
                'MEDIA TYPE',
                'UPLOAD DATE',
                'DURATION',
                'PUBLISH STATE',
            ]);
            const base = { media_type: 'all', upload_date: 'all', duration: 'all', publish_state: 'all', sort_by: 'most_views', tag: 'news' };
            pick(group(container, 'MEDIA TYPE'), 'Video');
            expect(onFiltersUpdate).toHaveBeenLastCalledWith({ ...base, media_type: 'video' });
            pick(group(container, 'MEDIA TYPE'), 'Video');
            expect(onFiltersUpdate).toHaveBeenLastCalledWith(base);
            pick(group(container, 'UPLOAD DATE'), 'Today');
            expect(onFiltersUpdate).toHaveBeenLastCalledWith({ ...base, upload_date: 'today' });
            pick(group(container, 'UPLOAD DATE'), 'Today');
            pick(group(container, 'DURATION'), '20 - 40 min');
            expect(onFiltersUpdate).toHaveBeenLastCalledWith({ ...base, duration: '20-40' });
            pick(group(container, 'DURATION'), '20 - 40 min');
            pick(group(container, 'PUBLISH STATE'), 'Shared');
            expect(onFiltersUpdate).toHaveBeenLastCalledWith({ ...base, publish_state: 'shared' });
            expect(active(container)).toEqual(['All', 'All', 'All', 'Shared']);
            pick(group(container, 'PUBLISH STATE'), 'Shared');
            expect(onFiltersUpdate).toHaveBeenLastCalledWith(base);
            act(() => {
                pageStore.emit('window_resize');
            });
            unmount();
        });

        test('Falls back to internal sort and tag defaults', () => {
            const onFiltersUpdate = jest.fn();
            const { container, unmount } = renderIntoContainer(<ProfileMediaFilters hidden onFiltersUpdate={onFiltersUpdate} />);
            expect(container.firstElementChild?.className).toBe('mi-filters-row hidden');
            pick(group(container, 'MEDIA TYPE'), 'Pdf');
            expect(onFiltersUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ sort_by: 'date_added_desc', tag: 'all', media_type: 'pdf' }));
            unmount();
        });
    });

    describe('SearchMediaFiltersRow', () => {
        function openAndPick(container: HTMLElement, index: number, label: string) {
            const filter = container.querySelectorAll('.media-filter')[index] as HTMLElement;
            click(filter.querySelector('.popup-trigger'));
            click(findByText(filter, '.media-filter-option button', label));
        }

        test('Reports default args on mount', () => {
            const onFiltersUpdate = jest.fn();
            const { container, unmount } = renderIntoContainer(<SearchMediaFiltersRow onFiltersUpdate={onFiltersUpdate} />);
            expect(onFiltersUpdate).toHaveBeenLastCalledWith({ sort_by: null, ordering: null, media_type: null });
            expect(container.querySelector('.media-type-filters .filter-button-label-text')?.textContent).toBe('All media types');
            unmount();
        });

        test('Type filter hides the selected option and updates its label', () => {
            const onFiltersUpdate = jest.fn();
            const { container, unmount } = renderIntoContainer(<SearchMediaFiltersRow onFiltersUpdate={onFiltersUpdate} />);
            const typeFilter = container.querySelector('.media-type-filters .media-filter') as HTMLElement;
            click(typeFilter.querySelector('.popup-trigger'));
            expect(Array.from(typeFilter.querySelectorAll('.media-filter-option button')).map((b) => b.textContent)).toEqual(['Video', 'Audio', 'Images', 'Pdf']);
            click(findByText(typeFilter, '.media-filter-option button', 'Images'));
            expect(onFiltersUpdate).toHaveBeenLastCalledWith({ sort_by: null, ordering: null, media_type: 'image' });
            expect(typeFilter.querySelector('.filter-button-label-text')?.textContent).toBe('Images');
            expect(typeFilter.querySelector('.media-filter-option-list')).toBeNull();
            unmount();
        });

        test.each([
            ['Video', 'View count', { media_type: 'video', sort_by: 'views', ordering: null }],
            ['Audio', 'Like count', { media_type: 'audio', sort_by: 'likes', ordering: null }],
            ['Pdf', 'Upload date (oldest)', { media_type: 'pdf', sort_by: null, ordering: 'asc' }],
        ])('Combines %s type with %s sorting', (type, sort, expected) => {
            const onFiltersUpdate = jest.fn();
            const { container, unmount } = renderIntoContainer(<SearchMediaFiltersRow onFiltersUpdate={onFiltersUpdate} />);
            openAndPick(container, 0, type);
            openAndPick(container, 1, sort);
            expect(onFiltersUpdate).toHaveBeenLastCalledWith(expected);
            const sortFilter = container.querySelectorAll('.media-filter')[1] as HTMLElement;
            click(sortFilter.querySelector('.popup-trigger'));
            expect(findByText(sortFilter, '.media-filter-option button', sort)?.className).toBe('active');
            unmount();
        });
    });
});
