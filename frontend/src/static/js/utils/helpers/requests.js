import axios from 'axios';

export async function getRequest(url, sync, callback, errorCallback) {
  const requestConfig = {
    timeout: null,
    maxContentLength: null,
  };

  function responseHandler(result) {
    if (callback instanceof Function || typeof callback === 'function') {
      callback(result);
    }
  }

  function errorHandler(error) {
    if (errorCallback instanceof Function || typeof errorCallback === 'function') {
      let err = error;
      if (void 0 === error.response) {
        err = {
          type: 'network',
          error: error,
        };
      } else if (void 0 !== error.response.status) {
        // TODO: Improve this, it's valid only in case of media requests.
        switch (error.response.status) {
          case 401:
            err = {
              type: 'private',
              error: error,
              message: 'Media is private',
            };
            break;
          case 400:
            err = {
              type: 'unavailable',
              error: error,
              message: 'Media is unavailable',
            };
            break;
        }
      }
      errorCallback(err);
    }
  }

  if (sync) {
    await axios.get(url, requestConfig)
      .then(responseHandler)
      .catch(errorHandler || null);
  } else {
    axios.get(url, requestConfig)
      .then(responseHandler)
      .catch(errorHandler || null);
  }
}

export async function postRequest(url, postData, configData, sync, callback, errorCallback) {
  postData = postData || {};

  function responseHandler(result) {
    if (callback instanceof Function || typeof callback === 'function') {
      callback(result);
    }
  }

  function errorHandler(error) {
    if (errorCallback instanceof Function || typeof errorCallback === 'function') {
      errorCallback(error);
    }
  }

  if (sync) {
    await axios.post(url, postData, configData || null)
      .then(responseHandler)
      .catch(errorHandler || null);
  } else {
    axios.post(url, postData, configData || null)
      .then(responseHandler)
      .catch(errorHandler || null);
  }
}

export async function putRequest(url, putData, configData, sync, callback, errorCallback) {
  putData = putData || {};

  function responseHandler(result) {
    if (callback instanceof Function || typeof callback === 'function') {
      callback(result);
    }
  }

  function errorHandler(error) {
    if (errorCallback instanceof Function || typeof errorCallback === 'function') {
      errorCallback(error);
    }
  }

  if (sync) {
    await axios.put(url, putData, configData || null)
      .then(responseHandler)
      .catch(errorHandler || null);
  } else {
    axios.put(url, putData, configData || null)
      .then(responseHandler)
      .catch(errorHandler || null);
  }
}

export async function deleteRequest(url, configData, sync, callback, errorCallback) {
  configData = configData || {};

  function responseHandler(result) {
    if (callback instanceof Function || typeof callback === 'function') {
      callback(result);
    }
  }

  function errorHandler(error) {
    if (errorCallback instanceof Function || typeof errorCallback === 'function') {
      errorCallback(error);
    }
  }

  if (sync) {
    await axios
      .delete(url, configData || null)
      .then(responseHandler)
      .catch(errorHandler || null);
  } else {
    axios
      .delete(url, configData || null)
      .then(responseHandler)
      .catch(errorHandler || null);
  }
}
