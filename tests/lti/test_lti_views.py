import re
from html import unescape
from urllib.parse import parse_qs, urlparse

import jwt
from cryptography.hazmat.primitives import serialization
from django.test import RequestFactory, TestCase, override_settings
from lti_testkit import (
    AUTH_LOGIN_URL,
    CLAIM,
    CLIENT_ID,
    DEPLOYMENT_ID,
    DL_CLAIM,
    FORGED_PRIVATE_KEY,
    ISSUER,
    KEY_SET_URL,
    LIS_MEMBERSHIP,
    TARGET_LINK_URI,
    create_platform,
    decode_state,
    deep_linking_settings,
    encode_publishdata,
    encode_state,
    launch_claims,
    mint_id_token,
    mock_platform_jwks,
    tool_public_key,
)

from files.models import Category, MediaPermission
from files.tests import create_account, create_media
from lti.models import LTILaunchLog, LTIResourceLink, LTIToolKeys, LTIUserMapping
from lti.views import LaunchView, get_client_ip
from rbac.models import RBACMembership
from users.models import User

OIDC_LOGIN_URL = "/lti/oidc/login/"
LAUNCH_URL = "/lti/launch/"
MY_MEDIA_URL = "/lti/my-media/"


def redirect_target(response):
    return unescape(re.search(r'http-equiv="refresh" content="0;url=([^"]+)"', response.content.decode()).group(1))


class LaunchFlowMixin:
    def oidc_login(self, **extra):
        params = {"iss": ISSUER, "client_id": CLIENT_ID, "target_link_uri": TARGET_LINK_URI, "login_hint": "user-hint", **extra}
        response = self.client.get(OIDC_LOGIN_URL, params)
        self.assertEqual(response.status_code, 302)
        query = parse_qs(urlparse(response["Location"]).query)
        return query["state"][0], query["nonce"][0]

    def launch(self, claims=None, state=None, token=None, oidc_params=None, **claim_kwargs):
        if state is None:
            state, nonce = self.oidc_login(**(oidc_params or {}))
            claim_kwargs.setdefault("nonce", nonce)
        if token is None:
            token = mint_id_token(claims or launch_claims(**claim_kwargs))
        with mock_platform_jwks() as fetch:
            response = self.client.post(LAUNCH_URL, {"id_token": token, "state": state})
        self.jwks_fetch = fetch
        return response


class OIDCLoginViewTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform()

    def test_missing_parameters_are_rejected(self):
        response = self.client.get(OIDC_LOGIN_URL, {"iss": ISSUER, "client_id": CLIENT_ID})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "Missing required OIDC parameters"})

    def test_unknown_platform_is_rejected(self):
        response = self.client.get(OIDC_LOGIN_URL, {"iss": ISSUER, "client_id": "unknown", "target_link_uri": TARGET_LINK_URI})
        self.assertEqual(response.status_code, 404)

    def test_login_redirects_to_platform_auth_endpoint_with_oidc_parameters(self):
        response = self.client.get(OIDC_LOGIN_URL, {"iss": ISSUER, "client_id": CLIENT_ID, "target_link_uri": TARGET_LINK_URI, "login_hint": "user-hint", "lti_message_hint": "msg-hint"})
        self.assertEqual(response.status_code, 302)
        location = urlparse(response["Location"])
        self.assertEqual(f"{location.scheme}://{location.netloc}{location.path}", AUTH_LOGIN_URL)
        query = {key: values[0] for key, values in parse_qs(location.query).items()}
        self.assertEqual(query["response_type"], "id_token")
        self.assertEqual(query["redirect_uri"], TARGET_LINK_URI)
        self.assertEqual(query["client_id"], CLIENT_ID)
        self.assertEqual(query["login_hint"], "user-hint")
        self.assertEqual(query["lti_message_hint"], "msg-hint")
        self.assertEqual(query["scope"], "openid")
        self.assertEqual(query["response_mode"], "form_post")
        self.assertEqual(query["prompt"], "none")
        self.assertTrue(query["nonce"])
        self.assertEqual(self.client.session["lti_last_message_hint"], "msg-hint")

    def test_post_login_works_like_get(self):
        response = self.client.post(OIDC_LOGIN_URL, {"iss": ISSUER, "client_id": CLIENT_ID, "target_link_uri": TARGET_LINK_URI, "login_hint": "h"})
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response["Location"].startswith(AUTH_LOGIN_URL + "?"))

    def test_state_carries_media_token_and_embed_options(self):
        params = {
            "iss": ISSUER,
            "client_id": CLIENT_ID,
            "target_link_uri": TARGET_LINK_URI,
            "login_hint": "h",
            "lti_message_hint": "msg",
            "media_token": "abc123",
            "embed_show_title": "1",
            "embed_show_related": "0",
            "embed_show_user_avatar": "1",
            "embed_link_title": "0",
            "embed_start_time": "42",
            "embed_width": "640",
            "embed_height": "360",
            "show_media_page": "true",
        }
        response = self.client.get(OIDC_LOGIN_URL, params)
        state = parse_qs(urlparse(response["Location"]).query)["state"][0]
        state_data = decode_state(state)
        self.assertTrue(state_data.pop("uuid"))
        self.assertEqual(
            state_data,
            {
                "hint": "msg",
                "media_token": "abc123",
                "embed_show_title": "1",
                "embed_show_related": "0",
                "embed_show_user_avatar": "1",
                "embed_link_title": "0",
                "embed_start_time": "42",
                "embed_width": "640",
                "embed_height": "360",
                "show_media_page": "true",
            },
        )

    def test_each_login_issues_a_fresh_state_and_nonce(self):
        first = parse_qs(urlparse(self.client.get(OIDC_LOGIN_URL, {"iss": ISSUER, "client_id": CLIENT_ID, "target_link_uri": TARGET_LINK_URI})["Location"]).query)
        second = parse_qs(urlparse(self.client.get(OIDC_LOGIN_URL, {"iss": ISSUER, "client_id": CLIENT_ID, "target_link_uri": TARGET_LINK_URI})["Location"]).query)
        self.assertNotEqual(first["state"], second["state"])
        self.assertNotEqual(first["nonce"], second["nonce"])


