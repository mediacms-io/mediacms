import React, { useState, useEffect } from 'react';
import './BulkActionTagModal.scss';
import { translateString } from '../utils/helpers/';

interface Tag {
  title: string;
}

interface BulkActionTagModalProps {
  isOpen: boolean;
  selectedMediaIds: string[];
  onCancel: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  csrfToken: string;
}

export const BulkActionTagModal: React.FC<BulkActionTagModalProps> = ({
  isOpen,
  selectedMediaIds,
  onCancel,
  onSuccess,
  onError,
  csrfToken,
}) => {
  const [existingTags, setExistingTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagsToAdd, setTagsToAdd] = useState<Tag[]>([]);
  const [tagsToRemove, setTagsToRemove] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen && selectedMediaIds.length > 0) {
      fetchData();
    } else {
      // Reset state when modal closes
      setExistingTags([]);
      setAllTags([]);
      setTagsToAdd([]);
      setTagsToRemove([]);
    }
  }, [isOpen, selectedMediaIds]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch existing tags (intersection - tags all selected media belong to)
      const existingResponse = await fetch('/api/v1/media/user/bulk_actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({
          action: 'tag_membership',
          media_ids: selectedMediaIds,
        }),
      });

      if (!existingResponse.ok) {
        throw new Error(translateString('Failed to fetch existing tags'));
      }

      const existingData = await existingResponse.json();
      const existing = existingData.results || [];

      // Fetch all tags
      const allResponse = await fetch('/api/v1/tags');
      if (!allResponse.ok) {
        throw new Error(translateString('Failed to fetch all tags'));
      }

      const allData = await allResponse.json();
      const all = allData.results || allData;

      setExistingTags(existing);
      setAllTags(all);
    } catch (error) {
      console.error('Error fetching tags:', error);
      onError(translateString('Failed to load tags'));
    } finally {
      setIsLoading(false);
    }
  };

  const addTagToList = (tag: Tag) => {
    if (!tagsToAdd.some((t) => t.title === tag.title)) {
      setTagsToAdd([...tagsToAdd, tag]);
    }
  };

  const removeTagFromAddList = (tag: Tag) => {
    setTagsToAdd(tagsToAdd.filter((t) => t.title !== tag.title));
  };

  const markTagForRemoval = (tag: Tag) => {
    if (!tagsToRemove.some((t) => t.title === tag.title)) {
      setTagsToRemove([...tagsToRemove, tag]);
    }
  };

  const unmarkTagForRemoval = (tag: Tag) => {
    setTagsToRemove(tagsToRemove.filter((t) => t.title !== tag.title));
  };

  const handleProceed = async () => {
    setIsProcessing(true);

    try {
      // First, add tags if any
      if (tagsToAdd.length > 0) {
        const titlesToAdd = tagsToAdd.map((t) => t.title);
        const addResponse = await fetch('/api/v1/media/user/bulk_actions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
          },
          body: JSON.stringify({
            action: 'add_tags',
            media_ids: selectedMediaIds,
            tag_titles: titlesToAdd,
          }),
        });

        if (!addResponse.ok) {
          throw new Error(translateString('Failed to add tags'));
        }
      }

      // Then, remove tags if any
      if (tagsToRemove.length > 0) {
        const titlesToRemove = tagsToRemove.map((t) => t.title);
        const removeResponse = await fetch('/api/v1/media/user/bulk_actions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
          },
          body: JSON.stringify({
            action: 'remove_tags',
            media_ids: selectedMediaIds,
            tag_titles: titlesToRemove,
          }),
        });

        if (!removeResponse.ok) {
          throw new Error(translateString('Failed to remove tags'));
        }
      }

      onSuccess(translateString('Successfully updated tags'));
      onCancel();
    } catch (error) {
      console.error('Error processing tags:', error);
      onError(translateString('Failed to update tags. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Get tags for left panel (all tags minus those already existing)
  const getLeftPanelTags = () => {
    return allTags.filter(
      (tag) => !existingTags.some((existing) => existing.title === tag.title)
    );
  };

  // Get tags for right panel ("Add to" - existing + newly added)
  const getRightPanelTags = () => {
    // Combine existing tags with newly added ones
    const combined = [...existingTags, ...tagsToAdd];
    return combined;
  };

  if (!isOpen) return null;

  const leftPanelTags = getLeftPanelTags();
  const rightPanelTags = getRightPanelTags();

  return (
    <div className="tag-modal-overlay">
      <div className="tag-modal">
        <div className="tag-modal-header">
          <h2>{translateString('Add / Remove Tags')}</h2>
          <button className="tag-modal-close" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="tag-modal-content">
          <div className="tag-panel">
            <h3>{translateString('Tags')}</h3>

            {isLoading ? (
              <div className="loading-message">{translateString('Loading tags...')}</div>
            ) : (
              <div className="tag-list scrollable">
                {leftPanelTags.length === 0 ? (
                  <div className="empty-message">{translateString('All tags already added')}</div>
                ) : (
                  leftPanelTags.map((tag) => (
                    <div
                      key={tag.title}
                      className="tag-item clickable"
                      onClick={() => addTagToList(tag)}
                    >
                      <span>{tag.title}</span>
                      <button className="add-btn">+</button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="tag-panel">
            <h3>
              {translateString('Add to')}
              {selectedMediaIds.length > 1 && (
                <span className="info-tooltip" title={translateString('The intersection of tags in the selected media is shown')}>
                  ?
                </span>
              )}
            </h3>

            {isLoading ? (
              <div className="loading-message">{translateString('Loading tags...')}</div>
            ) : (
              <div className="tag-list scrollable">
                {rightPanelTags.length === 0 ? (
                  <div className="empty-message">{translateString('No tags')}</div>
                ) : (
                  rightPanelTags.map((tag) => {
                    const isExisting = existingTags.some((t) => t.title === tag.title);
                    const isMarkedForRemoval = tagsToRemove.some((t) => t.title === tag.title);

                    return (
                      <div key={tag.title} className={`tag-item ${isMarkedForRemoval ? 'marked-for-removal' : ''}`}>
                        <span>{tag.title}</span>
                        <button
                          className="remove-btn"
                          onClick={() => {
                            if (isExisting) {
                              // This is an existing tag - mark/unmark for removal
                              isMarkedForRemoval ? unmarkTagForRemoval(tag) : markTagForRemoval(tag);
                            } else {
                              // This is a newly added tag - remove from add list
                              removeTagFromAddList(tag);
                            }
                          }}
                          title={isMarkedForRemoval ? translateString('Undo removal') : isExisting ? translateString('Remove tag') : translateString('Remove from list')}
                        >
                          {isMarkedForRemoval ? '↺' : '×'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        <div className="tag-modal-footer">
          <button className="tag-btn tag-btn-cancel" onClick={onCancel} disabled={isProcessing}>
            {translateString('Cancel')}
          </button>
          <button
            className="tag-btn tag-btn-proceed"
            onClick={handleProceed}
            disabled={isProcessing || (tagsToAdd.length === 0 && tagsToRemove.length === 0)}
          >
            {isProcessing ? translateString('Processing...') : translateString('Proceed')}
          </button>
        </div>
      </div>
    </div>
  );
};
