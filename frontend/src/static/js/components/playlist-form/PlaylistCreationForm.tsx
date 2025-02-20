import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../utils/stores/store';
import { PageActions, MediaPageActions } from '../../utils/actions/';
import { MediaPageStore } from '../../utils/stores/';
import './PlaylistForm.scss';
import { loadPlaylistData, updatePlaylist } from '../../utils/stores/actions/playlistPage';

interface PlaylistCreationFormProps {
  id?: string; // If provided, editing mode
  onCancel: () => void;
  onPlaylistSave: CallableFunction;
}

export const PlaylistCreationForm: React.FC<PlaylistCreationFormProps> = ({ id, onCancel, onPlaylistSave }) => {
  const dispatch = useDispatch<AppDispatch>();
  const nameRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

  const playlistData = useSelector((state: RootState) => state.playlistPage.data);
  console.log(playlistData);

  const [title, setTitle] = useState(id ? playlistData?.title || '' : '');
  const [description, setDescription] = useState(id ? playlistData?.description || '' : '');

  useEffect(() => {
    if (id) {
      dispatch(loadPlaylistData(id));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (playlistData) {
      setTitle(playlistData.title);
      setDescription(playlistData.description);
    }
  }, [playlistData]);

  const playlistCreationCompleted = (newPlaylistData: any) => {
    setTimeout(() => {
      PageActions.addNotification('Playlist created', 'playlistCreationCompleted');
      const plistData = {
        playlist_id: newPlaylistData.url.split('/').pop(),
        add_date: newPlaylistData.add_date,
        description: newPlaylistData.description,
        title: newPlaylistData.title,
        media_list: [],
      };
      onPlaylistSave(plistData);
    }, 100);
  };

  // Handle failed playlist creation
  const playlistCreationFailed = () => {
    setTimeout(() => {
      PageActions.addNotification('Playlist creation failed', 'playlistCreationFailed');
    }, 100);
  };

  // Effect: Listen for MediaPageStore events (Flux)
  useEffect(() => {
    MediaPageStore.on('playlist_creation_completed', playlistCreationCompleted);
    MediaPageStore.on('playlist_creation_failed', playlistCreationFailed);
    nameInputRef.current?.focus();

    return () => {
      MediaPageStore.removeListener('playlist_creation_completed', playlistCreationCompleted);
      MediaPageStore.removeListener('playlist_creation_failed', playlistCreationFailed);
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleSaveClick = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      nameRef.current?.classList.add('invalid');
      return;
    }

    const trimmedDescription = description.trim();

    if (id) {
      // Updating existing playlist
      dispatch(updatePlaylist(id, trimmedTitle, trimmedDescription));
    } else {
      // Creating new playlist
      MediaPageActions.createPlaylist({
        title: trimmedTitle,
        description: trimmedDescription,
      });
    }
  };

  return (
    <div className="playlist-form-wrap">
      <div className="playlist-form-field playlist-title" ref={nameRef}>
        <span className="playlist-form-label">Title</span>
        <input
          ref={nameInputRef}
          type="text"
          placeholder="Enter playlist title..."
          value={title}
          onChange={handleTitleChange}
        />
      </div>

      <div className="playlist-form-field playlist-description" ref={descriptionRef}>
        <span className="playlist-form-label">Description</span>
        <textarea
          ref={descriptionInputRef}
          rows={1}
          placeholder="Enter playlist description..."
          value={description}
          onChange={handleDescriptionChange}
        ></textarea>
      </div>

      <div className="playlist-form-actions">
        <button className="cancel-btn" onClick={onCancel}>
          CANCEL
        </button>
        <button className="create-btn" onClick={handleSaveClick}>
          {id ? 'UPDATE' : 'CREATE'}
        </button>
      </div>
    </div>
  );
};

PlaylistCreationForm.propTypes = {
  id: PropTypes.string,
  onCancel: PropTypes.func.isRequired,
  onPlaylistSave: PropTypes.func.isRequired,
};
