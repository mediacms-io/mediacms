from django.conf import settings

from .de import translation_strings as de_translation_strings, replacement_strings as de_replacement_strings
from .el import translation_strings as el_translation_strings, replacement_strings as el_replacement_strings
from .fr import translation_strings as fr_translation_strings, replacement_strings as fr_replacement_strings

translation_strings = {}
translation_strings['el'] = el_translation_strings
translation_strings['fr'] = fr_translation_strings
translation_strings['de'] = de_translation_strings

replacement_strings = {}
replacement_strings['el'] = el_replacement_strings

def get_translation(language_code):
    if language_code not in [pair[0] for pair in settings.LANGUAGES]:
        return {}

    if language_code in ['en', 'en-us', 'en-gb']:
        return {}

    translation = translation_strings[language_code]

    return translation


def get_translation_strings(language_code):
    if language_code not in [pair[0] for pair in settings.LANGUAGES]:
        return {}

    if language_code in ['en', 'en-us', 'en-gb']:
        return {}

    translation = replacement_strings[language_code]

    return translation
