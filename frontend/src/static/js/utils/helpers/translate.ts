// check templates/config/installation/translations.html for more

declare global {
    interface Window {
        TRANSLATION?: Record<string, string>;
    }
}

export function translateString(word: string) {
    return window.TRANSLATION?.[word] ?? word;
}
