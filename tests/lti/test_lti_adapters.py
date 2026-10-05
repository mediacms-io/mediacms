import json
from unittest import mock

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from django.contrib.sessions.backends.db import SessionStore
from django.core.cache import cache
from django.test import RequestFactory, TestCase
from lti_testkit import (
    AUTH_TOKEN_URL,
    CLIENT_ID,
    DEPLOYMENT_ID,
    ISSUER,
    KEY_SET_URL,
    create_platform,
    launch_claims,
    mint_id_token,
    mock_platform_jwks,
    tool_public_key,
)
from pylti1p3.message_launch import MessageLaunch

from lti.adapters import (
    DjangoCacheDataStorage,
    DjangoMessageLaunch,
    DjangoOIDCLogin,
    DjangoRequest,
    DjangoServiceConnector,
    DjangoSessionService,
    DjangoToolConfig,
)
from lti.models import LTIToolKeys


def build_request(method="get", path="/lti/launch/", data=None, cookies=None, secure=False):
    request = getattr(RequestFactory(), method)(path, data or {}, secure=secure)
    request.session = SessionStore()
    request.COOKIES.update(cookies or {})
    return request


class DjangoRequestTest(TestCase):
    def test_post_parameters_win_over_query_string(self):
        request = RequestFactory().post("/lti/launch/?state=from-get&only_get=1", {"state": "from-post"})
        request.session = SessionStore()
        lti_request = DjangoRequest(request)
        self.assertEqual(lti_request.get_param("state"), "from-post")
        self.assertEqual(lti_request.get_param("only_get"), "1")
        self.assertEqual(lti_request._get_request_param("state"), "from-post")
        self.assertIsNone(lti_request.get_param("missing"))

    def test_exposes_cookies_session_and_scheme(self):
        request = build_request(cookies={"lti-state": "abc"}, secure=True)
        lti_request = DjangoRequest(request)
        self.assertEqual(lti_request.get_cookie("lti-state"), "abc")
        self.assertIsNone(lti_request.get_cookie("other"))
        self.assertIs(lti_request.session, request.session)
        self.assertTrue(lti_request.is_secure())
        self.assertFalse(DjangoRequest(build_request()).is_secure())


class DjangoSessionServiceTest(TestCase):
    def setUp(self):
        self.request = build_request(cookies={"state-cookie": "value"})
        self.service = DjangoSessionService(self.request)

    def test_state_and_nonce_live_in_the_shared_cache_not_the_session(self):
        self.service.save_launch_data("state-abc", {"nonce": "n1"})
        self.assertEqual(json.loads(cache.get("lti1p3_cache_state-abc")), {"nonce": "n1"})
        self.assertNotIn("lti1p3_state-abc", self.request.session)
        other_request_service = DjangoSessionService(build_request())
        self.assertEqual(other_request_service.get_launch_data("state-abc"), {"nonce": "n1"})

    def test_other_launch_data_is_stored_in_the_session(self):
        self.service.save_launch_data("lti1p3-launch-1", {"sub": "x"})
        self.assertEqual(json.loads(self.request.session["lti1p3_lti1p3-launch-1"]), {"sub": "x"})
        self.assertTrue(self.request.session.modified)
        self.assertIsNone(cache.get("lti1p3_cache_lti1p3-launch-1"))
        self.assertEqual(self.service.get_launch_data("lti1p3-launch-1"), {"sub": "x"})
        self.assertTrue(self.service.check_launch_data_storage_exists("lti1p3-launch-1"))
        self.assertFalse(self.service.check_launch_data_storage_exists("lti1p3-launch-2"))

    def test_missing_launch_data_is_none(self):
        self.assertIsNone(self.service.get_launch_data("state-unknown"))
        self.assertIsNone(self.service.get_launch_data("anything-else"))
        self.assertFalse(self.service.check_launch_data_storage_exists("nonce-unknown"))

    def test_state_is_valid_only_when_issued_by_oidc_login(self):
        self.assertFalse(self.service.check_state_is_valid("abc", "nonce"))
        self.service.set_state_valid("abc", "token-hash")
        self.assertTrue(self.service.check_state_is_valid("abc", "nonce"))
        self.assertEqual(self.service.get_launch_data("state-abc"), {"valid": True, "id_token_hash": "token-hash"})

    def test_nonce_can_only_be_used_once(self):
        self.assertTrue(self.service.check_nonce("n-1"))
        self.assertFalse(self.service.check_nonce("n-1"))
        self.assertFalse(DjangoSessionService(build_request()).check_nonce("n-1"))
        self.assertTrue(self.service.check_nonce("n-2"))

    def test_cookie_service_reads_request_cookies_and_ignores_writes(self):
        self.assertEqual(self.service.get_cookie("state-cookie"), "value")
        self.assertTrue(self.service.set_cookie("new", "v"))
        self.assertIsNone(self.service.get_cookie("new"))


