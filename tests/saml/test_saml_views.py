import binascii
from unittest.mock import MagicMock, patch

from allauth.socialaccount import providers
from allauth.socialaccount.models import SocialAccount, SocialApp
from django.contrib.sites.models import Site
from django.http import HttpResponse
from django.test import Client, TestCase, override_settings
from django.urls import include, path
from onelogin.saml2.errors import OneLogin_Saml2_Error

from cms import urls as cms_urls
from rbac.models import RBACGroup, RBACMembership
from saml_auth.custom.provider import CustomSAMLProvider
from saml_auth.models import SAMLConfiguration
from users.models import User

ORG = "views-org"
HOST = "sp.example.org"


class SAMLTestUrls:
    urlpatterns = cms_urls.urlpatterns + [path("", include("saml_auth.custom.urls"))]


def make_app(client_id=ORG, settings=None):
    app = SocialApp.objects.create(provider="saml", provider_id=f"{client_id}-idp", name=f"{client_id} name", client_id=client_id, settings=settings or {})
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
        "uid": "uid",
        "name": "displayName",
        "email": "mail",
        "groups": "isMemberOf",
        "role": "affiliation",
        "save_saml_response_logs": False,
    }
    fields.update(overrides)
    return SAMLConfiguration.objects.create(**fields)


def fake_auth(attributes=None, errors=None, authenticated=True, in_response_to="ONELOGIN_request"):
    auth = MagicMock()
    auth.get_errors.return_value = errors or []
    auth.get_last_error_reason.return_value = None
    auth.is_authenticated.return_value = authenticated
    auth.get_last_response_in_response_to.return_value = in_response_to
    auth.get_attributes.return_value = attributes or {}
    auth.get_friendlyname_attributes.return_value = {}
    auth.get_nameid.return_value = "nameid"
    auth.get_nameid_format.return_value = "urn:oasis:names:tc:SAML:2.0:nameid-format:persistent"
    return auth


@override_settings(ROOT_URLCONF=SAMLTestUrls)
class SAMLViewsTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.app = make_app()
        make_configuration(cls.app)

    def setUp(self):
        registry_patch = patch.dict(providers.registry.provider_map, {"saml": CustomSAMLProvider})
        registry_patch.start()
        self.addCleanup(registry_patch.stop)
        self.client = Client(HTTP_HOST=HOST)


class MetadataViewTest(SAMLViewsTestCase):
    def test_metadata_is_served_as_xml_for_configured_app(self):
        response = self.client.get(f"/saml/{ORG}/metadata/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/xml")
        body = response.content.decode()
        self.assertIn('entityID="https://sp.example.org/saml/metadata"', body)
        self.assertIn(f"http://{HOST}/saml/{ORG}/acs/", body)

    def test_metadata_uses_app_settings_without_configuration(self):
        make_app("settings-org", settings={"sp": {"entity_id": "urn:settings-sp"}, "idp": {"entity_id": "urn:idp", "x509cert": "C", "sso_url": "https://idp.example.org/sso"}})
        response = self.client.get("/saml/settings-org/metadata/")
        self.assertEqual(response.status_code, 200)
        self.assertIn('entityID="urn:settings-sp"', response.content.decode())

    def test_metadata_validation_errors_return_500(self):
        with patch("saml_auth.custom.views.OneLogin_Saml2_Settings.validate_metadata", return_value=["invalid_xml"]):
            response = self.client.get(f"/saml/{ORG}/metadata/")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json(), {"errors": ["invalid_xml"]})

    def test_unknown_organization_is_404(self):
        self.assertEqual(self.client.get("/saml/unknown-org/metadata/").status_code, 404)


class LoginViewTest(SAMLViewsTestCase):
    def test_get_renders_confirmation_instead_of_redirecting(self):
        response = self.client.get(f"/saml/{ORG}/login/")
        self.assertEqual(response.status_code, 200)

    def test_post_redirects_to_idp_with_authn_request(self):
        response = self.client.post(f"/saml/{ORG}/login/")
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response["Location"].startswith("https://idp.example.org/sso?SAMLRequest="))

    def test_unknown_organization_is_404(self):
        self.assertEqual(self.client.post("/saml/unknown-org/login/").status_code, 404)


