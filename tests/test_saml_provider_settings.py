from allauth.socialaccount.models import SocialApp
from django.test import RequestFactory, TestCase, override_settings

from saml_auth.custom.utils import build_saml_config
from saml_auth.models import SAMLConfiguration


@override_settings(ROOT_URLCONF="saml_auth.custom.urls")
class TestSamlProviderSettings(TestCase):
    """The SocialApp "advanced" settings reach python3-saml on the saml_auth path"""

    def create_configuration(self, advanced=None):
        settings = {"advanced": advanced} if advanced is not None else {}
        app = SocialApp.objects.create(provider="saml", name="idp", client_id="org", settings=settings)
        return SAMLConfiguration.objects.create(
            social_app=app,
            sso_url="https://idp.example.org/sso",
            slo_url="https://idp.example.org/slo",
            sp_metadata_url="https://sp.example.org/saml/org/metadata/",
            idp_id="https://idp.example.org/entity",
            idp_cert="MIIC",
            uid="uid",
        )

    def build_config(self, configuration):
        request = RequestFactory().get("/saml/org/acs/", secure=True, HTTP_HOST="sp.example.org")
        return build_saml_config(request, configuration.saml_provider_settings, "org")

    def test_advanced_settings_are_passed(self):
        configuration = self.create_configuration(
            {
                "want_assertion_signed": True,
                "want_message_signed": True,
                "authn_request_signed": True,
            }
        )
        self.assertEqual(configuration.saml_provider_settings["advanced"]["want_assertion_signed"], True)
        security = self.build_config(configuration)["security"]
        self.assertIs(security["wantAssertionsSigned"], True)
        self.assertIs(security["wantMessagesSigned"], True)
        self.assertIs(security["authnRequestsSigned"], True)

    def test_defaults_without_advanced_settings(self):
        config = self.build_config(self.create_configuration())
        self.assertIs(config["strict"], True)
        self.assertIs(config["security"]["wantAssertionsSigned"], False)
