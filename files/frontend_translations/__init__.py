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
replacement_strings['de'] = de_replacement_strings
replacement_strings['fr'] = fr_replacement_strings

def check_language_code(language_code):
    if language_code not in [pair[0] for pair in settings.LANGUAGES]:
        return False

    if language_code in ['en', 'en-us', 'en-gb']:
        return False

    return True


def get_translation(language_code):
    if not check_language_code(language_code):
        return {}

    translation = translation_strings[language_code]

    return translation


def get_translation_strings(language_code):
    if not check_language_code(language_code):
        return {}

    translation = replacement_strings[language_code]

    return translation


def translate_string(language_code, string):
    if not check_language_code(language_code):
        return string

    return translation_strings[language_code].get(string, string)
