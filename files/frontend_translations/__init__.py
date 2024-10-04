import os
from django.conf import settings

current_dir = os.path.dirname(os.path.abspath(__file__))
files = os.listdir(current_dir)
translation_strings = {}
replacement_strings = {}

def check_language_code(language_code):
    # helper function
    if language_code not in [pair[0] for pair in settings.LANGUAGES]:
        return False
    if language_code in ['en', 'en-us', 'en-gb']:
        return False
    return True

for translation_file in files:
    # the language code is zh-hans but the file is zh_hans.py

    language_code_file = translation_file.split('.')[0]
    language_code = language_code_file.replace('_', '-')
    if not check_language_code(language_code):
        continue

    exec(f'from .{language_code_file} import translation_strings as {language_code_file}_translation_strings')
    exec(f'from .{language_code_file} import replacement_strings as {language_code_file}_replacement_strings')

    translation_strings[language_code] = eval(f'{language_code_file}_translation_strings')
    replacement_strings[language_code] = eval(f'{language_code_file}_replacement_strings')


def get_translation(language_code):
    # get list of translations per language
    if not check_language_code(language_code):
        return {}

    translation = translation_strings[language_code]

    return translation


def get_translation_strings(language_code):
    # get list of replacement strings per language
    if not check_language_code(language_code):
        return {}

    translation = replacement_strings[language_code]

    return translation


def translate_string(language_code, string):
    # translate a string to the given language
    if not check_language_code(language_code):
        return string

    return translation_strings[language_code].get(string, string)
