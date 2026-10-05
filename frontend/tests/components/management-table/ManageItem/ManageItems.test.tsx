import '../../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer, act } from '../../../_support/render';
import { click, changeValue, flush, jsonResponse } from '../../../_support/compD_dom';
import { PageStore } from '../../../../src/static/js/utils/stores/';
import { UserProvider } from '../../../../src/static/js/utils/contexts/UserContext';
import { ManageMediaItem } from '../../../../src/static/js/components/management-table/ManageItem/ManageMediaItem';
import { ManageUsersItem } from '../../../../src/static/js/components/management-table/ManageItem/ManageUsersItem';
import { ManageCommentsItem } from '../../../../src/static/js/components/management-table/ManageItem/ManageCommentsItem';

jest.mock('../../../../src/static/js/utils/stores/', () => require('../../../_support/compD_storeMocks').mockStoresModule());

const pageStore = PageStore as any;
const DATE = '2024-03-05T07:08:09';

function cellText(container: HTMLElement, selector: string) {
    return container.querySelector(selector)?.textContent;
}

function icon(container: HTMLElement, selector: string) {
    return container.querySelector(selector + ' i')?.getAttribute('data-icon');
}

describe('components/management-table', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        pageStore.__reset();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    function settle() {
        act(() => {
            jest.advanceTimersByTime(50);
        });
    }

    describe('ManageMediaItem', () => {
        const props = {
            token: 'tok1',
            title: 'Clip',
            url: '/view?m=tok1',
            author_name: 'Ann',
            author_url: '/user/ann',
            add_date: DATE,
            media_type: 'video',
            encoding_status: 'success',
            state: 'public',
            is_reviewed: true,
            featured: false,
            reported_times: 2,
            selectedRow: false,
            hideDeleteAction: false,
        };

        test('Renders all columns', () => {
            const { container, unmount } = renderIntoContainer(<ManageMediaItem {...props} />);
            const link = container.querySelector('.mi-title > a') as HTMLAnchorElement;
            expect(link.getAttribute('href')).toBe('/view?m=tok1');
            expect(link.textContent).toBe('Clip');
            expect(cellText(container, '.mi-added')).toBe('Mar 5, 2024 07:08:09');
            expect(container.querySelector('.mi-author a')?.getAttribute('href')).toBe('/user/ann');
            expect(cellText(container, '.mi-type')).toBe('video');
            expect(cellText(container, '.mi-encoding')).toBe('success');
            expect(cellText(container, '.mi-state')).toBe('public');
            expect(icon(container, '.mi-reviewed')).toBe('check_circle');
            expect(cellText(container, '.mi-featured')).toBe('-');
            expect(cellText(container, '.mi-reported')).toBe('2 times');
            expect(container.querySelector('.actions button')?.getAttribute('title')).toBe('Delete "Clip"');
            unmount();
        });

        test('Shows N/A placeholders and alternate values', () => {
            const { container, unmount } = renderIntoContainer(
                <ManageMediaItem token="t" selectedRow={false} hideDeleteAction is_reviewed={false} featured reported_times={1} />
            );
            expect(container.querySelector('.mi-title .non-available')).not.toBeNull();
            expect(container.querySelector('.actions')).toBeNull();
            ['.mi-added', '.mi-author', '.mi-type', '.mi-encoding', '.mi-state'].forEach((s) =>
                expect(container.querySelector(s + ' .non-available')?.textContent).toBe('N/A')
            );
            expect(icon(container, '.mi-reviewed')).toBe('cancel');
            expect(icon(container, '.mi-featured')).toBe('check_circle');
            expect(cellText(container, '.mi-reported')).toBe('1 time');
            unmount();
        });

        test('Title or url alone render as text and zero reports as dash', () => {
            const a = renderIntoContainer(<ManageMediaItem selectedRow={false} hideDeleteAction title="Only title" author_name="Ann" reported_times={0} />);
            expect(cellText(a.container, '.mi-title')).toBe('Only title');
            expect(cellText(a.container, '.mi-author')).toBe('Ann');
            expect(cellText(a.container, '.mi-reported')).toBe('-');
            a.unmount();
            const b = renderIntoContainer(<ManageMediaItem selectedRow={false} hideDeleteAction url="/u" author_url="/a" />);
            expect(cellText(b.container, '.mi-title')).toBe('/u');
            expect(cellText(b.container, '.mi-author')).toBe('/a');
            expect(b.container.querySelector('.mi-reviewed .non-available')).not.toBeNull();
            b.unmount();
        });

        test('Row checkbox reports selection and follows selectedRow prop', () => {
            const onCheckRow = jest.fn();
            const { container, rerender, unmount } = renderIntoContainer(<ManageMediaItem {...props} onCheckRow={onCheckRow} />);
            expect(onCheckRow).toHaveBeenLastCalledWith('tok1', false);
            click(container.querySelector('.mi-checkbox input'));
            expect(onCheckRow).toHaveBeenLastCalledWith('tok1', true);
            rerender(<ManageMediaItem {...props} onCheckRow={onCheckRow} selectedRow />);
            expect((container.querySelector('.mi-checkbox input') as HTMLInputElement).checked).toBe(true);
            unmount();
        });

        test('Delete popup proceeds with the media token and cancels without it', () => {
            const onProceedRemoval = jest.fn();
            const { container, unmount } = renderIntoContainer(<ManageMediaItem {...props} onProceedRemoval={onProceedRemoval} />);
            click(container.querySelector('.actions > button'));
            expect(cellText(container, '.popup-message-main')).toBe('You\'re willing to remove media "Clip"?');
            expect(pageStore.listenerCount('window_resize')).toBe(1);
            act(() => {
                pageStore.emit('window_scroll');
                pageStore.emit('window_resize');
                jest.advanceTimersByTime(8);
            });
            expect((container.querySelector('.actions .popup') as HTMLElement).style.position).toBe('fixed');
            click(container.querySelector('.cancel-profile-removal'));
            expect(container.querySelector('.popup-message')).toBeNull();
            expect(pageStore.listenerCount('window_resize')).toBe(0);
            expect(onProceedRemoval).not.toHaveBeenCalled();
            click(container.querySelector('.actions > button'));
            click(container.querySelector('.proceed-profile-removal'));
            expect(onProceedRemoval).toHaveBeenCalledWith('tok1');
            settle();
            unmount();
        });
    });

    describe('ManageCommentsItem', () => {
        const props = {
            uid: 'c1',
            author_name: 'Ann',
            author_url: '/user/ann',
            text: 'Nice video',
            media_url: '/view?m=1',
            add_date: DATE,
            selectedRow: false,
            hideDeleteAction: false,
        };

        test('Renders author, text, media link and date', () => {
            const { container, unmount } = renderIntoContainer(<ManageCommentsItem {...props} />);
            expect(container.querySelector('.mi-author a')?.textContent).toBe('Ann');
            expect(container.querySelector('.mi-comment')?.firstChild?.textContent).toBe('Nice video');
            expect(container.querySelector('.actions a')?.getAttribute('href')).toBe('/view?m=1');
            expect(container.querySelector('.actions .seperator')).not.toBeNull();
            expect(cellText(container, '.mi-added')).toBe('Mar 5, 2024 07:08:09');
            unmount();
        });

        test('Omits actions when there is no text', () => {
            const { container, unmount } = renderIntoContainer(<ManageCommentsItem uid="c" selectedRow={false} hideDeleteAction={false} />);
            expect(container.querySelector('.mi-comment .non-available')).not.toBeNull();
            expect(container.querySelector('.mi-author .non-available')).not.toBeNull();
            expect(container.querySelector('.actions')).toBeNull();
            unmount();
        });

        test('Omits actions without media url when delete is hidden', () => {
            const { container, unmount } = renderIntoContainer(<ManageCommentsItem uid="c" text="t" author_name="Ann" selectedRow={false} hideDeleteAction />);
            expect(container.querySelector('.actions')).toBeNull();
            expect(cellText(container, '.mi-author')).toBe('Ann');
            unmount();
        });

        test('Delete popup proceeds with the comment uid', () => {
            const onProceedRemoval = jest.fn();
            const onCheckRow = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <ManageCommentsItem {...props} media_url={undefined} author_name={undefined} onProceedRemoval={onProceedRemoval} onCheckRow={onCheckRow} />
            );
            expect(cellText(container, '.mi-author')).toBe('/user/ann');
            expect(container.querySelector('.actions .seperator')).toBeNull();
            click(container.querySelector('.mi-checkbox input'));
            expect(onCheckRow).toHaveBeenLastCalledWith('c1', true);
            click(container.querySelector('.actions button'));
            click(container.querySelector('.cancel-profile-removal'));
            click(container.querySelector('.actions button'));
            click(container.querySelector('.proceed-profile-removal'));
            expect(onProceedRemoval).toHaveBeenCalledWith('c1');
            settle();
            unmount();
        });
    });

    describe('ManageUsersItem', () => {
        let fetchMock: jest.Mock;

        beforeEach(() => {
            fetchMock = jest.fn();
            (global as any).fetch = fetchMock;
            document.cookie = 'csrftoken=csrf123';
        });

        afterEach(() => {
            delete (global as any).fetch;
            sessionStorage.clear();
        });

        const props = {
            name: 'Ann',
            username: 'ann',
            url: '/user/ann',
            add_date: DATE,
            selectedRow: false,
            hideDeleteAction: false,
        };

        function render(extra: { [key: string]: any } = {}) {
            return renderIntoContainer(
                <UserProvider>
                    <ManageUsersItem {...props} {...extra} />
                </UserProvider>
            );
        }

        test('Renders linked name and username and optional columns', () => {
            const { container, unmount } = render({
                has_roles: true,
                roles: ['editor', 'manager'],
                has_verified: true,
                is_verified: true,
                has_trusted: true,
                is_trusted: false,
                has_approved: true,
                is_approved: false,
                is_featured: true,
            });
            expect(container.querySelector('.mi-name > a')?.textContent).toBe('Ann');
            expect(container.querySelector('.mi-username a')?.textContent).toBe('ann');
            expect(cellText(container, '.mi-role')).toBe('editor\nmanager');
            expect(icon(container, '.mi-verified')).toBe('check_circle');
            expect(cellText(container, '.mi-trusted')).toBe('-');
            expect(icon(container, '.mi-approved')).toBe('cancel');
            expect(icon(container, '.mi-featured')).toBe('check_circle');
            unmount();
        });

        test('Shows placeholders for missing values', () => {
            const { container, unmount } = render({
                name: '',
                url: undefined,
                username: null,
                add_date: undefined,
                has_roles: true,
                has_verified: true,
                has_trusted: true,
                has_approved: true,
                is_approved: null,
            });
            ['.mi-name', '.mi-username', '.mi-added', '.mi-role', '.mi-verified', '.mi-trusted', '.mi-approved', '.mi-featured'].forEach((s) =>
                expect(container.querySelector(s + ' .non-available')).not.toBeNull()
            );
            unmount();
        });

        test('Plain text name and username without url and empty roles as dash', () => {
            const { container, unmount } = render({ url: undefined, has_roles: true, roles: [], has_verified: true, is_verified: false, has_trusted: true, is_trusted: true, has_approved: true, is_approved: true, is_featured: false });
            expect(container.querySelector('.mi-name')?.firstChild?.textContent).toBe('Ann');
            expect(cellText(container, '.mi-username')).toBe('ann');
            expect(cellText(container, '.mi-role')).toBe('-');
            expect(cellText(container, '.mi-verified')).toBe('-');
            expect(icon(container, '.mi-trusted')).toBe('check_circle');
            expect(icon(container, '.mi-approved')).toBe('check_circle');
            expect(cellText(container, '.mi-featured')).toBe('-');
            unmount();
        });

        test('Approve action is hidden when users need no approval', () => {
            const { container, unmount } = render({ is_approved: false });
            const buttons = Array.from(container.querySelectorAll('.actions > button')).map((b) => b.textContent);
            expect(buttons).toEqual(['Change password', 'Delete']);
            unmount();
        });

        test('Delete popup proceeds with the username', () => {
            const onProceedRemoval = jest.fn();
            const onCheckRow = jest.fn();
            const { container, unmount } = render({ onProceedRemoval, onCheckRow });
            click(container.querySelector('.mi-checkbox input'));
            expect(onCheckRow).toHaveBeenLastCalledWith('ann', true);
            const deleteBtn = () => Array.from(container.querySelectorAll('.actions > button')).find((b) => b.textContent === 'Delete') as HTMLElement;
            expect(deleteBtn().title).toBe('Delete "Ann"');
            click(deleteBtn());
            expect(cellText(container, '.popup-message-title')).toBe('Member removal');
            click(container.querySelector('.cancel-profile-removal'));
            expect(container.querySelector('.popup-message')).toBeNull();
            click(deleteBtn());
            click(container.querySelector('.proceed-profile-removal'));
            expect(onProceedRemoval).toHaveBeenCalledWith('ann');
            settle();
            unmount();
        });

        test('Password change failure reports the server message', async () => {
            const setMessage = jest.fn();
            fetchMock.mockReturnValueOnce(jsonResponse({ detail: 'Too short' }, false));
            const { container, unmount } = render({ setMessage });
            click(container.querySelector('.actions > button'));
            expect(cellText(container, '.popup-message-title')).toBe('Change Password for Ann');
            changeValue(container.querySelector('input[type="password"]'), 'pw');
            act(() => {
                (container.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            });
            await flush();
            expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/users/ann');
            const init = fetchMock.mock.calls[0][1];
            expect(init.method).toBe('PUT');
            expect(init.headers).toEqual({ 'X-CSRFToken': 'csrf123' });
            expect(init.body.get('action')).toBe('change_password');
            expect(init.body.get('password')).toBe('pw');
            expect(setMessage).toHaveBeenCalledWith({ type: '', text: '' });
            expect(setMessage).toHaveBeenLastCalledWith({ type: 'error', text: 'Too short' });
            click(container.querySelector('.cancel-profile-removal'));
            expect(container.querySelector('form')).toBeNull();
            settle();
            unmount();
        });

        test('Password change failure without detail uses a default message', async () => {
            const setMessage = jest.fn();
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            const { container, unmount } = render({ setMessage });
            click(container.querySelector('.actions > button'));
            act(() => {
                (container.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            });
            await flush();
            expect(setMessage).toHaveBeenLastCalledWith({ type: 'error', text: 'Failed to change password.' });
            settle();
            unmount();
        });
    });
});
