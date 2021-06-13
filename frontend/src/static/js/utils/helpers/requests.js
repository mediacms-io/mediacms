import axios, { get as axiosGet, post as axiosPost, put as axiosPut } from 'axios';

export async function getRequest(url, sync, callback, errorCallback) {
  const requestConfig = {
    timeout: null,
    maxContentLength: null,
  };

  function responseHandler(result) {
    if (callback instanceof Function) {
      callback(result);
    }
  }

  function errorHandler(error) {
    if (errorCallback instanceof Function) {
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
    await axiosGet(url, requestConfig)
      .then(responseHandler)
      .catch(errorHandler || null);
  } else {
    axiosGet(url, requestConfig)
      .then(responseHandler)
      .catch(errorHandler || null);
  }
}

export async function postRequest(url, postData, configData, sync, callback, errorCallback) {
  postData = postData || {};

  function responseHandler(result) {
    if (callback instanceof Function) {
      callback(result);
    }
  }

  function errorHandler(error) {
    if (errorCallback instanceof Function) {
      errorCallback(error);
    }
  }

  if (sync) {
    await axiosPost(url, postData, configData || null)
      .then(responseHandler)
      .catch(errorHandler || null);
  } else {
    axiosPost(url, postData, configData || null)
      .then(responseHandler)
      .catch(errorHandler || null);
  }
}

export async function putRequest(url, putData, configData, sync, callback, errorCallback) {
  putData = putData || {};

  function responseHandler(result) {
    if (callback instanceof Function) {
      callback(result);
    }
  }

  function errorHandler(error) {
    if (errorCallback instanceof Function) {
      errorCallback(error);
    }
  }

  if (sync) {
    await axiosPut(url, putData, configData || null)
      .then(responseHandler)
      .catch(errorHandler || null);
  } else {
    axiosPut(url, putData, configData || null)
      .then(responseHandler)
      .catch(errorHandler || null);
  }
}

export async function deleteRequest(url, configData, sync, callback, errorCallback) {
  configData = configData || {};

  function responseHandler(result) {
    if (callback instanceof Function) {
      callback(result);
    }
  }

  function errorHandler(error) {
    if (errorCallback instanceof Function) {
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
