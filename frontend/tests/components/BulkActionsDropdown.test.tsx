import React from 'react';
import { renderIntoContainer, act } from '../_support/render';
import { BulkActionsDropdown } from '../../src/static/js/components/BulkActionsDropdown';

function click(el: Element | null) {
    act(() => {
        (el as HTMLElement).click();
    });
}

function optionLabels(container: HTMLElement) {
    return Array.from(container.querySelectorAll('.bulk-actions-item')).map((b) => b.textContent);
}

describe('components', () => {
    describe('BulkActionsDropdown', () => {
        afterEach(() => {
            sessionStorage.clear();
        });

        test('Shows plain label and closed menu without selection', () => {
            const { container, unmount } = renderIntoContainer(<BulkActionsDropdown selectedCount={0} onActionSelect={jest.fn()} />);
            const trigger = container.querySelector('.bulk-actions-trigger') as HTMLButtonElement;
            expect(trigger.textContent).toBe('Bulk Actions');
            expect(trigger.className).toBe('bulk-actions-trigger no-selection');
            expect(trigger.getAttribute('aria-expanded')).toBe('false');
            expect(container.querySelector('.bulk-actions-menu')).toBeNull();
            unmount();
        });

        test('Shows selected count in the label', () => {
            const { container, unmount } = renderIntoContainer(<BulkActionsDropdown selectedCount={4} onActionSelect={jest.fn()} />);
            expect(container.querySelector('.bulk-actions-trigger')?.textContent).toBe('Bulk Actions (4 selected)');
            unmount();
        });

        test('Opens grouped menu with all actions disabled when nothing is selected', () => {
            const onActionSelect = jest.fn();
            const { container, unmount } = renderIntoContainer(<BulkActionsDropdown selectedCount={0} onActionSelect={onActionSelect} />);
            click(container.querySelector('.bulk-actions-trigger'));
            expect(container.querySelector('.bulk-actions-trigger')?.className).toContain('is-open');
            const groups = Array.from(container.querySelectorAll('.bulk-actions-group-label')).map((g) => g.textContent);
            expect(groups).toEqual(['Sharing', 'Organization', 'Settings', 'Management']);
            const items = container.querySelectorAll('.bulk-actions-item');
            expect(items.length).toBe(15);
            items.forEach((item) => expect((item as HTMLButtonElement).disabled).toBe(true));
            expect(optionLabels(container)).toContain('Add / Remove from Categories');
            expect(optionLabels(container)).not.toContain('Course Cleanup');
            unmount();
        });

        test('Selecting an action calls back with its value and closes the menu', () => {
            const onActionSelect = jest.fn();
            const { container, unmount } = renderIntoContainer(<BulkActionsDropdown selectedCount={2} onActionSelect={onActionSelect} />);
            click(container.querySelector('.bulk-actions-trigger'));
            const deleteBtn = Array.from(container.querySelectorAll('.bulk-actions-item')).find((b) => b.textContent === 'Delete Media');
            click(deleteBtn as Element);
            expect(onActionSelect).toHaveBeenCalledWith('delete-media');
            expect(container.querySelector('.bulk-actions-menu')).toBeNull();
            unmount();
        });

        test('Closes on Escape and on outside mousedown but not on inside mousedown', () => {
            const { container, unmount } = renderIntoContainer(<BulkActionsDropdown selectedCount={1} onActionSelect={jest.fn()} />);
            click(container.querySelector('.bulk-actions-trigger'));
            act(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            });
            expect(container.querySelector('.bulk-actions-menu')).toBeNull();

            click(container.querySelector('.bulk-actions-trigger'));
            act(() => {
                container.querySelector('.bulk-actions-menu')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            });
            expect(container.querySelector('.bulk-actions-menu')).not.toBeNull();
            act(() => {
                document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            });
            expect(container.querySelector('.bulk-actions-menu')).toBeNull();
            unmount();
        });

        test('Toggles closed when trigger is clicked twice', () => {
            const { container, unmount } = renderIntoContainer(<BulkActionsDropdown selectedCount={1} onActionSelect={jest.fn()} />);
            click(container.querySelector('.bulk-actions-trigger'));
            click(container.querySelector('.bulk-actions-trigger'));
            expect(container.querySelector('.bulk-actions-menu')).toBeNull();
            unmount();
        });

        test('In LMS mode renames categories action and offers course cleanup without selection', () => {
            sessionStorage.setItem('lms_embed_mode', 'true');
            const onActionSelect = jest.fn();
            const { container, unmount } = renderIntoContainer(
                <BulkActionsDropdown selectedCount={0} onActionSelect={onActionSelect} hasContributorCourses />
            );
            click(container.querySelector('.bulk-actions-trigger'));
            expect(optionLabels(container)).toContain('Share with Course Members');
            const cleanup = Array.from(container.querySelectorAll('.bulk-actions-item')).find((b) => b.textContent === 'Course Cleanup') as HTMLButtonElement;
            expect(cleanup.disabled).toBe(false);
            click(cleanup);
            expect(onActionSelect).toHaveBeenCalledWith('course-cleanup');
            unmount();
        });
    });
});
