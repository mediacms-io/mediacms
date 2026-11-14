from allauth.account.forms import LoginForm
from allauth.account.views import LoginView
from allauth.socialaccount.models import SocialApp
from django.conf import settings
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.http import Http404, HttpResponse
from django.shortcuts import redirect, render
from django.urls import NoReverseMatch, reverse

from identity_providers.models import LoginOption
from identity_providers.providers import is_local_login_url, kind_for_url


def saml_metadata(request):
    if not (hasattr(settings, "USE_SAML") and settings.USE_SAML):
        raise Http404

    xml_parts = ['<?xml version="1.0"?>']
    saml_social_apps = SocialApp.objects.filter(provider='saml')
    entity_id = f"{settings.FRONTEND_HOST}/saml/metadata/"
    xml_parts.append(f'<md:EntitiesDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" Name="{entity_id}">')  # noqa
    xml_parts.append(f'    <md:EntityDescriptor entityID="{entity_id}">')  # noqa
    xml_parts.append('        <md:SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">')  # noqa

    # Add multiple AssertionConsumerService elements with different indices
    for index, app in enumerate(saml_social_apps, start=1):
        xml_parts.append(
            f'            <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" '  # noqa
            f'Location="{settings.FRONTEND_HOST}/accounts/saml/{app.client_id}/acs/" index="{index}"/>'  # noqa
        )

    xml_parts.append('        </md:SPSSODescriptor>')  # noqa
    xml_parts.append('    </md:EntityDescriptor>')  # noqa
    xml_parts.append('</md:EntitiesDescriptor>')  # noqa
    metadata_xml = '\n'.join(xml_parts)
    return HttpResponse(metadata_xml, content_type='application/xml')


def active_login_options():
    options = []
    for option in LoginOption.objects.filter(active=True):
        options.append(
            {
                "title": option.title,
                "url": option.url,
                "kind": kind_for_url(option.url),
                "local": is_local_login_url(option.url),
            }
        )
    return options


def login_by_code_url():
    if not getattr(settings, "ACCOUNT_LOGIN_BY_CODE_ENABLED", False):
        return ""
    try:
        return reverse("account_request_login_code")
    except NoReverseMatch:
        return ""


def suggest_register(form):
    """Offer registration after a bad password without checking whether the account exists."""
    if not getattr(settings, "USERS_CAN_SELF_REGISTER", False):
        return False
    if form is None or not getattr(form, "is_bound", False):
        return False
    return bool(form.non_field_errors())


def login_page_context(request, form):
    identity_providers = bool(getattr(settings, "USE_IDENTITY_PROVIDERS", False))
    options = active_login_options() if identity_providers else []
    show_local = (not identity_providers) or any(option["local"] for option in options)
    redirect_value = ""
    if request is not None:
        redirect_value = request.POST.get(REDIRECT_FIELD_NAME, request.GET.get(REDIRECT_FIELD_NAME, ""))
    try:
        signup_url = reverse("account_signup")
    except NoReverseMatch:
        signup_url = "/accounts/signup/"
    return {
        "form": form,
        "show_local_login": show_local,
        "provider_options": [option for option in options if not option["local"]],
        "suggest_register": suggest_register(form),
        "login_by_code_url": login_by_code_url(),
        "redirect_field_name": REDIRECT_FIELD_NAME,
        "redirect_field_value": redirect_value,
        "signup_url": signup_url,
    }


class MediaCMSLoginView(LoginView):
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context.update(login_page_context(self.request, context.get("form")))
        return context


def custom_login_view(request):
    if not (hasattr(settings, "USE_IDENTITY_PROVIDERS") and settings.USE_IDENTITY_PROVIDERS):
        return redirect(reverse('login_system'))

    if request.method == "POST":
        form = LoginForm(request.POST, request=request)
    else:
        form = LoginForm(request=request)
    return render(request, "account/login.html", login_page_context(request, form))
