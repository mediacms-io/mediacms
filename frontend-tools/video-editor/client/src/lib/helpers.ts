export function csrfToken(): string {
  const name = 'csrftoken';
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue || '';
}

export function postRequest(
  url: string,
  data: any,
  options: { headers?: Record<string, string> },
  async: boolean,
  successCallback: (response: any) => void,
  errorCallback: (error: Error) => void
) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url, async);
  
  // Set headers
  xhr.setRequestHeader('Content-Type', 'application/json');
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });
  }

  xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const response = JSON.parse(xhr.responseText);
        successCallback(response);
      } catch (e) {
        errorCallback(new Error('Failed to parse response'));
      }
    } else {
      errorCallback(new Error(`HTTP error! status: ${xhr.status}`));
    }
  };

  xhr.onerror = function() {
    errorCallback(new Error('Network error occurred'));
  };

  xhr.send(JSON.stringify(data));
} 