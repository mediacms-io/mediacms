import React from 'react';
import AttachmentManager from '../components/media-viewer/AttachmentManager';

export default function EditAttachmentsPage() {
  // mediaId ophalen uit querystring
  const params = new URLSearchParams(window.location.search);
  const mediaId = params.get('m');

  return (
    <div className="edit-attachments-page">
      <AttachmentManager mediaId={mediaId} />
    </div>
  );
}
