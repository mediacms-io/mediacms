import React from 'react';
import { renderIntoContainer, act } from '../../_support/render';
import { withBulkActions } from '../../../src/static/js/utils/hoc/withBulkActions';

describe('utils/hoc', () => {
    describe('withBulkActions', () => {
        test('Passes through props and injects bulk actions state', () => {
            let received: any;
            function Inner(props: any) {
                received = props;
                return <span>{props.label + ':' + props.bulkActions.selectedMedia.size}</span>;
            }
            const Wrapped: any = withBulkActions(Inner);

            const { container, unmount } = renderIntoContainer(<Wrapped label="items" />);
            expect(container.textContent).toBe('items:0');
            expect(received.label).toBe('items');
            expect(typeof received.bulkActions.handleBulkAction).toBe('function');

            act(() => received.bulkActions.handleMediaSelection('m1', true));
            expect(container.textContent).toBe('items:1');
            unmount();
        });

        test('Returns a named wrapper component', () => {
            const Wrapped = withBulkActions(() => null);
            expect(Wrapped.name).toBe('WithBulkActionsComponent');
        });
    });
});
