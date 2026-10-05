import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { FiltersToggleButton } from '../../../src/static/js/components/_shared/filters-toggle-button/FiltersToggleButton';

describe('components/_shared', () => {
    describe('FiltersToggleButton', () => {
        test('Starts inactive by default and toggles active class on click', () => {
            const onClick = jest.fn();
            const { container, unmount } = renderIntoContainer(<FiltersToggleButton onClick={onClick} />);
            const button = container.querySelector('.mi-filters-toggle button') as HTMLButtonElement;
            expect(button.className).toBe('');
            expect(button.getAttribute('aria-label')).toBe('Filter');
            expect(button.querySelector('i[data-icon="filter_list"]')).not.toBeNull();
            expect(button.textContent).toBe('FILTERS');

            act(() => button.click());
            expect(button.className).toBe('active');
            act(() => button.click());
            expect(button.className).toBe('');
            expect(onClick).toHaveBeenCalledTimes(2);
            unmount();
        });

        test('Respects initial active prop and works without onClick', () => {
            const { container, unmount } = renderIntoContainer(<FiltersToggleButton active={true} />);
            const button = container.querySelector('button') as HTMLButtonElement;
            expect(button.className).toBe('active');
            act(() => button.click());
            expect(button.className).toBe('');
            unmount();
        });
    });
});
