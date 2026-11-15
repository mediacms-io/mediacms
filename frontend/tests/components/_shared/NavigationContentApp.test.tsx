import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { NavigationContentApp } from '../../../src/static/js/components/_shared/navigation-content-app/NavigationContentApp';

describe('components/_shared', () => {
    describe('NavigationContentApp', () => {
        const pages = {
            main: (
                <div className="page-main" tabIndex={-1}>
                    <button className="change-page" data-page-id=" settings ">
                        go settings
                    </button>
                    <button className="change-page" data-page-id="">
                        no id
                    </button>
                    <button className="change-page" data-page-id="missing">
                        missing page
                    </button>
                </div>
            ),
            settings: (
                <div className="page-settings">
                    <button className="change-page" data-page-id="main">
                        back
                    </button>
                </div>
            ),
        };

        function render(props: any = {}) {
            return renderIntoContainer(
                <NavigationContentApp
                    pages={pages}
                    pageChangeSelector=".change-page"
                    pageIdSelectorAttr="data-page-id"
                    {...props}
                />
            );
        }

        test('Renders the initial page and reports it via callback', () => {
            const cb = jest.fn();
            const { container, unmount } = render({ initPage: 'settings', pageChangeCallback: cb });
            expect(container.querySelector('.page-settings')).not.toBeNull();
            expect(cb).toHaveBeenCalledWith('settings');
            unmount();
        });

        test('Falls back to the first page when initPage is unknown', () => {
            const { container, unmount } = render({ initPage: 'nope' });
            expect(container.querySelector('.page-main')).not.toBeNull();
            unmount();
        });

        test('Renders nothing when there are no pages', () => {
            const { container, unmount } = renderIntoContainer(
                <NavigationContentApp pages={{}} pageChangeSelector=".change-page" pageIdSelectorAttr="data-page-id" />
            );
            expect(container.innerHTML).toBe('');
            unmount();
        });

        test('Clicking page change elements switches pages using trimmed ids', () => {
            const cb = jest.fn();
            const { container, unmount } = render({ initPage: 'main', pageChangeCallback: cb });
            act(() => {
                (container.querySelector('.change-page') as HTMLButtonElement).click();
            });
            expect(container.querySelector('.page-settings')).not.toBeNull();
            act(() => {
                (container.querySelector('.change-page') as HTMLButtonElement).click();
            });
            expect(container.querySelector('.page-main')).not.toBeNull();
            expect(cb.mock.calls.map((c) => c[0])).toStrictEqual(['main', 'settings', 'main']);
            unmount();
        });

        test('Ignores clicks targeting unknown pages', () => {
            const { container, unmount } = render({ initPage: 'main' });
            act(() => {
                (container.querySelectorAll('.change-page')[2] as HTMLButtonElement).click();
            });
            expect(container.querySelector('.page-main')).not.toBeNull();
            unmount();
        });

        test('Focuses the container on page change unless disabled', () => {
            const focusSpy = jest.spyOn(HTMLElement.prototype, 'focus');
            const first = render({ initPage: 'main' });
            expect(focusSpy).toHaveBeenCalledTimes(1);
            first.unmount();

            focusSpy.mockClear();
            const second = render({ initPage: 'main', focusFirstItemOnPageChange: false });
            expect(focusSpy).not.toHaveBeenCalled();
            second.unmount();
            focusSpy.mockRestore();
        });
    });
});
