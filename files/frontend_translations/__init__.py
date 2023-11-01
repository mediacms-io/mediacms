from django.conf import settings

from .de import translations as de_translations
from .el import translations as el_translations
from .fr import translations as fr_translations

translations = {}
translations['el'] = el_translations
translations['fr'] = fr_translations
translations['de'] = de_translations


def get_frontend_translations(language_code):
    if language_code not in [pair[0] for pair in settings.LANGUAGES]:
        return {}

    if language_code in ['en', 'en-us', 'en-gb']:
        return {}

    translation = translations[language_code]

    # replace any keys from translation that contains a space with an underscore
    # do not keep initial keys that contain a space
    for key in list(translation.keys()):
        if ' ' in key:
            translation[key.replace(' ', '_')] = translation.pop(key)

    return translation
