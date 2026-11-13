import os
import tempfile
from unittest.mock import patch

from django.test import TestCase, override_settings

from admin_customizations.admin import (
    get_site_configuration_status,
    get_site_health_checks,
)
from admin_customizations.deployment_health import _probe_directory


def _checks():
    return {check["id"]: check for check in get_site_health_checks()}


PROD_HTTPS = dict(
    DEBUG=False,
    LOCAL_INSTALL=False,
    FRONTEND_HOST="https://example.com",
    USE_X_FORWARDED_HOST=False,
    SECURE_PROXY_SSL_HEADER=None,
    CSRF_TRUSTED_ORIGINS=[],
    CSRF_COOKIE_SECURE=False,
    SESSION_COOKIE_SECURE=False,
    SECURE_SSL_REDIRECT=False,
)


class DeploymentHealthTests(TestCase):
    @override_settings(**PROD_HTTPS)
    def test_https_production_gaps_warn(self):
        checks = _checks()
        for check_id in (
            "proxy_forwarded_host",
            "proxy_ssl_header",
            "csrf_trusted_origins",
            "secure_cookies",
            "secure_ssl_redirect",
        ):
            self.assertEqual(checks[check_id]["status"], "warn", check_id)

    @override_settings(DEBUG=False, LOCAL_INSTALL=False, FRONTEND_HOST="https://example.com")
    @patch("admin_customizations.deployment_health._cors_installed", return_value=False)
    def test_cors_ok_when_not_installed(self, _installed):
        checks = _checks()
        self.assertEqual(checks["cors_allow_all"]["status"], "ok")
        self.assertIn("not installed", checks["cors_allow_all"]["detail"])

    @override_settings(**PROD_HTTPS)
    @patch("admin_customizations.deployment_health._cors_installed", return_value=True)
    @patch("admin_customizations.deployment_health._cors_allow_all", return_value=True)
    def test_cors_allow_all_warns_in_production(self, _allow, _installed):
        checks = _checks()
        self.assertEqual(checks["cors_allow_all"]["status"], "warn")

    @override_settings(DEBUG=True, LOCAL_INSTALL=True, FRONTEND_HOST="http://localhost")
    def test_local_http_proxy_gaps_are_ok(self):
        checks = _checks()
        self.assertEqual(checks["proxy_forwarded_host"]["status"], "ok")
        self.assertEqual(checks["proxy_ssl_header"]["status"], "ok")
        self.assertEqual(checks["secure_cookies"]["status"], "ok")
        self.assertIn(checks["cors_allow_all"]["status"], ("ok", "info"))

    @override_settings(
        DEBUG=True,
        LOCAL_INSTALL=False,
        FRONTEND_HOST="https://example.com",
        USE_X_FORWARDED_HOST=False,
        SECURE_PROXY_SSL_HEADER=None,
        CSRF_TRUSTED_ORIGINS=[],
        CSRF_COOKIE_SECURE=False,
        SESSION_COOKIE_SECURE=False,
        SECURE_SSL_REDIRECT=False,
    )
    def test_https_debug_gaps_are_info(self):
        checks = _checks()
        self.assertEqual(checks["proxy_forwarded_host"]["status"], "info")
        self.assertEqual(checks["secure_cookies"]["status"], "info")
        self.assertEqual(checks["csrf_trusted_origins"]["status"], "info")

    @override_settings(
        DEBUG=False,
        LOCAL_INSTALL=False,
        FRONTEND_HOST="https://example.com:8443",
        USE_X_FORWARDED_HOST=True,
        SECURE_PROXY_SSL_HEADER=("HTTP_X_FORWARDED_PROTO", "https"),
        CSRF_TRUSTED_ORIGINS=["https://example.com:8443"],
        CSRF_COOKIE_SECURE=True,
        SESSION_COOKIE_SECURE=True,
        SECURE_SSL_REDIRECT=True,
    )
    def test_https_production_settings_ok(self):
        checks = _checks()
        for check_id in (
            "proxy_forwarded_host",
            "proxy_ssl_header",
            "csrf_trusted_origins",
            "secure_cookies",
            "secure_ssl_redirect",
        ):
            self.assertEqual(checks[check_id]["status"], "ok", check_id)

    def test_configuration_includes_proxy_and_media_rows(self):
        labels = [item["label"] for item in get_site_configuration_status()]
        for expected in (
            "USE_X_FORWARDED_HOST",
            "SECURE_PROXY_SSL_HEADER",
            "SECURE_SSL_REDIRECT",
            "CSRF_COOKIE_SECURE",
            "SESSION_COOKIE_SECURE",
            "CSRF_TRUSTED_ORIGINS",
            "MEDIA_ROOT",
            "HLS_DIR",
            "TEMP_DIRECTORY",
        ):
            self.assertIn(expected, labels)


class MediaStorageHealthTests(TestCase):
    def _override_tree(self, root, **extra):
        for name in ("original", "encoded", "uploads", "chunks", "hls"):
            os.makedirs(os.path.join(root, name), exist_ok=True)
        return override_settings(
            MEDIA_ROOT=root,
            HLS_DIR=os.path.join(root, "hls"),
            TEMP_DIRECTORY=root,
            MEDIA_UPLOAD_DIR="original/",
            MEDIA_ENCODING_DIR="encoded/",
            UPLOAD_DIR="uploads/",
            CHUNKS_DIR="chunks/",
            **extra,
        )

    def test_writable_tree_is_ok(self):
        with tempfile.TemporaryDirectory() as root:
            with self._override_tree(root):
                checks = _checks()
            for check_id in ("media_root_access", "hls_dir_access", "temp_dir_access", "media_subdirs_access"):
                self.assertEqual(checks[check_id]["status"], "ok", checks[check_id]["detail"])

    def test_missing_paths_fail_or_warn(self):
        missing = "/tmp/mediacms-health-missing-not-created"
        with override_settings(
            MEDIA_ROOT=missing,
            HLS_DIR=os.path.join(missing, "hls"),
            TEMP_DIRECTORY=os.path.join(missing, "tmp"),
            MEDIA_UPLOAD_DIR="original/",
            MEDIA_ENCODING_DIR="encoded/",
            UPLOAD_DIR="uploads/",
            CHUNKS_DIR="chunks/",
        ):
            checks = _checks()
        self.assertEqual(checks["media_root_access"]["status"], "fail")
        self.assertIn("missing", checks["media_root_access"]["detail"])
        self.assertEqual(checks["temp_dir_access"]["status"], "fail")
        self.assertEqual(checks["hls_dir_access"]["status"], "warn")
        self.assertEqual(checks["media_subdirs_access"]["status"], "warn")
        self.assertIn("original", checks["media_subdirs_access"]["detail"])

    def test_probe_not_writable(self):
        with tempfile.TemporaryDirectory() as root:
            probe = _probe_directory(root)
            self.assertIsNone(probe)

            real_open = open

            def deny_probe(path, mode="r", *args, **kwargs):
                if ".mediacms_health_probe_" in str(path):
                    raise PermissionError("denied")
                return real_open(path, mode, *args, **kwargs)

            with patch("builtins.open", deny_probe):
                reason = _probe_directory(root)
            self.assertIn("not writable", reason)

    def test_health_checks_include_new_ids(self):
        checks = _checks()
        for check_id in (
            "proxy_forwarded_host",
            "proxy_ssl_header",
            "csrf_trusted_origins",
            "secure_cookies",
            "secure_ssl_redirect",
            "cors_allow_all",
            "media_root_access",
            "hls_dir_access",
            "temp_dir_access",
            "media_subdirs_access",
        ):
            self.assertIn(check_id, checks)
