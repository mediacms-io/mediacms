import React from 'react';
import { renderIntoContainer } from '../_support/render';
import { click, flush, jsonResponse, findByText } from '../_support/compD_dom';
import { BulkActionCourseCleanupModal } from '../../src/static/js/components/BulkActionCourseCleanupModal';

describe('components', () => {
    describe('BulkActionCourseCleanupModal', () => {
        let fetchMock: jest.Mock;
        const courses = [
            { uid: 'c1', title: 'Biology' },
            { uid: 'c2', title: 'Physics' },
        ];

        beforeEach(() => {
            fetchMock = jest.fn();
            (global as any).fetch = fetchMock;
        });

        afterEach(() => {
            delete (global as any).fetch;
        });

        async function setup(selectedMediaIds: string[]) {
            const props = { onCancel: jest.fn(), onSuccess: jest.fn(), onError: jest.fn() };
            const view = renderIntoContainer(
                <BulkActionCourseCleanupModal isOpen selectedMediaIds={selectedMediaIds} csrfToken="tok" {...props} />
            );
            await flush();
            return { ...view, ...props };
        }

        const panelTitles = (c: HTMLElement, i: number) =>
            Array.from(c.querySelectorAll('.category-panel')[i].querySelectorAll('.category-item span')).map((s) => s.textContent);

        test('Renders nothing when closed', () => {
            const view = renderIntoContainer(
                <BulkActionCourseCleanupModal isOpen={false} selectedMediaIds={[]} csrfToken="t" onCancel={jest.fn()} onSuccess={jest.fn()} onError={jest.fn()} />
            );
            expect(view.container.innerHTML).toBe('');
            expect(fetchMock).not.toHaveBeenCalled();
            view.unmount();
        });

        test('Without selection lists all contributor courses and hides apply to all', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse(courses));
            const { container, unmount } = await setup([]);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledWith('/api/v1/categories/contributor?lms_courses_only=true');
            expect(panelTitles(container, 0)).toEqual(['Biology', 'Physics']);
            expect(container.querySelectorAll('.course-cleanup-checkbox').length).toBe(2);
            unmount();
        });

        test('With selection limits courses to those the media belongs to', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse({ results: courses })).mockReturnValueOnce(jsonResponse({ results: [{ uid: 'c2', title: 'Physics' }] }));
            const { container, unmount } = await setup(['m1']);
            expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ action: 'category_membership', media_ids: ['m1'] });
            expect(panelTitles(container, 0)).toEqual(['Physics']);
            expect(container.querySelectorAll('.course-cleanup-checkbox').length).toBe(3);
            unmount();
        });

        test('Reports load failure', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse({}, false));
            const { onError, container, unmount } = await setup([]);
            expect(onError).toHaveBeenCalledWith('Failed to load courses');
            expect(container.querySelectorAll('.empty-message')[0].textContent).toBe('No courses available');
            unmount();
        });

        test('Moves courses between panels', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse(courses));
            const { container, unmount } = await setup([]);
            const proceed = () => container.querySelector('.category-btn-proceed') as HTMLButtonElement;
            expect(proceed().disabled).toBe(true);
            click(findByText(container, '.category-item.clickable', 'Biology+'));
            expect(panelTitles(container, 0)).toEqual(['Physics']);
            expect(panelTitles(container, 1)).toEqual(['Biology']);
            expect(proceed().disabled).toBe(false);
            click(container.querySelectorAll('.category-panel')[1].querySelector('.remove-btn'));
            expect(panelTitles(container, 0)).toEqual(['Physics', 'Biology']);
            expect(container.querySelectorAll('.category-panel')[1].querySelector('.empty-message')?.textContent).toBe('No courses selected');
            unmount();
        });

        test('Proceed posts course_cleanup with chosen options', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse(courses)).mockReturnValueOnce(jsonResponse({ results: courses }));
            const { container, onSuccess, onCancel, unmount } = await setup(['m1', 'm2']);
            click(findByText(container, '.category-item.clickable', 'Physics+'));
            const boxes = container.querySelectorAll('.course-cleanup-checkbox input');
            click(boxes[0]);
            click(boxes[2]);
            fetchMock.mockReturnValueOnce(jsonResponse({}));
            click(container.querySelector('.category-btn-proceed'));
            await flush();
            expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
                action: 'course_cleanup',
                media_ids: ['m1', 'm2'],
                category_uids: ['c2'],
                remove_permissions: true,
                remove_comments: false,
                apply_to_all: true,
            });
            expect(onSuccess).toHaveBeenCalledWith('Course cleanup completed successfully');
            expect(onCancel).toHaveBeenCalled();
            unmount();
        });

        test('Proceed failure reports server detail', async () => {
            fetchMock.mockReturnValueOnce(jsonResponse(courses));
            const { container, onError, unmount } = await setup([]);
            click(findByText(container, '.category-item.clickable', 'Physics+'));
            click(container.querySelectorAll('.course-cleanup-checkbox input')[1]);
            fetchMock.mockReturnValueOnce(jsonResponse({ detail: 'Not allowed' }, false));
            click(container.querySelector('.category-btn-proceed'));
            await flush();
            expect(JSON.parse(fetchMock.mock.calls[1][1].body).remove_comments).toBe(true);
            expect(onError).toHaveBeenCalledWith('Not allowed');
            unmount();
        });
    });
});
