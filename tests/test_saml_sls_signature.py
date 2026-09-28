from allauth.socialaccount.models import SocialApp
from django.contrib.sites.models import Site
from django.test import TestCase, override_settings
from django.urls import include, path
from django.utils import timezone
from onelogin.saml2.utils import OneLogin_Saml2_Utils

from files.tests import create_account
from saml_auth.models import SAMLConfiguration

SP_HOST = "sp.example.org"
IDP_ENTITY_ID = "https://idp.example.org/entity"
SLS_PATH = "/saml/org/sls/"

# the saml_auth views as mounted by its provider package, then the site routes
urlpatterns = [path("", include("saml_auth.custom.urls")), path("", include("cms.urls"))]


def logout_message(root, body):
    """An unsigned HTTP-Redirect logout message that names the configured IdP as issuer"""

    issue_instant = timezone.now().strftime("%Y-%m-%dT%H:%M:%SZ")
    xml = (
        f'<samlp:{root} xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" '
        'xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" '
        f'ID="_unsigned-logout" Version="2.0" IssueInstant="{issue_instant}" '
        f'Destination="https://{SP_HOST}{SLS_PATH}">'
        f"<saml:Issuer>{IDP_ENTITY_ID}</saml:Issuer>"
        f"{body}"
        f"</samlp:{root}>"
    )
    return OneLogin_Saml2_Utils.deflate_and_base64_encode(xml)


def logout_request():
    return logout_message("LogoutRequest", "<saml:NameID>nobody@example.org</saml:NameID>")


def logout_response():
    return logout_message("LogoutResponse", '<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>')


@override_settings(ROOT_URLCONF=__name__)
class TestSamlSlsSignature(TestCase):
    """The single logout endpoint does not act on unsigned logout messages"""

    def setUp(self):
        app = SocialApp.objects.create(provider="saml", name="idp", client_id="org", settings={})
        app.sites.add(Site.objects.get_current())
        SAMLConfiguration.objects.create(
            social_app=app,
            sso_url="https://idp.example.org/sso",
            slo_url="https://idp.example.org/slo",
            sp_metadata_url=f"https://{SP_HOST}/saml/org/metadata/",
            idp_id=IDP_ENTITY_ID,
            idp_cert="MIIC",
            uid="uid",
        )
        self.user = create_account(username="signed_in", password="this_is_a_fake_password")
        self.client.force_login(self.user)

    def get_sls(self, **params):
        return self.client.get(SLS_PATH, params, secure=True, HTTP_HOST=SP_HOST)

    def test_unsigned_logout_request_refused(self):
        response = self.get_sls(SAMLRequest=logout_request())
        self.assertEqual(response.status_code, 400)

    def test_unsigned_logout_request_keeps_session(self):
        self.get_sls(SAMLRequest=logout_request())
        self.assertIn("_auth_user_id", self.client.session)

    def test_unsigned_logout_response_keeps_session(self):
        self.get_sls(SAMLResponse=logout_response())
        self.assertIn("_auth_user_id", self.client.session)
