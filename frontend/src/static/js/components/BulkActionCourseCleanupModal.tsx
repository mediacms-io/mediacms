import React, { useState, useEffect } from 'react';
import './BulkActionCategoryModal.scss';
import './BulkActionCourseCleanupModal.scss';
import { translateString } from '../utils/helpers/';

interface Course {
  title: string;
  uid: string;
}

interface BulkActionCourseCleanupModalProps {
  isOpen: boolean;
  selectedMediaIds: string[];
  onCancel: () => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  csrfToken: string;
}

export const BulkActionCourseCleanupModal: React.FC<BulkActionCourseCleanupModalProps> = ({
  isOpen,
  selectedMediaIds,
  onCancel,
  onSuccess,
  onError,
  csrfToken,
}) => {
  const hasMediaSelected = selectedMediaIds.length > 0;
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [coursesToCleanup, setCoursesToCleanup] = useState<Course[]>([]);
  const [removePermissions, setRemovePermissions] = useState(false);
  const [removeComments, setRemoveComments] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
    } else {
      setAvailableCourses([]);
      setCoursesToCleanup([]);
      setRemovePermissions(false);
      setRemoveComments(false);
      setApplyToAll(false);
    }
  }, [isOpen, selectedMediaIds.join(',')]);

  const fetchCourses = async () => {
    setIsLoading(true);
    try {
      const contributorResponse = await fetch('/api/v1/categories/contributor?lms_courses_only=true');
      if (!contributorResponse.ok) throw new Error('Failed to fetch courses');
      const contributorData = await contributorResponse.json();
      const allContributorCourses: Course[] = contributorData.results || contributorData;

      if (hasMediaSelected) {
        const membershipResponse = await fetch('/api/v1/media/user/bulk_actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
          body: JSON.stringify({ action: 'category_membership', media_ids: selectedMediaIds }),
        });
        if (!membershipResponse.ok) throw new Error('Failed to fetch media categories');
        const membershipData = await membershipResponse.json();
        const mediaCategoryUids = new Set((membershipData.results || []).map((c: Course) => c.uid));
        setAvailableCourses(allContributorCourses.filter((c) => mediaCategoryUids.has(c.uid)));
      } else {
        setAvailableCourses(allContributorCourses);
      }
    } catch (error) {
      onError(translateString('Failed to load courses'));
    } finally {
      setIsLoading(false);
    }
  };

  const addCourseToCleanup = (course: Course) => {
    if (!coursesToCleanup.some((c) => c.uid === course.uid)) {
      setCoursesToCleanup((prev) => [...prev, course]);
      setAvailableCourses((prev) => prev.filter((c) => c.uid !== course.uid));
    }
  };

  const removeCourseFromCleanup = (course: Course) => {
    setCoursesToCleanup((prev) => prev.filter((c) => c.uid !== course.uid));
    setAvailableCourses((prev) => [...prev, course]);
  };

  const handleProceed = async () => {
    if (coursesToCleanup.length === 0) return;
    setIsProcessing(true);
    try {
      const response = await fetch('/api/v1/media/user/bulk_actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({
          action: 'course_cleanup',
          media_ids: selectedMediaIds,
          category_uids: coursesToCleanup.map((c) => c.uid),
          remove_permissions: removePermissions,
          remove_comments: removeComments,
          apply_to_all: applyToAll,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed');
      }
      onSuccess(translateString('Course cleanup completed successfully'));
      onCancel();
    } catch (error: any) {
      onError(error.message || translateString('Course cleanup failed. Please try again.'));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="category-modal-overlay">
      <div className="category-modal">
        <div className="category-modal-header">
          <div>
            <h2>{translateString('Course Cleanup')}</h2>
            <div className="category-modal-subtitle">
              <span>
                {translateString(
                  'Cleanup irrelevant course content such as old user permissions and course tags. Add course to the right column and select what to cleanup under the Column. The cleanup can apply to the media you have selected only or to all media in the course, if that option is selected.'
                )}
              </span>
            </div>
          </div>
          <button className="category-modal-close" onClick={onCancel}>
            ×
          </button>
        </div>

        <div className="category-modal-content">
          <div className="category-panel">
            <h3>{translateString('Courses available')}</h3>
            {isLoading ? (
              <div className="loading-message">{translateString('Loading courses...')}</div>
            ) : (
              <div className="category-list scrollable">
                {availableCourses.length === 0 ? (
                  <div className="empty-message">{translateString('No courses available')}</div>
                ) : (
                  availableCourses.map((course) => (
                    <div
                      key={course.uid}
                      className="category-item clickable"
                      onClick={() => addCourseToCleanup(course)}
                    >
                      <span>{course.title}</span>
                      <button className="add-btn">+</button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="category-panel">
            <h3>{translateString('Courses to cleanup')}</h3>
            {isLoading ? (
              <div className="loading-message">{translateString('Loading courses...')}</div>
            ) : (
              <>
                <div className="category-list scrollable">
                  {coursesToCleanup.length === 0 ? (
                    <div className="empty-message">{translateString('No courses selected')}</div>
                  ) : (
                    coursesToCleanup.map((course) => (
                      <div key={course.uid} className="category-item">
                        <span>{course.title}</span>
                        <button
                          className="remove-btn"
                          onClick={() => removeCourseFromCleanup(course)}
                          title={translateString('Remove from list')}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="course-cleanup-options">
                  <label className="course-cleanup-checkbox">
                    <input
                      type="checkbox"
                      checked={removePermissions}
                      onChange={(e) => setRemovePermissions(e.target.checked)}
                    />
                    <span>{translateString('Remove present course permissions for all course members')}</span>
                  </label>
                  <label className="course-cleanup-checkbox">
                    <input
                      type="checkbox"
                      checked={removeComments}
                      onChange={(e) => setRemoveComments(e.target.checked)}
                    />
                    <span>{translateString('Remove Comments')}</span>
                  </label>
                  {hasMediaSelected && (
                    <label className="course-cleanup-checkbox">
                      <input
                        type="checkbox"
                        checked={applyToAll}
                        onChange={(e) => setApplyToAll(e.target.checked)}
                      />
                      <span>{translateString('Apply cleanup to all media shared in the course')}</span>
                    </label>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="category-modal-footer">
          <button className="category-btn category-btn-cancel" onClick={onCancel} disabled={isProcessing}>
            {translateString('Cancel')}
          </button>
          <button
            className="category-btn category-btn-proceed"
            onClick={handleProceed}
            disabled={isProcessing || coursesToCleanup.length === 0}
          >
            {isProcessing ? translateString('Processing...') : translateString('Proceed')}
          </button>
        </div>
      </div>
    </div>
  );
};
