import os
import shutil
import tempfile

os.environ.setdefault("TESTING", "True")

from .settings import *  # noqa: E402,F401,F403
from .settings import BASE_DIR, DATABASES  # noqa: E402

CELERY_TASK_ALWAYS_EAGER = True

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "mediacms-tests"}}

MEDIA_ROOT = tempfile.mkdtemp(prefix="mediacms-tests-") + "/"
HLS_DIR = os.path.join(MEDIA_ROOT, "hls/")
os.makedirs(HLS_DIR, exist_ok=True)
shutil.copytree(os.path.join(BASE_DIR, "media_files", "userlogos"), os.path.join(MEDIA_ROOT, "userlogos"))

DATABASES["default"].pop("OPTIONS", None)
DATABASES["default"]["TEST"] = {"NAME": "test_mediacms" + os.environ.get("TEST_DB_SUFFIX", "")}

FFMPEG_DEFAULT_PRESET = "ultrafast"
