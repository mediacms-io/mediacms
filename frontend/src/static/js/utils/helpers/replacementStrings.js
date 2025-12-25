// check templates/config/installation/translations.html for more

export function replaceString(word) {
    if (!window.REPLACEMENTS) {
        return word;
    }

    let result = word;

    for (const [search, replacement] of Object.entries(window.REPLACEMENTS)) {
        result = result.split(search).join(replacement);
    }

    return result;
}
