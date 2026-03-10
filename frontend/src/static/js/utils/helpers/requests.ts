import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

export async function getRequest(
    url: string,
    sync: boolean = false,
    callback?: (response: AxiosResponse<any, any, {}>) => void,
    errorCallback?: (err: any) => void
) {
    const requestConfig = {
        timeout: undefined,
        maxContentLength: undefined,
    };

    function responseHandler(result: AxiosResponse<any, any, {}>) {
        if (callback) {
            callback(result);
        }
    }

    function errorHandler(reason: any) {
        if (!errorCallback) {
            return;
        }

        let err = reason;
        if (reason.response === undefined) {
            err = {
                type: 'network',
                error: reason,
            };
        } else if (reason.response.status !== undefined) {
            // @todo: Improve this, it's valid only in case of media requests.
            switch (reason.response.status) {
                case 401:
                    err = {
                        type: 'private',
                        error: reason,
                        message: 'Media is private',
                    };
                    break;
                case 400:
                    err = {
                        type: 'unavailable',
                        error: reason,
                        message: 'Media is unavailable',
                    };
                    break;
            }
        }

        errorCallback(err);
    }

    if (sync) {
        await axios
            .get(url, requestConfig)
            .then(responseHandler)
            .catch(errorHandler || null);
    } else {
        axios
            .get(url, requestConfig)
            .then(responseHandler)
            .catch(errorHandler || null);
    }
}

export async function postRequest(
    url: string,
    postData: any,
    configData?: AxiosRequestConfig<any>,
    sync: boolean = false,
    callback?: (response: AxiosResponse<any, any, {}>) => void,
    errorCallback?: (error: any) => void
) {
    postData = postData || {};

    function responseHandler(result: AxiosResponse<any, any, {}>) {
        if (callback) {
            callback(result);
        }
    }

    function errorHandler(error: any) {
        if (errorCallback) {
            errorCallback(error);
        }
    }

    if (sync) {
        await axios
            .post(url, postData, configData)
            .then(responseHandler)
            .catch(errorHandler || null);
    } else {
        axios
            .post(url, postData, configData)
            .then(responseHandler)
            .catch(errorHandler || null);
    }
}

export async function putRequest(
    url: string,
    putData: any,
    configData?: AxiosRequestConfig<any>,
    sync: boolean = false,
    callback?: (response: AxiosResponse<any, any, {}>) => void,
    errorCallback?: (error: any) => void
) {
    putData = putData || {};

    function responseHandler(result: AxiosResponse<any, any, {}>) {
        if (callback) {
            callback(result);
        }
    }

    function errorHandler(error: any) {
        if (errorCallback) {
            errorCallback(error);
        }
    }

    if (sync) {
        await axios
            .put(url, putData, configData)
            .then(responseHandler)
            .catch(errorHandler || null);
    } else {
        axios
            .put(url, putData, configData)
            .then(responseHandler)
            .catch(errorHandler || null);
    }
}

export async function deleteRequest(
    url: string,
    configData?: AxiosRequestConfig<any>,
    sync: boolean = false,
    callback?: (response: AxiosResponse<any, any, {}>) => void,
    errorCallback?: (error: any) => void
) {
    configData = configData || {};

    function responseHandler(result: AxiosResponse<any, any, {}>) {
        if (callback) {
            callback(result);
        }
    }

    function errorHandler(error: any) {
        if (errorCallback) {
            errorCallback(error);
        }
    }

    if (sync) {
        await axios
            .delete(url, configData)
            .then(responseHandler)
            .catch(errorHandler || null);
    } else {
        axios
            .delete(url, configData || null)
            .then(responseHandler)
            .catch(errorHandler || null);
    }
}
