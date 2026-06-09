import React from 'react';
import { useBulkActions } from '../hooks/useBulkActions';

/**
 * Higher-Order Component that provides bulk actions functionality
 * to class components via props
 */
export function withBulkActions(WrappedComponent) {
  return function WithBulkActionsComponent(props) {
    const bulkActions = useBulkActions();

    return (
      <WrappedComponent
        {...props}
        bulkActions={bulkActions}
      />
    );
  };
}
