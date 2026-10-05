import re
from html import unescape

import jwt
from django.test import RequestFactory, TestCase
from lti_testkit import (
    CLAIM,
    CLIENT_ID,
    DEPLOYMENT_ID,
    DL_CLAIM,
    ISSUER,
    PLATFORM_PRIVATE_KEY,
    create_platform,
    deep_linking_settings,
    launch_claims,
    tool_public_key,
)

from files.models import Category, MediaPermission
from files.tests import create_account, create_media
from lti.deep_linking import SelectMediaView
from rbac.models import RBACGroup, RBACMembership

SELECT_MEDIA_URL = "/lti/select-media/"
RETURN_URL = ISSUER + "/mod/lti/contentitem_return.php"


def returned_jwt(response):
    return unescape(re.search(r'name="JWT" value="([^"]+)"', response.content.decode()).group(1))


def decode_response_jwt(token):
    return jwt.decode(token, tool_public_key(), algorithms=["RS256"], audience=ISSUER)


class SelectMediaGetTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_account(username="dl_instructor")

    def test_anonymous_user_is_sent_to_login(self):
        response = self.client.get(SELECT_MEDIA_URL)
        self.assertEqual(response.status_code, 302)
        self.assertIn("login", response["Location"])

    def test_plain_lti_session_redirects_to_profile_in_select_mode(self):
        self.client.force_login(self.user)
        response = self.client.get(SELECT_MEDIA_URL)
        self.assertRedirects(response, "/user/dl_instructor?mode=lms_embed_mode&action=select_media", fetch_redirect_response=False)

    def test_course_context_and_deep_link_flag_are_forwarded_to_frontend(self):
        self.client.force_login(self.user)
        session = self.client.session
        session["lti_session"] = {"context_id": "course 42/a"}
        session["lti_deep_link"] = {"deep_link_return_url": RETURN_URL}
        session.save()
        response = self.client.get(SELECT_MEDIA_URL)
        self.assertEqual(response["Location"], "/user/dl_instructor?mode=lms_embed_mode&action=select_media&lti_context_id=course%2042/a&lti_deep_link=1")


class SelectMediaPostTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.platform = create_platform()
        cls.instructor = create_account(username="dl_poster")
        cls.other = create_account(username="dl_other_owner")
        cls.own_private = create_media(cls.instructor, title="My private lecture", state="private")
        cls.public = create_media(cls.other, title="Someone's public clip", state="public")
        cls.unlisted = create_media(cls.other, title="Someone's unlisted clip", state="unlisted")
        cls.foreign_private = create_media(cls.other, title="Someone's private clip", state="private")

    def setUp(self):
        self.client.force_login(self.instructor)

    def _start_deep_link(self, **dl_overrides):
        claims = launch_claims(message_type="LtiDeepLinkingRequest", sub="instructor-sub", **{DL_CLAIM + "deep_linking_settings": deep_linking_settings(**dl_overrides)})
        session = self.client.session
        session["lti_deep_link"] = {
            "deep_link_return_url": RETURN_URL,
            "deployment_id": DEPLOYMENT_ID,
            "platform_id": self.platform.pk,
            "message_launch_data": claims,
        }
        session.save()

    def _select(self, *ids):
        return self.client.post(SELECT_MEDIA_URL, {"media_ids[]": list(ids)})

    def test_selection_without_deep_link_launch_is_rejected(self):
        response = self._select(self.public.friendly_token)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "Invalid session"})

    def test_empty_selection_is_rejected(self):
        self._start_deep_link()
        response = self._select()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "No media selected"})

    def test_selected_media_is_returned_as_a_signed_deep_linking_response(self):
        self._start_deep_link()
        response = self._select(self.own_private.friendly_token, self.public.friendly_token)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "lti/deep_link_return.html")
        self.assertContains(response, f'action="{RETURN_URL}"')
        token = returned_jwt(response)
        self.assertEqual(jwt.get_unverified_header(token)["kid"], "mediacms-lti-key")
        claims = decode_response_jwt(token)
        self.assertEqual(claims["iss"], CLIENT_ID)
        self.assertEqual(claims["sub"], "instructor-sub")
        self.assertEqual(claims[CLAIM + "message_type"], "LtiDeepLinkingResponse")
        self.assertEqual(claims[CLAIM + "version"], "1.3.0")
        self.assertEqual(claims[CLAIM + "deployment_id"], DEPLOYMENT_ID)
        self.assertEqual(claims[DL_CLAIM + "data"], "opaque-platform-data")
        self.assertTrue(claims["nonce"])
        self.assertGreater(claims["exp"], claims["iat"])
        items = claims[DL_CLAIM + "content_items"]
        self.assertEqual([item["title"] for item in items], ["My private lecture", "Someone's public clip"])
        for item, media in zip(items, (self.own_private, self.public)):
            self.assertEqual(item["type"], "ltiResourceLink")
            self.assertEqual(item["url"], "http://testserver/lti/launch/")
            self.assertEqual(item["custom"], {"media_friendly_token": media.friendly_token})
            self.assertEqual(item["iframe"], {"width": 960, "height": 540})
            if "thumbnail" in item:
                self.assertTrue(item["thumbnail"]["url"].startswith("http"))

    def test_response_is_not_verifiable_with_another_key(self):
        self._start_deep_link()
        token = returned_jwt(self._select(self.public.friendly_token))
        with self.assertRaises(jwt.InvalidSignatureError):
            jwt.decode(token, PLATFORM_PRIVATE_KEY.public_key(), algorithms=["RS256"], audience=ISSUER)

    def test_numeric_ids_are_still_accepted(self):
        self._start_deep_link()
        claims = decode_response_jwt(returned_jwt(self._select(str(self.unlisted.pk))))
        self.assertEqual([item["title"] for item in claims[DL_CLAIM + "content_items"]], ["Someone's unlisted clip"])

    def test_private_media_of_others_cannot_be_embedded(self):
        self._start_deep_link()
        response = self._select(self.foreign_private.friendly_token, "does-not-exist", "999999999")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"error": "No valid media found"})

    def test_unselectable_items_are_dropped_from_a_mixed_selection(self):
        self._start_deep_link()
        claims = decode_response_jwt(returned_jwt(self._select(self.foreign_private.friendly_token, self.public.friendly_token)))
        self.assertEqual([item["custom"]["media_friendly_token"] for item in claims[DL_CLAIM + "content_items"]], [self.public.friendly_token])

    def test_platform_data_claim_is_omitted_when_platform_sent_none(self):
        self._start_deep_link()
        session = self.client.session
        del session["lti_deep_link"]["message_launch_data"][DL_CLAIM + "deep_linking_settings"]["data"]
        session.save()
        claims = decode_response_jwt(returned_jwt(self._select(self.public.friendly_token)))
        self.assertNotIn(DL_CLAIM + "data", claims)


class CanSelectTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = create_account(username="cs_owner")
        cls.stranger = create_account(username="cs_stranger")
        cls.editor = create_account(username="cs_editor", is_editor=True)
        cls.shared_with = create_account(username="cs_shared")
        cls.media = create_media(cls.owner, title="Restricted", state="private")
        MediaPermission.objects.create(user=cls.shared_with, owner_user=cls.owner, media=cls.media, permission="viewer")

    def test_only_users_who_can_reach_private_media_may_select_it(self):
        self.assertTrue(SelectMediaView.can_select(self.owner, self.media))
        self.assertTrue(SelectMediaView.can_select(self.editor, self.media))
        self.assertTrue(SelectMediaView.can_select(self.shared_with, self.media))
        self.assertFalse(SelectMediaView.can_select(self.stranger, self.media))

    def test_rbac_course_members_may_select_course_media(self):
        category = Category.objects.create(title="CS course", is_rbac_category=True)
        group = RBACGroup.objects.create(name="CS course group")
        group.categories.add(category)
        member = create_account(username="cs_member")
        RBACMembership.objects.create(user=member, rbac_group=group, role="member")
        self.media.category.add(category)
        with self.settings(USE_RBAC=True):
            self.assertTrue(SelectMediaView.can_select(member, self.media))


class CreateDeepLinkJWTTest(TestCase):
    def test_unknown_platform_raises_a_value_error(self):
        request = RequestFactory().post(SELECT_MEDIA_URL)
        deep_link_data = {"platform_id": 0, "deployment_id": DEPLOYMENT_ID, "message_launch_data": {}}
        with self.assertRaisesMessage(ValueError, "Failed to create Deep Linking JWT"):
            SelectMediaView().create_deep_link_jwt(deep_link_data, [], request)

    def test_launch_without_sub_produces_response_without_sub(self):
        platform = create_platform()
        request = RequestFactory().post(SELECT_MEDIA_URL)
        deep_link_data = {"platform_id": platform.pk, "deployment_id": DEPLOYMENT_ID, "message_launch_data": {}}
        items = [{"type": "ltiResourceLink", "title": "Clip", "url": "http://testserver/lti/launch/"}]
        claims = decode_response_jwt(SelectMediaView().create_deep_link_jwt(deep_link_data, items, request))
        self.assertNotIn("sub", claims)
        self.assertEqual(claims[DL_CLAIM + "content_items"], items)
