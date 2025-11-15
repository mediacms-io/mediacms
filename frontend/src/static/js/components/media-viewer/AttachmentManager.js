import React, { useEffect, useState } from 'react';
import { translateString } from '../../utils/helpers/';

export default function AttachmentManager({ mediaId }) {
  const [attachments, setAttachments] = useState([]);
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/v1/attachments/?media=${mediaId}`)
      .then(res => res.json())
      .then(data => setAttachments(data))
      .catch(() => setError(translateString('Could not load attachments')));
  }, [mediaId]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !name) return;
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('media', mediaId);
    formData.append('name', name);
    formData.append('file', file);
    try {
      const res = await fetch('/api/v1/attachments/', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const newAttachment = await res.json();
      setAttachments([...attachments, newAttachment]);
      setName('');
      setFile(null);
    } catch (err) {
      setError(translateString('Upload failed'));
    }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/attachments/${id}/`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setAttachments(attachments.filter(a => a.id !== id));
    } catch {
      setError(translateString('Delete failed'));
    }
    setLoading(false);
  };

  return (
    <div className="attachment-manager">
      <h3>{translateString('ATTACHMENTS')}</h3>
      <form onSubmit={handleUpload}>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder={translateString('Filename')} required />
        <input type="file" onChange={e => setFile(e.target.files[0])} required />
        <button type="submit" disabled={loading}>{translateString('UPLOAD')}</button>
      </form>
      {error && <div className="error">{error}</div>}
      <ul>
        {attachments.map(att => (
          <li key={att.id}>
            <a href={att.file_url} target="_blank" rel="noopener noreferrer">{att.name}</a>
            <button onClick={() => handleDelete(att.id)} disabled={loading}>{translateString('DELETE')}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
