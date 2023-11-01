// check templates/config/installation/translations.html for more

export function translate_string(string) {
    if (window.TRANSLATIONS && window.TRANSLATIONS[string]) {
        return window.TRANSLATIONS[string];
    } else {
        return string;
    }
}
