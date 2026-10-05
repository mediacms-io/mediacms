import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { MaterialIcon } from '../../../src/static/js/components/_shared/material-icon/MaterialIcon';

describe('components/_shared', () => {
    describe('MaterialIcon', () => {
        test('Renders an icon element with data-icon attribute', () => {
            const { container, unmount } = renderIntoContainer(<MaterialIcon type="close" />);
            const icon = container.querySelector('i') as HTMLElement;
            expect(icon.className).toBe('material-icons');
            expect(icon.getAttribute('data-icon')).toBe('close');
            unmount();
        });

        test('Renders nothing without a type', () => {
            const { container, unmount } = renderIntoContainer(<MaterialIcon type="" />);
            expect(container.innerHTML).toBe('');
            unmount();
        });
    });
});
