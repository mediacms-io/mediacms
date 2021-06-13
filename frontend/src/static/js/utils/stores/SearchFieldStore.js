import EventEmitter from 'events';
import { exportStore, getRequest } from '../helpers';
import { config as mediacmsConfig } from '../settings/config.js';

function getUrlVars() {
  var vars = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
    vars[key] = value;
  });
  return vars;
}

const SearchFieldStoreData = {};

class SearchFieldStore extends EventEmitter {
  constructor() {
    super();

    this.mediacms_config = mediacmsConfig(window.MediaCMS);

    const urlvars = getUrlVars();
    const query = urlvars['q'];
    const categories = urlvars['c'];
    const tags = urlvars['t'];

    SearchFieldStoreData[
      Object.defineProperty(this, 'id', {
        value: 'SearchFieldStoreData_' + Object.keys(SearchFieldStoreData).length,
      }).id
    ] = {
      searchQuery: query ? decodeURIComponent(query).replace(/\+/g, ' ') : '',
      categoriesQuery: categories ? decodeURIComponent(categories).replace(/\+/g, ' ') : '',
      tagsQuery: tags ? decodeURIComponent(tags).replace(/\+/g, ' ') : '',
      predictions: [],
    };
    this.dataResponse = this.dataResponse.bind(this);
  }

  dataResponse(response) {
    if (response && response.data) {
      let i = 0;

      SearchFieldStoreData[this.id].predictions = [];

      while (i < response.data.length) {
        SearchFieldStoreData[this.id].predictions[i] = response.data[i].title;
        i += 1;
      }

      this.emit(
        'load_predictions',
        SearchFieldStoreData[this.id].requestedQuery,
        SearchFieldStoreData[this.id].predictions
      );

      if (SearchFieldStoreData[this.id].pendingRequested) {
        SearchFieldStoreData[this.id].requestedQuery = SearchFieldStoreData[this.id].pendingRequested.query;

        getRequest(SearchFieldStoreData[this.id].pendingRequested.url, !1, this.dataResponse);

        SearchFieldStoreData[this.id].pendingRequested = null;
      } else {
        SearchFieldStoreData[this.id].requestedQuery = null;
      }
    }
  }

  get(type) {
    switch (type) {
      case 'search-query':
        return SearchFieldStoreData[this.id].searchQuery;
      case 'search-categories':
        return SearchFieldStoreData[this.id].categoriesQuery;
      case 'search-tags':
        return SearchFieldStoreData[this.id].tagsQuery;
    }
    return null;
  }

  actions_handler(action) {
    switch (action.type) {
      case 'REQUEST_PREDICTIONS':
        let q = action.query;
        let u = this.mediacms_config.api.search.titles + q;

        if (SearchFieldStoreData[this.id].requestedQuery) {
          if (SearchFieldStoreData[this.id].requestedQuery.q !== q) {
            SearchFieldStoreData[this.id].pendingRequested = { query: q, url: u };
          }

          return;
        }

        SearchFieldStoreData[this.id].requestedQuery = q;

        getRequest(u, !1, this.dataResponse);
        break;
    }
  }
}

export default exportStore(new SearchFieldStore(), 'actions_handler');
