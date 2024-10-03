// check templates/config/installation/translations.html for more

export function replaceString(string) {
    for (const key in window.REPLACEMENTS) {
        string = string.replace(key, window.REPLACEMENTS[key]);
    }
    return string;
}
