// check templates/config/installation/translations.html for more

export function translateString(string) {
    if (window.TRANSLATION && window.TRANSLATION[string]) {
        return window.TRANSLATION[string];
    } else {
        return string;
    }
}
