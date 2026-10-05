import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer } from '../../_support/render';
import { UserThumbnail } from '../../../src/static/js/components/_shared/user-thumbnail/UserThumbnail';
import UserContext, { UserProvider } from '../../../src/static/js/utils/contexts/UserContext';

describe('components/_shared', () => {
    describe('UserThumbnail', () => {
        test('Renders the configured user thumbnail as a span by default', () => {
            const { container, unmount } = renderIntoContainer(
                <UserProvider>
                    <UserThumbnail />
                </UserProvider>
            );
            const root = container.firstElementChild as HTMLElement;
            expect(root.tagName).toBe('SPAN');
            expect(root.className).toBe('circle-icon-button thumbnail');
            expect(root.querySelector('img')?.getAttribute('src')).toBe('/img/john.png');
            unmount();
        });

        test('Renders a button with size class and click handler when isButton', () => {
            const onClick = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <UserProvider>
                    <UserThumbnail isButton={true} size="small" onClick={onClick} />
                </UserProvider>
            );
            const button = container.querySelector('button') as HTMLButtonElement;
            expect(button.className).toBe('circle-icon-button thumbnail small-thumb');
            button.click();
            expect(onClick).toHaveBeenCalledTimes(1);
            unmount();
        });

        test('Falls back to a person icon without thumbnail', () => {
            const { container, unmount } = renderIntoContainer(
                <UserContext.Provider value={{ thumbnail: '' }}>
                    <UserThumbnail size="large" isButton={true} />
                </UserContext.Provider>
            );
            const button = container.querySelector('button') as HTMLButtonElement;
            expect(button.className).toBe('circle-icon-button thumbnail large-thumb');
            expect(button.querySelector('img')).toBeNull();
            expect(button.querySelector('i')?.getAttribute('data-icon')).toBe('person');
            unmount();
        });
    });
});
