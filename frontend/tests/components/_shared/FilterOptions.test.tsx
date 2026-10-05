import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { FilterOptions } from '../../../src/static/js/components/_shared/filter-options/FilterOptions';

describe('components/_shared', () => {
    describe('FilterOptions', () => {
        const options = [
            { id: 'all', title: 'All' },
            { id: 'video', title: 'Video' },
            { id: 'audio', title: 'Audio' },
        ];

        test('Renders one entry per option and marks the selected one', () => {
            const { container, unmount } = renderIntoContainer(
                <FilterOptions id="media_type" options={options} selected="video" onSelect={jest.fn()} />
            );
            const entries = container.querySelectorAll(':scope > div');
            expect(entries).toHaveLength(3);
            expect(Array.from(entries).map((e) => e.className)).toStrictEqual(['', 'active', '']);
            expect(Array.from(entries).map((e) => e.textContent)).toStrictEqual(['All', 'Video', 'Audio']);
            expect(entries[1].querySelector('i[data-icon="close"]')).not.toBeNull();
            expect(entries[0].querySelector('i')).toBeNull();
            unmount();
        });

        test('Passes filter id and option value on the button and calls onSelect on click', () => {
            const selectedValues: string[] = [];
            const onSelect = jest.fn((ev: any) => selectedValues.push(ev.currentTarget.value));
            const { container, unmount } = renderIntoContainer(
                <FilterOptions id="media_type" options={options} selected="all" onSelect={onSelect} />
            );
            const button = container.querySelectorAll('button')[2];
            expect(button.getAttribute('filter')).toBe('media_type');
            expect(button.getAttribute('value')).toBe('audio');
            button.click();
            expect(onSelect).toHaveBeenCalledTimes(1);
            expect(selectedValues).toStrictEqual(['audio']);
            unmount();
        });
    });
});
