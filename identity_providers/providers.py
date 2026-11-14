"""Catalog of identity providers that can be configured without a schema change.

Login URLs and icons are derived from the provider id. LoginOption.ordering is
only a display sort; nothing here treats it as an authentication priority.
"""

from django.urls import NoReverseMatch, reverse

from identity_providers.models import LoginOption

OAUTH_PROVIDER_IDS = ("google", "github", "facebook")

# id, label, allauth app, kind
CATALOG = (
    ("google", "Google", "allauth.socialaccount.providers.google", "oauth2"),
    ("github", "GitHub", "allauth.socialaccount.providers.github", "oauth2"),
    ("facebook", "Facebook", "allauth.socialaccount.providers.facebook", "oauth2"),
    ("saml", "SAML", "allauth.socialaccount.providers.saml", "saml"),
    ("openid_connect", "OpenID Connect", "allauth.socialaccount.providers.openid_connect", "oidc"),
)

_BY_ID = {item[0]: item for item in CATALOG}

_KIND_LABELS = {
    "local": "Password",
    "google": "Google",
    "github": "GitHub",
    "facebook": "Facebook",
    "saml": "SAML",
    "oidc": "OpenID Connect",
    "generic": "Identity provider",
}


def catalog_choices(current=None):
    choices = [(item[0], item[1]) for item in CATALOG]
    if current and current not in _BY_ID:
        choices.append((current, current))
    return choices


def provider_kind(provider_id):
    item = _BY_ID.get(provider_id)
    return item[3] if item else None


def login_url_for(app):
    """Path allauth expects a browser to POST to for this social app."""
    provider = app.provider
    if provider == "saml":
        return reverse("saml_login", kwargs={"organization_slug": app.client_id})
    if provider == "openid_connect":
        provider_id = app.provider_id or app.client_id
        return reverse("openid_connect_login", kwargs={"provider_id": provider_id})
    if provider in OAUTH_PROVIDER_IDS:
        return reverse(f"{provider}_login")
    return f"/accounts/{provider}/login/"


def is_local_login_url(url):
    return "/accounts/login_system" in (url or "")


def kind_for_url(url):
    if is_local_login_url(url):
        return "local"
    path = url or ""
    if "/accounts/saml/" in path:
        return "saml"
    if "/accounts/oidc/" in path:
        return "oidc"
    for provider in OAUTH_PROVIDER_IDS:
        if f"/accounts/{provider}/" in path:
            return provider
    return "generic"


def label_for_url(url):
    return _KIND_LABELS.get(kind_for_url(url), _KIND_LABELS["generic"])


def ensure_login_option(app, previous_url=None):
    """Create a display row for this provider. Leave an existing title and ordering alone."""
    try:
        url = login_url_for(app)
    except NoReverseMatch:
        return None
    if previous_url and previous_url != url:
        LoginOption.objects.filter(url=previous_url).update(url=url)
    if LoginOption.objects.filter(url=url).exists():
        return LoginOption.objects.filter(url=url).first()
    last = LoginOption.objects.order_by("-ordering").values_list("ordering", flat=True).first() or 0
    return LoginOption.objects.create(title=app.name, url=url, ordering=last + 1, active=True)


def delete_login_option_for_app(sender, instance, **kwargs):
    try:
        url = login_url_for(instance)
    except NoReverseMatch:
        return
    for app in sender.objects.all():
        try:
            if login_url_for(app) == url:
                return
        except NoReverseMatch:
            continue
    LoginOption.objects.filter(url=url).delete()
