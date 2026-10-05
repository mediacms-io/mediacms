import io
from unittest import mock

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.db import SessionStore
from django.template import Context, Template
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings

from cms.version import VERSION
from files.backends import FFmpegBackend, VideoEncodingError
from files.context_processors import stuff
from files.frontend_translations import translation_strings
from files.permissions import IsMediacmsEditor
from files.templatetags.custom_filters import custom_translate
from files.tests import create_account, fixture_path


def make_user(username, **kwargs):
    return create_account(username=username, email=f"{username}@example.com", **kwargs)


class ContextProcessorTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superuser = make_user("ctx_super", is_superuser=True)
        cls.editor = make_user("ctx_editor", is_editor=True)
        cls.regular = make_user("ctx_regular")

    def context_for(self, user, language="en", session=None):
        request = RequestFactory().get("/", HTTP_HOST="portal.example.com")
        request.user = user
        request.LANGUAGE_CODE = language
        request.session = SessionStore()
        request.session.update(session or {})
        return stuff(request)

    def test_portal_settings_are_exposed(self):
        ctx = self.context_for(AnonymousUser())
        self.assertEqual(ctx["FRONTEND_HOST"], "http://portal.example.com")
        self.assertEqual(ctx["PORTAL_NAME"], settings.PORTAL_NAME)
        self.assertEqual(ctx["VERSION"], VERSION)
        self.assertEqual(ctx["RSS_URL"], "/rss")
        self.assertEqual(ctx["TRANSLATION"], {})

    def test_roles_are_reported_for_the_current_user(self):
        anonymous = self.context_for(AnonymousUser())
        self.assertFalse(anonymous["IS_MEDIACMS_ADMIN"])
        self.assertFalse(anonymous["IS_MEDIACMS_EDITOR"])

        editor = self.context_for(self.editor)
        self.assertTrue(editor["IS_MEDIACMS_EDITOR"])
        self.assertFalse(editor["IS_MEDIACMS_MANAGER"])
        self.assertNotIn("DJANGO_ADMIN_URL", editor)

        admin = self.context_for(self.superuser)
        self.assertTrue(admin["IS_MEDIACMS_ADMIN"])
        self.assertTrue(admin["IS_MEDIACMS_MANAGER"])
        self.assertEqual(admin["DJANGO_ADMIN_URL"], settings.DJANGO_ADMIN_URL)

    @override_settings(CAN_SEE_MEMBERS_PAGE="all")
    def test_members_page_open_to_all_logged_in_users(self):
        self.assertTrue(self.context_for(self.regular)["CAN_SEE_MEMBERS_PAGE"])
        self.assertFalse(self.context_for(AnonymousUser())["CAN_SEE_MEMBERS_PAGE"])

    @override_settings(CAN_SEE_MEMBERS_PAGE="editors")
    def test_members_page_for_editors_only(self):
        self.assertTrue(self.context_for(self.editor)["CAN_SEE_MEMBERS_PAGE"])
        self.assertFalse(self.context_for(self.regular)["CAN_SEE_MEMBERS_PAGE"])

    @override_settings(CAN_SEE_MEMBERS_PAGE="admins")
    def test_members_page_for_admins_only(self):
        self.assertTrue(self.context_for(self.superuser)["CAN_SEE_MEMBERS_PAGE"])
        self.assertFalse(self.context_for(self.editor)["CAN_SEE_MEMBERS_PAGE"])

    def test_translations_follow_the_request_language(self):
        ctx = self.context_for(AnonymousUser(), language="fr")
        self.assertEqual(ctx["TRANSLATION"], translation_strings["fr"])

    @override_settings(USE_LTI=True)
    def test_lti_session_is_exposed_only_to_logged_in_users(self):
        lti = {"context_id": "course-1"}
        self.assertEqual(self.context_for(self.regular, session={"lti_session": lti})["lti_session"], lti)
        self.assertNotIn("lti_session", self.context_for(AnonymousUser(), session={"lti_session": lti}))

    @override_settings(USE_LTI=False)
    def test_lti_session_is_hidden_when_lti_is_off(self):
        self.assertNotIn("lti_session", self.context_for(self.regular, session={"lti_session": {"x": 1}}))


class EditorPermissionTests(TestCase):
    def test_only_editors_pass(self):
        permission = IsMediacmsEditor()
        request = RequestFactory().get("/")
        request.user = make_user("perm_editor", is_editor=True)
        self.assertTrue(permission.has_permission(request, None))
        request.user = make_user("perm_regular")
        self.assertFalse(permission.has_permission(request, None))
        request.user = AnonymousUser()
        self.assertFalse(permission.has_permission(request, None))


class CustomTranslateFilterTests(SimpleTestCase):
    def test_known_strings_are_translated(self):
        self.assertEqual(custom_translate("Upload", "fr"), translation_strings["fr"]["Upload"])

    def test_unknown_strings_and_english_pass_through(self):
        self.assertEqual(custom_translate("No such string here", "fr"), "No such string here")
        self.assertEqual(custom_translate("Upload", "en"), "Upload")
        self.assertEqual(custom_translate("Upload", "xx"), "Upload")

    def test_filter_is_usable_from_templates(self):
        rendered = Template("{% load custom_filters %}{{ 'Upload'|custom_translate:'fr' }}").render(Context())
        self.assertEqual(rendered, translation_strings["fr"]["Upload"])


class FFmpegBackendTests(SimpleTestCase):
    def run_encode(self, cmd):
        return list(FFmpegBackend().encode(cmd))

    def test_progress_is_parsed_from_carriage_return_separated_stats(self):
        stderr = b"header\rframe=1 time=00:00:01.50 bitrate=1\rframe=2 time=00:00:03.00 bitrate=1\rsummary\n"
        process = mock.Mock(stderr=io.BytesIO(stderr), returncode=0)
        process.communicate.return_value = (b"", b"")
        with mock.patch.object(FFmpegBackend, "_spawn", return_value=process):
            results = self.run_encode(["ffmpeg"])

        self.assertEqual(results[:-1], [[], "00:00:01.50", "00:00:03.00"])
        self.assertEqual(results[-1], stderr.decode())

    def test_real_ffmpeg_run_returns_its_output(self):
        cmd = [settings.FFMPEG_COMMAND, "-y", "-i", fixture_path("small_video.mp4"), "-t", "1", "-f", "null", "-"]
        self.assertIn("time=00:00:01", self.run_encode(cmd)[-1])

    def test_failing_command_raises_with_its_output(self):
        with self.assertRaises(VideoEncodingError) as raised:
            self.run_encode([settings.FFMPEG_COMMAND, "-i", "/nonexistent/input.mp4", "-f", "null", "-"])
        self.assertIn("/nonexistent/input.mp4", raised.exception.message)

    def test_silent_command_raises(self):
        with self.assertRaises(VideoEncodingError) as raised:
            self.run_encode(["true"])
        self.assertEqual(raised.exception.message, "No output from FFmpeg.")

    def test_missing_binary_raises(self):
        with self.assertRaises(VideoEncodingError) as raised:
            self.run_encode(["/nonexistent/ffmpeg-binary"])
        self.assertEqual(raised.exception.message, "Error while running ffmpeg")
