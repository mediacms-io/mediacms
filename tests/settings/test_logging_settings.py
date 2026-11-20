import json
import os
import subprocess
import sys
import unittest

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

_SCRIPT = """
import json, os, sys, types
local_settings = types.ModuleType("cms.local_settings")
for key, value in json.loads(sys.argv[1]).items():
    setattr(local_settings, key, value)
sys.modules["cms.local_settings"] = local_settings
os.environ.setdefault("TESTING", "True")
import cms.settings as s
print(json.dumps(s.LOGGING))
"""

CUSTOM_LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"null": {"class": "logging.NullHandler"}},
    "loggers": {"django": {"handlers": ["null"], "level": "WARNING"}},
}


def load_logging_with(overrides, **env_vars):
    env = dict(os.environ, PYTHONPATH=BASE_DIR, **env_vars)
    env.setdefault("SECRET_KEY", "test")
    for name in ("LOGLEVEL", "ENABLE_SQL_DEBUG_LOGGING", "DEVELOPMENT_MODE"):
        if name not in env_vars:
            env.pop(name, None)
    result = subprocess.run(
        [sys.executable, "-c", _SCRIPT, json.dumps(overrides)],
        capture_output=True,
        text=True,
        env=env,
        cwd=BASE_DIR,
        check=True,
    )
    return json.loads(result.stdout.strip().splitlines()[-1])


class LoggingSettingsTests(unittest.TestCase):
    def test_default_level_is_error_without_app_loggers(self):
        logging_config = load_logging_with({})
        self.assertEqual(logging_config["handlers"]["file"]["level"], "ERROR")
        self.assertEqual(logging_config["loggers"]["django"]["level"], "ERROR")
        self.assertEqual(set(logging_config["loggers"]), {"django"})
        self.assertNotIn("console", logging_config["handlers"])

    def test_loglevel_env_is_honored(self):
        logging_config = load_logging_with({}, LOGLEVEL="info")
        self.assertEqual(logging_config["handlers"]["file"]["level"], "INFO")
        self.assertEqual(logging_config["loggers"]["files"]["level"], "INFO")
        self.assertEqual(logging_config["loggers"]["django"]["level"], "INFO")

    def test_loglevel_in_local_settings_is_honored(self):
        logging_config = load_logging_with({"LOGLEVEL": "WARNING"})
        self.assertEqual(logging_config["handlers"]["file"]["level"], "WARNING")
        self.assertEqual(logging_config["loggers"]["users"]["level"], "WARNING")

    def test_local_logging_override_is_kept(self):
        self.assertEqual(load_logging_with({"LOGGING": CUSTOM_LOGGING, "DEBUG": True}), CUSTOM_LOGGING)

    def test_debug_adds_console_handler(self):
        logging_config = load_logging_with({"DEBUG": True})
        self.assertIn("console", logging_config["handlers"])
        self.assertIn("console", logging_config["loggers"]["files"]["handlers"])
        self.assertEqual(logging_config["loggers"]["files"]["level"], "DEBUG")
        self.assertNotIn("django.db.backends", logging_config["loggers"])

    def test_sql_debug_logging(self):
        logging_config = load_logging_with({"DEBUG": True}, ENABLE_SQL_DEBUG_LOGGING="true")
        self.assertEqual(logging_config["loggers"]["django.db.backends"]["level"], "DEBUG")

    def test_sql_debug_logging_needs_debug(self):
        logging_config = load_logging_with({}, ENABLE_SQL_DEBUG_LOGGING="true")
        self.assertNotIn("django.db.backends", logging_config["loggers"])
