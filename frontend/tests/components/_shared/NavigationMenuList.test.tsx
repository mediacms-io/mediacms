import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { NavigationMenuList } from '../../../src/static/js/components/_shared/navigation-menu-list/NavigationMenuList';

describe('components/_shared', () => {
    describe('NavigationMenuList', () => {
        test('Renders nothing for an empty item list', () => {
            const { container, unmount } = renderIntoContainer(<NavigationMenuList items={[]} />);
            expect(container.innerHTML).toBe('');
            unmount();
        });

        test('Adds pv0 class when vertical padding is removed', () => {
            const { container, unmount } = renderIntoContainer(
                <NavigationMenuList removeVerticalPadding={true} items={[{ link: '/a', text: 'A' }]} />
            );
            expect(container.querySelector('.nav-menu')?.className).toBe('nav-menu pv0');
            unmount();
        });

        test('Renders link items with icon before text and active class', () => {
            const { container, unmount } = renderIntoContainer(
                <NavigationMenuList
                    items={[
                        { link: '/home', text: 'Home', icon: 'home', active: true, linkAttr: { target: '_blank' } },
                        { link: '/b', text: 'B' },
                    ]}
                />
            );
            const items = container.querySelectorAll('nav ul li');
            expect(items).toHaveLength(2);
            expect(items[0].className).toBe('link-item active');
            expect(items[1].className).toBe('link-item');

            const link = items[0].querySelector('a') as HTMLAnchorElement;
            expect(link.getAttribute('href')).toBe('/home');
            expect(link.getAttribute('title')).toBe('Home');
            expect(link.getAttribute('target')).toBe('_blank');
            const children = link.children;
            expect(children[0].className).toBe('menu-item-icon');
            expect(children[0].querySelector('i')?.getAttribute('data-icon')).toBe('home');
            expect(children[1].textContent).toBe('Home');
            unmount();
        });

        test('Places icon after text when iconPos is right', () => {
            const { container, unmount } = renderIntoContainer(
                <NavigationMenuList items={[{ link: '/x', text: 'X', icon: 'star', iconPos: 'right' }]} />
            );
            const children = (container.querySelector('a') as HTMLAnchorElement).children;
            expect(children[0].textContent).toBe('X');
            expect(children[1].className).toBe('menu-item-icon-right');
            unmount();
        });

        test('Renders link with icon only and no title', () => {
            const { container, unmount } = renderIntoContainer(<NavigationMenuList items={[{ link: '/x', icon: 'star' }]} />);
            const link = container.querySelector('a') as HTMLAnchorElement;
            expect(link.hasAttribute('title')).toBe(false);
            expect(link.children).toHaveLength(1);
            expect(link.children[0].className).toBe('menu-item-icon');
            unmount();
        });

        test('Renders button, open-subpage, label and div item types', () => {
            const { container, unmount } = renderIntoContainer(
                <NavigationMenuList
                    items={[
                        { itemType: 'button', text: 'Btn', buttonAttr: { className: 'b1' } },
                        {
                            itemType: 'open-subpage',
                            text: 'Sub',
                            icon: 'brightness_4',
                            buttonAttr: { 'data-page-id': 'switch-theme' },
                            itemAttr: { className: 'custom' },
                        },
                        { itemType: 'label', text: 'Lbl' },
                        { itemType: 'div', text: 'Div', divAttr: { className: 'd1' } },
                    ]}
                />
            );
            const items = container.querySelectorAll('li');
            expect(items[0].className).toBe('');
            expect(items[0].querySelector('button.b1')?.textContent).toBe('Btn');
            expect(items[1].className).toBe('custom');
            expect(items[1].querySelector('button')?.getAttribute('data-page-id')).toBe('switch-theme');
            expect(items[2].className).toBe('label-item');
            expect(items[2].querySelector('button > span')?.textContent).toBe('Lbl');
            expect(items[3].querySelector('div.d1')?.textContent).toBe('Div');
            unmount();
        });
    });
});
