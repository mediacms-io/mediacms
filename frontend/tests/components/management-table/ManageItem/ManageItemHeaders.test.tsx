import '../../../_support/setupMediaCMS';
import React from 'react';
import { renderIntoContainer } from '../../../_support/render';
import { click } from '../../../_support/compD_dom';
import { ManageMediaItemHeader } from '../../../../src/static/js/components/management-table/ManageItem/ManageMediaItemHeader';
import { ManageUsersItemHeader } from '../../../../src/static/js/components/management-table/ManageItem/ManageUsersItemHeader';
import { ManageCommentsItemHeader } from '../../../../src/static/js/components/management-table/ManageItem/ManageCommentsItemHeader';

describe('components/management-table', () => {
    describe('ManageMediaItemHeader', () => {
        test('Marks the sorted column and lists media columns', () => {
            const { container, unmount } = renderIntoContainer(<ManageMediaItemHeader sort="title" order="asc" selected={false} />);
            expect(container.querySelector('#title')?.className).toBe('mi-title mi-col-sort asc');
            expect(container.querySelector('#add_date')?.className).toBe('mi-added mi-col-sort');
            expect(container.querySelector('.mi-reported')?.textContent).toBe('Reported');
            unmount();
        });

        test('Sorting a new column starts descending and toggles on repeat', () => {
            const onClickColumnSort = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <ManageMediaItemHeader sort="title" order="asc" selected={false} onClickColumnSort={onClickColumnSort} />
            );
            click(container.querySelector('#add_date'));
            expect(onClickColumnSort).toHaveBeenLastCalledWith('add_date', 'desc');
            expect(container.querySelector('#add_date')?.className).toBe('mi-added mi-col-sort desc');
            click(container.querySelector('#add_date'));
            expect(onClickColumnSort).toHaveBeenLastCalledWith('add_date', 'asc');
            click(container.querySelector('#add_date'));
            expect(onClickColumnSort).toHaveBeenLastCalledWith('add_date', 'desc');
            unmount();
        });

        test('Check all reports the requested state with the table type', () => {
            const onCheckAllRows = jest.fn();
            const { container, rerender, unmount } = renderIntoContainer(
                <ManageMediaItemHeader sort="title" order="asc" selected={false} onCheckAllRows={onCheckAllRows} />
            );
            click(container.querySelector('input'));
            expect(onCheckAllRows).toHaveBeenCalledWith(true, 'media');
            rerender(<ManageMediaItemHeader sort="add_date" order="desc" selected onCheckAllRows={onCheckAllRows} />);
            expect((container.querySelector('input') as HTMLInputElement).checked).toBe(true);
            expect(container.querySelector('#add_date')?.className).toBe('mi-added mi-col-sort desc');
            click(container.querySelector('input'));
            expect(onCheckAllRows).toHaveBeenLastCalledWith(false, 'media');
            unmount();
        });
    });

    describe('ManageUsersItemHeader', () => {
        test('Renders optional columns only when enabled', () => {
            const plain = renderIntoContainer(<ManageUsersItemHeader sort="name" order="desc" selected={false} />);
            expect(plain.container.querySelector('#name')?.className).toBe('mi-name mi-col-sort desc');
            ['.mi-role', '.mi-verified', '.mi-trusted', '.mi-approved'].forEach((s) => expect(plain.container.querySelector(s)).toBeNull());
            plain.unmount();

            const full = renderIntoContainer(<ManageUsersItemHeader sort="name" order="desc" selected={false} has_roles has_verified has_trusted has_approved />);
            ['.mi-role', '.mi-verified', '.mi-trusted', '.mi-approved'].forEach((s) => expect(full.container.querySelector(s)).not.toBeNull());
            full.unmount();
        });

        test('Check all passes users type', () => {
            const onCheckAllRows = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <ManageUsersItemHeader sort="name" order="desc" selected={false} onCheckAllRows={onCheckAllRows} />
            );
            click(container.querySelector('input'));
            expect(onCheckAllRows).toHaveBeenCalledWith(true, 'users');
            unmount();
        });
    });

    describe('ManageCommentsItemHeader', () => {
        test('Sorts by comment text and passes comments type', () => {
            const onClickColumnSort = jest.fn();
            const onCheckAllRows = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <ManageCommentsItemHeader sort="add_date" order="desc" selected={false} onClickColumnSort={onClickColumnSort} onCheckAllRows={onCheckAllRows} />
            );
            expect(container.querySelector('#text')?.className).toBe('mi-comment mi-col-sort');
            click(container.querySelector('#text'));
            expect(onClickColumnSort).toHaveBeenCalledWith('text', 'desc');
            click(container.querySelector('input'));
            expect(onCheckAllRows).toHaveBeenCalledWith(true, 'comments');
            unmount();
        });
    });
});