class DjangoCacheDataStorageTest(TestCase):
    def test_values_round_trip_with_prefix(self):
        storage = DjangoCacheDataStorage()
        self.assertIsNone(storage.get_value("key-set"))
        self.assertFalse(storage.check_value("key-set"))
        storage.set_value("key-set", {"keys": []}, exp=60)
        self.assertEqual(storage.get_value("key-set"), {"keys": []})
        self.assertTrue(storage.check_value("key-set"))
        self.assertEqual(cache.get("lti1p3_cache_key-set"), {"keys": []})


class DjangoToolConfigTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform(auth_audience="https://lms.example.com/token-aud")
        cls.config = DjangoToolConfig.from_platform(cls.platform)

    def test_issuer_lookup(self):
        self.assertEqual(self.config.get_iss(), [ISSUER])
        self.assertTrue(self.config.check_iss_has_one_client(ISSUER))
        self.assertFalse(self.config.check_iss_has_one_client("https://other.example.com"))
        self.assertFalse(self.config.check_iss_has_many_clients(ISSUER))
        self.assertIsNone(self.config.get_jwks(ISSUER))

    def test_registration_by_issuer_carries_platform_endpoints_and_tool_key(self):
        registration = self.config.find_registration_by_issuer(ISSUER)
        self.assertEqual(registration.get_issuer(), ISSUER)
        self.assertEqual(registration.get_client_id(), CLIENT_ID)
        self.assertEqual(registration.get_auth_token_url(), AUTH_TOKEN_URL)
        self.assertEqual(registration.get_auth_audience(), "https://lms.example.com/token-aud")
        self.assertEqual(registration.get_key_set_url(), KEY_SET_URL)
        self.assertTrue(registration.get_tool_private_key().startswith("-----BEGIN PRIVATE KEY-----"))
        self.assertEqual(registration._tool_private_key_kid, "mediacms-lti-key")

    def test_unknown_issuer_or_client_has_no_registration(self):
        self.assertIsNone(self.config.find_registration_by_issuer("https://other.example.com"))
        self.assertIsNone(self.config.find_registration_by_params("https://other.example.com", CLIENT_ID))
        self.assertIsNone(self.config.find_registration_by_params(ISSUER, "someone-else"))

    def test_registration_by_params(self):
        registration = self.config.find_registration_by_params(ISSUER, CLIENT_ID)
        self.assertEqual(registration.get_client_id(), CLIENT_ID)
        self.assertEqual(registration.get_auth_audience(), "https://lms.example.com/token-aud")

    def test_deployment_must_be_registered_on_the_platform(self):
        self.assertIsNotNone(self.config.find_deployment(ISSUER, DEPLOYMENT_ID))
        self.assertIsNone(self.config.find_deployment(ISSUER, "unknown-deployment"))
        self.assertIsNone(self.config.find_deployment("https://other.example.com", DEPLOYMENT_ID))
        self.assertIsNotNone(self.config.find_deployment_by_params(ISSUER, DEPLOYMENT_ID, CLIENT_ID))
        self.assertIsNone(self.config.find_deployment_by_params(ISSUER, DEPLOYMENT_ID, "someone-else"))
        self.assertIsNone(self.config.find_deployment_by_params(ISSUER, "unknown-deployment", CLIENT_ID))
        self.assertIsNone(self.config.find_deployment_by_params("https://other.example.com", DEPLOYMENT_ID, CLIENT_ID))

    def test_signing_key_matches_published_tool_key(self):
        private_key = self.config.get_jwk()
        self.assertIsInstance(private_key, rsa.RSAPrivateKey)
        self.assertEqual(private_key.public_key().public_numbers(), tool_public_key().public_numbers())
        self.assertEqual(self.config.get_kid(), LTIToolKeys.objects.get().private_key_jwk["kid"])

    def test_registration_without_audience_leaves_it_unset(self):
        platform = create_platform(client_id="no-audience")
        registration = DjangoToolConfig.from_platform(platform).find_registration_by_params(ISSUER, "no-audience")
        self.assertIsNone(registration.get_auth_audience())

    def test_from_platform_rejects_anything_but_a_platform(self):
        with self.assertRaises(ValueError):
            DjangoToolConfig.from_platform({"platform_id": ISSUER})

    def test_from_all_platforms_indexes_by_issuer(self):
        create_platform(platform_id="https://itslearning.example.com", client_id="its-client")
        config = DjangoToolConfig.from_all_platforms()
        self.assertCountEqual(config.get_iss(), [ISSUER, "https://itslearning.example.com"])
        self.assertEqual(config.find_registration_by_issuer("https://itslearning.example.com").get_client_id(), "its-client")

    def test_empty_config_knows_no_issuers(self):
        self.assertEqual(DjangoToolConfig().get_iss(), [])


