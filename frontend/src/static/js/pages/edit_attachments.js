import React from 'react';
import { createRoot } from 'react-dom/client';
import EditAttachmentsPage from './EditAttachmentsPage';

document.addEventListener('DOMContentLoaded', function () {
  const rootEl = document.getElementById('attachment-manager-root');
  if (rootEl) {
    createRoot(rootEl).render(<EditAttachmentsPage />);
  }
});
