// check templates/config/installation/translations.html for more

export function translateString(str) {
    return window.TRANSLATION?.[str] ?? str;
}
