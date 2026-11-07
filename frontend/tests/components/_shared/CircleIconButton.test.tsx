import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { CircleIconButton } from '../../../src/static/js/components/_shared/circle-icon-button/CircleIconButton';

describe('components/_shared', () => {
    describe('CircleIconButton', () => {
        test('Renders a button by default wrapping children in two spans', () => {
            const onClick = jest.fn();
            const { container, unmount } = renderIntoContainer(<CircleIconButton onClick={onClick}>X</CircleIconButton>);
            const button = container.querySelector('button') as HTMLButtonElement;
            expect(button.className).toBe('circle-icon-button');
            expect(button.querySelector('span > span')?.textContent).toBe('X');
            expect(button.hasAttribute('title')).toBe(false);
            expect(button.hasAttribute('tabindex')).toBe(false);
            button.click();
            expect(onClick).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Applies className, shadow, title, tabIndex and data/aria attributes', () => {
            const { container, unmount } = renderIntoContainer(
                <CircleIconButton
                    className="extra"
                    buttonShadow={true}
                    title="Hello"
                    tabIndex={3}
                    data-page-id="page-1"
                    aria-label="Label"
                />
            );
            const button = container.querySelector('button') as HTMLButtonElement;
            expect(button.className).toBe('circle-icon-button extra button-shadow');
            expect(button.getAttribute('title')).toBe('Hello');
            expect(button.getAttribute('tabindex')).toBe('3');
            expect(button.getAttribute('data-page-id')).toBe('page-1');
            expect(button.getAttribute('aria-label')).toBe('Label');
            unmount();
        });

        test('Renders an anchor with href and rel for link type', () => {
            const { container, unmount } = renderIntoContainer(
                <CircleIconButton type="link" href="/somewhere" rel="nofollow" />
            );
            const link = container.querySelector('a') as HTMLAnchorElement;
            expect(link.getAttribute('href')).toBe('/somewhere');
            expect(link.getAttribute('rel')).toBe('nofollow');
            expect(container.querySelector('button')).toBeNull();
            unmount();
        });

        test('Renders a clickable span for span type', () => {
            const onClick = jest.fn();
            const { container, unmount } = renderIntoContainer(<CircleIconButton type="span" onClick={onClick} />);
            const span = container.firstElementChild as HTMLSpanElement;
            expect(span.tagName).toBe('SPAN');
            expect(span.className).toBe('circle-icon-button');
            span.click();
            expect(onClick).toHaveBeenCalledTimes(1);
            unmount();
        });
    });
});