class DjangoOIDCLoginAdapterTest(TestCase):
    def test_cookie_check_without_new_window_yields_no_redirect(self):
        create_platform()
        request = build_request(data={"iss": ISSUER, "client_id": CLIENT_ID, "login_hint": "u1"})
        login = DjangoOIDCLogin(request, DjangoToolConfig.from_all_platforms())
        self.assertIsInstance(login.launch_data_storage, DjangoSessionService)
        self.assertFalse(login.get_redirect("http://testserver/lti/launch/"))


class DjangoMessageLaunchAdapterTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform()

    def _launch_request(self, claims):
        request = build_request("post", data={"id_token": mint_id_token(claims), "state": "state-1"})
        DjangoSessionService(request).save_launch_data("state-state-1", {"nonce": claims["nonce"]})
        return request

    def test_validated_launch_returns_signed_claims(self):
        claims = launch_claims()
        adapter = DjangoMessageLaunch(self._launch_request(claims), DjangoToolConfig.from_platform(self.platform))
        message_launch = adapter.validate()
        self.assertIsInstance(message_launch, MessageLaunch)
        with mock_platform_jwks() as fetch:
            data = message_launch.get_launch_data()
        fetch.assert_called_once_with(KEY_SET_URL)
        self.assertEqual(data["sub"], claims["sub"])
        self.assertTrue(message_launch.is_resource_launch())

    def test_launch_without_matching_state_is_rejected(self):
        claims = launch_claims()
        request = build_request("post", data={"id_token": mint_id_token(claims), "state": "never-issued"})
        message_launch = DjangoMessageLaunch(request, DjangoToolConfig.from_platform(self.platform)).validate()
        with mock_platform_jwks(), self.assertRaisesMessage(Exception, "State not found"):
            message_launch.get_launch_data()


class DjangoServiceConnectorTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform()

    def setUp(self):
        registration = DjangoToolConfig.from_platform(self.platform).find_registration_by_issuer(ISSUER)
        self.connector = DjangoServiceConnector(registration)

    def _token_response(self, token="token-1", expires_in=3600):
        return mock.Mock(**{"json.return_value": {"access_token": token, "expires_in": expires_in}})

    def test_access_token_uses_a_client_assertion_signed_by_the_tool(self):
        with mock.patch("lti.adapters.requests.post", return_value=self._token_response()) as post:
            token = self.connector.get_access_token(["scope-a", "scope-b"])
        self.assertEqual(token, "token-1")
        (url,) = post.call_args.args
        data = post.call_args.kwargs["data"]
        self.assertEqual(url, AUTH_TOKEN_URL)
        self.assertEqual(data["grant_type"], "client_credentials")
        self.assertEqual(data["scope"], "scope-a scope-b")
        self.assertEqual(jwt.get_unverified_header(data["client_assertion"])["kid"], "mediacms-lti-key")
        assertion = jwt.decode(data["client_assertion"], tool_public_key(), algorithms=["RS256"], audience=AUTH_TOKEN_URL)
        self.assertEqual(assertion["iss"], CLIENT_ID)
        self.assertEqual(assertion["sub"], CLIENT_ID)

    def test_access_token_is_reused_until_it_expires(self):
        with mock.patch("lti.adapters.requests.post", return_value=self._token_response()) as post:
            self.connector.get_access_token(["s"])
            self.connector.get_access_token(["s"])
        self.assertEqual(post.call_count, 1)

    def test_expired_access_token_is_refreshed(self):
        with mock.patch("lti.adapters.requests.post", side_effect=[self._token_response("old", expires_in=0), self._token_response("new")]):
            self.assertEqual(self.connector.get_access_token(["s"]), "old")
            self.assertEqual(self.connector.get_access_token(["s"]), "new")

    def test_service_get_follows_link_header_and_sends_bearer_token(self):
        response = mock.Mock(status_code=200, headers={"Link": '<https://lms.example.com/members?page=2>; rel="next"', "Content-Type": "application/json"})
        response.json.return_value = {"members": []}
        with mock.patch("lti.adapters.requests.post", return_value=self._token_response()), mock.patch("lti.adapters.requests.get", return_value=response) as get:
            result = self.connector.make_service_request(["s"], "https://lms.example.com/members", accept="application/vnd.ims.lti-nrps.v2.membershipcontainer+json")
        headers = get.call_args.kwargs["headers"]
        self.assertEqual(headers["Authorization"], "Bearer token-1")
        self.assertEqual(headers["Accept"], "application/vnd.ims.lti-nrps.v2.membershipcontainer+json")
        self.assertEqual(result["body"], {"members": []})
        self.assertEqual(result["next_page_url"], "https://lms.example.com/members?page=2")
        self.assertEqual(result["status_code"], 200)

    def test_service_post_sends_json_and_has_no_next_page_without_link(self):
        response = mock.Mock(status_code=201, headers={})
        response.json.return_value = {"ok": True}
        with mock.patch("lti.adapters.requests.post", side_effect=[self._token_response(), response]) as post:
            result = self.connector.make_service_request(["s"], "https://lms.example.com/scores", is_post=True, data={"score": 1})
        self.assertEqual(post.call_args.kwargs["json"], {"score": 1})
        self.assertNotIn("Accept", post.call_args.kwargs["headers"])
        self.assertIsNone(result["next_page_url"])

    def test_non_json_service_response_raises_a_descriptive_error(self):
        response = mock.Mock(status_code=200, headers={"Content-Type": "text/html"}, text="<html>login</html>")
        response.json.side_effect = ValueError("not json")
        with mock.patch("lti.adapters.requests.post", return_value=self._token_response()), mock.patch("lti.adapters.requests.get", return_value=response):
            with self.assertRaisesMessage(ValueError, "non-JSON response"):
                self.connector.make_service_request(["s"], "https://lms.example.com/members")
