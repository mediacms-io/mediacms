export function csrfToken() {
  var i,
    cookies,
    cookie,
    cookieVal = null;
  if (document.cookie && '' !== document.cookie) {
    cookies = document.cookie.split(';');
    i = 0;
    while (i < cookies.length) {
      cookie = cookies[i].trim();
      if ('csrftoken=' === cookie.substring(0, 10)) {
        cookieVal = decodeURIComponent(cookie.substring(10));
        break;
      }
      i += 1;
    }
  }
  return cookieVal;
}
