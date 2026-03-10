export function csrfToken() {
    let cookieVal = null;

    if (document.cookie && '' !== document.cookie) {
        const cookies = document.cookie.split(';');
        let i = 0;
        while (i < cookies.length) {
            const cookie = cookies[i].trim();
            if ('csrftoken=' === cookie.substring(0, 10)) {
                cookieVal = decodeURIComponent(cookie.substring(10));
                break;
            }
            i += 1;
        }
    }

    return cookieVal;
}
