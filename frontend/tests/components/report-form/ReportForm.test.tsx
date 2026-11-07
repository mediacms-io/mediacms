import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { click, changeValue } from '../../_support/compD_dom';
import { PageStore } from '../../../src/static/js/utils/stores/';
import { ReportForm } from '../../../src/static/js/components/report-form/ReportForm';

jest.mock('../../../src/static/js/utils/stores/', () => require('../../_support/compD_storeMocks').mockStoresModule());

const pageStore = PageStore as any;

describe('components/report-form', () => {
    describe('ReportForm', () => {
        beforeEach(() => {
            pageStore.__reset();
        });

        test('Renders media url and limits height to the window', () => {
            const { container, unmount } = renderIntoContainer(<ReportForm mediaUrl="https://example.com/view?m=1" />);
            expect((container.querySelector('input') as HTMLInputElement).value).toBe('https://example.com/view?m=1');
            expect((container.querySelector('.report-form') as HTMLElement).style.maxHeight).toBe(window.innerHeight - 104 + 'px');
            expect(pageStore.listenerCount('window_resize')).toBe(1);
            act(() => {
                pageStore.emit('window_resize');
            });
            unmount();
            expect(pageStore.listenerCount('window_resize')).toBe(0);
        });

        test('Submits trimmed description', () => {
            const submitReportForm = jest.fn();
            const { container, unmount } = renderIntoContainer(<ReportForm mediaUrl="u" submitReportForm={submitReportForm} />);
            changeValue(container.querySelector('textarea'), '  spam  ');
            click(container.querySelectorAll('.form-actions-bottom button')[1]);
            expect(submitReportForm).toHaveBeenCalledWith('spam');
            unmount();
        });

        test('Does not submit an empty description', () => {
            const submitReportForm = jest.fn();
            const { container, unmount } = renderIntoContainer(<ReportForm mediaUrl="u" submitReportForm={submitReportForm} />);
            const form = container.querySelector('form') as HTMLFormElement;
            form.addEventListener('submit', (e) => e.preventDefault());
            changeValue(container.querySelector('textarea'), '   ');
            click(container.querySelectorAll('.form-actions-bottom button')[1]);
            expect(submitReportForm).not.toHaveBeenCalled();
            unmount();
        });

        test('Cancel calls the cancel callback', () => {
            const cancelReportForm = jest.fn();
            const { container, unmount } = renderIntoContainer(<ReportForm mediaUrl="u" cancelReportForm={cancelReportForm} />);
            click(container.querySelector('.cancel'));
            expect(cancelReportForm).toHaveBeenCalledTimes(1);
            unmount();
        });
    });
});
