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
print(json.dumps({
    "enabled": s.PROXY_AWARE_MIDDLEWARE_ENABLED,
    "middleware": "cms.middleware.ProxyAwareMiddleware" in s.MIDDLEWARE,
}))
"""


def load_settings_with(overrides):
    env = dict(os.environ, PYTHONPATH=BASE_DIR)
    env.setdefault("SECRET_KEY", "test")
    result = subprocess.run(
        [sys.executable, "-c", _SCRIPT, json.dumps(overrides)],
        capture_output=True,
        text=True,
        env=env,
        cwd=BASE_DIR,
        check=True,
    )
    return json.loads(result.stdout.strip().splitlines()[-1])


class ProxySettingsTests(unittest.TestCase):
    def test_disabled_by_default(self):
        self.assertEqual(load_settings_with({}), {"enabled": False, "middleware": False})

    def test_trusted_proxies_in_local_settings_enables_middleware(self):
        self.assertEqual(load_settings_with({"TRUSTED_PROXIES": ["10.0.0.0/8"]}), {"enabled": True, "middleware": True})

    def test_explicit_disable_wins(self):
        overrides = {"TRUSTED_PROXIES": ["10.0.0.0/8"], "PROXY_AWARE_MIDDLEWARE_ENABLED": False}
        self.assertEqual(load_settings_with(overrides), {"enabled": False, "middleware": False})
