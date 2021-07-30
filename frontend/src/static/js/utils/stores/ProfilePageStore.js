import EventEmitter from 'events';
import { exportStore, getRequest, deleteRequest, csrfToken } from '../helpers';

import { config as mediacmsConfig } from '../settings/config.js';

class ProfilePageStore extends EventEmitter {
  constructor() {
    super();
    this.mediacms_config = mediacmsConfig(window.MediaCMS);
    this.authorData = null;
    this.authorQuery = void 0;
    this.onDataLoad = this.onDataLoad.bind(this);
    this.onDataLoadFail = this.onDataLoadFail.bind(this);
    this.removeProfileResponse = this.removeProfileResponse.bind(this);
    this.removeProfileFail = this.removeProfileFail.bind(this);
    this.removingProfile = false;
  }

  removeProfileResponse(response) {
    if (response && 204 === response.status) {
      this.emit('profile_delete', this.authorData.username);
    }
  }

  removeProfileFail() {
    this.emit('profile_delete_fail', this.authorData.username);
    setTimeout(
      function (ins) {
        this.removingProfile = false;
      },
      100,
      this
    );
  }

  get(type) {
    switch (type) {
      case 'author-data':
        return this.authorData;
      case 'author-query':
        if (void 0 === this.authorQuery) {
          this.authorQuery = null;

          let getArgs = window.location.search;

          if (getArgs && '' !== getArgs) {
            getArgs = getArgs.split('?')[1].split('=');

            let i = 0;
            while (i < getArgs.length) {
              if ('aq' === getArgs[i]) {
                this.authorQuery = getArgs[i + 1] || null;
                break;
              }

              i += 1;
            }
          }
        }

        return this.authorQuery;
    }
  }

  onDataLoad(response) {
    if (response && response.data) {
      this.authorData = response.data;
      this.authorData.id = this.authorData.username;
      this.authorData.name = '' !== this.authorData.name ? this.authorData.name : this.authorData.username;
      this.emit('load-author-data');
    }
  }

  onDataLoadFail(response) {
    // TODO: Continue here.
  }

  actions_handler(action) {
    switch (action.type) {
      case 'REMOVE_PROFILE':
        if (this.removingProfile) {
          return;
        }
        this.removingProfile = true;
        let deleteAPIurl = this.mediacms_config.api.users + '/' + this.authorData.username;
        deleteRequest(
          deleteAPIurl,
          { headers: { 'X-CSRFToken': csrfToken() } },
          false,
          this.removeProfileResponse,
          this.removeProfileFail
        );
        break;
      case 'LOAD_AUTHOR_DATA':
        getRequest(
          this.mediacms_config.api.users + '/' + window.MediaCMS.profileId,
          !1,
          this.onDataLoad,
          this.onDataLoadFail
        );
        break;
    }
  }
}

export default exportStore(new ProfilePageStore(), 'actions_handler');
