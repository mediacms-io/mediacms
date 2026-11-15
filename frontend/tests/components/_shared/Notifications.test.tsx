import '../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { Notifications } from '../../../src/static/js/components/_shared/notifications/Notifications';
import { addNotification } from '../../../src/static/js/utils/actions/PageActions';

describe('components/_shared', () => {
    describe('Notifications', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            act(() => {
                jest.runOnlyPendingTimers();
            });
            jest.useRealTimers();
        });

        test('Renders nothing without notifications', () => {
            const { container, unmount } = renderIntoContainer(<Notifications />);
            expect(container.innerHTML).toBe('');
            unmount();
        });

        test('Shows dispatched notifications then hides and removes them after timeouts', () => {
            const { container, unmount } = renderIntoContainer(<Notifications />);

            act(() => {
                addNotification('First message');
            });

            let items = container.querySelectorAll('.notifications .notification-item');
            expect(items).toHaveLength(1);
            expect(items[0].className).toBe('notification-item');
            expect(items[0].textContent).toBe('First message');

            act(() => {
                addNotification('Second message');
            });
            items = container.querySelectorAll('.notification-item');
            expect(Array.from(items).map((i) => i.textContent)).toStrictEqual(['First message', 'Second message']);

            act(() => {
                jest.advanceTimersByTime(5000);
            });
            items = container.querySelectorAll('.notification-item');
            expect(Array.from(items).map((i) => i.className)).toStrictEqual([
                'notification-item hidden',
                'notification-item hidden',
            ]);

            act(() => {
                jest.advanceTimersByTime(1000);
            });
            expect(container.querySelectorAll('.notification-item')).toHaveLength(0);
            unmount();
        });

        test('Clears pending timers when unmounted early', () => {
            const { container, unmount } = renderIntoContainer(<Notifications />);
            act(() => {
                addNotification('Short lived');
            });
            expect(container.querySelector('.notification-item')).not.toBeNull();
            const clearSpy = jest.spyOn(window, 'clearTimeout');
            unmount();
            expect(clearSpy).toHaveBeenCalled();
            clearSpy.mockRestore();
        });
    });
});
