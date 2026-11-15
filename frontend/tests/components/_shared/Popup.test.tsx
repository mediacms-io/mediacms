import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import PopupComponent, { PopupTop, PopupMain } from '../../../src/static/js/components/_shared/popup/Popup';
import { PopupContent } from '../../../src/static/js/components/_shared/popup/PopupContent';
import { PopupTrigger } from '../../../src/static/js/components/_shared/popup/PopupTrigger';

const Popup = PopupComponent as any;

describe('components/_shared', () => {
    describe('Popup', () => {
        test('Renders children with optional class and style and forwards ref', () => {
            const ref = React.createRef<HTMLDivElement>();
            const { container, unmount } = renderIntoContainer(
                <Popup ref={ref} className="extra" style={{ width: '10px' }}>
                    <span>hi</span>
                </Popup>
            );
            const popup = container.querySelector('.popup') as HTMLDivElement;
            expect(popup.className).toBe('popup extra');
            expect(popup.style.width).toBe('10px');
            expect(ref.current).toBe(popup);
            unmount();
        });

        test('Renders nothing without children', () => {
            const { container, unmount } = renderIntoContainer(
                <div>
                    <Popup />
                    <PopupTop />
                    <PopupMain />
                </div>
            );
            expect(container.firstElementChild?.innerHTML).toBe('');
            unmount();
        });

        test('PopupTop and PopupMain render their wrapper classes', () => {
            const { container, unmount } = renderIntoContainer(
                <div>
                    <PopupTop className="t">top</PopupTop>
                    <PopupMain>main</PopupMain>
                </div>
            );
            expect(container.querySelector('.popup-top.t')?.textContent).toBe('top');
            expect(container.querySelector('.popup-main')?.className).toBe('popup-main');
            unmount();
        });
    });

    describe('PopupContent and PopupTrigger', () => {
        function setup() {
            const contentRef = React.createRef<any>();
            const showCallback = jest.fn();
            const hideCallback = jest.fn();
            const view = renderIntoContainer(
                <div>
                    <PopupTrigger contentRef={contentRef}>
                        <button className="trigger">open</button>
                    </PopupTrigger>
                    <PopupContent
                        contentRef={contentRef}
                        className="menu"
                        showCallback={showCallback}
                        hideCallback={hideCallback}
                    >
                        <span className="inside">content</span>
                    </PopupContent>
                </div>
            );
            return { ...view, contentRef, showCallback, hideCallback };
        }

        test('Is hidden initially and calls hideCallback on mount', () => {
            const { container, hideCallback, showCallback, unmount } = setup();
            expect(container.querySelector('.popup')).toBeNull();
            expect(hideCallback).toHaveBeenCalledTimes(1);
            expect(showCallback).not.toHaveBeenCalled();
            unmount();
        });

        test('Trigger click toggles visibility', () => {
            const { container, showCallback, hideCallback, unmount } = setup();
            const trigger = container.querySelector('.trigger') as HTMLButtonElement;
            act(() => trigger.click());
            expect(container.querySelector('.popup.menu .inside')).not.toBeNull();
            expect(showCallback).toHaveBeenCalledTimes(1);
            act(() => trigger.click());
            expect(container.querySelector('.popup')).toBeNull();
            expect(hideCallback).toHaveBeenCalledTimes(2);
            unmount();
        });

        test('Imperative tryToShow and tryToHide are idempotent', () => {
            const { container, contentRef, showCallback, unmount } = setup();
            act(() => contentRef.current.tryToHide());
            expect(container.querySelector('.popup')).toBeNull();
            act(() => contentRef.current.tryToShow());
            act(() => contentRef.current.tryToShow());
            expect(container.querySelector('.popup')).not.toBeNull();
            expect(showCallback).toHaveBeenCalledTimes(1);
            act(() => contentRef.current.tryToHide());
            expect(container.querySelector('.popup')).toBeNull();
            unmount();
        });

        test('Mousedown inside keeps it open while outside closes it', () => {
            const { container, contentRef, unmount } = setup();
            act(() => contentRef.current.tryToShow());
            const inside = container.querySelector('.inside') as HTMLElement;
            act(() => {
                inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            });
            expect(container.querySelector('.popup')).not.toBeNull();
            act(() => {
                document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            });
            expect(container.querySelector('.popup')).toBeNull();
            unmount();
        });

        test('Mousedown on fullscreen overlay closes it', () => {
            const { container, contentRef, unmount } = setup();
            const overlay = document.createElement('div');
            overlay.className = 'popup-fullscreen-overlay';
            document.body.appendChild(overlay);
            act(() => contentRef.current.tryToShow());
            act(() => {
                overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            });
            expect(container.querySelector('.popup')).toBeNull();
            overlay.remove();
            unmount();
        });

        test('Escape key closes it while other keys do not', () => {
            const { container, contentRef, unmount } = setup();
            act(() => contentRef.current.tryToShow());
            act(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 13 } as any));
            });
            expect(container.querySelector('.popup')).not.toBeNull();
            act(() => {
                document.body.dispatchEvent(new KeyboardEvent('keydown', { keyCode: 27, bubbles: true } as any));
            });
            expect(container.querySelector('.popup')).toBeNull();
            unmount();
        });
    });
});
