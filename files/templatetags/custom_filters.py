from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from django import template

from files.frontend_translations import translate_string

register = template.Library()


@register.filter
def custom_translate(string, lang_code):
    return translate_string(lang_code, string)


@register.filter
def single_sort_url(url):
    """Keep only the primary ``o`` field so changelist header clicks replace prior sorts.

    Django's ``url_primary`` / ``url_toggle`` keep secondary orderings (``o=2.-1``), which
    leaves sort icons on previously selected columns. Header clicks should be single-field.
    """
    if not url:
        return url
    parts = urlsplit(str(url))
    query = []
    for key, value in parse_qsl(parts.query, keep_blank_values=True):
        if key == "o" and value:
            query.append((key, value.split(".", 1)[0]))
        else:
            query.append((key, value))
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
