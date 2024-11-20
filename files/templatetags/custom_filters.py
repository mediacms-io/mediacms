from django import template

from files.frontend_translations import translate_string

register = template.Library()


@register.filter
def custom_translate(string, lang_code):
    return translate_string(lang_code, string)
