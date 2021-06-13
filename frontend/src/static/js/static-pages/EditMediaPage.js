import React from 'react';
import { Page } from './_StaticPage';
import * as PageActions from './_StaticPageActions';

// TODO: Transfer page into static template.

export class EditMediaPage extends React.PureComponent {
  constructor(props) {
    super(props);
    PageActions.initPage('edit-media');
  }

  render() {
    return (
      <Page>
        <div className="user-action-form-wrap">
          <div className="user-action-form-inner">
            <h1>Edit Media</h1>

            <form encType="multipart/form-data" action="" method="post" className="post-form">
              <p className="requiredField">
                <i>Required fields with a red star</i> <span className="asteriskField">*</span>
              </p>

              <div id="div_id_title" className="control-group">
                <label htmlFor="id_title" className="control-label ">
                  Title
                </label>
                <div className="controls">
                  <input
                    type="text"
                    name="title"
                    defaultValue="filename.mp4"
                    maxLength="100"
                    className="textinput textInput"
                    id="id_title"
                  />
                </div>
              </div>

              <div id="div_id_category" className="control-group">
                <label htmlFor="id_category" className="control-label ">
                  Category
                </label>
                <div className="controls">
                  <select name="category" className="selectmultiple" id="id_category" multiple={true}>
                    <option value="1">Art</option>
                    <option value="2">Documentary</option>
                    <option value="3">Experimental</option>
                    <option value="4">Film</option>
                    <option value="5">Music</option>
                    <option value="6">TV</option>
                  </select>
                </div>
              </div>

              <div id="div_id_new_tags" className="control-group">
                <label htmlFor="id_new_tags" className="control-label ">
                  Tags
                </label>
                <div className="controls">
                  <input type="text" name="new_tags" className="textinput textInput" id="id_new_tags" />
                  <p id="hint_id_new_tags" className="help-block">
                    a comma separated list of new tags.
                  </p>
                </div>
              </div>

              <div id="div_id_description" className="control-group">
                <label htmlFor="id_description" className="control-label ">
                  Description
                </label>
                <div className="controls">
                  <textarea
                    name="description"
                    cols="40"
                    rows="10"
                    className="textarea"
                    id="id_description"
                    defaultValue="rgf dsadsaqewrtetrh fff"
                  ></textarea>
                </div>
              </div>

              <div id="div_id_state" className="control-group">
                <label htmlFor="id_state" className="control-label requiredField">
                  State<span className="asteriskField">*</span>{' '}
                </label>
                <div className="controls">
                  <select name="state" className="select" id="id_state" defaultValue="public">
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                  </select>
                </div>
              </div>

              <div id="div_id_enable_comments" className="control-group">
                <div className="controls">
                  <label htmlFor="id_enable_comments" className="checkbox ">
                    <input type="checkbox" name="enable_comments" className="checkboxinput" id="id_enable_comments" />
                    Enable comments
                  </label>
                  <p id="hint_id_enable_comments" className="help-block">
                    Whether comments will be allowed for this media
                  </p>
                </div>
              </div>

              <div id="div_id_featured" className="control-group">
                <div className="controls">
                  <label htmlFor="id_featured" className="checkbox ">
                    <input type="checkbox" name="featured" className="checkboxinput" id="id_featured" />
                    Featured
                  </label>
                  <p id="hint_id_featured" className="help-block">
                    Globally featured
                  </p>
                </div>
              </div>

              <div id="div_id_thumbnail_time" className="control-group">
                <label htmlFor="id_thumbnail_time" className="control-label ">
                  Thumbnail time
                </label>
                <div className="controls">
                  <input
                    type="number"
                    name="thumbnail_time"
                    defaultValue="13.0"
                    step="any"
                    className="numberinput"
                    id="id_thumbnail_time"
                  />
                  <p id="hint_id_thumbnail_time" className="help-block">
                    Time on video file that a thumbnail will be taken
                  </p>
                </div>
              </div>

              <div id="div_id_reported_times" className="control-group">
                <label htmlFor="id_reported_times" className="control-label requiredField">
                  Reported times<span className="asteriskField">*</span>{' '}
                </label>
                <div className="controls">
                  <input
                    type="number"
                    name="reported_times"
                    defaultValue="0"
                    className="numberinput"
                    required=""
                    id="id_reported_times"
                  />
                </div>
              </div>

              <div id="div_id_is_reviewed" className="control-group">
                <div className="controls">
                  <label htmlFor="id_is_reviewed" className="checkbox ">
                    <input type="checkbox" name="is_reviewed" className="checkboxinput" id="id_is_reviewed" />
                    Is reviewed
                  </label>
                  <p id="hint_id_is_reviewed" className="help-block">
                    Media is reviewed by admin. If not it will not appear on public listings
                  </p>
                </div>
              </div>

              <button className="primaryAction" type="submit">
                Update Media
              </button>
            </form>
          </div>
        </div>
      </Page>
    );
  }
}
