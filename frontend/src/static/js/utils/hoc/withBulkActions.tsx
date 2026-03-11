import React from 'react';
import { useBulkActions } from '../hooks/useBulkActions';

/**
 * Higher-Order Component that provides bulk actions functionality
 * to class components via props
 */
export function withBulkActions<P extends { bulkActions: ReturnType<typeof useBulkActions> }>(
    WrappedComponent: React.ComponentType<P>
) {
    return function WithBulkActionsComponent(props: Omit<P, 'bulkActions'>) {
        const bulkActions = useBulkActions();
        return <WrappedComponent {...(props as P)} bulkActions={bulkActions} />;
    };
}
