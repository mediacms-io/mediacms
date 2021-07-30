import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { PageStore } from '../../utils/stores/';

export function ReportForm(props) {
  const formActionsBottomRef = useRef(null);
  const reportMessageTextRef = useRef(null);

  const [maxFormContentHeight, setMaxFormContentHeight] = useState(null);

  function onWindowResize() {
    setMaxFormContentHeight(window.innerHeight - (56 + 2 * 24 + formActionsBottomRef.current.offsetHeight));
  }

  function cancelReportForm(ev) {
    ev.preventDefault();
    if (void 0 !== props.cancelReportForm) {
      props.cancelReportForm();
    }
  }

  function submitReportForm(ev) {
    const descr = reportMessageTextRef.current.value.trim();
    if ('' !== descr) {
      ev.preventDefault();
      if (void 0 !== props.submitReportForm) {
        props.submitReportForm(descr);
      }
    }
  }

  useEffect(() => {
    onWindowResize();
    PageStore.on('window_resize', onWindowResize);
    return () => {
      PageStore.removeListener('window_resize', onWindowResize);
    };
  }, []);

  return (
    <form>
      <div
        className="report-form"
        style={null !== maxFormContentHeight ? { maxHeight: maxFormContentHeight + 'px' } : null}
      >
        <div className="form-title">Report media</div>
        <div className="form-field">
          <span className="label">URL</span>
          <input type="text" readOnly value={props.mediaUrl} />
        </div>
        <div className="form-field">
          <span className="label">Description</span>
          <textarea ref={reportMessageTextRef} required></textarea>
        </div>
        <div className="form-field form-help-text">Reported media is reviewed</div>
      </div>
      <div ref={formActionsBottomRef} className="form-actions-bottom">
        <button className="cancel" onClick={cancelReportForm}>
          CANCEL
        </button>
        <button onClick={submitReportForm}>SUBMIT</button>
      </div>
    </form>
  );
}

ReportForm.propTypes = {
  mediaUrl: PropTypes.string.isRequired,
  cancelReportForm: PropTypes.func,
  submitReportForm: PropTypes.func,
};