class ACSFlowTest(SAMLViewsTestCase):
    def post_acs(self, relay_state=""):
        return self.client.post(f"/saml/{ORG}/acs/", {"SAMLResponse": "ignored-by-mock", "RelayState": relay_state})

    def finish(self, auth, relay_state=""):
        self.post_acs(relay_state)
        with patch("saml_auth.custom.views.build_auth", return_value=auth):
            return self.client.get(f"/saml/{ORG}/acs/finish/")

    def test_acs_stores_request_and_redirects_to_finish(self):
        response = self.post_acs()
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], f"/saml/{ORG}/acs/finish/")
        self.assertIn("saml-acs-session", response.cookies)

    def test_finish_without_acs_session_is_an_authentication_error(self):
        with self.assertLogs("saml_auth.custom.views", level="ERROR"):
            response = self.client.get(f"/saml/{ORG}/acs/finish/")
        self.assertEqual(response.status_code, 401)
        self.assertIn("auth_error", response.context)

    def test_finish_rebuilds_auth_from_stored_acs_request(self):
        auth = fake_auth(errors=["invalid_response"])
        with self.assertLogs("saml_auth.custom.views", level="ERROR"):
            self.post_acs()
            with patch("saml_auth.custom.views.build_auth", return_value=auth) as build_auth:
                self.client.get(f"/saml/{ORG}/acs/finish/")
        acs_request = build_auth.call_args.args[0]
        self.assertEqual(acs_request.method, "POST")
        self.assertEqual(acs_request.POST["SAMLResponse"], "ignored-by-mock")
        auth.process_response.assert_called_once_with(request_id=None)

    def test_response_errors_are_reported(self):
        auth = fake_auth(errors=["invalid_response"])
        auth.get_last_error_reason.return_value = "Signature validation failed"
        with self.assertLogs("saml_auth.custom.views", level="ERROR"):
            response = self.finish(auth)
        self.assertEqual(response.context["saml_errors"], ["invalid_response"])
        self.assertEqual(response.context["saml_last_error_reason"], "Signature validation failed")

    def test_undecodable_response_is_reported(self):
        auth = fake_auth()
        auth.process_response.side_effect = binascii.Error("bad base64")
        with self.assertLogs("saml_auth.custom.views", level="ERROR"):
            response = self.finish(auth)
        self.assertEqual(response.context["saml_errors"], ["invalid_response"])
        self.assertEqual(response.context["saml_last_error_reason"], "Invalid response")

    def test_saml_library_error_is_reported(self):
        auth = fake_auth()
        auth.process_response.side_effect = OneLogin_Saml2_Error("SAML Response not found")
        with self.assertLogs("saml_auth.custom.views", level="ERROR"):
            response = self.finish(auth)
        self.assertEqual(response.context["saml_errors"], ["error"])
        self.assertEqual(response.context["saml_last_error_reason"], "SAML Response not found")

    def test_unauthenticated_response_counts_as_cancelled(self):
        response = self.finish(fake_auth(authenticated=False))
        self.assertEqual(response.status_code, 302)
        self.assertIn("cancelled", response["Location"])

    def test_idp_initiated_login_is_rejected_by_default(self):
        auth = fake_auth(attributes={"uid": ["idp_user"], "mail": ["idp_user@example.org"]}, in_response_to=None)
        with self.assertLogs("saml_auth.custom.views", level="ERROR") as logs:
            response = self.finish(auth)
        self.assertIn("IdP initiated SSO rejected", "".join(logs.output))
        self.assertIn("auth_error", response.context)

    def test_idp_initiated_login_can_be_allowed_and_keeps_relay_state(self):
        self.app.settings = {"advanced": {"reject_idp_initiated_sso": False}}
        self.app.save()
        auth = fake_auth(attributes={"uid": ["idp_user"], "mail": ["idp_user@example.org"]}, in_response_to=None)
        with patch("saml_auth.custom.views.complete_social_login", return_value=HttpResponse("done")) as complete:
            response = self.finish(auth, relay_state="/media/landing")
        self.assertEqual(response.content, b"done")
        login = complete.call_args.args[1]
        self.assertEqual(login.account.uid, "idp_user")
        self.assertEqual(login.state["process"], "login")
        self.assertEqual(login.state["next"], "/media/landing")

    def test_sp_initiated_login_restores_stashed_state(self):
        auth = fake_auth(attributes={"uid": ["sp_user"], "mail": ["sp_user@example.org"]})
        with patch.object(CustomSAMLProvider, "unstash_redirect_state", return_value={"process": "login", "next": "/after"}) as unstash:
            with patch("saml_auth.custom.views.complete_social_login", return_value=HttpResponse("done")) as complete:
                self.finish(auth)
        self.assertEqual(unstash.call_args.args[1], "ONELOGIN_request")
        self.assertEqual(complete.call_args.args[1].state, {"process": "login", "next": "/after"})

    @override_settings(SOCIALACCOUNT_ADAPTER="saml_auth.adapter.SAMLAccountAdapter")
    def test_successful_login_creates_user_and_group_membership(self):
        group = RBACGroup.objects.create(name="Chemistry", uid="chemistry", identity_provider=self.app)
        attributes = {"uid": ["chem.student"], "mail": ["chem.student@example.org"], "displayName": ["Chem Student"], "isMemberOf": ["chemistry"], "affiliation": ["contributor"]}
        with patch.object(CustomSAMLProvider, "unstash_redirect_state", return_value={"process": "login"}):
            response = self.finish(fake_auth(attributes=attributes))
        self.assertEqual(response.status_code, 302)
        user = User.objects.get(username="chem.student")
        self.assertEqual(user.email, "chem.student@example.org")
        self.assertEqual(user.name, "Chem Student")
        self.assertTrue(SocialAccount.objects.filter(user=user, provider=self.app.provider_id, uid="chem.student").exists())
        self.assertTrue(RBACMembership.objects.filter(user=user, rbac_group=group, role="contributor").exists())


class SLSViewTest(SAMLViewsTestCase):
    def sls(self, auth):
        with patch("saml_auth.custom.views.build_auth", return_value=auth):
            return self.client.get(f"/saml/{ORG}/sls/")

    def test_redirects_where_idp_asks(self):
        auth = fake_auth()
        auth.process_slo.return_value = "https://idp.example.org/slo/done"
        response = self.sls(auth)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "https://idp.example.org/slo/done")
        self.assertTrue(auth.process_slo.call_args.kwargs["keep_local_session"])

    def test_logged_in_user_session_is_cleared_and_redirected_to_logout_url(self):
        user = User.objects.create(username="sls_user", email="sls_user@example.org")
        self.client.force_login(user)
        auth = fake_auth()

        def process_slo(delete_session_cb, keep_local_session):
            delete_session_cb()
            return None

        auth.process_slo.side_effect = process_slo
        response = self.sls(auth)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], "/")
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_errors_return_400_with_reason(self):
        auth = fake_auth(errors=["invalid_logout_request"])
        auth.process_slo.side_effect = OneLogin_Saml2_Error("bad request")
        with self.assertLogs("saml_auth.custom.views", level="ERROR"):
            response = self.sls(auth)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.content, b"bad request")
