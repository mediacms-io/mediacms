import json
import os
import subprocess
import sys
import tempfile
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
file_handler = s.LOGGING.get("handlers", {}).get("file")
print(json.dumps({
    "LOGS_DIR": s.LOGS_DIR,
    "filename": file_handler and file_handler["filename"],
    "exists": file_handler is not None and os.path.isfile(file_handler["filename"]),
}))
"""


def load_settings_with(overrides):
    env = dict(os.environ, PYTHONPATH=BASE_DIR)
    result = subprocess.run(
        [sys.executable, "-c", _SCRIPT, json.dumps(overrides)],
        capture_output=True,
        text=True,
        env=env,
        cwd=BASE_DIR,
        check=True,
    )
    return json.loads(result.stdout.strip().splitlines()[-1])


class LogsDirOverrideTests(unittest.TestCase):
    def test_overridden_logs_dir_is_used_for_the_file_handler(self):
        with tempfile.TemporaryDirectory(prefix="mediacms-logs-") as tmp:
            logs_dir = os.path.join(tmp, "custom", "logs")
            loaded = load_settings_with({"LOGS_DIR": logs_dir})
        self.assertEqual(loaded["LOGS_DIR"], logs_dir)
        self.assertEqual(loaded["filename"], os.path.join(logs_dir, "debug.log"))
        self.assertTrue(loaded["exists"])

    def test_explicit_handler_filename_is_kept(self):
        with tempfile.TemporaryDirectory(prefix="mediacms-logs-") as tmp:
            explicit = os.path.join(tmp, "explicit.log")
            logging_config = {
                "version": 1,
                "disable_existing_loggers": False,
                "handlers": {"file": {"class": "logging.FileHandler", "filename": explicit}},
                "loggers": {},
            }
            loaded = load_settings_with({"LOGS_DIR": os.path.join(tmp, "logs"), "LOGGING": logging_config})
        self.assertEqual(loaded["filename"], explicit)

    def test_logging_without_a_file_handler_does_not_break_startup(self):
        with tempfile.TemporaryDirectory(prefix="mediacms-logs-") as tmp:
            logging_config = {"version": 1, "disable_existing_loggers": False, "handlers": {}, "loggers": {}}
            loaded = load_settings_with({"LOGS_DIR": os.path.join(tmp, "logs"), "LOGGING": logging_config})
        self.assertIsNone(loaded["filename"])
