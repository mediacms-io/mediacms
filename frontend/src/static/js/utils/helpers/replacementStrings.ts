// check templates/config/installation/translations.html for more

declare global {
    interface Window {
        REPLACEMENTS?: Record<string, string>;
    }
}

export function replaceString(word: string) {
    if (!window.REPLACEMENTS) {
        return word;
    }

    let result = word;

    for (const [search, replacement] of Object.entries(window.REPLACEMENTS)) {
        result = result.split(search).join(replacement);
    }

    return result;
}

// @todo: Check this alterative.
/*function replaceStringRegExp(word: string) {
    if (!window.REPLACEMENTS) {
        return word;
    }

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    let result = word;

    for (const [search, replacement] of Object.entries(window.REPLACEMENTS)) {
        const regex = new RegExp(escapeRegExp(search), 'g');
        result = result.replace(regex, replacement);
    }

    return result;
}*/

// @todo: Remove older vesion.
/*export function replaceString_OLD(string: string) {
    for (const key in window.REPLACEMENTS) {
        string = string.replace(key, window.REPLACEMENTS[key]);
    }
    return string;
}*/
