from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from allauth.socialaccount.models import SocialApp
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sites.models import Site
from django.core.exceptions import ImproperlyConfigured, ValidationError
from django.http import Http404
from django.test import RequestFactory, TestCase
from onelogin.saml2.auth import OneLogin_Saml2_Auth
from onelogin.saml2.constants import OneLogin_Saml2_Constants

from saml_auth.custom import utils
from saml_auth.custom.provider import CustomSAMLProvider
from saml_auth.models import SAMLConfiguration

EMAIL_NAMEID = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"


def make_app(client_id, settings=None):
    app = SocialApp.objects.create(provider="saml", provider_id=f"{client_id}-id", name=f"{client_id} name", client_id=client_id, settings=settings or {})
    app.sites.add(Site.objects.get_current())
    return app


def make_configuration(social_app, **overrides):
    fields = {
        "social_app": social_app,
        "sso_url": "https://idp.example.org/sso",
        "slo_url": "https://idp.example.org/slo",
        "sp_metadata_url": "https://sp.example.org/saml/metadata",
        "idp_id": "https://idp.example.org/entity",
        "idp_cert": "IDPCERT",
        "uid": "urn:oid:uid",
        "name": "displayName",
        "email": "mail",
        "groups": "isMemberOf",
        "first_name": "gn",
        "last_name": "sn",
        "role": "affiliation",
    }
    fields.update(overrides)
    return SAMLConfiguration.objects.create(**fields)


def saml_data(attributes, friendly=None, nameid="nameid@example.org", nameid_format="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"):
    data = MagicMock()
    data.get_attributes.return_value = attributes
    if friendly is None:
        del data.get_friendlyname_attributes
    else:
        data.get_friendlyname_attributes.return_value = friendly
    data.get_nameid.return_value = nameid
    data.get_nameid_format.return_value = nameid_format
    return data


class SAMLConfigurationModelTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.app = make_app("model-org")

    def test_str_names_app_and_idp(self):
        configuration = make_configuration(self.app)
        self.assertEqual(str(configuration), "SAML Config for model-org name - https://idp.example.org/entity")

    def test_second_configuration_for_same_app_is_rejected(self):
        make_configuration(self.app)
        duplicate = SAMLConfiguration(social_app=self.app, idp_id="https://other.example.org", sp_cert="", sp_private_key="")
        with self.assertRaises(ValidationError) as ctx:
            duplicate.clean()
        self.assertIn("social_app", ctx.exception.message_dict)

    def test_existing_configuration_can_be_cleaned_again(self):
        configuration = make_configuration(self.app)
        configuration.clean()

    def test_sp_certificate_and_key_must_come_together(self):
        with self.assertRaises(ValidationError) as ctx:
            SAMLConfiguration(social_app=self.app, sp_cert="CERT").clean()
        self.assertIn("sp_private_key", ctx.exception.message_dict)
        with self.assertRaises(ValidationError) as ctx:
            SAMLConfiguration(social_app=self.app, sp_private_key="KEY").clean()
        self.assertIn("sp_cert", ctx.exception.message_dict)

    def test_provider_settings_without_sp_keys(self):
        provider_settings = make_configuration(self.app, verified_email=True).saml_provider_settings
        self.assertEqual(provider_settings["sp"], {"entity_id": "https://sp.example.org/saml/metadata"})
        self.assertEqual(
            provider_settings["idp"],
            {"slo_url": "https://idp.example.org/slo", "sso_url": "https://idp.example.org/sso", "x509cert": "IDPCERT", "entity_id": "https://idp.example.org/entity"},
        )
        self.assertEqual(provider_settings["attribute_mapping"]["uid"], "urn:oid:uid")
        self.assertEqual(provider_settings["attribute_mapping"]["groups"], "isMemberOf")
        self.assertTrue(provider_settings["email_verified"])
        self.assertFalse(provider_settings["email_authentication"])

    def test_provider_settings_include_sp_keys_when_set(self):
        provider_settings = make_configuration(self.app, sp_cert="SPCERT", sp_private_key="SPKEY").saml_provider_settings
        self.assertEqual(provider_settings["sp"]["x509cert"], "SPCERT")
        self.assertEqual(provider_settings["sp"]["private_key"], "SPKEY")


class SAMLUtilsTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.app = make_app("utils-org", settings={"idp": {"entity_id": "https://settings-idp.example.org", "x509cert": "C", "sso_url": "https://settings-idp.example.org/sso"}})

    def setUp(self):
        self.factory = RequestFactory()

    def test_get_app_or_404_finds_app_by_client_id(self):
        self.assertEqual(utils.get_app_or_404(self.factory.get("/"), "utils-org"), self.app)

    def test_get_app_or_404_raises_for_unknown_client_id(self):
        with self.assertRaises(Http404):
            utils.get_app_or_404(self.factory.get("/"), "no-such-org")

    def test_prepare_django_request_describes_request(self):
        request = self.factory.post("/accounts/saml/x/acs/?a=1", {"SAMLResponse": "abc"}, HTTP_HOST="media.example.org", secure=True)
        prepared = utils.prepare_django_request(request)
        self.assertEqual(prepared["https"], "on")
        self.assertEqual(prepared["http_host"], "media.example.org")
        self.assertEqual(prepared["script_name"], "/accounts/saml/x/acs/")
        self.assertEqual(prepared["get_data"]["a"], "1")
        self.assertEqual(prepared["post_data"]["SAMLResponse"], "abc")
        self.assertEqual(utils.prepare_django_request(self.factory.get("/", HTTP_HOST="testserver"))["https"], "off")

    def test_sp_config_falls_back_to_metadata_url_as_entity_id(self):
        sp_config = utils.build_sp_config(self.factory.get("/"), {}, "utils-org")
        self.assertTrue(sp_config["entityId"].startswith("http://testserver/"))
        self.assertTrue(sp_config["entityId"].endswith("/saml/utils-org/metadata/"))
        self.assertTrue(sp_config["assertionConsumerService"]["url"].endswith("/saml/utils-org/acs/"))
        self.assertEqual(sp_config["assertionConsumerService"]["binding"], OneLogin_Saml2_Constants.BINDING_HTTP_POST)
        self.assertTrue(sp_config["singleLogoutService"]["url"].endswith("/saml/utils-org/sls/"))
        self.assertNotIn("x509cert", sp_config)
        self.assertNotIn("privateKey", sp_config)
        self.assertNotIn("NameIDFormat", sp_config)

    def test_sp_config_uses_explicit_entity_id_keys_and_name_id_format(self):
        provider_config = {"sp": {"entity_id": "urn:sp", "x509cert": "CERT", "private_key": "KEY"}, "advanced": {"name_id_format": "urn:fmt"}}
        sp_config = utils.build_sp_config(self.factory.get("/"), provider_config, "utils-org")
        self.assertEqual(sp_config["entityId"], "urn:sp")
        self.assertEqual(sp_config["x509cert"], "CERT")
        self.assertEqual(sp_config["privateKey"], "KEY")
        self.assertEqual(sp_config["NameIDFormat"], "urn:fmt")

    def test_saml_config_requires_idp(self):
        with self.assertRaises(ImproperlyConfigured):
            utils.build_saml_config(self.factory.get("/"), {}, "utils-org")

    def test_saml_config_with_inline_idp_and_defaults(self):
        provider_config = {"idp": {"entity_id": "urn:idp", "x509cert": "CERT", "sso_url": "https://idp/sso"}}
        config = utils.build_saml_config(self.factory.get("/"), provider_config, "utils-org")
        self.assertTrue(config["strict"])
        self.assertEqual(config["idp"], {"entityId": "urn:idp", "x509cert": "CERT", "singleSignOnService": {"url": "https://idp/sso"}})
        self.assertFalse(config["security"]["authnRequestsSigned"])
        self.assertTrue(config["security"]["rejectDeprecatedAlgorithm"])
        self.assertEqual(config["security"]["signatureAlgorithm"], OneLogin_Saml2_Constants.RSA_SHA256)
        self.assertNotIn("contactPerson", config)
        self.assertNotIn("organization", config)
        self.assertIn("entityId", config["sp"])

    def test_saml_config_honours_advanced_slo_contact_and_organization(self):
        provider_config = {
            "idp": {"entity_id": "urn:idp", "x509cert": "CERT", "sso_url": "https://idp/sso", "slo_url": "https://idp/slo"},
            "advanced": {"strict": False, "authn_request_signed": True, "want_assertion_signed": True},
            "contact_person": {"technical": {"givenName": "Ops", "emailAddress": "ops@example.org"}},
            "organization": {"en-US": {"name": "Uni", "displayname": "Uni", "url": "https://uni.example.org"}},
        }
        config = utils.build_saml_config(self.factory.get("/"), provider_config, "utils-org")
        self.assertFalse(config["strict"])
        self.assertTrue(config["security"]["authnRequestsSigned"])
        self.assertTrue(config["security"]["wantAssertionsSigned"])
        self.assertEqual(config["idp"]["singleLogoutService"], {"url": "https://idp/slo"})
        self.assertEqual(config["contactPerson"], provider_config["contact_person"])
        self.assertEqual(config["organization"], provider_config["organization"])

    def test_saml_config_with_metadata_url_uses_remote_metadata(self):
        remote = {"idp": {"entityId": "urn:remote"}}
        provider_config = {"idp": {"metadata_url": "https://idp.example.org/metadata", "entity_id": "urn:remote"}}
        with patch.object(utils.OneLogin_Saml2_IdPMetadataParser, "parse_remote", return_value=remote) as parse_remote:
            config = utils.build_saml_config(self.factory.get("/"), provider_config, "utils-org")
        self.assertEqual(config["idp"], {"entityId": "urn:remote"})
        parse_remote.assert_called_once_with("https://idp.example.org/metadata", entity_id="urn:remote", timeout=10)

    def test_remote_metadata_is_cached(self):
        idp_config = {"metadata_url": "https://idp.example.org/cached", "entity_id": "urn:cached", "metadata_request_timeout": 3}
        with patch.object(utils.OneLogin_Saml2_IdPMetadataParser, "parse_remote", return_value={"idp": {}}) as parse_remote:
            first = utils.fetch_metadata_url_config(idp_config)
            second = utils.fetch_metadata_url_config(idp_config)
        self.assertEqual(first, second)
        parse_remote.assert_called_once_with("https://idp.example.org/cached", entity_id="urn:cached", timeout=3)

    def test_relay_state_round_trip(self):
        self.assertEqual(utils.encode_relay_state("abc def"), "state=abc+def")
        self.assertEqual(utils.decode_relay_state("/media/view"), "/media/view")
        self.assertEqual(utils.decode_relay_state("https://sp.example.org/x"), "https://sp.example.org/x")
        self.assertIsNone(utils.decode_relay_state("opaque-state"))
        self.assertIsNone(utils.decode_relay_state(""))
        self.assertIsNone(utils.decode_relay_state(None))

    def test_build_auth_prefers_custom_configuration(self):
        configuration_app = make_app("auth-org")
        make_configuration(configuration_app)
        provider = SimpleNamespace(app=configuration_app)
        auth = utils.build_auth(self.factory.get("/", HTTP_HOST="sp.example.org"), provider)
        self.assertIsInstance(auth, OneLogin_Saml2_Auth)
        idp = auth.get_settings().get_idp_data()
        self.assertEqual(idp["entityId"], "https://idp.example.org/entity")
        self.assertEqual(auth.get_settings().get_sp_data()["entityId"], "https://sp.example.org/saml/metadata")

    def test_build_auth_falls_back_to_app_settings(self):
        auth = utils.build_auth(self.factory.get("/", HTTP_HOST="sp.example.org"), SimpleNamespace(app=self.app))
        self.assertEqual(auth.get_settings().get_idp_data()["entityId"], "https://settings-idp.example.org")


class CustomSAMLProviderTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.configured_app = make_app("provider-org")
        make_configuration(cls.configured_app, first_name=None, last_name="")
        cls.settings_app = make_app("provider-settings-org", settings={"attribute_mapping": {"uid": ["urn:uid", "uid"], "email": "mail"}, "email_verified": "yes"})

    def provider(self, app):
        return CustomSAMLProvider(request=None, app=app)

    def test_configuration_mapping_extracts_attributes(self):
        data = saml_data({"urn:oid:uid": ["jdoe"], "displayName": ["Jane Doe"], "mail": ["jane@example.org"], "isMemberOf": ["physics", "maths"], "affiliation": ["faculty"]}, friendly={})
        attributes = self.provider(self.configured_app)._extract(data)
        self.assertEqual(attributes["uid"], "jdoe")
        self.assertEqual(attributes["username"], "jdoe")
        self.assertEqual(attributes["name"], "Jane Doe")
        self.assertEqual(attributes["email"], "jane@example.org")
        self.assertEqual(attributes["groups"], "physics,maths")
        self.assertEqual(attributes["role"], "faculty")
        self.assertFalse(attributes["email_verified"])
        self.assertNotIn("first_name", attributes)
        self.assertNotIn("last_name", attributes)

    def test_friendly_name_is_used_when_name_lookup_misses(self):
        data = saml_data({"urn:oid:uid": ["jdoe"]}, friendly={"mail": ["friendly@example.org"], "displayName": []})
        attributes = self.provider(self.configured_app)._extract(data)
        self.assertEqual(attributes["email"], "friendly@example.org")
        self.assertNotIn("name", attributes)

    def test_data_without_friendly_names_is_supported(self):
        attributes = self.provider(self.configured_app)._extract(saml_data({"mail": ["only@example.org"]}))
        self.assertEqual(attributes["email"], "only@example.org")
        self.assertNotIn("username", attributes)

    def test_email_falls_back_to_email_nameid(self):
        data = saml_data({"urn:oid:uid": ["jdoe"]}, friendly={}, nameid="nameid@example.org", nameid_format=EMAIL_NAMEID)
        self.assertEqual(self.provider(self.configured_app)._extract(data)["email"], "nameid@example.org")

    def test_persistent_nameid_is_not_used_as_email(self):
        data = saml_data({"urn:oid:uid": ["jdoe"]}, friendly={})
        self.assertNotIn("email", self.provider(self.configured_app)._extract(data))

    def test_app_settings_are_used_without_configuration(self):
        data = saml_data({"uid": ["fallback"], "mail": ["s@example.org"]}, friendly={})
        attributes = self.provider(self.settings_app)._extract(data)
        self.assertEqual(attributes["uid"], "fallback")
        self.assertEqual(attributes["email"], "s@example.org")
        self.assertTrue(attributes["email_verified"])

    def test_use_nameid_for_email_setting(self):
        app = make_app("provider-nameid-org", settings={"attribute_mapping": {"uid": "uid"}, "use_nameid_for_email": True, "email_verified": True})
        attributes = self.provider(app)._extract(saml_data({"uid": ["u"]}, friendly={}, nameid="n@example.org"))
        self.assertEqual(attributes["email"], "n@example.org")
        self.assertTrue(attributes["email_verified"])

    def test_extract_uid_and_common_fields_use_custom_mapping(self):
        provider = self.provider(self.configured_app)
        data = saml_data({"urn:oid:uid": ["jdoe"], "mail": ["jane@example.org"]}, friendly={})
        self.assertEqual(provider.extract_uid(data), "jdoe")
        common = provider.extract_common_fields(data)
        self.assertNotIn("uid", common)
        self.assertEqual(common["email"], "jane@example.org")

    def test_redirect_sends_user_to_idp_and_stashes_request_id(self):
        request = RequestFactory().get("/")
        request.session = SessionStore()
        auth = MagicMock()
        auth.login.return_value = "https://idp.example.org/sso?SAMLRequest=xyz"
        auth.get_last_request_id.return_value = "ONELOGIN_123"
        provider = self.provider(self.configured_app)
        with patch("saml_auth.custom.provider.build_auth", return_value=auth) as build_auth, patch.object(CustomSAMLProvider, "stash_redirect_state") as stash:
            response = provider.redirect(request, "login", next_url="/next")
        build_auth.assert_called_once_with(request, provider)
        auth.login.assert_called_once_with(return_to="")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "https://idp.example.org/sso?SAMLRequest=xyz")
        stash.assert_called_once_with(request, "login", "/next", None, state_id="ONELOGIN_123")
