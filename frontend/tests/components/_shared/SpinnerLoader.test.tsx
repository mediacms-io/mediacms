import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { SpinnerLoader } from '../../../src/static/js/components/_shared/spinner-loader/SpinnerLoader';

describe('components/_shared', () => {
    describe('SpinnerLoader', () => {
        test('Uses medium size by default without a size modifier class', () => {
            const { container, unmount } = renderIntoContainer(<SpinnerLoader />);
            expect(container.firstElementChild?.className).toBe('spinner-loader');
            expect(container.querySelector('svg.circular circle.path')).not.toBeNull();
            unmount();
        });

        test.each(['tiny', 'x-small', 'small', 'large', 'x-large'])('Appends %s size class', (size) => {
            const { container, unmount } = renderIntoContainer(<SpinnerLoader size={size} />);
            expect(container.firstElementChild?.className).toBe('spinner-loader ' + size);
            unmount();
        });
    });
});