class LaunchViewResourceLinkTest(LaunchFlowMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform(name="Moodle Launch")

    def test_valid_launch_provisions_user_course_and_session(self):
        response = self.launch(roles=[LIS_MEMBERSHIP + "Instructor"])
        self.assertEqual(response.status_code, 200)
        self.jwks_fetch.assert_called_once_with(KEY_SET_URL)
        self.assertEqual(redirect_target(response), "/lti/my-media/?mode=lms_embed_mode")

        user = LTIUserMapping.objects.get(platform=self.platform, lti_user_id="lti-user-1").user
        self.assertEqual(user.email, "jane.doe@school.example.com")
        self.assertEqual(int(self.client.session["_auth_user_id"]), user.pk)
        link = LTIResourceLink.objects.get(platform=self.platform, context_id="course-42")
        self.assertTrue(link.category.is_lms_course)
        self.assertEqual(RBACMembership.objects.get(user=user, rbac_group=link.rbac_group).role, "manager")

        lti_session = self.client.session["lti_session"]
        self.assertEqual((lti_session["platform_id"], lti_session["context_id"], lti_session["resource_link_id"]), (self.platform.pk, "course-42", "resource-link-1"))
        log = LTILaunchLog.objects.get(platform=self.platform)
        self.assertTrue(log.success)
        self.assertEqual((log.user, log.resource_link, log.launch_type), (user, link, "resource_link"))
        self.assertEqual(log.claims["sub"], "lti-user-1")

    def test_relaunch_by_same_user_is_idempotent(self):
        self.launch(roles=[LIS_MEMBERSHIP + "Instructor"])
        self.client.logout()
        response = self.launch(roles=[LIS_MEMBERSHIP + "Learner"])
        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.filter(lti_mappings__platform=self.platform).count(), 1)
        self.assertEqual(Category.objects.filter(lti_context_id="course-42").count(), 1)
        self.assertEqual(RBACMembership.objects.get(rbac_group__lti_resource_links__context_id="course-42").role, "member")
        self.assertEqual(LTILaunchLog.objects.filter(success=True).count(), 2)

    def test_my_media_page_redirects_to_profile_within_lti_session(self):
        self.launch()
        username = LTIUserMapping.objects.get().user.username
        response = self.client.get(MY_MEDIA_URL, {"share_media": "0"})
        self.assertRedirects(response, f"/user/{username}?mode=lms_embed_mode&share_media=0", fetch_redirect_response=False)
        self.assertRedirects(self.client.get(MY_MEDIA_URL), f"/user/{username}?mode=lms_embed_mode", fetch_redirect_response=False)

    def test_media_launch_redirects_to_lti_embed_with_embed_options(self):
        owner = create_account(username="launch_media_owner")
        media = create_media(owner, title="Launch clip", state="public")
        response = self.launch(custom={"media_friendly_token": media.friendly_token, "embed_show_title": "1", "t": "30", "parent_media_base": "https://lms.example.com/a b"})
        self.assertEqual(redirect_target(response), f"/lti/embed/{media.friendly_token}/?mode=lms_embed_mode&showTitle=1&t=30&parent_media_base=https%3A%2F%2Flms.example.com%2Fa%20b")

    def test_filter_launch_takes_media_and_embed_options_from_state(self):
        owner = create_account(username="filter_media_owner")
        media = create_media(owner, title="Filter clip", state="public")
        response = self.launch(oidc_params={"media_token": media.friendly_token, "embed_width": "640", "embed_show_related": "0"})
        self.assertEqual(redirect_target(response), f"/lti/embed/{media.friendly_token}/?mode=lms_embed_mode&showRelated=0&width=640")

    def test_launch_for_deleted_media_reports_not_found(self):
        response = self.launch(custom={"media_id": "gone"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.content.decode(), "This media no longer exists")

    def test_custom_redirect_path_is_honoured_as_local_path(self):
        response = self.launch(custom={"redirect_path": "featured"})
        self.assertEqual(redirect_target(response), "/featured")

    def test_share_media_off_is_passed_to_my_media(self):
        response = self.launch(custom={"embed_share_media": "0"})
        self.assertEqual(redirect_target(response), "/lti/my-media/?mode=lms_embed_mode&share_media=0")

    def test_my_media_launch_provisions_courses_from_publishdata_instead_of_context(self):
        publishdata = encode_publishdata([{"id": 5, "fullname": "Chemistry", "role": "editingteacher"}, {"id": 6, "fullname": "Physics", "role": "student"}])
        response = self.launch(custom={"publishdata": publishdata})
        self.assertEqual(response.status_code, 200)
        user = LTIUserMapping.objects.get().user
        roles = dict(RBACMembership.objects.filter(user=user).values_list("rbac_group__lti_resource_links__context_id", "role"))
        self.assertEqual(roles, {"5": "manager", "6": "member"})
        self.assertFalse(LTIResourceLink.objects.filter(context_id="course-42").exists())
        self.assertIsNone(LTILaunchLog.objects.get().resource_link)

    def test_launch_without_context_only_provisions_the_user(self):
        claims = launch_claims(nonce=None)
        del claims[CLAIM + "context"]
        state, nonce = self.oidc_login()
        claims["nonce"] = nonce
        response = self.launch(claims=claims, state=state)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(LTIUserMapping.objects.filter(platform=self.platform).exists())
        self.assertFalse(LTIResourceLink.objects.exists())

    def test_successful_launch_clears_retry_counter(self):
        session = self.client.session
        session["lti_retry_count"] = 3
        session.save()
        self.launch()
        self.assertNotIn("lti_retry_count", self.client.session)


class LaunchViewRejectionTest(LaunchFlowMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform(name="Moodle Reject")

    def assertRejected(self, response, message=None):
        self.assertEqual(response.status_code, 400)
        self.assertTemplateUsed(response, "lti/launch_error.html")
        if message:
            self.assertIn(message, response.context["message"])
        self.assertFalse(LTIUserMapping.objects.exists())
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_missing_id_token_is_rejected(self):
        response = self.client.post(LAUNCH_URL, {"state": "s"})
        self.assertRejected(response)
        self.assertFalse(LTILaunchLog.objects.exists())

    def test_garbage_id_token_is_rejected(self):
        response = self.client.post(LAUNCH_URL, {"id_token": "not.a.jwt", "state": "s"})
        self.assertRejected(response)

    def test_token_from_unregistered_platform_is_rejected(self):
        state, nonce = self.oidc_login()
        response = self.launch(claims=launch_claims(nonce=nonce, aud="unknown-client"), state=state)
        self.assertRejected(response)
        self.assertFalse(LTILaunchLog.objects.exists())

    def test_token_signed_with_unknown_key_is_rejected_and_logged(self):
        state, nonce = self.oidc_login()
        token = mint_id_token(launch_claims(nonce=nonce), private_key=FORGED_PRIVATE_KEY)
        response = self.launch(token=token, state=state)
        self.assertRejected(response, "Can't decode id_token")
        log = LTILaunchLog.objects.get(platform=self.platform)
        self.assertFalse(log.success)
        self.assertIsNone(log.user)
        self.assertIn("Signature verification failed", log.error_message)

    def test_token_with_unknown_kid_is_rejected(self):
        state, nonce = self.oidc_login()
        token = mint_id_token(launch_claims(nonce=nonce), kid="rotated-away")
        self.assertRejected(self.launch(token=token, state=state), "Unable to find public key")

    def test_expired_token_is_rejected(self):
        state, nonce = self.oidc_login()
        self.assertRejected(self.launch(claims=launch_claims(nonce=nonce, exp=1, iat=0), state=state), "expired")

    def test_replayed_nonce_is_rejected(self):
        state, nonce = self.oidc_login()
        token = mint_id_token(launch_claims(nonce=nonce))
        self.assertEqual(self.launch(token=token, state=state).status_code, 200)
        self.client.logout()
        LTIUserMapping.objects.all().delete()
        state, _ = self.oidc_login()
        self.assertRejected(self.launch(token=token, state=state), "Invalid Nonce")

    def test_missing_nonce_is_rejected(self):
        state, _ = self.oidc_login()
        claims = launch_claims()
        del claims["nonce"]
        self.assertRejected(self.launch(claims=claims, state=state), '"nonce" is empty')

    def test_missing_state_is_rejected(self):
        response = self.launch(state="")
        self.assertRejected(response, "Missing state param")
        self.assertFalse(LTILaunchLog.objects.get().success)

    def test_unknown_deployment_is_rejected(self):
        state, nonce = self.oidc_login()
        claims = launch_claims(nonce=nonce, **{CLAIM + "deployment_id": "other-deployment"})
        self.assertRejected(self.launch(claims=claims, state=state), "Unable to find deployment")

    def test_wrong_lti_version_is_rejected(self):
        state, nonce = self.oidc_login()
        claims = launch_claims(nonce=nonce, **{CLAIM + "version": "1.1"})
        self.assertRejected(self.launch(claims=claims, state=state), "Incorrect version")

    def test_resource_launch_without_resource_link_is_rejected(self):
        state, nonce = self.oidc_login()
        claims = launch_claims(nonce=nonce)
        del claims[CLAIM + "resource_link"]
        self.assertRejected(self.launch(claims=claims, state=state), "Missing Resource Link Id")

    def test_unreachable_jwks_url_is_rejected(self):
        state, nonce = self.oidc_login()
        response = self.client.post(LAUNCH_URL, {"id_token": mint_id_token(launch_claims(nonce=nonce)), "state": state})
        self.assertRejected(response, "Error during fetch URL")


class LaunchViewStateRetryTest(LaunchFlowMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform()

    def test_unknown_state_restarts_oidc_login_and_keeps_media_token(self):
        state = encode_state({"uuid": "x", "media_token": "tok123"})
        response = self.launch(state=state, token=mint_id_token(launch_claims()))
        self.assertEqual(response.status_code, 302)
        location = urlparse(response["Location"])
        self.assertEqual(location.path, OIDC_LOGIN_URL)
        query = {key: values[0] for key, values in parse_qs(location.query).items()}
        self.assertEqual(query, {"iss": ISSUER, "client_id": CLIENT_ID, "target_link_uri": TARGET_LINK_URI, "login_hint": "lti-user-1", "media_token": "tok123", "retry": "1"})
        self.assertEqual(self.client.session["lti_retry_count"], 1)
        self.assertFalse(LTIUserMapping.objects.exists())

    def test_legacy_plain_state_retries_without_media_token(self):
        response = self.launch(state="plain-uuid-state", token=mint_id_token(launch_claims()))
        self.assertEqual(response.status_code, 302)
        self.assertNotIn("media_token", parse_qs(urlparse(response["Location"]).query))

    def test_retries_stop_after_five_attempts(self):
        session = self.client.session
        session["lti_retry_count"] = 5
        session.save()
        response = self.launch(state="never-issued", token=mint_id_token(launch_claims()))
        self.assertEqual(response.status_code, 400)
        self.assertTrue(response.context["is_cookie_error"])
        self.assertEqual(response.context["error"], "Authentication Failed")

    def test_retry_without_target_link_uri_fails_cleanly(self):
        claims = launch_claims()
        del claims[CLAIM + "target_link_uri"]
        response = self.launch(state="never-issued", token=mint_id_token(claims))
        self.assertEqual(response.status_code, 400)
        self.assertIn("automatic retry was unsuccessful", response.context["message"])


class LaunchViewDeepLinkingTest(LaunchFlowMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform()
        cls.owner = create_account(username="dl_launch_owner")
        cls.media = create_media(cls.owner, title="Deep linked clip", state="public")

    def deep_link_launch(self, custom=None, **dl_overrides):
        return self.launch(
            message_type="LtiDeepLinkingRequest",
            roles=[LIS_MEMBERSHIP + "Instructor"],
            custom=custom,
            **{DL_CLAIM + "deep_linking_settings": deep_linking_settings(**dl_overrides)},
        )

    def test_deep_linking_launch_opens_media_selection(self):
        response = self.deep_link_launch()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(redirect_target(response), "/lti/select-media/?mode=lms_embed_mode")
        deep_link = self.client.session["lti_deep_link"]
        self.assertEqual(deep_link["deep_link_return_url"], ISSUER + "/mod/lti/contentitem_return.php")
        self.assertEqual(deep_link["deployment_id"], DEPLOYMENT_ID)
        self.assertEqual(deep_link["platform_id"], self.platform.pk)
        self.assertEqual(deep_link["message_launch_data"]["sub"], "lti-user-1")

    def test_full_deep_linking_round_trip_returns_signed_content_items(self):
        self.deep_link_launch()
        username = LTIUserMapping.objects.get().user.username
        selection = self.client.get("/lti/select-media/")
        self.assertEqual(selection["Location"], f"/user/{username}?mode=lms_embed_mode&action=select_media&lti_context_id=course-42&lti_deep_link=1")
        response = self.client.post("/lti/select-media/", {"media_ids[]": [self.media.friendly_token]})
        self.assertEqual(response.status_code, 200)
        token = unescape(re.search(r'name="JWT" value="([^"]+)"', response.content.decode()).group(1))
        claims = jwt.decode(token, tool_public_key(), algorithms=["RS256"], audience=ISSUER)
        self.assertEqual(claims["sub"], "lti-user-1")
        self.assertEqual(claims[DL_CLAIM + "data"], "opaque-platform-data")
        self.assertEqual(claims[DL_CLAIM + "content_items"][0]["custom"], {"media_friendly_token": self.media.friendly_token})

    def test_filter_deep_linking_launch_goes_straight_to_media(self):
        response = self.deep_link_launch(custom={"media_friendly_token": self.media.friendly_token, "embed_height": "300"})
        self.assertEqual(redirect_target(response), f"/lti/embed/{self.media.friendly_token}/?mode=lms_embed_mode&height=300")

    def test_deep_linking_launch_without_return_url_is_rejected(self):
        response = self.deep_link_launch(deep_link_return_url="")
        self.assertEqual(response.status_code, 400)
        self.assertNotIn("lti_deep_link", self.client.session)

    def test_deep_linking_request_without_settings_is_treated_as_resource_launch(self):
        response = self.launch(message_type="LtiDeepLinkingRequest")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(redirect_target(response), "/lti/my-media/?mode=lms_embed_mode")
        self.assertNotIn("lti_deep_link", self.client.session)
        self.assertTrue(LTILaunchLog.objects.get().success)

    def test_deep_linking_request_with_invalid_settings_is_rejected(self):
        response = self.deep_link_launch(accept_types=["file"])
        self.assertEqual(response.status_code, 400)
        self.assertIn("Must support resource link placement types", response.context["message"])


class EmbedMediaLTIViewTest(LaunchFlowMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform()
        cls.owner = create_account(username="embed_owner")
        cls.public = create_media(cls.owner, title="Embed public", state="public")
        cls.private = create_media(cls.owner, title="Embed private", state="private")

    def embed_url(self, media):
        return f"/lti/embed/{media.friendly_token}/"

    def test_unknown_media_is_404(self):
        self.assertEqual(self.client.get("/lti/embed/doesnotexist/").status_code, 404)

    def test_public_media_redirects_to_embed_player_with_options(self):
        response = self.client.get(self.embed_url(self.public), {"showTitle": "1", "embed_start_time": "12"})
        self.assertRedirects(response, f"/embed?m={self.public.friendly_token}&mode=lms_embed_mode&showTitle=1&t=12", fetch_redirect_response=False)

    def test_show_media_page_redirects_to_full_media_page(self):
        response = self.client.get(self.embed_url(self.public), {"show_media_page": "true"})
        self.assertRedirects(response, f"/view?m={self.public.friendly_token}&mode=lms_embed_mode&show_media_page=true", fetch_redirect_response=False)

    def test_private_media_is_forbidden_without_lti_session(self):
        response = self.client.get(self.embed_url(self.private))
        self.assertEqual(response.status_code, 403)

    def test_private_media_is_forbidden_for_non_member_in_lti_session(self):
        self.launch()
        self.assertEqual(self.client.get(self.embed_url(self.private)).status_code, 403)
        self.assertFalse(MediaPermission.objects.exists())

    def test_course_member_gets_viewer_permission_for_media_shared_into_the_course(self):
        self.launch()
        course_category = LTIResourceLink.objects.get(context_id="course-42").category
        self.private.category.add(course_category)
        response = self.client.get(self.embed_url(self.private))
        self.assertEqual(response.status_code, 302)
        user = LTIUserMapping.objects.get().user
        permission = MediaPermission.objects.get(user=user, media=self.private)
        self.assertEqual((permission.permission, permission.owner_user, permission.source), ("viewer", self.owner, MediaPermission.SOURCE_LTI_EMBED))
        self.client.get(self.embed_url(self.private))
        self.assertEqual(MediaPermission.objects.filter(user=user, media=self.private).count(), 1)

    def test_owner_can_embed_own_private_media_in_lti_session(self):
        LTIUserMapping.objects.create(platform=self.platform, lti_user_id="owner-sub", user=self.owner)
        self.launch(sub="owner-sub")
        self.assertEqual(self.client.get(self.embed_url(self.private)).status_code, 302)


class KeyEndpointsTest(TestCase):
    def test_jwks_endpoint_publishes_the_tool_public_key(self):
        response = self.client.get("/lti/jwks/")
        self.assertEqual(response.status_code, 200)
        keys = response.json()["keys"]
        self.assertEqual(keys, [LTIToolKeys.objects.get().public_key_jwk])
        self.assertNotIn("d", keys[0])

    def test_public_key_endpoint_returns_matching_pem(self):
        response = self.client.get("/lti/public-key/")
        self.assertEqual(response["Content-Type"], "text/plain")
        body = response.content.decode()
        pem = body[body.index("-----BEGIN PUBLIC KEY-----") : body.index("-----END PUBLIC KEY-----") + len("-----END PUBLIC KEY-----")]
        public_key = serialization.load_pem_public_key(pem.encode())
        self.assertEqual(public_key.public_numbers(), tool_public_key().public_numbers())


class MyMediaLTIViewTest(TestCase):
    def test_requires_lti_session(self):
        self.assertEqual(self.client.get(MY_MEDIA_URL).status_code, 403)
        self.client.force_login(create_account(username="not_lti_user"))
        self.assertEqual(self.client.get(MY_MEDIA_URL).status_code, 403)


class LaunchViewHelpersTest(TestCase):
    def test_embed_params_map_both_naming_styles_without_duplicates(self):
        params = LaunchView.extract_embed_params_from_dict({"embed_show_title": "1", "showTitle": "1", "linkTitle": "0", "embed_share_media": "0", "embed_width": ""})
        self.assertEqual(params, ["showTitle=1", "linkTitle=0", "share_media=0"])

    def test_url_builder_appends_to_existing_query(self):
        self.assertEqual(LaunchView.build_url_with_embed_params("/embed?m=x", ["t=1"]), "/embed?m=x&mode=lms_embed_mode&t=1")
        self.assertEqual(LaunchView.build_url_with_embed_params("/lti/my-media/", []), "/lti/my-media/?mode=lms_embed_mode")

    def test_client_ip_prefers_first_forwarded_address(self):
        factory = RequestFactory()
        self.assertEqual(get_client_ip(factory.get("/", HTTP_X_FORWARDED_FOR="10.0.0.1, 10.0.0.2")), "10.0.0.1")
        self.assertEqual(get_client_ip(factory.get("/", REMOTE_ADDR="192.0.2.5")), "192.0.2.5")


@override_settings(USE_LTI=True)
class LTISessionContextProcessorTest(LaunchFlowMixin, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform()

    def test_lti_session_is_exposed_to_templates_when_lti_is_enabled(self):
        self.launch()
        response = self.client.get("/about")
        self.assertEqual(response.context["lti_session"]["context_id"], "course-42")
