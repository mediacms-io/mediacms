import os
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse

from admin_customizations.runtime_info import (
    _binary_cache,
    describe_binary,
    environment_rows,
    get_system_runtime_rows,
    strip_userinfo,
)
from admin_customizations.support_bundle import (
    render_support_bundle,
    support_bundle_filename,
)
from files.tests import create_account


@override_settings(SECURE_SSL_REDIRECT=False)
class RuntimeInfoTest(TestCase):
    def test_strip_userinfo_drops_password(self):
        self.assertEqual(strip_userinfo("redis://:s3cret@redis.internal:6379/1"), "redis://redis.internal:6379/1")
        self.assertEqual(strip_userinfo(""), "")

    def test_environment_rows_hide_unlisted_values(self):
        rows = {row["label"]: row["value"] for row in environment_rows({"PATH": "/usr/bin", "SECRET_TOKEN": "hunter2", "EMPTY_FLAG": ""})}
        self.assertEqual(rows["PATH"], "/usr/bin")
        self.assertEqual(rows["SECRET_TOKEN"], "(set)")
        self.assertEqual(rows["EMPTY_FLAG"], "(empty)")
        self.assertNotIn("hunter2", rows.values())

    def test_describe_binary_reports_missing_command(self):
        _binary_cache.pop("missing-bin", None)
        with patch("admin_customizations.runtime_info.shutil.which", return_value=""):
            self.assertEqual(describe_binary("missing-bin"), "missing-bin (not found)")

    @override_settings(BROKER_URL="redis://:s3cret@redis.internal:6379/1")
    def test_runtime_rows_omit_database_password_and_broker_secret(self):
        os.environ["SUPPORT_BUNDLE_SECRET"] = "bundle-secret-hunter2-value"
        try:
            values = "\n".join(row["value"] for row in get_system_runtime_rows())
        finally:
            os.environ.pop("SUPPORT_BUNDLE_SECRET", None)
        self.assertNotIn("s3cret", values)
        self.assertNotIn("bundle-secret-hunter2-value", values)
        self.assertIn("redis://redis.internal:6379/1", values)

    @override_settings(DEBUG=True)
    def test_support_bundle_includes_warning_and_omits_secret(self):
        admin = create_account(username="support_bundle_admin", is_superuser=True)
        os.environ["SUPPORT_BUNDLE_SECRET"] = "bundle-secret-hunter2-value"
        try:
            self.client.force_login(admin)
            filename = support_bundle_filename("md")
            response = self.client.get(reverse("admin:support_bundle", args=[filename]))
        finally:
            os.environ.pop("SUPPORT_BUNDLE_SECRET", None)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(filename.endswith(".md"))
        self.assertIn(filename, response["Content-Disposition"])
        self.assertEqual(self.client.get(reverse("admin:support_bundle", args=["bundle"])).status_code, 404)
        body = response.content.decode()
        self.assertIn("Warnings and failures", body)
        self.assertIn("DEBUG disabled", body)
        self.assertIn("SUPPORT_BUNDLE_SECRET", body)
        self.assertIn("(set)", body)
        self.assertNotIn("bundle-secret-hunter2-value", body)
        self.assertIn("safe to paste", body)

    def test_support_bundle_text_format(self):
        body = render_support_bundle("txt")
        self.assertIn("MediaCMS support bundle", body)
        self.assertIn("Configuration", body)
        self.assertIn("Runtime", body)
