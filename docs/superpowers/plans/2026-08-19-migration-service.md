# Migration Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only migration service in MediaCMS that imports media, users, categories, permissions and captions from a Kaltura installation, with pause/resume/abort, full logging and a source-ID to MediaCMS-ID mapping table.

**Architecture:** A new Django app `migrationservice` holds two models, a provider registry, and Celery tasks. A self-requeuing orchestrator task walks phases (users, categories, media) ten items at a time, dispatching one subtask per item via a Celery chord whose callback advances a resume cursor. Kaltura flavors are imported directly as MediaCMS `Encoding` rows so no re-transcoding happens. Three React pages under `/migrations` drive it through a DRF API.

**Tech Stack:** Django 5.2, Django REST Framework, Celery, PostgreSQL, `requests`, `cryptography` (Fernet), `pysubs2`, React (existing MediaCMS frontend build).

**Spec:** `docs/superpowers/specs/2026-08-19-migration-service-design.md`

## Global Constraints

- Page size for every migration phase is **10** items. Setting name: `MIGRATION_PAGE_SIZE`, default `10`.
- **Never disconnect a Django signal.** The `Encoding` post_save receiver is avoided by saving encodings with `status="pending"` and flipping to `success` with a queryset `.update()`.
- `create_hls` must fire **exactly once per media**, never once per flavor.
- Never set `is_superuser` or `is_staff` from an import.
- Django migrations are generated with `python manage.py makemigrations migrationservice`. Never hand-write or fake them.
- Do **not** run `make build-frontend`. The maintainer runs it.
- All new API endpoints require `request.user.is_superuser`.
- Existing-code changes are limited to these six files: `files/models/media.py`, `users/models.py`, `cms/settings.py`, `cms/dev_settings.py`, `cms/urls.py`, and the frontend wiring files named in Task 15. (`cms/dev_settings.py` maintains its own complete `INSTALLED_APPS` list that *replaces* the one in `cms/settings.py` when `DEVELOPMENT_MODE=true`, which is how the docker dev environment runs — the app must be registered in both or Django cannot see it.)
- Python style follows the repo: `setup.cfg` / `pyproject.toml` govern line length and formatting. Run `flake8` on changed files before each commit.
- Tests run with `pytest`. In this environment `TESTING=True` sets `CELERY_TASK_ALWAYS_EAGER = True`, so Celery tasks execute synchronously inside tests.

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `migrationservice/__init__.py` | empty |
| `migrationservice/apps.py` | `MigrationServiceConfig` |
| `migrationservice/models.py` | `MigrationService`, `MigrationRecord`, Fernet encrypt/decrypt helpers |
| `migrationservice/admin.py` | read-oriented Django admin for both models |
| `migrationservice/providers/__init__.py` | `get_provider_class(name)`, `get_provider(service)` |
| `migrationservice/providers/base.py` | `BaseProvider` interface and shared class attributes |
| `migrationservice/providers/kaltura.py` | `KalturaClient`, `KalturaProvider`, pure mapping functions |
| `migrationservice/providers/panopto.py` | stub provider |
| `migrationservice/providers/youtube.py` | stub provider |
| `migrationservice/tasks.py` | orchestrator, item tasks, importer functions |
| `migrationservice/serializers.py` | DRF serializers with secret masking |
| `migrationservice/views.py` | DRF viewset + three Django page views |
| `migrationservice/urls.py` | API and page routes |
| `migrationservice/tests/*` | test modules and JSON fixtures |
| `templates/cms/migrations.html` | list page shell |
| `templates/cms/migration_edit.html` | settings page shell |
| `templates/cms/migration_detail.html` | dashboard page shell |
| `frontend/src/static/js/pages/MigrationsPage.js` | list page |
| `frontend/src/static/js/pages/MigrationEditPage.js` | settings page |
| `frontend/src/static/js/pages/MigrationDetailPage.js` | dashboard page |
| `docs/migration_service.md` | admin documentation |

**Modified:** `files/models/media.py`, `users/models.py`, `cms/settings.py`, `cms/urls.py`, `templates/config/core/url.html`, `templates/config/core/api.html`, `frontend/config/mediacms.config.pages.js`, `frontend/src/templates/config/core/url.config.js`, `frontend/src/templates/config/core/api.config.js`, `frontend/src/static/js/utils/settings/api.js`, `frontend/src/static/js/utils/settings/config.js`, `frontend/src/static/js/utils/contexts/HeaderContext.js`, `frontend/src/static/js/pages/index.ts`.

---

## Task 1: App scaffolding, models and admin

**Files:**
- Create: `migrationservice/__init__.py`, `migrationservice/apps.py`, `migrationservice/models.py`, `migrationservice/admin.py`, `migrationservice/tests/__init__.py`, `migrationservice/tests/test_models.py`
- Modify: `cms/settings.py`
- Test: `migrationservice/tests/test_models.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MigrationService` model with fields `name, provider, source_system, connection, options, status, cursor, totals, log, created_at, started_at, ended_at, last_activity, created_by, task_id`
  - `MigrationService.get_connection() -> dict` (decrypted)
  - `MigrationService.append_log(line: str) -> None`
  - `MigrationRecord` model, `MigrationRecord.already_migrated(source_system: str, object_type: str, source_id: str) -> MigrationRecord | None`
  - `encrypt_value(value: str) -> str`, `decrypt_value(value: str) -> str`
  - Constants `PROVIDERS`, `MIGRATION_STATUS`, `OBJECT_TYPES`, `RECORD_STATUS`

- [ ] **Step 1: Create the app package and config**

`migrationservice/__init__.py` — empty file.

`migrationservice/apps.py`:

```python
from django.apps import AppConfig


class MigrationServiceConfig(AppConfig):
    default_auto_field = "django.db.models.AutoField"
    name = "migrationservice"
    verbose_name = "Migration Service"
```

`migrationservice/tests/__init__.py` — empty file.

- [ ] **Step 2: Register the app and add settings**

In `cms/settings.py`, add to `INSTALLED_APPS` immediately after `"lti.apps.LtiConfig",`:

```python
    "migrationservice.apps.MigrationServiceConfig",
```

Then append this block near the other feature settings (after the `USE_RBAC` / `USE_IDENTITY_PROVIDERS` lines):

```python
# Migration Service
# number of items handled per orchestrator page. Media files can be large,
# so this is deliberately small
MIGRATION_PAGE_SIZE = 10
# metadata API calls are small and must fail fast
MIGRATION_API_TIMEOUT = 60
# media downloads stream large files and need a far longer ceiling
MIGRATION_DOWNLOAD_TIMEOUT = 60 * 30
MIGRATION_MAX_RETRIES = 3

# Kaltura application-wide role name -> MediaCMS role understood by
# User.set_role_from_mapping. An empty value means "plain user".
# is_superuser/is_staff are never granted by an import.
KALTURA_ROLE_MAP = {
    "viewerRole": "",
    "privateOnlyRole": "",
    "adminRole": "advancedUser",
    "unmoderatedAdminRole": "advancedUser",
    "partnerAdminRole": "manager",
}
```

- [ ] **Step 3: Write the failing tests**

`migrationservice/tests/test_models.py`:

```python
from django.test import TestCase

from migrationservice.models import MigrationRecord, MigrationService, decrypt_value, encrypt_value


class TestEncryption(TestCase):
    def test_round_trip(self):
        encrypted = encrypt_value("super-secret")
        self.assertNotEqual(encrypted, "super-secret")
        self.assertTrue(encrypted.startswith("enc::"))
        self.assertEqual(decrypt_value(encrypted), "super-secret")

    def test_encrypting_twice_is_a_no_op(self):
        once = encrypt_value("super-secret")
        twice = encrypt_value(once)
        self.assertEqual(once, twice)

    def test_decrypting_plaintext_returns_it_unchanged(self):
        self.assertEqual(decrypt_value("not-encrypted"), "not-encrypted")

    def test_empty_value_is_left_alone(self):
        self.assertEqual(encrypt_value(""), "")
        self.assertEqual(decrypt_value(""), "")


class TestMigrationService(TestCase):
    def _service(self, **kwargs):
        defaults = {
            "name": "Kaltura production",
            "provider": "kaltura",
            "connection": {
                "service_url": "https://Kaltura.Example.edu/",
                "partner_id": "342",
                "admin_secret": "the-secret",
            },
        }
        defaults.update(kwargs)
        return MigrationService.objects.create(**defaults)

    def test_defaults(self):
        service = self._service()
        self.assertEqual(service.status, "pending")
        self.assertEqual(service.cursor, {})
        self.assertEqual(service.totals, {})

    def test_secret_is_encrypted_at_rest(self):
        service = self._service()
        service.refresh_from_db()
        self.assertNotEqual(service.connection["admin_secret"], "the-secret")
        self.assertEqual(service.connection["service_url"], "https://Kaltura.Example.edu/")

    def test_get_connection_decrypts(self):
        service = self._service()
        service.refresh_from_db()
        self.assertEqual(service.get_connection()["admin_secret"], "the-secret")

    def test_source_system_is_derived_and_normalised(self):
        service = self._service()
        self.assertEqual(service.source_system, "kaltura:342@kaltura.example.edu")

    def test_two_services_on_the_same_kaltura_share_a_source_system(self):
        first = self._service()
        second = self._service(name="Kaltura second pass")
        self.assertEqual(first.source_system, second.source_system)

    def test_append_log_keeps_lines(self):
        service = self._service()
        service.append_log("started")
        service.append_log("finished")
        service.refresh_from_db()
        self.assertIn("started", service.log)
        self.assertIn("finished", service.log)


class TestMigrationRecord(TestCase):
    def setUp(self):
        self.service = MigrationService.objects.create(
            name="Kaltura production",
            provider="kaltura",
            connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "admin_secret": "x"},
        )

    def test_already_migrated_ignores_records_whose_target_is_gone(self):
        MigrationRecord.objects.create(
            service=self.service, object_type="media", source_id="1_abc", status="success", target_id=5, media=None
        )
        found = MigrationRecord.already_migrated(self.service.source_system, "media", "1_abc")
        self.assertIsNone(found)

    def test_already_migrated_ignores_failed_records(self):
        MigrationRecord.objects.create(
            service=self.service, object_type="media", source_id="1_abc", status="failed", log="boom"
        )
        found = MigrationRecord.already_migrated(self.service.source_system, "media", "1_abc")
        self.assertIsNone(found)

    def test_source_id_is_unique_per_service_and_type(self):
        MigrationRecord.objects.create(service=self.service, object_type="media", source_id="1_abc", status="success")
        with self.assertRaises(Exception):
            MigrationRecord.objects.create(service=self.service, object_type="media", source_id="1_abc", status="success")
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'migrationservice.models'`

- [ ] **Step 5: Write the models**

`migrationservice/models.py`:

```python
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models
from django.utils import timezone

PROVIDERS = (
    ("kaltura", "Kaltura"),
    ("panopto", "Panopto"),
    ("youtube", "YouTube"),
)

MIGRATION_STATUS = (
    ("pending", "Pending"),
    ("running", "Running"),
    ("paused", "Paused"),
    ("error", "Error"),
    ("success", "Success"),
    ("aborted", "Aborted"),
)

OBJECT_TYPES = (
    ("media", "Media"),
    ("user", "User"),
    ("category", "Category"),
    ("caption", "Caption"),
)

RECORD_STATUS = (
    ("success", "Success"),
    ("failed", "Failed"),
    ("skipped", "Skipped"),
)

ENCRYPTED_PREFIX = "enc::"

LOG_MAX_CHARS = 200000


def _fernet():
    """Fernet instance keyed off SECRET_KEY.

    SECRET_KEY is not a valid Fernet key on its own, so it is hashed to
    exactly 32 bytes and base64 encoded.
    """
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_value(value):
    """Encrypt a string. Already encrypted values and empty values pass through."""
    if not value or not isinstance(value, str) or value.startswith(ENCRYPTED_PREFIX):
        return value
    return ENCRYPTED_PREFIX + _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_value(value):
    """Decrypt a string produced by encrypt_value. Anything else passes through."""
    if not value or not isinstance(value, str) or not value.startswith(ENCRYPTED_PREFIX):
        return value
    try:
        return _fernet().decrypt(value[len(ENCRYPTED_PREFIX):].encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""


class MigrationService(models.Model):
    """One configured migration from a source platform into MediaCMS"""

    name = models.CharField(max_length=100)

    provider = models.CharField(max_length=20, choices=PROVIDERS, default="kaltura", db_index=True)

    source_system = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
        help_text="Normalised identity of the source installation, derived from the connection",
    )

    connection = models.JSONField(default=dict, blank=True, help_text="Provider credentials, secrets encrypted")

    options = models.JSONField(default=dict, blank=True, help_text="Import options")

    status = models.CharField(max_length=20, choices=MIGRATION_STATUS, default="pending", db_index=True)

    cursor = models.JSONField(default=dict, blank=True, help_text="Resume position")

    totals = models.JSONField(default=dict, blank=True, help_text="Discovered and migrated counts per object type")

    log = models.TextField(blank=True, help_text="Phase level events")

    created_at = models.DateTimeField(auto_now_add=True)

    started_at = models.DateTimeField(blank=True, null=True)

    ended_at = models.DateTimeField(blank=True, null=True)

    last_activity = models.DateTimeField(blank=True, null=True)

    created_by = models.ForeignKey("users.User", on_delete=models.SET_NULL, blank=True, null=True)

    task_id = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Migration"
        verbose_name_plural = "Migrations"

    def __str__(self):
        return f"{self.name} ({self.provider})"

    @property
    def provider_class(self):
        from .providers import get_provider_class

        return get_provider_class(self.provider)

    def save(self, *args, **kwargs):
        klass = self.provider_class
        connection = dict(self.connection or {})
        for key in klass.secret_keys:
            if connection.get(key):
                connection[key] = encrypt_value(connection[key])
        self.connection = connection
        self.source_system = klass.source_system(connection)
        super().save(*args, **kwargs)

    def get_connection(self):
        """Connection dict with secrets decrypted, for provider use"""
        klass = self.provider_class
        connection = dict(self.connection or {})
        for key in klass.secret_keys:
            if connection.get(key):
                connection[key] = decrypt_value(connection[key])
        return connection

    def get_options(self):
        """Options merged over the provider defaults"""
        options = dict(self.provider_class.default_options)
        options.update(self.options or {})
        return options

    def append_log(self, line):
        """Append one timestamped line to the phase level log"""
        stamp = timezone.now().strftime("%Y-%m-%d %H:%M:%S")
        log = f"{self.log or ''}{stamp} {line}\n"
        if len(log) > LOG_MAX_CHARS:
            log = log[-LOG_MAX_CHARS:]
        self.log = log
        MigrationService.objects.filter(pk=self.pk).update(log=log, last_activity=timezone.now())

    def bump_total(self, key, amount=1):
        """Increment a counter in totals and persist it"""
        totals = dict(self.totals or {})
        totals[key] = totals.get(key, 0) + amount
        self.totals = totals
        MigrationService.objects.filter(pk=self.pk).update(totals=totals, last_activity=timezone.now())


class MigrationRecord(models.Model):
    """Maps one source object to the MediaCMS object it produced"""

    service = models.ForeignKey(MigrationService, on_delete=models.CASCADE, related_name="records")

    object_type = models.CharField(max_length=20, choices=OBJECT_TYPES, db_index=True)

    source_id = models.CharField(max_length=255, db_index=True)

    target_id = models.IntegerField(blank=True, null=True, help_text="Retained even if the object is later deleted")

    media = models.ForeignKey("files.Media", on_delete=models.SET_NULL, blank=True, null=True)

    user = models.ForeignKey("users.User", on_delete=models.SET_NULL, blank=True, null=True)

    category = models.ForeignKey("files.Category", on_delete=models.SET_NULL, blank=True, null=True)

    status = models.CharField(max_length=20, choices=RECORD_STATUS, default="success", db_index=True)

    log = models.CharField(max_length=500, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [["service", "object_type", "source_id"]]
        indexes = [
            models.Index(fields=["object_type", "source_id"]),
            models.Index(fields=["service", "status"]),
        ]

    def __str__(self):
        return f"{self.object_type} {self.source_id} -> {self.target_id}"

    def target_exists(self):
        """Whether the MediaCMS object this record points at is still there"""
        if self.target_id is None:
            return False
        if self.object_type == "media":
            return self.media_id is not None
        if self.object_type == "user":
            return self.user_id is not None
        if self.object_type == "category":
            return self.category_id is not None
        return True

    @classmethod
    def already_migrated(cls, source_system, object_type, source_id):
        """A successful record for this object from the same source system,
        whose target still exists. Used to avoid re-importing across migrations.
        """
        records = cls.objects.filter(
            service__source_system=source_system,
            object_type=object_type,
            source_id=source_id,
            status="success",
        ).select_related("service")
        for record in records:
            if record.target_exists():
                return record
        return None
```

- [ ] **Step 6: Write the admin**

`migrationservice/admin.py`:

```python
from django.contrib import admin

from .models import MigrationRecord, MigrationService


@admin.register(MigrationService)
class MigrationServiceAdmin(admin.ModelAdmin):
    list_display = ["name", "provider", "status", "created_at", "last_activity"]
    list_filter = ["provider", "status"]
    search_fields = ["name", "source_system"]
    readonly_fields = ["source_system", "cursor", "totals", "log", "created_at", "last_activity"]


@admin.register(MigrationRecord)
class MigrationRecordAdmin(admin.ModelAdmin):
    list_display = ["service", "object_type", "source_id", "target_id", "status", "created_at"]
    list_filter = ["object_type", "status", "service"]
    search_fields = ["source_id"]
    readonly_fields = ["service", "object_type", "source_id", "target_id", "media", "user", "category", "status", "log"]
```

- [ ] **Step 7: Generate the Django migration**

Run: `python manage.py makemigrations migrationservice`
Expected: `Migrations for 'migrationservice': migrationservice/migrations/0001_initial.py`

**Dependency:** `MigrationService.save()` calls `provider_class`, so the provider package has to exist before these tests can run. Create the four provider files now, exactly as written in **Task 2, Steps 3 to 6** (`providers/__init__.py`, `providers/base.py`, `providers/panopto.py`, `providers/youtube.py`, and the minimal `providers/kaltura.py`). None of them import anything from `models.py`, so there is no circularity. Task 2 then adds only its own tests on top of files that already exist.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_models.py -v`
Expected: PASS, 12 tests

- [ ] **Step 9: Commit**

```bash
git add migrationservice cms/settings.py
git commit -m "feat(migrationservice): add app scaffolding, models and admin"
```

---

## Task 2: Provider registry, interface and stubs

**Files:**
- Create: `migrationservice/providers/__init__.py`, `migrationservice/providers/base.py`, `migrationservice/providers/panopto.py`, `migrationservice/providers/youtube.py`, `migrationservice/tests/test_providers.py`
- Test: `migrationservice/tests/test_providers.py`

**Interfaces:**
- Consumes: `MigrationService` from Task 1.
- Produces:
  - `get_provider_class(name: str) -> type[BaseProvider]`
  - `get_provider(service: MigrationService) -> BaseProvider`
  - `BaseProvider` with class attributes `name: str`, `label: str`, `implemented: bool`, `secret_keys: tuple`, `required_connection_keys: tuple`, `default_options: dict`; classmethod `source_system(connection: dict) -> str`; instance methods `check_connection() -> dict`, `list_page(phase: str, cursor: dict, page_size: int) -> tuple[list, dict]`, `fetch_media(source_id: str) -> dict`, `download(url: str, dest_path: str) -> int`

- [ ] **Step 1: Write the failing test**

If Task 1 was completed first, the four provider files from Steps 3 to 6 already exist and those steps are a no-op — verify their contents match and move on.

`migrationservice/tests/test_providers.py`:

```python
from django.test import TestCase

from migrationservice.providers import get_provider_class
from migrationservice.providers.base import BaseProvider


class TestProviderRegistry(TestCase):
    def test_known_providers_resolve(self):
        for name in ["kaltura", "panopto", "youtube"]:
            self.assertTrue(issubclass(get_provider_class(name), BaseProvider))

    def test_unknown_provider_raises(self):
        with self.assertRaises(ValueError):
            get_provider_class("vimeo")

    def test_stub_providers_are_marked_unimplemented(self):
        for name in ["panopto", "youtube"]:
            self.assertFalse(get_provider_class(name).implemented)

    def test_stub_check_connection_raises_not_implemented(self):
        provider = get_provider_class("panopto")({}, {})
        with self.assertRaises(NotImplementedError):
            provider.check_connection()

    def test_stub_source_system_is_namespaced(self):
        self.assertEqual(get_provider_class("panopto").source_system({}), "panopto:")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pytest migrationservice/tests/test_providers.py -v`
Expected: FAIL — `ImportError: cannot import name 'get_provider_class'` or `No module named 'migrationservice.providers.base'`

- [ ] **Step 3: Write the registry**

`migrationservice/providers/__init__.py`:

```python
def get_provider_class(name):
    """Provider class for a provider name"""
    from .kaltura import KalturaProvider
    from .panopto import PanoptoProvider
    from .youtube import YouTubeProvider

    providers = {
        KalturaProvider.name: KalturaProvider,
        PanoptoProvider.name: PanoptoProvider,
        YouTubeProvider.name: YouTubeProvider,
    }
    if name not in providers:
        raise ValueError(f"Unknown migration provider: {name}")
    return providers[name]


def get_provider(service):
    """Instantiated provider for a MigrationService, with decrypted credentials"""
    klass = get_provider_class(service.provider)
    return klass(service.get_connection(), service.get_options())
```

- [ ] **Step 4: Write the interface**

`migrationservice/providers/base.py`:

```python
class BaseProvider:
    """Interface every migration source implements.

    Cursors are opaque JSON serialisable dicts owned by the provider. The
    orchestrator stores whatever a provider hands back and passes it in again
    on the next page, without interpreting it.
    """

    name = ""
    label = ""
    implemented = False

    # connection keys whose values are encrypted at rest
    secret_keys = ()
    # connection keys that must be present and non empty
    required_connection_keys = ()
    # option defaults, also the allowed option key set
    default_options = {}

    def __init__(self, connection, options):
        self.connection = connection or {}
        self.options = options or {}

    @classmethod
    def source_system(cls, connection):
        """Normalised identity of the source installation.

        Two migrations pointing at the same installation must return the same
        string; two pointing at different installations must not.
        """
        return f"{cls.name}:"

    def check_connection(self):
        """{"ok": bool, "error": str, "stats": {...}}"""
        raise NotImplementedError

    def list_page(self, phase, cursor, page_size):
        """One page of source ids for a phase.

        Returns (source_ids, next_cursor). An empty list means the phase is done.
        """
        raise NotImplementedError

    def fetch_media(self, source_id):
        """Everything needed to import one media entry"""
        raise NotImplementedError

    def fetch_user(self, source_id):
        """One source user record"""
        raise NotImplementedError

    def fetch_category(self, source_id):
        """One source category record"""
        raise NotImplementedError

    def download(self, url, dest_path):
        """Stream a URL to dest_path, return bytes written"""
        raise NotImplementedError
```

- [ ] **Step 5: Write the stubs**

`migrationservice/providers/panopto.py`:

```python
from .base import BaseProvider

PLACEHOLDER = "Panopto migration is not implemented yet."


class PanoptoProvider(BaseProvider):
    name = "panopto"
    label = "Panopto"
    implemented = False

    secret_keys = ("client_secret",)
    required_connection_keys = ("service_url", "client_id", "client_secret")
    default_options = {}

    def check_connection(self):
        raise NotImplementedError(PLACEHOLDER)

    def list_page(self, phase, cursor, page_size):
        raise NotImplementedError(PLACEHOLDER)

    def fetch_media(self, source_id):
        raise NotImplementedError(PLACEHOLDER)
```

`migrationservice/providers/youtube.py`:

```python
from .base import BaseProvider

PLACEHOLDER = "YouTube migration is not implemented yet."


class YouTubeProvider(BaseProvider):
    name = "youtube"
    label = "YouTube"
    implemented = False

    secret_keys = ("api_key",)
    required_connection_keys = ("channel_id", "api_key")
    default_options = {}

    def check_connection(self):
        raise NotImplementedError(PLACEHOLDER)

    def list_page(self, phase, cursor, page_size):
        raise NotImplementedError(PLACEHOLDER)

    def fetch_media(self, source_id):
        raise NotImplementedError(PLACEHOLDER)
```

- [ ] **Step 6: Add a temporary Kaltura class so the registry imports**

Create `migrationservice/providers/kaltura.py` with just enough to import. Task 3 replaces the body.

```python
from urllib.parse import urlparse

from .base import BaseProvider


class KalturaProvider(BaseProvider):
    name = "kaltura"
    label = "Kaltura"
    implemented = True

    secret_keys = ("admin_secret",)
    required_connection_keys = ("service_url", "partner_id", "admin_secret")
    default_options = {
        "create_users": True,
        "fallback_username": "admin",
        "create_categories": True,
        "map_permissions": True,
        "import_captions": True,
        "preserve_views": True,
        "preserve_publish_state": True,
        "skip_transcoding": True,
        "created_after": None,
        "created_before": None,
        "root_category": None,
        "max_items": None,
    }

    @classmethod
    def source_system(cls, connection):
        host = urlparse(connection.get("service_url") or "").netloc.lower()
        return f"kaltura:{connection.get('partner_id') or ''}@{host}"
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/ -v`
Expected: PASS — Task 1's 12 tests plus 5 provider tests

- [ ] **Step 8: Commit**

```bash
git add migrationservice/providers migrationservice/tests/test_providers.py
git commit -m "feat(migrationservice): add provider registry, interface and stubs"
```

---

## Task 3: Kaltura client — sessions, calls and retries

**Files:**
- Modify: `migrationservice/providers/kaltura.py`
- Create: `migrationservice/tests/test_kaltura_client.py`
- Test: `migrationservice/tests/test_kaltura_client.py`

**Interfaces:**
- Consumes: `BaseProvider` from Task 2.
- Produces:
  - `KalturaAPIError(code: str, message: str)` exception with `.code` and `.message`
  - `KalturaClient(service_url, partner_id, admin_secret, user_id="", timeout=None)`
  - `KalturaClient.call(service: str, action: str, use_session: bool = True, **params) -> dict | list | str`
  - `KalturaClient.get_ks() -> str`
  - `KalturaClient._post(url: str, data: dict) -> dict | list | str` — the single seam tests patch

**Background for the implementer:** the Kaltura API is at `{service_url}/api_v3/service/{service}/action/{action}`. Parameters are form encoded and nested objects use colons, so `filter={"orderBy": "+createdAt"}` is sent as `filter:orderBy=+createdAt`. Adding `format=1` makes responses JSON. Errors come back with HTTP 200 and a body containing `"objectType": "KalturaAPIException"` — they are not HTTP errors. A Kaltura Session (KS) is a string obtained from `session.start` and passed as `ks` on every other call; it expires, so the client re-issues it.

- [ ] **Step 1: Write the failing tests**

`migrationservice/tests/test_kaltura_client.py`:

```python
from unittest import mock

from django.test import TestCase

from migrationservice.providers.kaltura import KalturaAPIError, KalturaClient


def make_client():
    return KalturaClient(
        service_url="https://kaltura.example.edu/",
        partner_id="342",
        admin_secret="the-secret",
    )


class TestKalturaClient(TestCase):
    def test_flatten_nests_with_colons(self):
        client = make_client()
        flat = client._flatten({"filter": {"orderBy": "+createdAt"}, "pager": {"pageSize": 10}})
        self.assertEqual(flat, {"filter:orderBy": "+createdAt", "pager:pageSize": 10})

    def test_flatten_drops_none_values(self):
        client = make_client()
        flat = client._flatten({"filter": {"orderBy": "+createdAt", "idEqual": None}})
        self.assertEqual(flat, {"filter:orderBy": "+createdAt"})

    def test_url_is_built_from_service_and_action(self):
        client = make_client()
        self.assertEqual(
            client._url("media", "list"),
            "https://kaltura.example.edu/api_v3/service/media/action/list",
        )

    def test_session_is_started_once_and_reused(self):
        client = make_client()
        with mock.patch.object(client, "_post", return_value="the-ks") as post:
            self.assertEqual(client.get_ks(), "the-ks")
            self.assertEqual(client.get_ks(), "the-ks")
        self.assertEqual(post.call_count, 1)

    def test_call_sends_format_and_ks(self):
        client = make_client()
        client.ks = "the-ks"
        client.ks_issued_at = 9999999999
        with mock.patch.object(client, "_post", return_value={"totalCount": 3}) as post:
            client.call("media", "list", pager={"pageSize": 1})
        url, data = post.call_args[0]
        self.assertEqual(url, "https://kaltura.example.edu/api_v3/service/media/action/list")
        self.assertEqual(data["format"], 1)
        self.assertEqual(data["ks"], "the-ks")
        self.assertEqual(data["pager:pageSize"], 1)

    def test_api_exception_is_raised(self):
        client = make_client()
        client.ks = "the-ks"
        client.ks_issued_at = 9999999999
        error = {"objectType": "KalturaAPIException", "code": "ENTRY_ID_NOT_FOUND", "message": "Entry not found"}
        with mock.patch.object(client, "_post", return_value=error):
            with self.assertRaises(KalturaAPIError) as raised:
                client.call("media", "get", entryId="1_nope")
        self.assertEqual(raised.exception.code, "ENTRY_ID_NOT_FOUND")

    def test_invalid_ks_triggers_one_reissue_then_succeeds(self):
        client = make_client()
        client.ks = "stale-ks"
        client.ks_issued_at = 9999999999
        responses = [
            {"objectType": "KalturaAPIException", "code": "INVALID_KS", "message": "Invalid KS"},
            "fresh-ks",
            {"totalCount": 7},
        ]
        with mock.patch.object(client, "_post", side_effect=responses):
            result = client.call("media", "list", pager={"pageSize": 1})
        self.assertEqual(result, {"totalCount": 7})
        self.assertEqual(client.ks, "fresh-ks")

    def test_invalid_ks_twice_raises(self):
        client = make_client()
        client.ks = "stale-ks"
        client.ks_issued_at = 9999999999
        error = {"objectType": "KalturaAPIException", "code": "INVALID_KS", "message": "Invalid KS"}
        with mock.patch.object(client, "_post", side_effect=[error, "fresh-ks", error]):
            with self.assertRaises(KalturaAPIError):
                client.call("media", "list", pager={"pageSize": 1})

    def test_network_errors_are_retried_then_raised(self):
        import requests

        client = make_client()
        client.ks = "the-ks"
        client.ks_issued_at = 9999999999
        with mock.patch("migrationservice.providers.kaltura.time.sleep"):
            with mock.patch.object(client, "_post", side_effect=requests.ConnectionError("boom")) as post:
                with self.assertRaises(requests.ConnectionError):
                    client.call("media", "list")
        self.assertEqual(post.call_count, 3)

    def test_network_error_then_success_returns_the_result(self):
        import requests

        client = make_client()
        client.ks = "the-ks"
        client.ks_issued_at = 9999999999
        with mock.patch("migrationservice.providers.kaltura.time.sleep"):
            with mock.patch.object(client, "_post", side_effect=[requests.Timeout("slow"), {"totalCount": 1}]):
                result = client.call("media", "list")
        self.assertEqual(result, {"totalCount": 1})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_kaltura_client.py -v`
Expected: FAIL — `ImportError: cannot import name 'KalturaAPIError'`

- [ ] **Step 3: Implement the client**

Replace the contents of `migrationservice/providers/kaltura.py` with the following, keeping the `KalturaProvider` class from Task 2 Step 6 at the bottom of the file unchanged:

```python
import logging
import time
from urllib.parse import urlparse

import requests
from django.conf import settings

from .base import BaseProvider

logger = logging.getLogger(__name__)

# Kaltura session types
SESSION_TYPE_USER = 0
SESSION_TYPE_ADMIN = 2

# Kaltura entry status
ENTRY_STATUS_READY = 2

# Kaltura flavor asset status. Same value as ENTRY_STATUS_READY but a different enum.
FLAVOR_STATUS_READY = 2

# Kaltura refuses pageIndex * pageSize beyond this
KALTURA_MAX_PAGE_SIZE = 10000

RETRYABLE_KS_ERRORS = ("INVALID_KS", "EXPIRED_KS", "START_SESSION_ERROR")


class KalturaAPIError(Exception):
    """A Kaltura API level error. Not retried, it is a real answer."""

    def __init__(self, code, message):
        self.code = code
        self.message = message
        super().__init__(f"{code}: {message}")


class KalturaClient:
    """Thin client over the Kaltura api_v3 REST interface"""

    # re-issue the KS well before Kaltura's 24 hour default expires
    SESSION_TTL = 60 * 60 * 20
    SESSION_EXPIRY = 60 * 60 * 24

    def __init__(self, service_url, partner_id, admin_secret, user_id="", timeout=None):
        self.service_url = (service_url or "").rstrip("/")
        self.partner_id = str(partner_id or "")
        self.admin_secret = admin_secret or ""
        self.user_id = user_id or ""
        self.timeout = timeout or getattr(settings, "MIGRATION_API_TIMEOUT", 60)
        self.ks = None
        self.ks_issued_at = 0
        self.session = requests.Session()

    def _url(self, service, action):
        return f"{self.service_url}/api_v3/service/{service}/action/{action}"

    def _flatten(self, params, prefix=""):
        """Kaltura expects nested objects as filter:orderBy=... form fields"""
        flat = {}
        for key, value in params.items():
            name = f"{prefix}{key}"
            if isinstance(value, dict):
                flat.update(self._flatten(value, prefix=f"{name}:"))
            elif value is not None:
                flat[name] = value
        return flat

    def _post(self, url, data):
        """The single HTTP seam. Tests patch this."""
        response = self.session.post(url, data=data, timeout=self.timeout)
        response.raise_for_status()
        return response.json()

    def _post_with_retries(self, url, data):
        attempts = getattr(settings, "MIGRATION_MAX_RETRIES", 3)
        delay = 2
        for attempt in range(1, attempts + 1):
            try:
                return self._post(url, data)
            except requests.RequestException:
                if attempt >= attempts:
                    raise
                time.sleep(delay)
                delay *= 2

    @staticmethod
    def _is_error(result):
        return isinstance(result, dict) and result.get("objectType") == "KalturaAPIException"

    def get_ks(self):
        """Current Kaltura Session, started or re-issued as needed"""
        if self.ks and (time.time() - self.ks_issued_at) < self.SESSION_TTL:
            return self.ks
        result = self.call(
            "session",
            "start",
            use_session=False,
            secret=self.admin_secret,
            userId=self.user_id,
            type=SESSION_TYPE_ADMIN,
            partnerId=self.partner_id,
            expiry=self.SESSION_EXPIRY,
        )
        if not isinstance(result, str):
            raise KalturaAPIError("START_SESSION_ERROR", "session.start did not return a session string")
        self.ks = result
        self.ks_issued_at = time.time()
        return self.ks

    def call(self, service, action, use_session=True, **params):
        """Call one Kaltura service action and return the decoded result"""
        url = self._url(service, action)
        data = self._flatten(params)
        data["format"] = 1
        if use_session:
            data["ks"] = self.get_ks()

        result = self._post_with_retries(url, data)

        if self._is_error(result):
            code = result.get("code") or ""
            if use_session and code in RETRYABLE_KS_ERRORS:
                # the session went stale mid migration, get a new one and retry once
                self.ks = None
                self.ks_issued_at = 0
                data["ks"] = self.get_ks()
                result = self._post_with_retries(url, data)
                if self._is_error(result):
                    raise KalturaAPIError(result.get("code") or "", result.get("message") or "")
                return result
            raise KalturaAPIError(code, result.get("message") or "")

        return result
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_kaltura_client.py -v`
Expected: PASS, 10 tests

- [ ] **Step 5: Commit**

```bash
git add migrationservice/providers/kaltura.py migrationservice/tests/test_kaltura_client.py
git commit -m "feat(migrationservice): add Kaltura API client with session handling and retries"
```

---

## Task 4: Kaltura client — pagination and connection check

**Files:**
- Modify: `migrationservice/providers/kaltura.py`
- Modify: `migrationservice/tests/test_kaltura_client.py`
- Test: `migrationservice/tests/test_kaltura_client.py`

**Interfaces:**
- Consumes: `KalturaClient.call` from Task 3.
- Produces:
  - `KalturaClient.count(service: str, kfilter: dict | None = None) -> int`
  - `KalturaClient.list_page_by_index(service: str, cursor: dict, page_size: int, kfilter: dict | None = None) -> tuple[list[dict], dict]`
  - `KalturaClient.list_entries_page(cursor: dict, page_size: int, kfilter: dict | None = None) -> tuple[list[dict], dict]`
  - `KalturaClient.check_connection() -> dict` shaped `{"ok": bool, "error": str, "stats": {"entries": int, "users": int, "categories": int}}`

**Background:** Kaltura refuses `pageIndex * pageSize > 10000`, so entries cannot be paged by index. `list_entries_page` instead orders by `+createdAt` and filters `createdAtGreaterThanOrEqual`, carrying the ids already seen at the boundary timestamp so entries sharing a `createdAt` are neither skipped nor repeated. Users and categories are few enough that plain index paging is fine.

- [ ] **Step 1: Write the failing tests**

Append to `migrationservice/tests/test_kaltura_client.py`:

```python
class TestKalturaPagination(TestCase):
    def setUp(self):
        self.client = make_client()
        self.client.ks = "the-ks"
        self.client.ks_issued_at = 9999999999

    def test_count_reads_total_count(self):
        with mock.patch.object(self.client, "_post", return_value={"totalCount": 11960, "objects": []}):
            self.assertEqual(self.client.count("media"), 11960)

    def test_index_paging_advances_and_terminates(self):
        pages = [
            {"totalCount": 3, "objects": [{"id": "a"}, {"id": "b"}]},
            {"totalCount": 3, "objects": [{"id": "c"}]},
            {"totalCount": 3, "objects": []},
        ]
        with mock.patch.object(self.client, "_post", side_effect=pages):
            first, cursor = self.client.list_page_by_index("user", {}, 2)
            self.assertEqual([o["id"] for o in first], ["a", "b"])
            second, cursor = self.client.list_page_by_index("user", cursor, 2)
            self.assertEqual([o["id"] for o in second], ["c"])
            third, cursor = self.client.list_page_by_index("user", cursor, 2)
            self.assertEqual(third, [])

    def test_entries_page_sets_order_and_status_filter(self):
        with mock.patch.object(self.client, "_post", return_value={"objects": []}) as post:
            self.client.list_entries_page({}, 10)
        data = post.call_args[0][1]
        self.assertEqual(data["filter:orderBy"], "+createdAt")
        self.assertEqual(data["filter:statusEqual"], 2)
        self.assertNotIn("filter:createdAtGreaterThanOrEqual", data)

    def test_entries_cursor_carries_created_at_and_seen_ids(self):
        page = {
            "objects": [
                {"id": "1_a", "createdAt": 100},
                {"id": "1_b", "createdAt": 200},
                {"id": "1_c", "createdAt": 200},
            ]
        }
        with mock.patch.object(self.client, "_post", return_value=page):
            entries, cursor = self.client.list_entries_page({}, 10)
        self.assertEqual([e["id"] for e in entries], ["1_a", "1_b", "1_c"])
        self.assertEqual(cursor["created_at"], 200)
        self.assertEqual(sorted(cursor["seen_ids"]), ["1_b", "1_c"])

    def test_entries_page_skips_ids_already_seen_at_the_boundary(self):
        cursor = {"created_at": 200, "seen_ids": ["1_b", "1_c"]}
        page = {
            "objects": [
                {"id": "1_b", "createdAt": 200},
                {"id": "1_c", "createdAt": 200},
                {"id": "1_d", "createdAt": 200},
                {"id": "1_e", "createdAt": 300},
            ]
        }
        with mock.patch.object(self.client, "_post", side_effect=[page]) as post:
            entries, next_cursor = self.client.list_entries_page(cursor, 10)
        data = post.call_args[0][1]
        self.assertEqual(data["filter:createdAtGreaterThanOrEqual"], 200)
        self.assertEqual([e["id"] for e in entries], ["1_d", "1_e"])
        self.assertEqual(next_cursor["created_at"], 300)
        self.assertEqual(next_cursor["seen_ids"], ["1_e"])

    def test_entries_page_accumulates_seen_ids_when_created_at_does_not_move(self):
        cursor = {"created_at": 200, "seen_ids": ["1_b"]}
        page = {"objects": [{"id": "1_b", "createdAt": 200}, {"id": "1_c", "createdAt": 200}]}
        with mock.patch.object(self.client, "_post", return_value=page):
            entries, next_cursor = self.client.list_entries_page(cursor, 10)
        self.assertEqual([e["id"] for e in entries], ["1_c"])
        self.assertEqual(sorted(next_cursor["seen_ids"]), ["1_b", "1_c"])

    def test_entries_page_returns_empty_and_keeps_cursor_when_exhausted(self):
        cursor = {"created_at": 300, "seen_ids": ["1_e"]}
        with mock.patch.object(self.client, "_post", return_value={"objects": [{"id": "1_e", "createdAt": 300}]}):
            entries, next_cursor = self.client.list_entries_page(cursor, 10)
        self.assertEqual(entries, [])
        self.assertEqual(next_cursor, cursor)


class TestKalturaCheckConnection(TestCase):
    def test_reports_stats_on_success(self):
        client = make_client()
        responses = [
            "the-ks",
            {"totalCount": 11960, "objects": []},
            {"totalCount": 214, "objects": []},
            {"totalCount": 87, "objects": []},
        ]
        with mock.patch.object(client, "_post", side_effect=responses):
            result = client.check_connection()
        self.assertTrue(result["ok"])
        self.assertEqual(result["stats"], {"entries": 11960, "users": 214, "categories": 87})

    def test_reports_the_error_on_failure(self):
        client = make_client()
        error = {"objectType": "KalturaAPIException", "code": "INVALID_PARTNER_ID", "message": "Bad partner"}
        with mock.patch.object(client, "_post", return_value=error):
            result = client.check_connection()
        self.assertFalse(result["ok"])
        self.assertIn("INVALID_PARTNER_ID", result["error"])
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_kaltura_client.py -v -k "Pagination or CheckConnection"`
Expected: FAIL — `AttributeError: 'KalturaClient' object has no attribute 'count'`

- [ ] **Step 3: Implement pagination and the connection check**

Add these methods to `KalturaClient` in `migrationservice/providers/kaltura.py`:

```python
    def count(self, service, kfilter=None):
        """Total number of objects a list service reports"""
        result = self.call(service, "list", filter=kfilter or {}, pager={"pageSize": 1, "pageIndex": 1})
        return result.get("totalCount", 0) if isinstance(result, dict) else 0

    def list_page_by_index(self, service, cursor, page_size, kfilter=None):
        """Plain pageIndex paging, for object types small enough to stay under
        Kaltura's 10000 result ceiling. Returns (objects, next_cursor).
        """
        cursor = dict(cursor or {})
        page_index = cursor.get("page_index") or 1
        result = self.call(
            service,
            "list",
            filter=kfilter or {},
            pager={"pageSize": page_size, "pageIndex": page_index},
        )
        objects = result.get("objects") or [] if isinstance(result, dict) else []
        if not objects:
            return [], cursor
        return objects, {"page_index": page_index + 1}

    def list_entries_page(self, cursor, page_size, kfilter=None):
        """One page of media entries, paged by createdAt.

        Kaltura rejects pageIndex * pageSize beyond 10000, so entries are walked
        forward in creation order. The cursor holds the last createdAt reached
        plus the ids already handled at exactly that timestamp, which is what
        keeps entries sharing a createdAt from being skipped or repeated.
        """
        cursor = dict(cursor or {})
        created_at = cursor.get("created_at") or 0
        seen = list(cursor.get("seen_ids") or [])

        # The caller's filter goes in FIRST. The cursor derived keys are applied
        # after it and must win: a static user option such as created_after would
        # otherwise overwrite the resume boundary on every page, making the query
        # restart from the same timestamp forever.
        entry_filter = dict(kfilter or {})
        floor = entry_filter.get("createdAtGreaterThanOrEqual") or 0
        entry_filter["orderBy"] = "+createdAt"
        entry_filter["statusEqual"] = ENTRY_STATUS_READY
        if created_at or floor:
            # keep honouring the user's created_after floor on the first page,
            # then let the advancing cursor take over
            entry_filter["createdAtGreaterThanOrEqual"] = max(created_at or 0, floor)

        # A pathological source can have more entries sharing one createdAt than
        # Kaltura will return in a single page. seen grows each round in that case,
        # and pageSize grows with it, back towards the 10000 row ceiling this whole
        # scheme exists to avoid. Fail with something an operator can act on rather
        # than letting Kaltura refuse the request.
        requested_page_size = page_size + len(seen)
        if requested_page_size > KALTURA_MAX_PAGE_SIZE:
            raise KalturaAPIError(
                "PAGINATION_LIMIT",
                f"More than {KALTURA_MAX_PAGE_SIZE} entries share createdAt={created_at}; "
                "this exceeds what Kaltura will return in one page. Narrow the migration "
                "with the created_after or created_before options to get past this block.",
            )

        # ask for enough rows that the already handled ids at the boundary
        # cannot fill the whole page
        result = self.call(
            "media",
            "list",
            filter=entry_filter,
            pager={"pageSize": requested_page_size, "pageIndex": 1},
        )
        objects = result.get("objects") or [] if isinstance(result, dict) else []

        seen_set = set(seen)
        entries = [entry for entry in objects if entry.get("id") not in seen_set][:page_size]
        if not entries:
            return [], cursor

        last_created_at = entries[-1].get("createdAt") or created_at
        boundary_ids = [entry.get("id") for entry in entries if entry.get("createdAt") == last_created_at]
        if last_created_at == created_at:
            boundary_ids = seen + boundary_ids

        return entries, {"created_at": last_created_at, "seen_ids": boundary_ids}

    def check_connection(self):
        """Start a session and report the totals the dashboard needs"""
        try:
            self.get_ks()
            stats = {
                "entries": self.count("media"),
                "users": self.count("user"),
                "categories": self.count("category"),
            }
            return {"ok": True, "error": "", "stats": stats}
        except KalturaAPIError as exc:
            return {"ok": False, "error": str(exc), "stats": {}}
        except requests.RequestException as exc:
            return {"ok": False, "error": f"Could not reach {self.service_url}: {exc}", "stats": {}}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_kaltura_client.py -v`
Expected: PASS, 19 tests

- [ ] **Step 5: Commit**

```bash
git add migrationservice/providers/kaltura.py migrationservice/tests/test_kaltura_client.py
git commit -m "feat(migrationservice): add Kaltura cursor pagination and connection check"
```

---

## Task 5: Kaltura mapping functions

**Files:**
- Modify: `migrationservice/providers/kaltura.py`
- Create: `migrationservice/tests/test_kaltura_mappings.py`
- Test: `migrationservice/tests/test_kaltura_mappings.py`

**Interfaces:**
- Consumes: nothing beyond Django settings.
- Produces (all module level and pure):
  - `media_state(category_privacies: list[int], display_in_search: int | None = None) -> str`
  - `mediacms_role(kaltura_role_name: str, role_map: dict | None = None) -> str`
  - `category_title_and_description(full_name: str, kms_root: str = "") -> tuple[str, str]`
  - `unique_category_title(title: str, parent_name: str, taken: set[str]) -> str`
  - `match_flavors_to_profiles(flavors: list[dict], profiles: list) -> list[tuple[dict, object]]`
  - `sanitize_username(value: str) -> str`
  - `rbac_role_for_permission_level(level: int) -> str`
  - Constants `PRIVACY_ALL = 1`, `PRIVACY_AUTHENTICATED = 2`, `PRIVACY_MEMBERS_ONLY = 3`, `DISPLAY_IN_SEARCH_NONE = 1`

**Note on `media_state`:** `displayInSearch == NONE` only ever downgrades. It turns `public` into `unlisted`; it never promotes a `private` entry.

- [ ] **Step 1: Write the failing tests**

`migrationservice/tests/test_kaltura_mappings.py`:

```python
from django.test import TestCase, override_settings

from files.models import EncodeProfile
from migrationservice.providers.kaltura import (
    DISPLAY_IN_SEARCH_NONE,
    PRIVACY_ALL,
    PRIVACY_AUTHENTICATED,
    PRIVACY_MEMBERS_ONLY,
    category_title_and_description,
    match_flavors_to_profiles,
    media_state,
    mediacms_role,
    rbac_role_for_permission_level,
    sanitize_username,
    unique_category_title,
)


class TestMediaState(TestCase):
    def test_no_categories_is_private(self):
        self.assertEqual(media_state([]), "private")

    def test_any_public_category_is_public(self):
        self.assertEqual(media_state([PRIVACY_MEMBERS_ONLY, PRIVACY_ALL]), "public")

    def test_only_restricted_categories_is_unlisted(self):
        self.assertEqual(media_state([PRIVACY_AUTHENTICATED, PRIVACY_MEMBERS_ONLY]), "unlisted")

    def test_display_in_search_none_downgrades_public_to_unlisted(self):
        self.assertEqual(media_state([PRIVACY_ALL], DISPLAY_IN_SEARCH_NONE), "unlisted")

    def test_display_in_search_none_never_promotes_private(self):
        self.assertEqual(media_state([], DISPLAY_IN_SEARCH_NONE), "private")


class TestRoleMapping(TestCase):
    def test_default_map(self):
        self.assertEqual(mediacms_role("viewerRole"), "")
        self.assertEqual(mediacms_role("adminRole"), "advancedUser")
        self.assertEqual(mediacms_role("unmoderatedAdminRole"), "advancedUser")
        self.assertEqual(mediacms_role("partnerAdminRole"), "manager")

    def test_unknown_role_is_a_plain_user(self):
        self.assertEqual(mediacms_role("someCustomRole"), "")

    @override_settings(KALTURA_ROLE_MAP={"someCustomRole": "editor"})
    def test_settings_override_is_used(self):
        self.assertEqual(mediacms_role("someCustomRole"), "editor")

    def test_admin_is_never_produced(self):
        for role in ["viewerRole", "privateOnlyRole", "adminRole", "unmoderatedAdminRole", "partnerAdminRole"]:
            self.assertNotEqual(mediacms_role(role), "admin")


class TestCategoryTitles(TestCase):
    def test_kms_scaffolding_is_dropped_and_path_becomes_description(self):
        title, description = category_title_and_description(
            "MediaSpace>site>galleries>Engineering>1. Term>Electronics", kms_root="MediaSpace"
        )
        self.assertEqual(title, "Electronics")
        self.assertEqual(description, "Engineering: 1. Term: Electronics")

    def test_channels_scaffolding_is_dropped_too(self):
        title, description = category_title_and_description("MediaSpace>site>channels>Physics", kms_root="MediaSpace")
        self.assertEqual(title, "Physics")
        self.assertEqual(description, "Physics")

    def test_missing_root_still_works(self):
        title, description = category_title_and_description("Engineering>Electronics")
        self.assertEqual(title, "Electronics")
        self.assertEqual(description, "Engineering: Electronics")

    def test_empty_input(self):
        self.assertEqual(category_title_and_description(""), ("", ""))

    def test_title_is_truncated_to_the_model_limit(self):
        title, _ = category_title_and_description("A>" + "x" * 200)
        self.assertEqual(len(title), 100)


class TestUniqueCategoryTitle(TestCase):
    def test_free_title_is_returned_unchanged(self):
        self.assertEqual(unique_category_title("Electronics", "Engineering", set()), "Electronics")

    def test_collision_appends_the_parent(self):
        self.assertEqual(
            unique_category_title("Electronics", "Engineering", {"Electronics"}),
            "Electronics (Engineering)",
        )

    def test_second_collision_falls_back_to_a_counter(self):
        taken = {"Electronics", "Electronics (Engineering)"}
        self.assertEqual(unique_category_title("Electronics", "Engineering", taken), "Electronics (2)")

    def test_collision_without_a_parent_uses_a_counter(self):
        self.assertEqual(unique_category_title("Electronics", "", {"Electronics"}), "Electronics (2)")


class TestFlavorMatching(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        self.profiles = list(EncodeProfile.objects.filter(active=True))

    def test_each_flavor_lands_on_its_own_profile(self):
        flavors = [
            {"id": "f720", "height": 720, "fileExt": "mp4"},
            {"id": "f360", "height": 360, "fileExt": "mp4"},
        ]
        pairs = match_flavors_to_profiles(flavors, self.profiles)
        matched = {flavor["id"]: profile.resolution for flavor, profile in pairs}
        self.assertEqual(matched, {"f720": 720, "f360": 360})

    def test_a_flavor_with_no_exact_profile_gets_the_nearest_one(self):
        pairs = match_flavors_to_profiles([{"id": "f540", "height": 540, "fileExt": "mp4"}], self.profiles)
        self.assertEqual(pairs[0][1].resolution, 480)

    def test_two_flavors_never_share_a_profile(self):
        flavors = [
            {"id": "f716", "height": 716, "fileExt": "mp4"},
            {"id": "f720", "height": 720, "fileExt": "mp4"},
        ]
        pairs = match_flavors_to_profiles(flavors, self.profiles)
        resolutions = [profile.resolution for _flavor, profile in pairs]
        self.assertEqual(len(resolutions), len(set(resolutions)))
        exact = [flavor["id"] for flavor, profile in pairs if profile.resolution == 720]
        self.assertEqual(exact, ["f720"])

    def test_unsupported_extensions_are_dropped(self):
        pairs = match_flavors_to_profiles([{"id": "fmov", "height": 720, "fileExt": "mov"}], self.profiles)
        self.assertEqual(pairs, [])

    def test_gif_profiles_are_never_matched(self):
        flavors = [{"id": "f720", "height": 720, "fileExt": "mp4"}]
        pairs = match_flavors_to_profiles(flavors, self.profiles)
        self.assertTrue(all(profile.extension != "gif" for _flavor, profile in pairs))

    def test_no_flavors_gives_no_pairs(self):
        self.assertEqual(match_flavors_to_profiles([], self.profiles), [])


class TestSanitizeUsername(TestCase):
    def test_valid_characters_survive(self):
        self.assertEqual(sanitize_username("j.doe@example.edu"), "j.doe@example.edu")

    def test_invalid_characters_become_dashes(self):
        self.assertEqual(sanitize_username("cn=John Doe,ou=staff"), "cn-John-Doe-ou-staff")

    def test_empty_input_gets_a_placeholder(self):
        self.assertEqual(sanitize_username(""), "migrated-user")

    def test_length_is_capped(self):
        self.assertEqual(len(sanitize_username("x" * 300)), 150)


class TestRbacRoleMapping(TestCase):
    def test_permission_levels(self):
        self.assertEqual(rbac_role_for_permission_level(0), "manager")
        self.assertEqual(rbac_role_for_permission_level(1), "contributor")
        self.assertEqual(rbac_role_for_permission_level(2), "contributor")
        self.assertEqual(rbac_role_for_permission_level(3), "member")

    def test_unknown_level_is_a_member(self):
        self.assertEqual(rbac_role_for_permission_level(99), "member")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_kaltura_mappings.py -v`
Expected: FAIL — `ImportError: cannot import name 'media_state'`

- [ ] **Step 3: Implement the mapping functions**

Add to `migrationservice/providers/kaltura.py`, above the `KalturaProvider` class:

```python
import re

# KalturaPrivacyType
PRIVACY_ALL = 1
PRIVACY_AUTHENTICATED = 2
PRIVACY_MEMBERS_ONLY = 3

# KalturaEntryDisplayInSearchType
DISPLAY_IN_SEARCH_NONE = 1

# KalturaCategoryUserPermissionLevel
PERMISSION_LEVEL_MANAGER = 0
PERMISSION_LEVEL_MODERATOR = 1
PERMISSION_LEVEL_CONTRIBUTOR = 2
PERMISSION_LEVEL_MEMBER = 3

DEFAULT_ROLE_MAP = {
    "viewerRole": "",
    "privateOnlyRole": "",
    "adminRole": "advancedUser",
    "unmoderatedAdminRole": "advancedUser",
    "partnerAdminRole": "manager",
}

# KMS path segments that are structure rather than a real category
KMS_SCAFFOLDING = ("galleries", "channels")

CATEGORY_TITLE_MAX = 100
USERNAME_MAX = 150

USERNAME_INVALID = re.compile(r"[^\w.@-]", re.ASCII)


def media_state(category_privacies, display_in_search=None):
    """MediaCMS state for a Kaltura entry.

    Kaltura entries carry no public/private flag, so state comes from the
    categories the entry belongs to. displayInSearch=NONE only downgrades:
    it turns public into unlisted and never promotes a private entry.
    """
    privacies = [privacy for privacy in (category_privacies or []) if privacy is not None]
    if not privacies:
        state = "private"
    elif PRIVACY_ALL in privacies:
        state = "public"
    else:
        state = "unlisted"

    if display_in_search == DISPLAY_IN_SEARCH_NONE and state == "public":
        state = "unlisted"
    return state


# roles an import must never be able to grant, whatever a custom map says
FORBIDDEN_ROLES = ("admin", "superuser", "staff")


def mediacms_role(kaltura_role_name, role_map=None):
    """MediaCMS role string for User.set_role_from_mapping, or "" for a plain user.

    A deployment can override KALTURA_ROLE_MAP, so the "an import never grants
    Django superuser or staff" rule is enforced here rather than left to the
    shipped default map's contents.
    """
    if role_map is None:
        role_map = getattr(settings, "KALTURA_ROLE_MAP", None) or DEFAULT_ROLE_MAP
    role = role_map.get(kaltura_role_name or "", "")
    if role in FORBIDDEN_ROLES:
        logger.warning(
            "KALTURA_ROLE_MAP maps '%s' to '%s'; refusing to grant it from an import",
            kaltura_role_name,
            role,
        )
        return ""
    return role


def rbac_role_for_permission_level(level):
    """RBACMembership role for a Kaltura categoryUser permission level"""
    if level == PERMISSION_LEVEL_MANAGER:
        return "manager"
    if level in (PERMISSION_LEVEL_MODERATOR, PERMISSION_LEVEL_CONTRIBUTOR):
        return "contributor"
    return "member"


def category_title_and_description(full_name, kms_root=""):
    """Split a Kaltura fullName into a MediaCMS title and a readable path.

    "MediaSpace>site>galleries>Engineering>1. Term>Electronics"
    becomes ("Electronics", "Engineering: 1. Term: Electronics").
    """
    parts = [part.strip() for part in (full_name or "").split(">") if part.strip()]

    if kms_root and parts and parts[0].lower() == kms_root.lower():
        parts = parts[1:]

    # KMS nests galleries and channels under a literal "site" segment. Only strip
    # them in that exact shape, so a real top level category named "Channels" or
    # "Galleries" is not silently deleted.
    if parts and parts[0].lower() == "site":
        parts = parts[1:]
        if parts and parts[0].lower() in KMS_SCAFFOLDING:
            parts = parts[1:]

    if not parts:
        return "", ""

    title = parts[-1][:CATEGORY_TITLE_MAX]
    description = ": ".join(parts)
    return title, description


def _fit_with_suffix(base, suffix):
    """base + suffix, trimmed to the model's limit without losing the suffix.

    Trimming the formatted string would discard the very part that makes the
    title unique, so the base is trimmed first to leave room.
    """
    suffix = suffix[:CATEGORY_TITLE_MAX // 2]
    room = max(1, CATEGORY_TITLE_MAX - len(suffix))
    return f"{base[:room]}{suffix}"


def unique_category_title(title, parent_name, taken):
    """A title not already in `taken`.

    Category titles act as identifiers in MediaCMS URLs, so flattening a tree
    has to resolve collisions. The parent name is tried first because it reads
    naturally, then a counter.

    Every candidate reserves room for its own suffix. Truncating after
    formatting would collapse long titles back onto the string that was already
    taken, and the loop would never terminate.
    """
    if title not in taken:
        return title

    if parent_name:
        candidate = _fit_with_suffix(title, f" ({parent_name})")
        if candidate not in taken:
            return candidate

    index = 2
    while True:
        candidate = _fit_with_suffix(title, f" ({index})")
        if candidate not in taken:
            return candidate
        index += 1


def match_flavors_to_profiles(flavors, profiles):
    """Pair Kaltura flavors with MediaCMS encode profiles.

    Each flavor takes the profile closest to its height, preferring a profile
    at or below that height on a tie. One flavor per profile: if two flavors
    want the same profile the closer match wins and the other is dropped.

    Returns a list of (flavor, profile) tuples.
    """
    # every viable (flavor, profile) pair is ranked, not just each flavor's
    # single favourite. Ranking only favourites means that when two flavors want
    # the same profile the loser is dropped outright, even with free profiles
    # left over, silently losing a rendition.
    usable = [profile for profile in profiles if profile.resolution and profile.active]

    candidates = []
    for flavor in flavors or []:
        extension = (flavor.get("fileExt") or "").lower()
        if extension not in ("mp4", "webm"):
            continue
        height = flavor.get("height") or 0

        for profile in usable:
            if profile.extension != extension:
                continue
            distance = abs(height - profile.resolution)
            above = 0 if profile.resolution <= height else 1
            candidates.append(((distance, above), flavor, profile))

    candidates.sort(key=lambda item: item[0])

    pairs = []
    used_profiles = set()
    used_flavors = set()
    for _key, flavor, profile in candidates:
        if profile.id in used_profiles or flavor.get("id") in used_flavors:
            continue
        used_profiles.add(profile.id)
        used_flavors.add(flavor.get("id"))
        pairs.append((flavor, profile))
    return pairs


def sanitize_username(value):
    """Turn a Kaltura user id into something the MediaCMS username validator accepts"""
    cleaned = USERNAME_INVALID.sub("-", (value or "").strip())
    cleaned = re.sub(r"-{2,}", "-", cleaned).strip("-")
    if not cleaned:
        return "migrated-user"
    # strip again after the cap: truncation can land exactly on a dash
    return cleaned[:USERNAME_MAX].strip("-") or "migrated-user"
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_kaltura_mappings.py -v`
Expected: PASS, 27 tests

- [ ] **Step 5: Commit**

```bash
git add migrationservice/providers/kaltura.py migrationservice/tests/test_kaltura_mappings.py
git commit -m "feat(migrationservice): add Kaltura mapping functions"
```

---

## Task 6: Core hooks in files and users

**Files:**
- Modify: `files/models/media.py:391`
- Modify: `users/models.py:290`
- Create: `migrationservice/tests/test_core_hooks.py`
- Test: `migrationservice/tests/test_core_hooks.py`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `Media._do_not_transcode` — set this attribute to `True` on an unsaved `Media` and `media_init()` will skip `encode()`
  - `User._skip_admin_notification` — set this attribute to `True` on an unsaved `User` and no admin notification email is sent

**Why these are needed:** `Media.save()` fires a post_save signal that calls `media_init()` synchronously, and `media_init()` only consults the global `settings.DO_NOT_TRANSCODE_VIDEO`. The migration must skip transcoding for its own media without disabling transcoding for the whole site, so the flag has to be per instance. Likewise, `post_user_create` emails the admin list on every new user; importing a few hundred users would send a few hundred emails.

**These are the only two changes to `files/` and `users/` in this plan. Do not change anything else in them.**

- [ ] **Step 1: Write the failing tests**

`migrationservice/tests/test_core_hooks.py`:

```python
from unittest import mock

from django.core.files import File
from django.test import TestCase

from files.models import Encoding, Media
from files.tests import create_account
from users.models import User


class TestDoNotTranscodeFlag(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        self.user = create_account()

    def _media(self, do_not_transcode):
        media = Media(user=self.user, title="migrated video")
        if do_not_transcode:
            media._do_not_transcode = True
        with open("fixtures/small_video.mp4", "rb") as fh:
            media.media_file.save(content=File(fh), name="small_video.mp4", save=False)
        media.save()
        return media

    def test_flag_skips_encoding(self):
        media = self._media(do_not_transcode=True)
        self.assertEqual(Encoding.objects.filter(media=media).count(), 0)
        self.assertEqual(media.encoding_status, "success")

    def test_without_the_flag_encoding_still_happens(self):
        media = self._media(do_not_transcode=False)
        self.assertGreater(Encoding.objects.filter(media=media).count(), 0)


class TestSkipAdminNotification(TestCase):
    def test_flag_suppresses_the_admin_email(self):
        with mock.patch("users.models.EmailMessage") as email:
            user = User(username="migrated1", email="migrated1@example.edu")
            user._skip_admin_notification = True
            user.save()
        email.assert_not_called()

    def test_without_the_flag_the_email_is_still_sent(self):
        with mock.patch("users.models.EmailMessage") as email:
            User.objects.create(username="signedup1", email="signedup1@example.edu")
        email.assert_called_once()

    def test_the_default_channel_is_created_either_way(self):
        user = User(username="migrated2", email="migrated2@example.edu")
        user._skip_admin_notification = True
        user.save()
        self.assertEqual(user.channels.count(), 1)
```

Note: if `User.channels` is not the related name on `Channel.user`, use `Channel.objects.filter(user=user).count()` instead. Check `users/models.py` before running.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_core_hooks.py -v`
Expected: FAIL — `test_flag_skips_encoding` fails because encodings were created, and `test_flag_suppresses_the_admin_email` fails because `EmailMessage` was called.

- [ ] **Step 3: Add the media flag**

In `files/models/media.py`, inside `media_init()`, change:

```python
        if self.media_type == "video":
            self.set_thumbnail(force=True)
            if settings.DO_NOT_TRANSCODE_VIDEO:
```

to:

```python
        if self.media_type == "video":
            self.set_thumbnail(force=True)
            # _do_not_transcode is set per instance by the migration service, so a
            # single import can skip transcoding without disabling it site wide
            if settings.DO_NOT_TRANSCODE_VIDEO or getattr(self, "_do_not_transcode", False):
```

- [ ] **Step 4: Add the user notification flag**

In `users/models.py`, inside `post_user_create`, change:

```python
        if settings.ADMINS_NOTIFICATIONS.get("NEW_USER", False):
```

to:

```python
        # _skip_admin_notification is set per instance by bulk importers, so
        # importing hundreds of users does not send hundreds of emails
        if settings.ADMINS_NOTIFICATIONS.get("NEW_USER", False) and not getattr(instance, "_skip_admin_notification", False):
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_core_hooks.py -v`
Expected: PASS, 5 tests

- [ ] **Step 6: Run the existing suite to confirm nothing regressed**

Run: `pytest tests/ files/ -v`
Expected: PASS, same results as before the change

- [ ] **Step 7: Commit**

```bash
git add files/models/media.py users/models.py migrationservice/tests/test_core_hooks.py
git commit -m "feat(files,users): allow per instance skip of transcoding and admin notification"
```

---

## Task 7: Kaltura provider adapter

**Files:**
- Modify: `migrationservice/providers/kaltura.py`
- Create: `migrationservice/tests/test_kaltura_provider.py`
- Test: `migrationservice/tests/test_kaltura_provider.py`

**Interfaces:**
- Consumes: `KalturaClient`, mapping functions from Tasks 3–5.
- Produces on `KalturaProvider`:
  - `client` property returning a lazily built `KalturaClient`
  - `check_connection() -> dict`
  - `list_page(phase: str, cursor: dict, page_size: int) -> tuple[list[str], dict]` — phases `"users"`, `"categories"`, `"media"`; returns source ids
  - `fetch_user(source_id: str) -> dict` with keys `id, email, fullName, screenName, roleName`
  - `fetch_category(source_id: str) -> dict` with keys `id, name, fullName, parentName, privacy, members`
  - `fetch_media(source_id: str) -> dict` with keys `entry, flavors, captions, transcripts, categories`
  - `download(url: str, dest_path: str) -> int`
  - `download_flavor(flavor: dict, dest_path: str) -> int`
  - `download_caption(caption: dict, dest_path: str) -> int`

- [ ] **Step 1: Write the failing tests**

`migrationservice/tests/test_kaltura_provider.py`:

```python
from unittest import mock

from django.test import TestCase

from migrationservice.providers import get_provider_class

CONNECTION = {
    "service_url": "https://kaltura.example.edu",
    "partner_id": "342",
    "admin_secret": "the-secret",
    "kms_root_category": "MediaSpace",
}


def make_provider(options=None):
    klass = get_provider_class("kaltura")
    provider = klass(dict(CONNECTION), options or {})
    provider._client = mock.MagicMock()
    return provider


class TestKalturaProviderListing(TestCase):
    def test_media_phase_returns_entry_ids_and_cursor(self):
        provider = make_provider()
        provider._client.list_entries_page.return_value = (
            [{"id": "1_a"}, {"id": "1_b"}],
            {"created_at": 200, "seen_ids": ["1_b"]},
        )
        ids, cursor = provider.list_page("media", {}, 10)
        self.assertEqual(ids, ["1_a", "1_b"])
        self.assertEqual(cursor["created_at"], 200)

    def test_media_phase_passes_the_created_at_filters(self):
        provider = make_provider({"created_after": 1000, "created_before": 2000})
        provider._client.list_entries_page.return_value = ([], {})
        provider.list_page("media", {}, 10)
        kfilter = provider._client.list_entries_page.call_args[0][2]
        self.assertEqual(kfilter["createdAtGreaterThanOrEqual"], 1000)
        self.assertEqual(kfilter["createdAtLessThanOrEqual"], 2000)

    def test_users_phase_uses_index_paging(self):
        provider = make_provider()
        provider._client.list_page_by_index.return_value = ([{"id": "jdoe"}], {"page_index": 2})
        ids, cursor = provider.list_page("users", {}, 10)
        self.assertEqual(ids, ["jdoe"])
        self.assertEqual(provider._client.list_page_by_index.call_args[0][0], "user")

    def test_categories_phase_only_lists_galleries_and_channels(self):
        provider = make_provider()
        provider._client.list_page_by_index.return_value = ([{"id": 8812}], {"page_index": 2})
        ids, _cursor = provider.list_page("categories", {}, 10)
        self.assertEqual(ids, ["8812"])
        kfilter = provider._client.list_page_by_index.call_args[1]["kfilter"]
        self.assertEqual(kfilter["fullNameStartsWith"], "MediaSpace>site>")

    def test_unknown_phase_raises(self):
        provider = make_provider()
        with self.assertRaises(ValueError):
            provider.list_page("playlists", {}, 10)


class TestKalturaProviderFetching(TestCase):
    def test_fetch_media_bundles_entry_flavors_captions_and_categories(self):
        provider = make_provider()

        def fake_call(service, action, **params):
            if (service, action) == ("media", "get"):
                return {"id": "1_a", "name": "Lecture 4", "userId": "jdoe"}
            if (service, action) == ("flavorAsset", "getByEntryId"):
                return [{"id": "flav1", "height": 720, "fileExt": "mp4", "status": 2, "isOriginal": False}]
            if (service, action) == ("captionAsset", "list"):
                return {"objects": [{"id": "cap1", "languageCode": "da", "language": "Danish"}]}
            if (service, action) == ("attachmentAsset", "list"):
                return {"objects": []}
            if (service, action) == ("categoryEntry", "list"):
                return {"objects": [{"categoryId": 8812}]}
            if (service, action) == ("category", "list"):
                return {"objects": [{"id": 8812, "name": "Electronics", "privacy": 1}]}
            raise AssertionError(f"unexpected call {service}.{action}")

        provider._client.call.side_effect = fake_call
        data = provider.fetch_media("1_a")
        self.assertEqual(data["entry"]["name"], "Lecture 4")
        self.assertEqual(len(data["flavors"]), 1)
        self.assertEqual(len(data["captions"]), 1)
        self.assertEqual(data["categories"][0]["privacy"], 1)

    def test_fetch_media_drops_flavors_that_are_not_ready(self):
        provider = make_provider()

        def fake_call(service, action, **params):
            if (service, action) == ("media", "get"):
                return {"id": "1_a"}
            if (service, action) == ("flavorAsset", "getByEntryId"):
                return [
                    {"id": "ok", "height": 720, "fileExt": "mp4", "status": 2},
                    {"id": "converting", "height": 360, "fileExt": "mp4", "status": 1},
                ]
            if (service, action) == ("captionAsset", "list"):
                return {"objects": []}
            if (service, action) == ("attachmentAsset", "list"):
                return {"objects": []}
            if (service, action) == ("categoryEntry", "list"):
                return {"objects": []}
            raise AssertionError(f"unexpected call {service}.{action}")

        provider._client.call.side_effect = fake_call
        data = provider.fetch_media("1_a")
        self.assertEqual([flavor["id"] for flavor in data["flavors"]], ["ok"])

    def test_fetch_user_flattens_the_role_name(self):
        provider = make_provider()

        def fake_call(service, action, **params):
            if (service, action) == ("user", "get"):
                return {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "roleIds": "17"}
            if (service, action) == ("userRole", "list"):
                return {"objects": [{"id": 17, "systemName": "adminRole"}]}
            raise AssertionError(f"unexpected call {service}.{action}")

        provider._client.call.side_effect = fake_call
        user = provider.fetch_user("jdoe")
        self.assertEqual(user["roleName"], "adminRole")

    def test_fetch_category_includes_members(self):
        provider = make_provider()

        def fake_call(service, action, **params):
            if (service, action) == ("category", "get"):
                return {"id": 8812, "name": "Electronics", "fullName": "MediaSpace>site>galleries>Eng>Electronics", "privacy": 3, "owner": "jdoe"}
            if (service, action) == ("categoryUser", "list"):
                return {"objects": [{"userId": "asmith", "permissionLevel": 0}]}
            raise AssertionError(f"unexpected call {service}.{action}")

        provider._client.call.side_effect = fake_call
        category = provider.fetch_category("8812")
        self.assertEqual(category["parentName"], "Eng")
        self.assertEqual(category["members"], [{"userId": "asmith", "permissionLevel": 0}])
        self.assertEqual(category["owner"], "jdoe")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_kaltura_provider.py -v`
Expected: FAIL — `AttributeError: 'KalturaProvider' object has no attribute 'list_page'`

- [ ] **Step 3: Implement the adapter**

Replace the `KalturaProvider` class at the bottom of `migrationservice/providers/kaltura.py`, keeping the class attributes from Task 2 Step 6 and adding the methods below:

```python
class KalturaProvider(BaseProvider):
    name = "kaltura"
    label = "Kaltura"
    implemented = True

    secret_keys = ("admin_secret",)
    required_connection_keys = ("service_url", "partner_id", "admin_secret")
    default_options = {
        "create_users": True,
        "fallback_username": "admin",
        "create_categories": True,
        "map_permissions": True,
        "import_captions": True,
        "preserve_views": True,
        "preserve_publish_state": True,
        "skip_transcoding": True,
        "created_after": None,
        "created_before": None,
        "root_category": None,
        "max_items": None,
    }

    def __init__(self, connection, options):
        super().__init__(connection, options)
        self._client = None

    @classmethod
    def source_system(cls, connection):
        url = (connection.get("service_url") or "").strip()
        if url and "://" not in url:
            # urlparse puts a scheme-less URL in the path, leaving netloc empty,
            # which would make every scheme-less installation collide
            url = f"https://{url}"
        host = urlparse(url).netloc.lower().rstrip("/")
        return f"kaltura:{connection.get('partner_id') or ''}@{host}"

    @property
    def client(self):
        if self._client is None:
            self._client = KalturaClient(
                service_url=self.connection.get("service_url"),
                partner_id=self.connection.get("partner_id"),
                admin_secret=self.connection.get("admin_secret"),
            )
        return self._client

    @property
    def kms_root(self):
        return self.connection.get("kms_root_category") or ""

    def check_connection(self):
        return self.client.check_connection()

    def _entry_filter(self):
        """Optional user supplied narrowing of the media phase.

        These keys are a floor, not the resume position. list_entries_page
        applies the cursor after this filter and takes the later of the two
        createdAt bounds, so a static created_after can never reset a
        migration's progress.
        """
        kfilter = {}
        if self.options.get("created_after"):
            kfilter["createdAtGreaterThanOrEqual"] = self.options["created_after"]
        if self.options.get("created_before"):
            kfilter["createdAtLessThanOrEqual"] = self.options["created_before"]
        if self.options.get("root_category"):
            kfilter["categoriesFullNameIn"] = self.options["root_category"]
        return kfilter

    def list_page(self, phase, cursor, page_size):
        if phase == "media":
            entries, next_cursor = self.client.list_entries_page(cursor, page_size, self._entry_filter())
            return [str(entry["id"]) for entry in entries], next_cursor

        if phase == "users":
            objects, next_cursor = self.client.list_page_by_index(
                "user", cursor, page_size, kfilter={"statusEqual": 1}
            )
            return [str(obj["id"]) for obj in objects], next_cursor

        if phase == "categories":
            # only KMS galleries and channels, which all live under "<root>>site".
            # the trailing separator matters: without it the prefix also matches the
            # "site" container itself, which would be imported as a junk category
            prefix = f"{self.kms_root}>site>" if self.kms_root else "site>"
            objects, next_cursor = self.client.list_page_by_index(
                "category", cursor, page_size, kfilter={"fullNameStartsWith": prefix}
            )
            return [str(obj["id"]) for obj in objects], next_cursor

        raise ValueError(f"Unknown migration phase: {phase}")

    def fetch_user(self, source_id):
        user = self.client.call("user", "get", userId=source_id)
        role_name = ""
        role_ids = str(user.get("roleIds") or "").split(",")[0].strip()
        if role_ids:
            roles = self.client.call("userRole", "list", filter={"idIn": role_ids})
            objects = roles.get("objects") or []
            if objects:
                role_name = objects[0].get("systemName") or objects[0].get("name") or ""
        return {
            "id": str(user.get("id") or ""),
            "email": user.get("email") or "",
            "fullName": user.get("fullName") or "",
            "screenName": user.get("screenName") or "",
            "roleName": role_name,
        }

    def fetch_category(self, source_id):
        category = self.client.call("category", "get", id=source_id)
        members = []
        if self.options.get("map_permissions", True):
            result = self.client.call("categoryUser", "list", filter={"categoryIdEqual": source_id})
            members = [
                {"userId": obj.get("userId"), "permissionLevel": obj.get("permissionLevel")}
                for obj in (result.get("objects") or [])
            ]
        parts = [part.strip() for part in (category.get("fullName") or "").split(">") if part.strip()]
        parent_name = parts[-2] if len(parts) > 1 else ""
        return {
            "id": str(category.get("id")),
            "name": category.get("name") or "",
            "fullName": category.get("fullName") or "",
            "parentName": parent_name,
            "privacy": category.get("privacy"),
            "owner": category.get("owner") or "",
            "members": members,
        }

    def fetch_media(self, source_id):
        entry = self.client.call("media", "get", entryId=source_id)

        flavors = self.client.call("flavorAsset", "getByEntryId", entryId=source_id) or []
        flavors = [flavor for flavor in flavors if flavor.get("status") == FLAVOR_STATUS_READY]

        captions = []
        if self.options.get("import_captions", True):
            result = self.client.call("captionAsset", "list", filter={"entryIdEqual": source_id})
            captions = result.get("objects") or []

        transcripts = []
        if self.options.get("import_captions", True):
            # Kaltura REACH plain text transcripts are attachment assets, not caption
            # assets. MediaCMS has nowhere to put them, so they are only reported.
            result = self.client.call("attachmentAsset", "list", filter={"entryIdEqual": source_id})
            transcripts = result.get("objects") or []

        categories = []
        result = self.client.call("categoryEntry", "list", filter={"entryIdEqual": source_id})
        category_ids = [str(obj.get("categoryId")) for obj in (result.get("objects") or [])]
        if category_ids:
            result = self.client.call("category", "list", filter={"idIn": ",".join(category_ids)})
            categories = result.get("objects") or []

        return {
            "entry": entry,
            "flavors": flavors,
            "captions": captions,
            "transcripts": transcripts,
            "categories": categories,
        }

    def download(self, url, dest_path):
        """Stream a URL to dest_path and return the number of bytes written"""
        timeout = getattr(settings, "MIGRATION_DOWNLOAD_TIMEOUT", 60 * 30)
        written = 0
        with requests.get(url, stream=True, timeout=timeout) as response:
            response.raise_for_status()
            with open(dest_path, "wb") as handle:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        handle.write(chunk)
                        written += len(chunk)
        return written

    def download_flavor(self, flavor, dest_path):
        """Resolve a flavor's download URL and stream it to dest_path"""
        url = self.client.call("flavorAsset", "getUrl", id=flavor["id"])
        if not isinstance(url, str):
            raise KalturaAPIError("FLAVOR_URL_ERROR", f"No download URL for flavor {flavor['id']}")
        return self.download(url, dest_path)

    def download_caption(self, caption, dest_path):
        """Resolve a caption asset's download URL and stream it to dest_path"""
        url = self.client.call("captionAsset", "getUrl", id=caption["id"])
        if not isinstance(url, str):
            raise KalturaAPIError("CAPTION_URL_ERROR", f"No download URL for caption {caption['id']}")
        return self.download(url, dest_path)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_kaltura_provider.py -v`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add migrationservice/providers/kaltura.py migrationservice/tests/test_kaltura_provider.py
git commit -m "feat(migrationservice): add Kaltura provider adapter"
```

---

## Task 8: Importers — users

**Files:**
- Create: `migrationservice/tasks.py`, `migrationservice/tests/fakes.py`, `migrationservice/tests/test_import_users.py`
- Test: `migrationservice/tests/test_import_users.py`

**Interfaces:**
- Consumes: `MigrationService`, `MigrationRecord` (Task 1), `get_provider` (Task 2), `mediacms_role`, `sanitize_username` (Task 5), `User._skip_admin_notification` (Task 6).
- Produces in `migrationservice/tasks.py`:
  - `record(service, object_type: str, source_id: str, status: str, log: str = "", target=None) -> MigrationRecord`
  - `unique_username(candidate: str) -> str`
  - `import_user(service, provider, source_id: str) -> User`
  - `resolve_owner(service, provider, kaltura_user_id: str) -> User`
- Produces in `migrationservice/tests/fakes.py`:
  - `FakeProvider(BaseProvider)` with settable `users`, `categories`, `entries`, `pages` and a `downloads` dict mapping ids to local file paths

- [ ] **Step 1: Write the fake provider**

`migrationservice/tests/fakes.py`:

```python
import shutil

from migrationservice.providers.base import BaseProvider


class FakeProvider(BaseProvider):
    """In memory provider used by the importer and orchestrator tests.

    Source data is handed in as plain dicts keyed by source id, so tests can
    describe exactly what the source system returns without any HTTP.
    """

    name = "fake"
    label = "Fake"
    implemented = True

    secret_keys = ()
    required_connection_keys = ()
    default_options = {}

    def __init__(self, connection=None, options=None):
        super().__init__(connection or {}, options or {})
        self.users = {}
        self.categories = {}
        self.media = {}
        self.downloads = {}
        self.calls = []

    @classmethod
    def source_system(cls, connection):
        return "fake:test"

    def check_connection(self):
        return {"ok": True, "error": "", "stats": {"entries": len(self.media)}}

    def list_page(self, phase, cursor, page_size):
        source = {"users": self.users, "categories": self.categories, "media": self.media}[phase]
        ids = sorted(source.keys())
        offset = (cursor or {}).get("offset", 0)
        page = ids[offset:offset + page_size]
        if not page:
            return [], cursor or {}
        return page, {"offset": offset + len(page)}

    def fetch_user(self, source_id):
        self.calls.append(("fetch_user", source_id))
        return self.users[source_id]

    def fetch_category(self, source_id):
        self.calls.append(("fetch_category", source_id))
        return self.categories[source_id]

    def fetch_media(self, source_id):
        self.calls.append(("fetch_media", source_id))
        return self.media[source_id]

    def download(self, url, dest_path):
        shutil.copyfile(self.downloads[url], dest_path)
        return 1

    def download_flavor(self, flavor, dest_path):
        self.calls.append(("download_flavor", flavor["id"]))
        shutil.copyfile(self.downloads[flavor["id"]], dest_path)
        return 1

    def download_caption(self, caption, dest_path):
        self.calls.append(("download_caption", caption["id"]))
        shutil.copyfile(self.downloads[caption["id"]], dest_path)
        return 1
```

- [ ] **Step 2: Write the failing tests**

`migrationservice/tests/test_import_users.py`:

```python
from django.test import TestCase

from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.tasks import import_user, resolve_owner
from migrationservice.tests.fakes import FakeProvider
from users.models import User


def make_service(**options):
    return MigrationService.objects.create(
        name="Kaltura production",
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "admin_secret": "x"},
        options=options,
    )


class TestImportUser(TestCase):
    def setUp(self):
        self.service = make_service(create_users=True, map_permissions=True)
        self.provider = FakeProvider()
        self.provider.users = {
            "jdoe": {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "screenName": "jdoe", "roleName": "adminRole"},
            "cn=Ann Smith,ou=staff": {"id": "cn=Ann Smith,ou=staff", "email": "", "fullName": "Ann Smith", "screenName": "", "roleName": "viewerRole"},
        }

    def test_creates_a_user_and_a_record(self):
        user = import_user(self.service, self.provider, "jdoe")
        self.assertEqual(user.email, "jdoe@example.edu")
        self.assertEqual(user.name, "J Doe")
        record = MigrationRecord.objects.get(service=self.service, object_type="user", source_id="jdoe")
        self.assertEqual(record.status, "success")
        self.assertEqual(record.user_id, user.id)
        self.assertEqual(record.target_id, user.id)

    def test_applies_the_mapped_role(self):
        user = import_user(self.service, self.provider, "jdoe")
        user.refresh_from_db()
        self.assertTrue(user.advancedUser)
        self.assertFalse(user.is_superuser)
        self.assertFalse(user.is_staff)

    def test_a_plain_role_leaves_permissions_untouched(self):
        user = import_user(self.service, self.provider, "cn=Ann Smith,ou=staff")
        user.refresh_from_db()
        self.assertFalse(user.advancedUser)
        self.assertFalse(user.is_editor)
        self.assertFalse(user.is_manager)

    def test_invalid_characters_are_sanitised_out_of_the_username(self):
        user = import_user(self.service, self.provider, "cn=Ann Smith,ou=staff")
        self.assertEqual(user.username, "cn-Ann-Smith-ou-staff")

    def test_an_existing_user_is_linked_by_email_not_duplicated(self):
        existing = create_account(email="jdoe@example.edu")
        user = import_user(self.service, self.provider, "jdoe")
        self.assertEqual(user.id, existing.id)
        self.assertEqual(User.objects.filter(email="jdoe@example.edu").count(), 1)

    def test_a_username_collision_gets_a_suffix(self):
        create_account(username="jdoe", email="someone.else@example.edu")
        self.provider.users["jdoe"]["email"] = ""
        user = import_user(self.service, self.provider, "jdoe")
        self.assertEqual(user.username, "jdoe-2")

    def test_importing_twice_returns_the_same_user(self):
        first = import_user(self.service, self.provider, "jdoe")
        second = import_user(self.service, self.provider, "jdoe")
        self.assertEqual(first.id, second.id)
        self.assertEqual(User.objects.filter(email="jdoe@example.edu").count(), 1)

    def test_map_permissions_off_skips_the_role(self):
        service = make_service(create_users=True, map_permissions=False)
        user = import_user(service, self.provider, "jdoe")
        user.refresh_from_db()
        self.assertFalse(user.advancedUser)


class TestResolveOwner(TestCase):
    def setUp(self):
        self.provider = FakeProvider()
        self.provider.users = {"jdoe": {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "screenName": "", "roleName": ""}}

    def test_create_users_on_returns_the_imported_user(self):
        service = make_service(create_users=True)
        owner = resolve_owner(service, self.provider, "jdoe")
        self.assertEqual(owner.email, "jdoe@example.edu")

    def test_create_users_off_returns_the_fallback(self):
        fallback = create_account(username="admin")
        service = make_service(create_users=False, fallback_username="admin")
        owner = resolve_owner(service, self.provider, "jdoe")
        self.assertEqual(owner.id, fallback.id)

    def test_unknown_source_user_falls_back(self):
        fallback = create_account(username="admin")
        service = make_service(create_users=True, fallback_username="admin")
        owner = resolve_owner(service, self.provider, "ghost")
        self.assertEqual(owner.id, fallback.id)

    def test_a_missing_fallback_user_raises(self):
        service = make_service(create_users=False, fallback_username="nobody")
        with self.assertRaises(ValueError):
            resolve_owner(service, self.provider, "jdoe")
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_import_users.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'migrationservice.tasks'`

- [ ] **Step 4: Implement the user importer**

`migrationservice/tasks.py`:

```python
import logging

from users.models import User

from .models import MigrationRecord
from .providers.kaltura import mediacms_role, sanitize_username

logger = logging.getLogger(__name__)


def record(service, object_type, source_id, status, log="", target=None):
    """Write the mapping row for one source object.

    update_or_create rather than create so that retrying a failed item
    replaces its record instead of tripping the unique constraint.
    """
    fields = {
        "status": status,
        "log": (log or "")[:500],
        "target_id": None,
        "media": None,
        "user": None,
        "category": None,
    }
    if target is not None:
        fields["target_id"] = target.pk
        if object_type == "media":
            fields["media"] = target
        elif object_type == "user":
            fields["user"] = target
        elif object_type == "category":
            fields["category"] = target

    row, _created = MigrationRecord.objects.update_or_create(
        service=service,
        object_type=object_type,
        source_id=str(source_id),
        defaults=fields,
    )
    return row


def unique_username(candidate):
    """A username not already taken, suffixed with a counter if needed"""
    if not User.objects.filter(username__iexact=candidate).exists():
        return candidate
    index = 2
    while True:
        suffixed = f"{candidate[:145]}-{index}"
        if not User.objects.filter(username__iexact=suffixed).exists():
            return suffixed
        index += 1


def import_user(service, provider, source_id):
    """Create or link the MediaCMS user for one source user, and record it"""
    options = service.get_options()
    payload = provider.fetch_user(source_id)

    email = (payload.get("email") or "").strip()
    username = sanitize_username(payload.get("id") or source_id)

    user = None
    if email:
        user = User.objects.filter(email__iexact=email).first()
    if user is None:
        # a username match only counts as the same person when the existing
        # account has no email of its own: otherwise it is a distinct,
        # already-identified human who merely collides on the sanitised
        # username, and linking would attach the migration to the wrong account
        candidate = User.objects.filter(username__iexact=username).first()
        if candidate is not None and not candidate.email:
            # and not already claimed by a different source user: two emailless
            # Kaltura accounts can sanitise to the same username, and the second
            # must not inherit the first one's media
            claimed = (
                MigrationRecord.objects.filter(
                    service__source_system=service.source_system,
                    object_type="user",
                    user=candidate,
                    status="success",
                )
                .exclude(source_id=str(source_id))
                .exists()
            )
            if not claimed:
                user = candidate

    created = False
    if user is None:
        user = User(
            username=unique_username(username),
            email=email,
            name=payload.get("fullName") or payload.get("screenName") or username,
        )
        user.set_unusable_password()
        # bulk import, do not email the admin list once per user
        user._skip_admin_notification = True
        user.save()
        created = True

    if options.get("map_permissions", True):
        role = mediacms_role(payload.get("roleName") or "")
        if role:
            # only called for a mapped role. set_role_from_mapping resets every
            # permission when handed an unknown value
            user.set_role_from_mapping(role)

    action = "created" if created else "linked to existing user"
    record(service, "user", source_id, "success", f"{action} {user.username}", target=user)
    return user


def resolve_owner(service, provider, source_user_id):
    """The MediaCMS user a migrated media should belong to"""
    options = service.get_options()

    if options.get("create_users", True) and source_user_id:
        try:
            return import_user(service, provider, source_user_id)
        except KeyError:
            logger.warning("migration %s: source user %s not found, using fallback", service.pk, source_user_id)
        except Exception as exc:  # noqa: BLE001 - fall back rather than lose the media
            logger.warning("migration %s: could not import user %s: %s", service.pk, source_user_id, exc)

    fallback_username = options.get("fallback_username") or "admin"
    fallback = User.objects.filter(username=fallback_username).first()
    if fallback is None:
        raise ValueError(f"Fallback user '{fallback_username}' does not exist")
    return fallback
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_import_users.py -v`
Expected: PASS, 12 tests

- [ ] **Step 6: Commit**

```bash
git add migrationservice/tasks.py migrationservice/tests/fakes.py migrationservice/tests/test_import_users.py
git commit -m "feat(migrationservice): import users with role mapping and deduplication"
```

---

## Task 9: Importers — categories and permissions

**Files:**
- Modify: `migrationservice/tasks.py`
- Create: `migrationservice/tests/test_import_categories.py`
- Test: `migrationservice/tests/test_import_categories.py`

**Interfaces:**
- Consumes: `record`, `resolve_owner` (Task 8), `category_title_and_description`, `unique_category_title`, `rbac_role_for_permission_level`, `PRIVACY_ALL` (Task 5).
- Produces in `migrationservice/tasks.py`:
  - `import_category(service, provider, source_id: str) -> Category`
  - `apply_category_permissions(service, provider, category, payload: dict) -> None`

**Background:** `Category.title` shows up in MediaCMS URLs as `?c=<title>`, so titles have to stay unique. Kaltura restricted categories become RBAC categories: an `RBACGroup` named after the category is linked to it and Kaltura's `categoryUser` rows become `RBACMembership` rows. If `settings.USE_RBAC` is false the objects are still created and a warning is logged — the data is then correct the moment RBAC is switched on.

- [ ] **Step 1: Write the failing tests**

`migrationservice/tests/test_import_categories.py`:

```python
from django.test import TestCase, override_settings

from files.models import Category
from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.tasks import import_category
from migrationservice.tests.fakes import FakeProvider
from rbac.models import RBACGroup, RBACMembership


def make_service(**options):
    defaults = {"create_users": True, "create_categories": True, "map_permissions": True, "fallback_username": "admin"}
    defaults.update(options)
    return MigrationService.objects.create(
        name="Kaltura production",
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "admin_secret": "x"},
        options=defaults,
    )


class TestImportCategory(TestCase):
    def setUp(self):
        create_account(username="admin")
        self.service = make_service()
        self.provider = FakeProvider()
        self.provider.users = {
            "jdoe": {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "screenName": "", "roleName": ""},
            "asmith": {"id": "asmith", "email": "asmith@example.edu", "fullName": "A Smith", "screenName": "", "roleName": ""},
        }
        self.provider.categories = {
            "8812": {
                "id": "8812",
                "name": "Electronics",
                "fullName": "MediaSpace>site>galleries>Engineering>1. Term>Electronics",
                "parentName": "1. Term",
                "privacy": 1,
                "owner": "jdoe",
                "members": [],
            },
            "8813": {
                "id": "8813",
                "name": "Electronics",
                "fullName": "MediaSpace>site>channels>Physics>Electronics",
                "parentName": "Physics",
                "privacy": 3,
                "owner": "jdoe",
                "members": [{"userId": "asmith", "permissionLevel": 3}],
            },
        }
        self.service.connection["kms_root_category"] = "MediaSpace"

    def test_creates_a_flat_category_with_the_path_as_description(self):
        category = import_category(self.service, self.provider, "8812")
        self.assertEqual(category.title, "Electronics")
        self.assertEqual(category.description, "Engineering: 1. Term: Electronics")
        self.assertTrue(category.is_global)

    def test_writes_a_mapping_record(self):
        category = import_category(self.service, self.provider, "8812")
        row = MigrationRecord.objects.get(service=self.service, object_type="category", source_id="8812")
        self.assertEqual(row.category_id, category.id)
        self.assertEqual(row.status, "success")

    def test_a_title_collision_appends_the_parent(self):
        import_category(self.service, self.provider, "8812")
        second = import_category(self.service, self.provider, "8813")
        self.assertEqual(second.title, "Electronics (Physics)")
        self.assertEqual(Category.objects.filter(title__startswith="Electronics").count(), 2)

    def test_public_kaltura_category_is_not_rbac(self):
        category = import_category(self.service, self.provider, "8812")
        self.assertFalse(category.is_rbac_category)
        self.assertEqual(RBACGroup.objects.filter(categories=category).count(), 0)

    def test_restricted_category_becomes_rbac_with_members(self):
        category = import_category(self.service, self.provider, "8813")
        self.assertTrue(category.is_rbac_category)
        group = RBACGroup.objects.get(categories=category)
        roles = {membership.user.username: membership.role for membership in RBACMembership.objects.filter(rbac_group=group)}
        self.assertEqual(roles["asmith"], "member")
        self.assertEqual(roles["jdoe"], "manager")

    def test_manager_permission_level_maps_to_manager(self):
        self.provider.categories["8813"]["members"] = [{"userId": "asmith", "permissionLevel": 0}]
        category = import_category(self.service, self.provider, "8813")
        group = RBACGroup.objects.get(categories=category)
        membership = RBACMembership.objects.get(rbac_group=group, user__username="asmith")
        self.assertEqual(membership.role, "manager")

    def test_map_permissions_off_leaves_the_category_public(self):
        service = make_service(map_permissions=False)
        service.connection["kms_root_category"] = "MediaSpace"
        category = import_category(service, self.provider, "8813")
        self.assertFalse(category.is_rbac_category)
        self.assertEqual(RBACGroup.objects.count(), 0)

    def test_importing_twice_reuses_the_same_category(self):
        first = import_category(self.service, self.provider, "8812")
        second = import_category(self.service, self.provider, "8812")
        self.assertEqual(first.id, second.id)
        self.assertEqual(Category.objects.filter(title="Electronics").count(), 1)

    @override_settings(USE_RBAC=False)
    def test_rbac_objects_are_still_created_when_rbac_is_off(self):
        category = import_category(self.service, self.provider, "8813")
        self.assertTrue(category.is_rbac_category)
        self.assertEqual(RBACGroup.objects.filter(categories=category).count(), 1)
        self.service.refresh_from_db()
        self.assertIn("USE_RBAC", self.service.log)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_import_categories.py -v`
Expected: FAIL — `ImportError: cannot import name 'import_category'`

- [ ] **Step 3: Implement the category importer**

Add to `migrationservice/tasks.py`:

```python
from django.conf import settings
from django.db import transaction

from files.models import Category
from rbac.models import RBACGroup, RBACMembership

from .providers.kaltura import (
    PRIVACY_ALL,
    category_title_and_description,
    rbac_role_for_permission_level,
    unique_category_title,
)
```

and these functions:

```python
def import_category(service, provider, source_id):
    """Create or reuse the MediaCMS category for one source category.

    The whole import is one transaction. The mapping row is written last, so
    without atomicity a failure part way through permissions would leave a real
    Category with no record of it, and the retry would build a second one.
    """
    payload = provider.fetch_category(source_id)

    existing = MigrationRecord.objects.filter(
        service=service, object_type="category", source_id=str(source_id), status="success"
    ).first()
    if existing and existing.category_id:
        return existing.category

    kms_root = service.get_connection().get("kms_root_category") or ""
    title, description = category_title_and_description(payload.get("fullName"), kms_root=kms_root)
    if not title:
        title = payload.get("name") or f"category-{source_id}"
        description = title

    with transaction.atomic():
        # read inside the transaction: two categories created in the same run must
        # collide against each other, not just against pre-existing titles
        taken = set(Category.objects.values_list("title", flat=True))
        title = unique_category_title(title, payload.get("parentName") or "", taken)

        category = Category.objects.create(title=title, description=description, is_global=True)

        if service.get_options().get("map_permissions", True):
            apply_category_permissions(service, provider, category, payload, str(source_id))

        record(service, "category", source_id, "success", f"created category {category.title}", target=category)
    return category


def apply_category_permissions(service, provider, category, payload, source_id):
    """Kaltura category privacy and membership -> MediaCMS public or RBAC category"""
    if payload.get("privacy") == PRIVACY_ALL:
        # no restrictions in Kaltura, a plain public MediaCMS category
        return

    if not getattr(settings, "USE_RBAC", False):
        service.append_log(
            f"category '{category.title}' needs RBAC but USE_RBAC is off; "
            "the group and memberships were created and will take effect once RBAC is enabled"
        )

    category.is_rbac_category = True
    category.save(update_fields=["is_rbac_category"])

    # the uid MUST be scoped by source_system. RBACGroup is unique on
    # (uid, identity_provider) and every migration group has a null provider, so a
    # bare "kaltura-<category id>" would make two different Kaltura tenants that
    # both number a category 8813 resolve to one shared group, cross-linking their
    # restricted categories and leaking access between installations.
    group, _created = RBACGroup.objects.get_or_create(
        uid=f"{service.source_system}:category-{source_id}"[:255],
        identity_provider=None,
        defaults={"name": category.title, "description": category.description},
    )
    group.categories.add(category)

    # the owner outranks any explicit entry for the same person. RBACMembership is
    # unique on (user, group, role), so role is part of the key and a duplicate
    # person at two roles would be allowed through as two rows.
    by_user = {}
    for membership in payload.get("members") or []:
        if membership.get("userId"):
            by_user[membership["userId"]] = membership
    if payload.get("owner"):
        by_user[payload["owner"]] = {"userId": payload["owner"], "permissionLevel": 0}

    for membership in by_user.values():
        source_user_id = membership.get("userId")
        if not source_user_id:
            continue
        try:
            user = import_user(service, provider, source_user_id)
        except Exception as exc:  # noqa: BLE001 - one bad member must not lose the category
            service.append_log(f"could not add member {source_user_id} to '{category.title}': {exc}")
            continue
        role = rbac_role_for_permission_level(membership.get("permissionLevel"))
        RBACMembership.objects.get_or_create(user=user, rbac_group=group, role=role)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_import_categories.py -v`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add migrationservice/tasks.py migrationservice/tests/test_import_categories.py
git commit -m "feat(migrationservice): import categories with permission mapping"
```

---

## Task 10: Importers — media entries

**Files:**
- Modify: `migrationservice/tasks.py`
- Create: `migrationservice/tests/test_import_media.py`
- Test: `migrationservice/tests/test_import_media.py`

**Interfaces:**
- Consumes: `record`, `resolve_owner` (Task 8), `import_category` (Task 9), `media_state`, `match_flavors_to_profiles` (Task 5), `Media._do_not_transcode` (Task 6).
- Produces in `migrationservice/tasks.py`:
  - `pick_original_flavor(flavors: list[dict]) -> dict | None`
  - `import_media_entry(service, provider, source_id: str) -> Media`
  - `apply_entry_metadata(service, provider, media, data: dict) -> None`
  - `get_or_import_category(service, provider, source_id: str) -> Category | None`
  - `attach_flavor_encodings(service, provider, media, flavors, original, original_path, tmp_dir) -> list[Encoding]`
  - `create_encoding(media, profile, path: str) -> Encoding`
  - `finalise_encodings(media, encodings: list) -> None`

**Two things to get right:**

1. `Encoding` rows are saved with `status="pending"` and then flipped to `"success"` with a queryset `.update()`. The `Encoding` post_save receiver calls `media.post_encode_actions()` for every successful h264 encoding, which launches `create_hls`. Saving five flavors normally would launch it five times. A pending save is inert and a queryset update fires no signals at all, so `finalise_encodings` can call `post_encode_actions` exactly once. **Do not disconnect the signal.**
2. `Media.save()` overwrites `state` with `get_default_state()` only on creation, so the migrated state has to be applied by a second save after the media exists.

- [ ] **Step 1: Write the failing tests**

`migrationservice/tests/test_import_media.py`:

```python
from unittest import mock

from django.test import TestCase

from files.models import Category, Encoding, Media
from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.tasks import import_media_entry, pick_original_flavor
from migrationservice.tests.fakes import FakeProvider

VIDEO = "fixtures/small_video.mp4"


def make_service(**options):
    defaults = {
        "create_users": True,
        "create_categories": True,
        "map_permissions": True,
        "import_captions": False,
        "preserve_views": True,
        "preserve_publish_state": True,
        "skip_transcoding": True,
        "fallback_username": "admin",
    }
    defaults.update(options)
    return MigrationService.objects.create(
        name="Kaltura production",
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "admin_secret": "x", "kms_root_category": "MediaSpace"},
        options=defaults,
    )


def make_provider():
    provider = FakeProvider()
    provider.users = {"jdoe": {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "screenName": "", "roleName": ""}}
    provider.categories = {
        "8812": {
            "id": "8812",
            "name": "Electronics",
            "fullName": "MediaSpace>site>galleries>Engineering>Electronics",
            "parentName": "Engineering",
            "privacy": 1,
            "owner": "",
            "members": [],
        }
    }
    provider.media = {
        "1_a": {
            "entry": {
                "id": "1_a",
                "name": "Circuit analysis lecture 4",
                "description": "Fourth lecture",
                "userId": "jdoe",
                "createdAt": 1683800000,
                "plays": 1204,
                "tags": "electronics, lecture",
                "displayInSearch": 3,
            },
            "flavors": [
                {"id": "source", "height": 1080, "fileExt": "mp4", "isOriginal": True, "status": 2},
                {"id": "flav720", "height": 720, "fileExt": "mp4", "isOriginal": False, "status": 2},
                {"id": "flav360", "height": 360, "fileExt": "mp4", "isOriginal": False, "status": 2},
            ],
            "captions": [],
            "categories": [{"id": "8812", "privacy": 1}],
        }
    }
    provider.downloads = {"source": VIDEO, "flav720": VIDEO, "flav360": VIDEO}
    return provider


class TestPickOriginalFlavor(TestCase):
    def test_prefers_the_source_flavor(self):
        flavors = [{"id": "a", "height": 720, "fileExt": "mp4"}, {"id": "src", "height": 1080, "fileExt": "mp4", "isOriginal": True}]
        self.assertEqual(pick_original_flavor(flavors)["id"], "src")

    def test_falls_back_to_the_tallest_flavor(self):
        flavors = [{"id": "a", "height": 360, "fileExt": "mp4"}, {"id": "b", "height": 720, "fileExt": "mp4"}]
        self.assertEqual(pick_original_flavor(flavors)["id"], "b")

    def test_no_flavors_gives_none(self):
        self.assertIsNone(pick_original_flavor([]))


class TestImportMediaEntry(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.service = make_service()
        self.provider = make_provider()

    def test_creates_the_media_with_its_metadata(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(media.title, "Circuit analysis lecture 4")
        self.assertEqual(media.description, "Fourth lecture")
        self.assertEqual(media.user.email, "jdoe@example.edu")
        self.assertEqual(media.views, 1204)
        self.assertEqual(media.add_date.year, 2023)

    def test_public_category_makes_the_media_public(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(media.state, "public")

    def test_no_categories_makes_the_media_private(self):
        self.provider.media["1_a"]["categories"] = []
        media = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(media.state, "private")

    def test_tags_are_imported(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(sorted(tag.title for tag in media.tags.all()), ["electronics", "lecture"])

    def test_the_category_is_created_and_linked(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual([category.title for category in media.category.all()], ["Electronics"])
        self.assertEqual(Category.objects.filter(title="Electronics").count(), 1)

    def test_flavors_become_encodings_on_active_profiles(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        encodings = Encoding.objects.filter(media=media)
        self.assertEqual(encodings.count(), 2)
        self.assertEqual(sorted(encoding.profile.resolution for encoding in encodings), [360, 720])
        self.assertTrue(all(encoding.status == "success" for encoding in encodings))
        self.assertTrue(all(encoding.profile.active for encoding in encodings))

    def test_no_transcoding_tasks_are_queued(self):
        with mock.patch("files.tasks.encode_media") as encode:
            import_media_entry(self.service, self.provider, "1_a")
        encode.apply_async.assert_not_called()

    def test_hls_is_triggered_exactly_once(self):
        with mock.patch("files.tasks.create_hls") as create_hls:
            import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(create_hls.delay.call_count, 1)

    def test_encoding_status_ends_up_successful(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        media.refresh_from_db()
        self.assertEqual(media.encoding_status, "success")
        self.assertTrue(media.listable)

    def test_a_mapping_record_is_written(self):
        media = import_media_entry(self.service, self.provider, "1_a")
        row = MigrationRecord.objects.get(service=self.service, object_type="media", source_id="1_a")
        self.assertEqual(row.media_id, media.id)
        self.assertEqual(row.target_id, media.id)
        self.assertEqual(row.status, "success")

    def test_the_original_file_is_used_when_no_flavor_survives(self):
        self.provider.media["1_a"]["flavors"] = [
            {"id": "source", "height": 1080, "fileExt": "mp4", "isOriginal": True, "status": 2}
        ]
        media = import_media_entry(self.service, self.provider, "1_a")
        media.refresh_from_db()
        self.assertEqual(Encoding.objects.filter(media=media).count(), 1)
        self.assertEqual(media.encoding_status, "success")

    def test_missing_source_flavor_uses_the_tallest_one(self):
        self.provider.media["1_a"]["flavors"] = [
            {"id": "flav720", "height": 720, "fileExt": "mp4", "isOriginal": False, "status": 2},
            {"id": "flav360", "height": 360, "fileExt": "mp4", "isOriginal": False, "status": 2},
        ]
        media = import_media_entry(self.service, self.provider, "1_a")
        self.assertEqual(Media.objects.filter(id=media.id).count(), 1)
        self.assertIn(("download_flavor", "flav720"), self.provider.calls)

    def test_preserve_views_off_leaves_the_default(self):
        service = make_service(preserve_views=False)
        media = import_media_entry(service, self.provider, "1_a")
        self.assertNotEqual(media.views, 1204)

    def test_skip_transcoding_off_runs_normal_encoding(self):
        service = make_service(skip_transcoding=False)
        with mock.patch("files.tasks.encode_media") as encode:
            import_media_entry(service, self.provider, "1_a")
        self.assertTrue(encode.apply_async.called)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_import_media.py -v`
Expected: FAIL — `ImportError: cannot import name 'import_media_entry'`

- [ ] **Step 3: Implement the media importer**

Add these imports at the top of `migrationservice/tasks.py`:

```python
import os
import tempfile
from datetime import datetime, timezone as dt_timezone

from django.core.files import File

from files import helpers
from files.models import EncodeProfile, Encoding, Media, Tag

from .providers.kaltura import media_state, match_flavors_to_profiles
```

and these functions:

```python
def pick_original_flavor(flavors):
    """The flavor to use as Media.media_file.

    Kaltura installations often purge the source flavor, so fall back to the
    tallest ready flavor and let the caller log the substitution.
    """
    flavors = flavors or []
    for flavor in flavors:
        if flavor.get("isOriginal"):
            return flavor
    playable = [flavor for flavor in flavors if (flavor.get("fileExt") or "").lower() in ("mp4", "webm")]
    if playable:
        return max(playable, key=lambda flavor: flavor.get("height") or 0)
    return flavors[0] if flavors else None


def get_or_import_category(service, provider, source_id):
    """The MediaCMS category for a source category id, importing it if needed"""
    row = MigrationRecord.objects.filter(
        service=service, object_type="category", source_id=str(source_id), status="success"
    ).first()
    if row and row.category_id:
        return row.category
    try:
        return import_category(service, provider, str(source_id))
    except Exception as exc:  # noqa: BLE001 - a bad category must not lose the media
        service.append_log(f"could not import category {source_id}: {exc}")
        return None


def create_encoding(media, profile, path):
    """Attach an already transcoded file to a media as a finished Encoding.

    Saved as pending first, because the Encoding post_save receiver only reacts
    to success and fail. The status is then flipped with a queryset update,
    which fires no signals at all. That is what keeps create_hls from being
    launched once per flavor.
    """
    encoding = Encoding(media=media, profile=profile, status="pending", progress=0)
    with open(path, "rb") as handle:
        encoding.media_file.save(content=File(handle), name=os.path.basename(path), save=False)
    encoding.save()
    Encoding.objects.filter(pk=encoding.pk).update(status="success", progress=100)
    encoding.refresh_from_db()
    return encoding


def finalise_encodings(media, encodings):
    """Set the media's encoding status and trigger HLS packaging exactly once"""
    h264 = next((encoding for encoding in encodings if encoding.profile.codec == "h264"), None)
    if h264:
        media.post_encode_actions(encoding=h264, action="add")
    else:
        media.set_encoding_status()
        media.save(update_fields=["encoding_status", "listable"])


def attach_flavor_encodings(service, provider, media, flavors, original, original_path, tmp_dir):
    """Download the transcoded flavors and attach them as MediaCMS encodings"""
    profiles = list(EncodeProfile.objects.filter(active=True))
    transcoded = [flavor for flavor in flavors if flavor.get("id") != (original or {}).get("id")]

    encodings = []
    for flavor, profile in match_flavors_to_profiles(transcoded, profiles):
        path = os.path.join(tmp_dir, f"{flavor['id']}.{profile.extension}")
        try:
            provider.download_flavor(flavor, path)
        except Exception as exc:  # noqa: BLE001 - one bad flavor must not lose the media
            service.append_log(f"media {media.friendly_token}: flavor {flavor['id']} failed: {exc}")
            continue
        encodings.append(create_encoding(media, profile, path))

    if not encodings:
        # Without at least one successful mp4 or webm encoding, set_encoding_status
        # leaves the media pending and listable stays false, which makes it
        # invisible. Fall back to the file already downloaded as the original.
        extension = os.path.splitext(original_path)[1].lstrip(".").lower()
        fallback = match_flavors_to_profiles(
            [{"id": "original", "height": media.video_height or 0, "fileExt": extension}], profiles
        )
        if fallback:
            service.append_log(f"media {media.friendly_token}: no usable flavors, using the original as its encoding")
            encodings.append(create_encoding(media, fallback[0][1], original_path))

    finalise_encodings(media, encodings)
    return encodings


def apply_entry_metadata(service, provider, media, data):
    """Second pass over a freshly created media: state, views, date, tags, categories.

    A second save is required because Media.save() overwrites state with the
    portal default on creation only.
    """
    options = service.get_options()
    entry = data.get("entry") or {}

    if options.get("preserve_views", True):
        media.views = entry.get("plays") or entry.get("views") or 0

    if entry.get("createdAt"):
        media.add_date = datetime.fromtimestamp(int(entry["createdAt"]), tz=dt_timezone.utc)

    if options.get("preserve_publish_state", True):
        privacies = [category.get("privacy") for category in (data.get("categories") or [])]
        media.state = media_state(privacies, entry.get("displayInSearch"))

    media.save()

    for raw_tag in (entry.get("tags") or "").split(","):
        title = helpers.get_alphanumeric_and_spaces(raw_tag).strip()[:100]
        if not title:
            continue
        tag, _created = Tag.objects.get_or_create(title=title, defaults={"user": media.user})
        media.tags.add(tag)

    if options.get("create_categories", True):
        for source_category in data.get("categories") or []:
            category = get_or_import_category(service, provider, str(source_category.get("id")))
            if category:
                media.category.add(category)


def import_media_entry(service, provider, source_id):
    """Import one source media entry into MediaCMS.

    Not wrapped in a transaction on purpose: this downloads gigabytes, and holding
    a database transaction open for that long is worse than the failure it would
    prevent. Instead the mapping row is written as soon as the Media exists, so a
    crash leaves a traceable row rather than an invisible orphan, and a retry
    discards the half built Media before starting again.
    """
    options = service.get_options()

    existing = MigrationRecord.objects.filter(
        service=service, object_type="media", source_id=str(source_id)
    ).first()
    if existing and existing.status == "success" and existing.media_id:
        return existing.media
    if existing and existing.media_id:
        service.append_log(f"entry {source_id}: discarding an incomplete media from an earlier attempt")
        existing.media.delete()

    data = provider.fetch_media(source_id)
    entry = data.get("entry") or {}
    flavors = data.get("flavors") or []

    owner = resolve_owner(service, provider, entry.get("userId") or entry.get("creatorId") or "")

    original = pick_original_flavor(flavors)
    if original is None:
        raise ValueError(f"entry {source_id} has no downloadable flavor")
    if not original.get("isOriginal"):
        service.append_log(f"entry {source_id}: no source flavor, using flavor {original.get('id')} as the original")

    with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as tmp_dir:
        extension = (original.get("fileExt") or "mp4").lower()
        original_path = os.path.join(tmp_dir, f"{source_id}.{extension}")
        provider.download_flavor(original, original_path)

        media = Media(
            user=owner,
            title=(entry.get("name") or source_id)[:100],
            description=entry.get("description") or "",
        )
        if options.get("skip_transcoding", True):
            media._do_not_transcode = True
        with open(original_path, "rb") as handle:
            media.media_file.save(content=File(handle), name=f"{source_id}.{extension}", save=False)
        media.save()

        # record before the slow part, so an interrupted import is traceable and
        # its half built Media can be cleaned up on retry instead of orphaned
        record(service, "media", source_id, "failed", "import started", target=media)

        if media.media_type == "video" and options.get("skip_transcoding", True):
            attach_flavor_encodings(service, provider, media, flavors, original, original_path, tmp_dir)

        # metadata last: applying the migrated state before the encodings exist
        # would briefly mark a public media listable with nothing to play
        apply_entry_metadata(service, provider, media, data)

    media.refresh_from_db()
    record(service, "media", source_id, "success", f"imported '{media.title}' as media {media.id}", target=media)
    return media
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_import_media.py -v`
Expected: PASS, 17 tests

- [ ] **Step 5: Commit**

```bash
git add migrationservice/tasks.py migrationservice/tests/test_import_media.py
git commit -m "feat(migrationservice): import media entries with flavors as encodings"
```

---

## Task 11: Importers — captions

**Files:**
- Modify: `migrationservice/tasks.py`
- Create: `migrationservice/tests/test_import_captions.py`, `migrationservice/tests/fixtures/sample.srt`
- Test: `migrationservice/tests/test_import_captions.py`

**Interfaces:**
- Consumes: `record` (Task 8), `import_media_entry` (Task 10).
- Produces in `migrationservice/tasks.py`:
  - `import_caption(service, provider, media, caption: dict, tmp_dir: str) -> Subtitle | None`
  - `report_transcripts(service, media, transcripts: list[dict]) -> None`

**Background:** MediaCMS `Subtitle` stores WebVTT and `Subtitle.convert_to_srt()` converts whatever was uploaded into WebVTT in place using `pysubs2` (the method name is misleading — read `files/models/subtitle.py`). MediaCMS ships no seeded `Language` rows, so languages are created on demand from Kaltura's language code. Kaltura's plain text transcripts are attachment assets, not caption assets; they have no home in the MediaCMS data model and are recorded as `skipped`.

- [ ] **Step 1: Create the fixture**

`migrationservice/tests/fixtures/sample.srt`:

```
1
00:00:00,000 --> 00:00:02,000
Welcome to the fourth lecture.

2
00:00:02,000 --> 00:00:05,000
Today we look at circuit analysis.
```

- [ ] **Step 2: Write the failing tests**

`migrationservice/tests/test_import_captions.py`:

```python
from django.test import TestCase

from files.models import Subtitle
from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.tasks import import_media_entry
from migrationservice.tests.fakes import FakeProvider

VIDEO = "fixtures/small_video.mp4"
CAPTION = "migrationservice/tests/fixtures/sample.srt"


def make_service(**options):
    defaults = {
        "create_users": True,
        "create_categories": True,
        "import_captions": True,
        "skip_transcoding": True,
        "fallback_username": "admin",
    }
    defaults.update(options)
    return MigrationService.objects.create(
        name="Kaltura production",
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "admin_secret": "x"},
        options=defaults,
    )


def make_provider(captions):
    provider = FakeProvider()
    provider.users = {"jdoe": {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "screenName": "", "roleName": ""}}
    provider.media = {
        "1_a": {
            "entry": {"id": "1_a", "name": "Lecture 4", "userId": "jdoe", "tags": ""},
            "flavors": [{"id": "source", "height": 720, "fileExt": "mp4", "isOriginal": True, "status": 2}],
            "captions": captions,
            "transcripts": [],
            "categories": [],
        }
    }
    provider.downloads = {"source": VIDEO, "cap1": CAPTION, "cap2": CAPTION}
    return provider


class TestImportCaptions(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.service = make_service()

    def test_a_caption_becomes_a_subtitle(self):
        provider = make_provider([{"id": "cap1", "languageCode": "da", "language": "Danish", "format": 1}])
        media = import_media_entry(self.service, provider, "1_a")
        subtitle = Subtitle.objects.get(media=media)
        self.assertEqual(subtitle.language.code, "da")
        self.assertEqual(subtitle.language.title, "Danish")

    def test_the_stored_file_is_webvtt(self):
        provider = make_provider([{"id": "cap1", "languageCode": "da", "language": "Danish", "format": 1}])
        media = import_media_entry(self.service, provider, "1_a")
        subtitle = Subtitle.objects.get(media=media)
        with open(subtitle.subtitle_file.path) as handle:
            self.assertTrue(handle.read().lstrip().startswith("WEBVTT"))

    def test_a_record_is_written_per_caption(self):
        provider = make_provider([{"id": "cap1", "languageCode": "da", "language": "Danish", "format": 1}])
        import_media_entry(self.service, provider, "1_a")
        row = MigrationRecord.objects.get(service=self.service, object_type="caption", source_id="cap1")
        self.assertEqual(row.status, "success")

    def test_two_captions_reuse_one_language_row(self):
        from files.models import Language

        provider = make_provider(
            [
                {"id": "cap1", "languageCode": "da", "language": "Danish", "format": 1},
                {"id": "cap2", "languageCode": "da", "language": "Danish", "format": 1},
            ]
        )
        media = import_media_entry(self.service, provider, "1_a")
        self.assertEqual(Subtitle.objects.filter(media=media).count(), 2)
        self.assertEqual(Language.objects.filter(code="da").count(), 1)

    def test_captions_off_skips_them_entirely(self):
        service = make_service(import_captions=False)
        provider = make_provider([{"id": "cap1", "languageCode": "da", "language": "Danish", "format": 1}])
        media = import_media_entry(service, provider, "1_a")
        self.assertEqual(Subtitle.objects.filter(media=media).count(), 0)

    def test_a_failing_caption_is_recorded_and_the_media_survives(self):
        provider = make_provider([{"id": "missing", "languageCode": "da", "language": "Danish", "format": 1}])
        media = import_media_entry(self.service, provider, "1_a")
        self.assertIsNotNone(media.id)
        row = MigrationRecord.objects.get(service=self.service, object_type="caption", source_id="missing")
        self.assertEqual(row.status, "failed")

    def test_a_caption_with_no_language_code_defaults_to_english(self):
        provider = make_provider([{"id": "cap1", "languageCode": "", "language": "", "format": 1}])
        media = import_media_entry(self.service, provider, "1_a")
        subtitle = Subtitle.objects.get(media=media)
        self.assertEqual(subtitle.language.code, "en")

    def test_a_plain_text_transcript_is_recorded_as_skipped(self):
        provider = make_provider([])
        provider.media["1_a"]["transcripts"] = [{"id": "att1", "fileExt": "txt"}]
        import_media_entry(self.service, provider, "1_a")
        row = MigrationRecord.objects.get(service=self.service, object_type="caption", source_id="att1")
        self.assertEqual(row.status, "skipped")
        self.assertIn("no MediaCMS equivalent", row.log)
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_import_captions.py -v`
Expected: FAIL — no `Subtitle` rows are created, because `import_media_entry` does not import captions yet.

- [ ] **Step 4: Implement the caption importer**

Add to the imports at the top of `migrationservice/tasks.py`:

```python
from files.models import Language, Subtitle
```

Add this function:

```python
def import_caption(service, provider, media, caption, tmp_dir):
    """Download one caption asset and attach it to a media as a WebVTT subtitle"""
    source_id = str(caption.get("id"))
    subtitle = None
    try:
        code = (caption.get("languageCode") or "en").strip() or "en"
        title = (caption.get("language") or code).strip() or code
        language, _created = Language.objects.get_or_create(code=code, defaults={"title": title})

        path = os.path.join(tmp_dir, f"caption-{source_id}.srt")
        provider.download_caption(caption, path)

        subtitle = Subtitle(media=media, language=language, user=media.user)
        with open(path, "rb") as handle:
            subtitle.subtitle_file.save(content=File(handle), name=f"{media.friendly_token}-{code}.srt", save=False)
        subtitle.save()
        # despite the name this converts the stored file to WebVTT in place
        subtitle.convert_to_srt()

        record(service, "caption", source_id, "success", f"attached {code} caption to media {media.id}", target=subtitle)
        service.bump_total("caption_migrated")
        return subtitle
    except Exception as exc:  # noqa: BLE001 - a bad caption must not lose the media
        if subtitle is not None and subtitle.pk:
            # the row exists but its file never became valid WebVTT. A broken
            # caption track attached to the media is worse than no caption, and
            # would otherwise contradict the failed record we are about to write.
            subtitle.delete()
        record(service, "caption", source_id, "failed", f"caption {source_id} failed: {exc}")
        service.bump_total("caption_failed")
        service.append_log(f"media {media.friendly_token}: caption {source_id} failed: {exc}")
        return None


def report_transcripts(service, media, transcripts):
    """Kaltura plain text transcripts have no home in the MediaCMS data model.

    They are recorded as skipped with a reason rather than silently dropped, so
    the mapping table shows what was left behind.
    """
    for transcript in transcripts or []:
        try:
            source_id = str(transcript.get("id"))
            record(
                service,
                "caption",
                source_id,
                "skipped",
                f"plain text transcript on media {media.id} has no MediaCMS equivalent",
            )
            service.bump_total("caption_skipped")
        except Exception as exc:  # noqa: BLE001 - reporting must never abort the import
            # this runs before apply_entry_metadata, so an escape here would leave
            # the media without its migrated state
            service.append_log(f"media {media.friendly_token}: could not report a transcript: {exc}")
```

Then, in `import_media_entry`, add the caption loop inside the `with tempfile.TemporaryDirectory(...)` block, immediately after the `attach_flavor_encodings` call:

```python
        if options.get("import_captions", True):
            for caption in data.get("captions") or []:
                import_caption(service, provider, media, caption, tmp_dir)
            report_transcripts(service, media, data.get("transcripts"))
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_import_captions.py migrationservice/tests/test_import_media.py -v`
Expected: PASS, 25 tests

- [ ] **Step 6: Commit**

```bash
git add migrationservice/tasks.py migrationservice/tests/test_import_captions.py migrationservice/tests/fixtures/sample.srt
git commit -m "feat(migrationservice): import Kaltura captions as WebVTT subtitles"
```

---

## Task 12: Orchestrator tasks

**Files:**
- Modify: `migrationservice/tasks.py`
- Create: `migrationservice/tests/test_orchestrator.py`
- Test: `migrationservice/tests/test_orchestrator.py`

**Interfaces:**
- Consumes: `import_user`, `import_category`, `import_media_entry`, `record` (Tasks 8–11), `get_provider` (Task 2).
- Produces in `migrationservice/tasks.py`:
  - Celery tasks `run_migration(service_id)`, `migrate_item(service_id, phase, source_id)`, `advance_migration(results, service_id, next_cursor)`
  - `start_migration(service)`, `pause_migration(service)`, `abort_migration(service)`, `finish_migration(service, status, message="")`
  - `next_phase(phase: str) -> str`, `first_enabled_phase(service, phase: str) -> str`
  - Constants `PHASES = ["users", "categories", "media"]`, `RECORD_TYPE`, `IMPORTERS`

**How the loop works:** `run_migration` fetches one page of ten source ids for the current phase, dispatches a `migrate_item` subtask per id inside a Celery `chord`, and makes `advance_migration` the chord callback. The callback stores the advanced cursor and re-queues `run_migration`. One page is in flight at a time, so the queue stays usable and no task approaches the two hour soft time limit. The cursor advances only after a page completes, so a crash mid-page replays that page — which is harmless, because every item checks the mapping table first.

**Pause** is a status flip. Each `migrate_item` re-reads the status with a single `values_list` before doing anything, so in-flight items finish and the callback declines to re-queue. Pause takes effect within one page.

**In tests** `CELERY_TASK_ALWAYS_EAGER` is on, so `start_migration` runs the entire migration synchronously before returning. Keep test data small.

- [ ] **Step 1: Write the failing tests**

`migrationservice/tests/test_orchestrator.py`:

```python
from unittest import mock

from django.test import TestCase

from files.models import Media
from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService
from migrationservice.tasks import abort_migration, pause_migration, start_migration
from migrationservice.tests.fakes import FakeProvider
from users.models import User

VIDEO = "fixtures/small_video.mp4"


def make_service(name="Kaltura production", **options):
    defaults = {
        "create_users": True,
        "create_categories": True,
        "map_permissions": True,
        "import_captions": False,
        "skip_transcoding": True,
        "fallback_username": "admin",
    }
    defaults.update(options)
    return MigrationService.objects.create(
        name=name,
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "admin_secret": "x", "kms_root_category": "MediaSpace"},
        options=defaults,
    )


def build_provider():
    provider = FakeProvider()
    provider.users = {
        "jdoe": {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "screenName": "", "roleName": ""},
        "asmith": {"id": "asmith", "email": "asmith@example.edu", "fullName": "A Smith", "screenName": "", "roleName": ""},
    }
    provider.categories = {
        "8812": {
            "id": "8812",
            "name": "Electronics",
            "fullName": "MediaSpace>site>galleries>Engineering>Electronics",
            "parentName": "Engineering",
            "privacy": 1,
            "owner": "",
            "members": [],
        }
    }
    provider.media = {}
    for source_id in ["1_a", "1_b"]:
        provider.media[source_id] = {
            "entry": {"id": source_id, "name": f"Lecture {source_id}", "userId": "jdoe", "tags": ""},
            "flavors": [{"id": f"src-{source_id}", "height": 720, "fileExt": "mp4", "isOriginal": True, "status": 2}],
            "captions": [],
            "categories": [{"id": "8812", "privacy": 1}],
        }
        provider.downloads[f"src-{source_id}"] = VIDEO
    return provider


class OrchestratorTestCase(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.provider = build_provider()
        self.patcher = mock.patch("migrationservice.tasks.get_provider", return_value=self.provider)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)


class TestFullRun(OrchestratorTestCase):
    def test_everything_is_imported_and_the_migration_succeeds(self):
        service = make_service()
        start_migration(service)
        service.refresh_from_db()

        self.assertEqual(service.status, "success")
        self.assertIsNotNone(service.started_at)
        self.assertIsNotNone(service.ended_at)
        self.assertEqual(Media.objects.count(), 2)
        self.assertEqual(MigrationRecord.objects.filter(service=service, object_type="media", status="success").count(), 2)
        self.assertEqual(MigrationRecord.objects.filter(service=service, object_type="user", status="success").count(), 2)
        self.assertEqual(MigrationRecord.objects.filter(service=service, object_type="category", status="success").count(), 1)

    def test_totals_are_counted(self):
        service = make_service()
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.totals.get("media_migrated"), 2)

    def test_disabled_phases_are_skipped(self):
        service = make_service(create_users=False, create_categories=False)
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.status, "success")
        self.assertEqual(MigrationRecord.objects.filter(service=service, object_type="user").count(), 0)
        self.assertEqual(MigrationRecord.objects.filter(service=service, object_type="category").count(), 0)
        self.assertEqual(Media.objects.count(), 2)

    def test_max_items_caps_the_media_phase(self):
        service = make_service(max_items=1)
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.status, "success")
        self.assertEqual(Media.objects.count(), 1)


class TestPauseAndResume(OrchestratorTestCase):
    def test_a_paused_migration_does_nothing(self):
        service = make_service()
        service.status = "paused"
        service.save(update_fields=["status"])
        from migrationservice.tasks import run_migration

        run_migration(service.pk)
        self.assertEqual(Media.objects.count(), 0)

    def test_pausing_during_the_media_phase_stops_after_the_current_item(self):
        service = make_service()

        def pause_after_first(svc, provider, source_id):
            from migrationservice.tasks import import_media_entry as real

            media = real(svc, provider, source_id)
            svc.refresh_from_db()
            if svc.status == "running":
                pause_migration(svc)
            return media

        with mock.patch("migrationservice.tasks.IMPORTERS", {"users": _noop, "categories": _noop, "media": pause_after_first}):
            start_migration(service)

        service.refresh_from_db()
        self.assertEqual(service.status, "paused")
        self.assertEqual(Media.objects.count(), 1)
        self.assertEqual(service.cursor.get("phase"), "media")

    def test_resuming_finishes_the_remaining_items(self):
        service = make_service()

        def pause_after_first(svc, provider, source_id):
            from migrationservice.tasks import import_media_entry as real

            media = real(svc, provider, source_id)
            svc.refresh_from_db()
            if svc.status == "running":
                pause_migration(svc)
            return media

        with mock.patch("migrationservice.tasks.IMPORTERS", {"users": _noop, "categories": _noop, "media": pause_after_first}):
            start_migration(service)

        service.refresh_from_db()
        start_migration(service)
        service.refresh_from_db()

        self.assertEqual(service.status, "success")
        self.assertEqual(Media.objects.count(), 2)

    def test_aborting_keeps_what_was_imported(self):
        service = make_service()
        start_migration(service)
        service.refresh_from_db()
        service.status = "running"
        service.save(update_fields=["status"])
        abort_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.status, "aborted")
        self.assertEqual(Media.objects.count(), 2)


def _noop(service, provider, source_id):
    return None


class TestIdempotency(OrchestratorTestCase):
    def test_running_the_same_migration_twice_imports_nothing_new(self):
        service = make_service()
        start_migration(service)
        service.refresh_from_db()

        service.cursor = {}
        service.status = "pending"
        service.save(update_fields=["cursor", "status"])
        start_migration(service)

        self.assertEqual(Media.objects.count(), 2)
        self.assertEqual(User.objects.filter(email="jdoe@example.edu").count(), 1)

    def test_a_second_migration_on_the_same_source_skips_what_exists(self):
        first = make_service(name="first pass")
        start_migration(first)

        second = make_service(name="second pass")
        start_migration(second)
        second.refresh_from_db()

        self.assertEqual(Media.objects.count(), 2)
        skipped = MigrationRecord.objects.filter(service=second, object_type="media", status="skipped")
        self.assertEqual(skipped.count(), 2)
        self.assertIn("first pass", skipped.first().log)

    def test_a_deleted_media_is_imported_again(self):
        first = make_service(name="first pass")
        start_migration(first)
        Media.objects.all().delete()

        second = make_service(name="second pass")
        start_migration(second)

        self.assertEqual(Media.objects.count(), 2)


class TestFailures(OrchestratorTestCase):
    def test_a_failing_item_is_recorded_and_the_run_continues(self):
        service = make_service()
        self.provider.media["1_a"]["flavors"] = []

        start_migration(service)
        service.refresh_from_db()

        self.assertEqual(service.status, "success")
        self.assertEqual(Media.objects.count(), 1)
        failed = MigrationRecord.objects.get(service=service, object_type="media", source_id="1_a")
        self.assertEqual(failed.status, "failed")
        self.assertIn("no downloadable flavor", failed.log)

    def test_a_failed_item_is_retried_on_a_rerun(self):
        service = make_service()
        self.provider.media["1_a"]["flavors"] = []
        start_migration(service)

        self.provider.media["1_a"]["flavors"] = [
            {"id": "src-1_a", "height": 720, "fileExt": "mp4", "isOriginal": True, "status": 2}
        ]
        service.refresh_from_db()
        service.cursor = {"phase": "media"}
        service.status = "pending"
        service.save(update_fields=["cursor", "status"])
        start_migration(service)

        self.assertEqual(Media.objects.count(), 2)
        row = MigrationRecord.objects.get(service=service, object_type="media", source_id="1_a")
        self.assertEqual(row.status, "success")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_orchestrator.py -v`
Expected: FAIL — `ImportError: cannot import name 'start_migration'`

- [ ] **Step 3: Implement the orchestrator**

Add to the imports at the top of `migrationservice/tasks.py`:

```python
from celery import chord
from celery import shared_task as task
from django.utils import timezone

from .models import MigrationService
from .providers import get_provider
```

Add at the bottom of `migrationservice/tasks.py`:

```python
PHASES = ["users", "categories", "media"]

# option that switches a phase off entirely
PHASE_OPTION = {"users": "create_users", "categories": "create_categories", "media": None}

RECORD_TYPE = {"users": "user", "categories": "category", "media": "media"}

IMPORTERS = {"users": import_user, "categories": import_category, "media": import_media_entry}


def next_phase(phase):
    """The phase after this one, or "done" """
    if phase not in PHASES:
        return "done"
    index = PHASES.index(phase)
    return PHASES[index + 1] if index + 1 < len(PHASES) else "done"


def first_enabled_phase(service, phase):
    """Advance past any phases the options switched off"""
    options = service.get_options()
    while phase != "done":
        option = PHASE_OPTION.get(phase)
        if option is None or options.get(option, True):
            return phase
        phase = next_phase(phase)
    return "done"


def _media_limit_reached(service):
    """Whether max_items has been hit. Applies to the media phase only."""
    max_items = service.get_options().get("max_items")
    if not max_items:
        return False
    handled = MigrationRecord.objects.filter(service=service, object_type="media").exclude(status="failed").count()
    return handled >= int(max_items)


# Every status transition below is a conditional queryset update rather than a
# read-then-save on a Python object. Two admins clicking Start at the same moment,
# or a Pause landing while the orchestrator is mid network call, would otherwise
# both pass their guard and the second write would silently win.
STARTABLE = ("pending", "paused", "error", "aborted")


def start_migration(service):
    """Move a migration into running and queue the orchestrator"""
    if service.status not in STARTABLE:
        raise ValueError(f"Cannot start a migration that is '{service.status}'")

    now = timezone.now()
    claimed = MigrationService.objects.filter(pk=service.pk, status__in=STARTABLE).update(
        status="running", ended_at=None, last_activity=now
    )
    if not claimed:
        # someone else won the race; do not dispatch a second orchestrator loop,
        # or two chords would race on one cursor
        service.refresh_from_db()
        raise ValueError(f"Migration is already '{service.status}'")

    MigrationService.objects.filter(pk=service.pk, started_at__isnull=True).update(started_at=now)
    service.refresh_from_db()
    service.append_log("migration started")

    result = run_migration.apply_async(args=[service.pk])
    MigrationService.objects.filter(pk=service.pk).update(task_id=str(result.id))
    return service


def pause_migration(service):
    """Ask a running migration to stop after the items already in flight"""
    paused = MigrationService.objects.filter(pk=service.pk, status="running").update(
        status="paused", last_activity=timezone.now()
    )
    service.refresh_from_db()
    if not paused:
        raise ValueError(f"Cannot pause a migration that is '{service.status}'")
    service.append_log("migration paused")
    return service


def abort_migration(service):
    """Stop for good, keeping the cursor and everything already imported"""
    aborted = MigrationService.objects.filter(pk=service.pk, status__in=("running", "paused")).update(
        status="aborted", ended_at=timezone.now(), last_activity=timezone.now()
    )
    service.refresh_from_db()
    if not aborted:
        raise ValueError(f"Cannot abort a migration that is '{service.status}'")
    service.append_log("migration aborted")
    return service


def finish_migration(service, status, message=""):
    """End a run, but never overwrite a stop the user asked for.

    The orchestrator can be mid network call when a pause or abort lands. Its
    in-memory copy still says running, so an unconditional save would silently
    discard the user's request.
    """
    finished = MigrationService.objects.filter(pk=service.pk, status="running").update(
        status=status, ended_at=timezone.now(), last_activity=timezone.now()
    )
    service.refresh_from_db()
    if not finished:
        service.append_log(f"not finishing as '{status}': status is already '{service.status}'")
        return service
    if message:
        service.append_log(message)
    return service


@task(name="run_migration", queue="long_tasks", soft_time_limit=60 * 30)
def run_migration(service_id):
    """Handle one page of the current phase, then hand off to the chord callback"""
    service = MigrationService.objects.filter(pk=service_id).first()
    if service is None or service.status != "running":
        return False

    cursor = dict(service.cursor or {})
    phase = first_enabled_phase(service, cursor.get("phase") or PHASES[0])
    if phase != cursor.get("phase"):
        # a phase was switched off, start the new one from the beginning
        cursor = {"phase": phase}

    if phase == "done":
        finish_migration(service, "success", "migration finished")
        return True

    if phase == "media" and _media_limit_reached(service):
        finish_migration(service, "success", "max_items reached, migration finished")
        return True

    provider = get_provider(service)
    page_size = getattr(settings, "MIGRATION_PAGE_SIZE", 10)

    try:
        source_ids, next_cursor = provider.list_page(phase, cursor, page_size)
    except Exception as exc:  # noqa: BLE001 - a listing failure ends the run, it is not per item
        logger.exception("migration %s: listing %s failed", service_id, phase)
        finish_migration(service, "error", f"could not list {phase}: {exc}")
        return False

    if phase == "media":
        max_items = service.get_options().get("max_items")
        if max_items:
            handled = MigrationRecord.objects.filter(service=service, object_type="media").exclude(status="failed").count()
            remaining = int(max_items) - handled
            if remaining <= 0:
                finish_migration(service, "success", "max_items reached, migration finished")
                return True
            if len(source_ids) > remaining:
                # trim so the cap is exact rather than rounded up to the page size.
                # the cursor will advance past the trimmed entries, which is fine:
                # max_items is a dry run cap and ends the migration.
                service.append_log(f"max_items: trimming this page to {remaining} entries")
                source_ids = source_ids[:remaining]

    if not source_ids:
        service.append_log(f"phase '{phase}' finished")
        service.cursor = {"phase": next_phase(phase)}
        service.save(update_fields=["cursor"])
        run_migration.apply_async(args=[service_id], countdown=1)
        return True

    next_cursor = dict(next_cursor or {})
    next_cursor["phase"] = phase

    service.append_log(f"phase '{phase}': handling {len(source_ids)} items")
    header = [migrate_item.s(service_id, phase, source_id) for source_id in source_ids]
    chord(header)(advance_migration.s(service_id, next_cursor))
    return True


@task(name="migrate_item", queue="long_tasks", soft_time_limit=60 * 60 * 2)
def migrate_item(service_id, phase, source_id):
    """Import one source object. Cheap status check first, so pause is responsive."""
    status = MigrationService.objects.filter(pk=service_id).values_list("status", flat=True).first()
    if status != "running":
        return "paused"

    service = MigrationService.objects.get(pk=service_id)
    object_type = RECORD_TYPE[phase]
    source_id = str(source_id)

    # already handled by this migration
    existing = MigrationRecord.objects.filter(service=service, object_type=object_type, source_id=source_id).first()
    if existing and existing.status in ("success", "skipped"):
        return "skipped"

    # already imported from the same source system by another migration.
    # checked before anything is downloaded, so a rerun costs list calls only
    other = MigrationRecord.already_migrated(service.source_system, object_type, source_id)
    if other is not None:
        record(service, object_type, source_id, "skipped", f"already migrated by '{other.service.name}'")
        service.bump_total(f"{object_type}_skipped")
        return "skipped"

    provider = get_provider(service)
    try:
        IMPORTERS[phase](service, provider, source_id)
        service.bump_total(f"{object_type}_migrated")
        return "ok"
    except Exception as exc:  # noqa: BLE001 - one bad item must not end the migration
        logger.exception("migration %s: %s %s failed", service_id, object_type, source_id)
        record(service, object_type, source_id, "failed", f"{type(exc).__name__}: {exc}")
        service.bump_total(f"{object_type}_failed")
        service.append_log(f"{object_type} {source_id} failed: {exc}")
        return "failed"


@task(name="advance_migration", queue="short_tasks")
def advance_migration(results, service_id, next_cursor):
    """Chord callback: store the advanced cursor and queue the next page"""
    service = MigrationService.objects.filter(pk=service_id).first()
    if service is None:
        return False

    if service.status != "running":
        # Do NOT advance the cursor. When a pause lands mid page, the items that
        # had not started yet returned early without importing anything. Advancing
        # would step the resume position past them and they would never be
        # imported at all. Leaving the cursor put replays the whole page on
        # resume, which is cheap: every importer is idempotent and returns early
        # for work already recorded.
        service.append_log(f"stopped after a page, status is '{service.status}'; the page will replay on resume")
        MigrationService.objects.filter(pk=service_id).update(last_activity=timezone.now())
        return False

    service.cursor = next_cursor
    service.last_activity = timezone.now()
    service.save(update_fields=["cursor", "last_activity"])

    run_migration.apply_async(args=[service_id], countdown=1)
    return True
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_orchestrator.py -v`
Expected: PASS, 12 tests

- [ ] **Step 5: Run the whole app suite**

Run: `pytest migrationservice/ -v`
Expected: PASS, all tests

- [ ] **Step 6: Commit**

```bash
git add migrationservice/tasks.py migrationservice/tests/test_orchestrator.py
git commit -m "feat(migrationservice): add resumable orchestrator with pause, resume and abort"
```

---

## Task 13: REST API

**Files:**
- Create: `migrationservice/serializers.py`, `migrationservice/views.py`, `migrationservice/urls.py`, `migrationservice/tests/test_api.py`
- Modify: `cms/urls.py`
- Test: `migrationservice/tests/test_api.py`

**Interfaces:**
- Consumes: models (Task 1), providers (Task 2), `start_migration`, `pause_migration`, `abort_migration` (Task 12).
- Produces:
  - `IsSuperUser` permission class
  - `MigrationServiceSerializer`, `MigrationRecordSerializer`
  - `MigrationServiceViewSet` with actions `check_connection` (detail and list), `start`, `pause`, `resume`, `abort`, `records`, `progress`
  - URL namespace mounted at `/api/v1/migrations/`

**Secret handling:** secrets are never returned. Reads show `"••••••••"` for any key in the provider's `secret_keys` that has a stored value. If a write sends that mask back, the stored value is kept — that is how the edit form can be saved without retyping the secret.

- [ ] **Step 1: Write the failing tests**

`migrationservice/tests/test_api.py`:

```python
import json
from unittest import mock

from django.test import Client, TestCase

from files.tests import create_account
from migrationservice.models import MigrationRecord, MigrationService

API = "/api/v1/migrations/"

CONNECTION = {
    "service_url": "https://kaltura.example.edu",
    "partner_id": "342",
    "admin_secret": "the-secret",
    "kms_root_category": "MediaSpace",
}


class ApiTestCase(TestCase):
    def setUp(self):
        self.password = "this_is_a_fake_password"
        self.admin = create_account(username="admin", password=self.password, is_superuser=True)
        self.editor = create_account(username="editor", password=self.password, is_editor=True)
        self.client = Client()

    def login(self, user):
        self.client.login(username=user.username, password=self.password)

    def make_service(self, **kwargs):
        defaults = {"name": "Kaltura production", "provider": "kaltura", "connection": dict(CONNECTION)}
        defaults.update(kwargs)
        return MigrationService.objects.create(**defaults)


class TestPermissions(ApiTestCase):
    def test_anonymous_is_rejected(self):
        self.assertIn(self.client.get(API).status_code, [401, 403])

    def test_an_editor_is_rejected(self):
        self.login(self.editor)
        self.assertEqual(self.client.get(API).status_code, 403)

    def test_a_superuser_is_allowed(self):
        self.login(self.admin)
        self.assertEqual(self.client.get(API).status_code, 200)


class TestCrud(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.login(self.admin)

    def test_create(self):
        payload = {"name": "Kaltura production", "provider": "kaltura", "connection": CONNECTION, "options": {"create_users": False}}
        response = self.client.post(API, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 201)
        service = MigrationService.objects.get(pk=response.json()["id"])
        self.assertEqual(service.get_connection()["admin_secret"], "the-secret")
        self.assertEqual(service.status, "pending")

    def test_the_secret_is_masked_on_read(self):
        service = self.make_service()
        response = self.client.get(f"{API}{service.pk}/")
        self.assertEqual(response.json()["connection"]["admin_secret"], "••••••••")
        self.assertEqual(response.json()["connection"]["partner_id"], "342")

    def test_saving_the_mask_back_keeps_the_stored_secret(self):
        service = self.make_service()
        payload = {"name": "Renamed", "provider": "kaltura", "connection": dict(CONNECTION, admin_secret="••••••••")}
        response = self.client.put(f"{API}{service.pk}/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        service.refresh_from_db()
        self.assertEqual(service.get_connection()["admin_secret"], "the-secret")
        self.assertEqual(service.name, "Renamed")

    def test_a_missing_required_connection_key_is_rejected(self):
        payload = {"name": "Broken", "provider": "kaltura", "connection": {"service_url": "https://x.example.edu"}}
        response = self.client.post(API, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("partner_id", json.dumps(response.json()))

    def test_an_unknown_option_is_rejected(self):
        payload = {"name": "Broken", "provider": "kaltura", "connection": CONNECTION, "options": {"delete_everything": True}}
        response = self.client.post(API, data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 400)


class TestConnectionCheck(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.login(self.admin)

    def test_checks_an_unsaved_payload(self):
        payload = {"provider": "kaltura", "connection": CONNECTION}
        stats = {"ok": True, "error": "", "stats": {"entries": 11960, "users": 214, "categories": 87}}
        with mock.patch("migrationservice.providers.kaltura.KalturaProvider.check_connection", return_value=stats):
            response = self.client.post(f"{API}check_connection/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["stats"]["entries"], 11960)

    def test_checks_a_saved_migration(self):
        service = self.make_service()
        stats = {"ok": True, "error": "", "stats": {"entries": 5}}
        with mock.patch("migrationservice.providers.kaltura.KalturaProvider.check_connection", return_value=stats):
            response = self.client.post(f"{API}{service.pk}/check_connection/", data="{}", content_type="application/json")
        self.assertEqual(response.json()["ok"], True)

    def test_an_unimplemented_provider_reports_instead_of_raising(self):
        payload = {"provider": "panopto", "connection": {"service_url": "https://x", "client_id": "a", "client_secret": "b"}}
        response = self.client.post(f"{API}check_connection/", data=json.dumps(payload), content_type="application/json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["ok"])
        self.assertIn("not implemented", response.json()["error"].lower())


class TestControls(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.login(self.admin)

    def test_start_moves_to_running(self):
        service = self.make_service()
        with mock.patch("migrationservice.views.start_migration") as start:
            response = self.client.post(f"{API}{service.pk}/start/")
        self.assertEqual(response.status_code, 200)
        start.assert_called_once()

    def test_pause_from_running(self):
        service = self.make_service(status="running")
        response = self.client.post(f"{API}{service.pk}/pause/")
        self.assertEqual(response.status_code, 200)
        service.refresh_from_db()
        self.assertEqual(service.status, "paused")

    def test_pausing_something_not_running_is_a_conflict(self):
        service = self.make_service(status="pending")
        response = self.client.post(f"{API}{service.pk}/pause/")
        self.assertEqual(response.status_code, 409)

    def test_abort_from_paused(self):
        service = self.make_service(status="paused")
        response = self.client.post(f"{API}{service.pk}/abort/")
        self.assertEqual(response.status_code, 200)
        service.refresh_from_db()
        self.assertEqual(service.status, "aborted")


class TestRecordsAndProgress(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.login(self.admin)
        self.service = self.make_service(status="running", totals={"media_migrated": 7, "media_failed": 1})
        MigrationRecord.objects.create(service=self.service, object_type="media", source_id="1_a", status="success", log="ok", target_id=1)
        MigrationRecord.objects.create(service=self.service, object_type="media", source_id="1_b", status="failed", log="boom")
        MigrationRecord.objects.create(service=self.service, object_type="user", source_id="jdoe", status="success", target_id=2)

    def test_records_are_listed(self):
        response = self.client.get(f"{API}{self.service.pk}/records/")
        self.assertEqual(response.json()["count"], 3)

    def test_records_filter_by_status(self):
        response = self.client.get(f"{API}{self.service.pk}/records/?status=failed")
        self.assertEqual(response.json()["count"], 1)
        self.assertEqual(response.json()["results"][0]["source_id"], "1_b")

    def test_records_filter_by_type(self):
        response = self.client.get(f"{API}{self.service.pk}/records/?object_type=user")
        self.assertEqual(response.json()["count"], 1)

    def test_progress_is_small_and_useful(self):
        response = self.client.get(f"{API}{self.service.pk}/progress/")
        body = response.json()
        self.assertEqual(body["status"], "running")
        self.assertEqual(body["totals"]["media_migrated"], 7)
        self.assertIn("log", body)
        self.assertNotIn("connection", body)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_api.py -v`
Expected: FAIL — 404 on every request, the URLs do not exist

- [ ] **Step 3: Write the serializers**

`migrationservice/serializers.py`:

```python
from rest_framework import serializers

from .models import MigrationRecord, MigrationService
from .providers import get_provider_class

SECRET_MASK = "••••••••"


class MigrationServiceSerializer(serializers.ModelSerializer):
    connection = serializers.DictField()
    options = serializers.DictField(required=False)

    class Meta:
        model = MigrationService
        fields = [
            "id",
            "name",
            "provider",
            "connection",
            "options",
            "status",
            "totals",
            "created_at",
            "started_at",
            "ended_at",
            "last_activity",
        ]
        read_only_fields = ["status", "totals", "created_at", "started_at", "ended_at", "last_activity"]

    def validate(self, attrs):
        provider = attrs.get("provider") or getattr(self.instance, "provider", None) or "kaltura"
        try:
            klass = get_provider_class(provider)
        except ValueError as exc:
            raise serializers.ValidationError({"provider": str(exc)})

        connection = attrs.get("connection")
        if connection is not None:
            connection = dict(connection)
            stored = self.instance.connection if self.instance else {}
            for key in klass.secret_keys:
                # the form sends the mask back when the secret was not retyped
                if connection.get(key) == SECRET_MASK:
                    if stored.get(key):
                        connection[key] = stored[key]
                    else:
                        # nothing stored to fall back on: storing the placeholder
                        # itself would fail authentication later with a baffling error
                        raise serializers.ValidationError(
                            {"connection": f"'{key}' was submitted as the placeholder; enter the real value."}
                        )
            missing = [key for key in klass.required_connection_keys if not str(connection.get(key) or "").strip()]
            if missing:
                raise serializers.ValidationError({"connection": f"Missing required fields: {', '.join(missing)}"})
            attrs["connection"] = connection

        options = attrs.get("options")
        if options is not None:
            unknown = sorted(set(options) - set(klass.default_options))
            if unknown:
                raise serializers.ValidationError({"options": f"Unknown options: {', '.join(unknown)}"})

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        klass = get_provider_class(instance.provider)
        connection = dict(data.get("connection") or {})
        for key in klass.secret_keys:
            if connection.get(key):
                connection[key] = SECRET_MASK
        data["connection"] = connection
        data["options"] = instance.get_options()
        return data


class MigrationRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MigrationRecord
        fields = ["id", "object_type", "source_id", "target_id", "status", "log", "created_at"]
        read_only_fields = fields
```

- [ ] **Step 4: Write the views**

`migrationservice/views.py`:

```python
from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect
from django.shortcuts import render
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import MigrationRecord, MigrationService
from .providers import get_provider, get_provider_class
from .serializers import MigrationRecordSerializer, MigrationServiceSerializer
from .tasks import abort_migration, pause_migration, start_migration

LOG_TAIL_LINES = 50
LOG_LINE_MAX = 500


class IsSuperUser(permissions.BasePermission):
    """Migrations create users, categories and media in bulk. Admins only."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


class MigrationServiceViewSet(viewsets.ModelViewSet):
    queryset = MigrationService.objects.all()
    serializer_class = MigrationServiceSerializer
    permission_classes = (IsSuperUser,)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["post"], url_path="check_connection")
    def check_unsaved_connection(self, request):
        """Validate credentials typed into the form before anything is saved"""
        provider_name = request.data.get("provider") or "kaltura"
        connection = request.data.get("connection") or {}
        try:
            klass = get_provider_class(provider_name)
        except ValueError as exc:
            return Response({"ok": False, "error": str(exc), "stats": {}})
        return Response(self._check(klass(connection, {})))

    @action(detail=True, methods=["post"], url_path="check_connection")
    def check_connection(self, request, pk=None):
        return Response(self._check(get_provider(self.get_object())))

    @staticmethod
    def _check(provider):
        try:
            return provider.check_connection()
        except NotImplementedError as exc:
            return {"ok": False, "error": str(exc), "stats": {}}
        except Exception as exc:  # noqa: BLE001 - the button must always answer
            return {"ok": False, "error": f"{type(exc).__name__}: {exc}", "stats": {}}

    def _transition(self, function):
        service = self.get_object()
        try:
            function(service)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_409_CONFLICT)
        service.refresh_from_db()
        return Response(MigrationServiceSerializer(service).data)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        return self._transition(start_migration)

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        return self._transition(start_migration)

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        return self._transition(pause_migration)

    @action(detail=True, methods=["post"])
    def abort(self, request, pk=None):
        return self._transition(abort_migration)

    @action(detail=True, methods=["get"])
    def records(self, request, pk=None):
        service = self.get_object()
        records = MigrationRecord.objects.filter(service=service)
        object_type = request.query_params.get("object_type")
        if object_type:
            records = records.filter(object_type=object_type)
        record_status = request.query_params.get("status")
        if record_status:
            records = records.filter(status=record_status)

        page = self.paginate_queryset(records)
        serializer = MigrationRecordSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(detail=True, methods=["get"])
    def progress(self, request, pk=None):
        """Small payload for the dashboard's poll. Never includes credentials."""
        service = self.get_object()
        log_lines = [line[:LOG_LINE_MAX] for line in (service.log or "").strip().split("\n")]
        return Response(
            {
                "id": service.pk,
                "status": service.status,
                "totals": service.totals or {},
                "cursor_phase": (service.cursor or {}).get("phase") or "",
                "started_at": service.started_at,
                "ended_at": service.ended_at,
                "last_activity": service.last_activity,
                "log": log_lines[-LOG_TAIL_LINES:],
            }
        )


@login_required
def migrations_list(request):
    """Migrations listing page"""
    if not request.user.is_superuser:
        return HttpResponseRedirect("/")
    return render(request, "cms/migrations.html", {})


@login_required
def migration_edit(request):
    """Migration create and settings page"""
    if not request.user.is_superuser:
        return HttpResponseRedirect("/")
    return render(request, "cms/migration_edit.html", {})


@login_required
def migration_detail(request, pk):
    """Running migration dashboard"""
    if not request.user.is_superuser:
        return HttpResponseRedirect("/")
    return render(request, "cms/migration_detail.html", {"migration_id": pk})
```

- [ ] **Step 5: Write the URLs**

`migrationservice/urls.py`:

```python
from django.urls import path, re_path
from rest_framework.routers import SimpleRouter

from . import views

# SimpleRouter, not DefaultRouter: this module is included at the site root, so
# DefaultRouter's auto generated api-root view would be mounted at "/" itself,
# outside this app's permission class.
router = SimpleRouter()
router.register(r"api/v1/migrations", views.MigrationServiceViewSet, basename="migrations")

urlpatterns = router.urls + [
    re_path(r"^migrations$", views.migrations_list, name="migrations_list"),
    re_path(r"^migrations/new$", views.migration_edit, name="migration_new"),
    path("migrations/<int:pk>/edit", views.migration_edit, name="migration_edit"),
    path("migrations/<int:pk>", views.migration_detail, name="migration_detail"),
]
```

In `cms/urls.py`, add the include **immediately before** the `files.urls` line:

```python
    re_path(r"^", include("migrationservice.urls")),
    re_path(r"^", include("files.urls")),
```

Order matters. `files/urls.py` ends with a catch-all page-slug pattern,
`re_path(r"^(?P<slug>[\w.-]*)$", views.get_page)`, which matches any single
segment path — including `migrations`. Included after it, `/migrations` never
reaches this app: it resolves to `files.views.pages.get_page`, a public view that
renders a 404 page with HTTP 200, so the feature's landing page is both broken
and unauthenticated. The trade-off is that a MediaCMS Page with the slug
`migrations` becomes unreachable, which is the right way round.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_api.py -v`
Expected: PASS, 18 tests

- [ ] **Step 7: Commit**

```bash
git add migrationservice/serializers.py migrationservice/views.py migrationservice/urls.py migrationservice/tests/test_api.py cms/urls.py
git commit -m "feat(migrationservice): add admin only REST API"
```

---

## Task 14: Page templates and config wiring

**Files:**
- Create: `templates/cms/migrations.html`, `templates/cms/migration_edit.html`, `templates/cms/migration_detail.html`
- Modify: `templates/config/core/url.html`, `templates/config/core/api.html`
- Create: `migrationservice/tests/test_pages.py`
- Test: `migrationservice/tests/test_pages.py`

**Interfaces:**
- Consumes: page views from Task 13.
- Produces: three rendered pages that mount React containers `#page-migrations`, `#page-migration-edit`, `#page-migration-detail`, and `MediaCMS.url.migrations` / `MediaCMS.api.migrations` for admins.

- [ ] **Step 1: Write the failing tests**

`migrationservice/tests/test_pages.py`:

```python
from django.test import Client, TestCase

from files.tests import create_account


class TestMigrationPages(TestCase):
    def setUp(self):
        self.password = "this_is_a_fake_password"
        self.admin = create_account(username="admin", password=self.password, is_superuser=True)
        self.editor = create_account(username="editor", password=self.password, is_editor=True)
        self.client = Client()

    def test_admin_sees_the_list_page(self):
        self.client.login(username="admin", password=self.password)
        response = self.client.get("/migrations")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "page-migrations")

    def test_admin_sees_the_edit_page(self):
        self.client.login(username="admin", password=self.password)
        response = self.client.get("/migrations/new")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "page-migration-edit")

    def test_admin_sees_the_detail_page(self):
        self.client.login(username="admin", password=self.password)
        response = self.client.get("/migrations/1")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "page-migration-detail")

    def test_a_non_admin_is_redirected(self):
        self.client.login(username="editor", password=self.password)
        self.assertEqual(self.client.get("/migrations").status_code, 302)

    def test_anonymous_is_redirected_to_login(self):
        self.assertEqual(self.client.get("/migrations").status_code, 302)

    def test_the_migrations_url_is_exposed_to_admins_only(self):
        self.client.login(username="admin", password=self.password)
        self.assertContains(self.client.get("/"), "migrations:")
        self.client.logout()
        self.client.login(username="editor", password=self.password)
        self.assertNotContains(self.client.get("/"), "migrations:")
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_pages.py -v`
Expected: FAIL — `TemplateDoesNotExist: cms/migrations.html`

- [ ] **Step 3: Write the templates**

`templates/cms/migrations.html`:

```html
{% extends "base.html" %}
{% load static %}

{% block headtitle %}Migrations - {{PORTAL_NAME}}{% endblock headtitle %}

{% block content %}
<div id="page-migrations"></div>
{% endblock %}

{% block bottomimports %}
    <script src="{% static "js/migrations.js" %}?v={{ VERSION }}"></script>
{% endblock bottomimports %}
```

`templates/cms/migration_edit.html`:

```html
{% extends "base.html" %}
{% load static %}

{% block headtitle %}Migration settings - {{PORTAL_NAME}}{% endblock headtitle %}

{% block content %}
<div id="page-migration-edit"></div>
{% endblock %}

{% block bottomimports %}
    <script src="{% static "js/migration-edit.js" %}?v={{ VERSION }}"></script>
{% endblock bottomimports %}
```

`templates/cms/migration_detail.html`:

```html
{% extends "base.html" %}
{% load static %}

{% block headtitle %}Migration - {{PORTAL_NAME}}{% endblock headtitle %}

{% block content %}
<script>
window.MIGRATION_ID = {{ migration_id }};
</script>
<div id="page-migration-detail"></div>
{% endblock %}

{% block bottomimports %}
    <script src="{% static "js/migration-detail.js" %}?v={{ VERSION }}"></script>
{% endblock bottomimports %}
```

- [ ] **Step 4: Expose the URLs and API endpoint to the frontend**

In `templates/config/core/url.html`, add directly below the existing admin line:

```html
    {% if IS_MEDIACMS_ADMIN %}migrations: "/migrations",{% endif %}
```

In `templates/config/core/api.html`, add below the existing manage lines:

```html
    {% if IS_MEDIACMS_ADMIN %}migrations: '/migrations',{% endif %}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_pages.py -v`
Expected: PASS, 6 tests

Note: `test_admin_sees_the_list_page` will pass even though `js/migrations.js` does not exist yet — Django's `static` tag does not check the filesystem in this configuration. The bundles arrive when the maintainer runs `make build-frontend` after Tasks 15–17.

- [ ] **Step 6: Commit**

```bash
git add templates/cms/migrations.html templates/cms/migration_edit.html templates/cms/migration_detail.html templates/config/core/url.html templates/config/core/api.html migrationservice/tests/test_pages.py
git commit -m "feat(migrationservice): add page templates and frontend config wiring"
```

---

## Task 15: Frontend wiring and the migrations list page

**Files:**
- Create: `frontend/src/static/js/utils/api/migrations.js`, `frontend/src/static/js/pages/MigrationsPage.js`
- Modify: `frontend/config/mediacms.config.pages.js`, `frontend/src/templates/config/core/url.config.js`, `frontend/src/templates/config/core/api.config.js`, `frontend/src/static/js/utils/settings/url.js` (no change needed, verify only), `frontend/src/static/js/utils/settings/config.js`, `frontend/src/static/js/utils/settings/api.js`, `frontend/src/static/js/utils/contexts/HeaderContext.js`, `frontend/src/static/js/pages/index.ts`

**Interfaces:**
- Consumes: the API from Task 13.
- Produces in `frontend/src/static/js/utils/api/migrations.js`:
  - `listMigrations()`, `getMigration(id)`, `createMigration(payload)`, `updateMigration(id, payload)`, `deleteMigration(id)`
  - `checkConnection(payload)`, `checkSavedConnection(id)`
  - `controlMigration(id, action)` where action is one of `start`, `pause`, `resume`, `abort`
  - `getProgress(id)`, `getRecords(id, params)`
- Produces `MigrationsPage` exported from `pages/index.ts`

**Do not run `make build-frontend`.** The maintainer runs it.

- [ ] **Step 1: Add the page entries to the build config**

In `frontend/config/mediacms.config.pages.js`, add after the `'manage-comments'` entry:

```javascript
  migrations: { id: 'migrations', title: 'Migrations', component: 'MigrationsPage' },
  'migration-edit': { id: 'migration-edit', title: 'Migration settings', component: 'MigrationEditPage' },
  'migration-detail': { id: 'migration-detail', title: 'Migration', component: 'MigrationDetailPage' },
```

- [ ] **Step 2: Add the URL and API endpoint to the frontend config**

In `frontend/src/templates/config/core/url.config.js`, add after the `admin` line:

```javascript
  migrations: './migrations.html',
```

In `frontend/src/templates/config/core/api.config.js`, add after `manage_comments`:

```javascript
  migrations: '/migrations',
```

In `frontend/src/static/js/utils/settings/config.js`, inside the `url.init({...})` call, add after the `admin` line:

```javascript
    migrations: !glbl.user.is.anonymous && glbl.user.is.admin ? glbl.url.migrations : '',
```

In `frontend/src/static/js/utils/settings/api.js`, inside the object passed to `formatEndpoints`, add after the `manage` block:

```javascript
    migrations: endpoints.migrations,
```

- [ ] **Step 3: Add the header menu item**

In `frontend/src/static/js/utils/contexts/HeaderContext.js`, in `popupBottomNavItems()`, add a second item after the administration one so it renders directly below it:

```javascript
function popupBottomNavItems() {
  const items = [];

  if (user.is.admin) {
    items.push({
      link: links.admin,
      icon: 'admin_panel_settings',
      text: 'MediaCMS administration',
    });

    if (links.migrations) {
      items.push({
        link: links.migrations,
        icon: 'swap_horiz',
        text: 'Migrations',
      });
    }
  }

  return items;
}
```

- [ ] **Step 4: Write the API helper**

`frontend/src/static/js/utils/api/migrations.js`:

```javascript
import axios from 'axios';
import { csrfToken } from '../helpers/';
import { config as mediacmsConfig } from '../settings/config.js';

function baseUrl() {
  return mediacmsConfig(window.MediaCMS).api.migrations;
}

function postConfig() {
  return { headers: { 'X-CSRFToken': csrfToken() } };
}

export function listMigrations() {
  return axios.get(baseUrl() + '/');
}

export function getMigration(id) {
  return axios.get(baseUrl() + '/' + id + '/');
}

export function createMigration(payload) {
  return axios.post(baseUrl() + '/', payload, postConfig());
}

export function updateMigration(id, payload) {
  return axios.put(baseUrl() + '/' + id + '/', payload, postConfig());
}

export function deleteMigration(id) {
  return axios.delete(baseUrl() + '/' + id + '/', postConfig());
}

export function checkConnection(payload) {
  return axios.post(baseUrl() + '/check_connection/', payload, postConfig());
}

export function checkSavedConnection(id) {
  return axios.post(baseUrl() + '/' + id + '/check_connection/', {}, postConfig());
}

export function controlMigration(id, action) {
  return axios.post(baseUrl() + '/' + id + '/' + action + '/', {}, postConfig());
}

export function getProgress(id) {
  return axios.get(baseUrl() + '/' + id + '/progress/');
}

export function getRecords(id, params) {
  return axios.get(baseUrl() + '/' + id + '/records/', { params: params || {} });
}
```

- [ ] **Step 5: Write the list page**

`frontend/src/static/js/pages/MigrationsPage.js`:

```javascript
import React from 'react';
import { Page } from './_Page';
import { listMigrations, controlMigration } from '../utils/api/migrations.js';

const STATUS_LABELS = {
  pending: 'Draft',
  running: 'Running',
  paused: 'Paused',
  error: 'Error',
  success: 'Completed',
  aborted: 'Aborted',
};

function migrationProgress(migration) {
  const totals = migration.totals || {};
  const migrated = totals.media_migrated || 0;
  const skipped = totals.media_skipped || 0;
  const failed = totals.media_failed || 0;
  const discovered = totals.media_discovered || 0;
  const handled = migrated + skipped + failed;
  const percent = discovered ? Math.min(100, Math.round((handled / discovered) * 100)) : 0;
  return { handled, discovered, failed, percent };
}

function primaryAction(status) {
  if ('running' === status) return { action: 'pause', label: 'Pause' };
  if ('paused' === status) return { action: 'resume', label: 'Resume' };
  return null;
}

export class MigrationsPage extends Page {
  constructor(props) {
    super(props, 'migrations');
    this.state = { migrations: [], loading: true, error: null };
    this.load = this.load.bind(this);
    this.onControlClick = this.onControlClick.bind(this);
  }

  componentDidMount() {
    this.load();
    this.timer = setInterval(this.load, 10000);
  }

  componentWillUnmount() {
    this.unmounted = true;
    clearInterval(this.timer);
  }

  safeSetState(state) {
    // a poll or a control request can land after the user has navigated away
    if (!this.unmounted) {
      this.setState(state);
    }
  }

  load() {
    listMigrations()
      .then((response) => {
        const data = response.data;
        this.safeSetState({ migrations: data.results || data, loading: false, error: null });
      })
      .catch(() => this.safeSetState({ loading: false, error: 'Could not load migrations' }));
  }

  onControlClick(id, action) {
    controlMigration(id, action)
      .then(this.load)
      .catch((error) => {
        const detail = error.response && error.response.data && error.response.data.detail;
        this.safeSetState({ error: detail || 'Action failed' });
      });
  }

  renderRow(migration) {
    const progress = migrationProgress(migration);
    const action = primaryAction(migration.status);
    const connection = migration.connection || {};
    const source = migration.provider + (connection.partner_id ? ' · partner ' + connection.partner_id : '');

    return (
      <div className="migrations-row" key={migration.id}>
        <div className="migrations-name">
          <a href={'/migrations/' + migration.id}>{migration.name}</a>
          <span className="migrations-source">{source}</span>
        </div>
        <div className="migrations-status">
          <span className={'migrations-badge migrations-badge--' + migration.status}>
            {STATUS_LABELS[migration.status] || migration.status}
          </span>
        </div>
        <div className="migrations-progress">
          {progress.discovered ? (
            <>
              <div className="migrations-bar">
                <div className="migrations-bar-fill" style={{ width: progress.percent + '%' }} />
              </div>
              <span>
                {progress.handled} / {progress.discovered} items
                {progress.failed ? ' · ' + progress.failed + ' errors' : ''}
              </span>
            </>
          ) : (
            <span>Not started — configuration saved</span>
          )}
        </div>
        <div className="migrations-activity">{migration.last_activity || '—'}</div>
        <div className="migrations-actions">
          {action ? (
            <button onClick={() => this.onControlClick(migration.id, action.action)}>{action.label}</button>
          ) : (
            <a href={'/migrations/' + migration.id + '/edit'}>Edit</a>
          )}
        </div>
      </div>
    );
  }

  pageContent() {
    const { migrations, loading, error } = this.state;

    return (
      <div className="migrations-page">
        <div className="migrations-header">
          <h1>Migrations</h1>
          <a className="migrations-new" href="/migrations/new">
            New migration
          </a>
        </div>

        {error ? <p className="migrations-error">{error}</p> : null}
        {loading ? <p>Loading…</p> : null}
        {!loading && !migrations.length ? <p>No migrations yet.</p> : null}

        <div className="migrations-table">
          <div className="migrations-row migrations-row--head">
            <div>Name / source</div>
            <div>Status</div>
            <div>Progress</div>
            <div>Last activity</div>
            <div />
          </div>
          {migrations.map((migration) => this.renderRow(migration))}
        </div>
      </div>
    );
  }
}
```

- [ ] **Step 6: Export the page**

In `frontend/src/static/js/pages/index.ts`, add in alphabetical position:

```typescript
export * from './MigrationsPage';
```

- [ ] **Step 7: Verify the config is syntactically valid**

Run: `node -e "require('./frontend/config/mediacms.config.pages.js'); console.log('pages config ok')"`
Expected: `pages config ok`

Run: `node -e "require('./frontend/src/templates/config/core/url.config.js'); require('./frontend/src/templates/config/core/api.config.js'); console.log('url and api config ok')"`
Expected: `url and api config ok`

- [ ] **Step 8: Commit**

```bash
git add frontend/config/mediacms.config.pages.js frontend/src/templates/config/core frontend/src/static/js/utils frontend/src/static/js/pages/MigrationsPage.js frontend/src/static/js/pages/index.ts
git commit -m "feat(frontend): add migrations listing page and config wiring"
```

---

## Task 16: Migration settings page

**Files:**
- Create: `frontend/src/static/js/pages/MigrationEditPage.js`
- Modify: `frontend/src/static/js/pages/index.ts`

**Interfaces:**
- Consumes: `createMigration`, `updateMigration`, `checkConnection`, `controlMigration` from Task 15.
- Produces: `MigrationEditPage` exported from `pages/index.ts`.

**Behaviour:** provider picker with Kaltura selected and Panopto / YouTube shown as not yet available; connection fields; a Test connection button that reports the discovered totals inline; the import options; and two save buttons — save draft, and save then start.

- [ ] **Step 1: Write the page**

`frontend/src/static/js/pages/MigrationEditPage.js`:

```javascript
import React from 'react';
import { Page } from './_Page';
import {
  createMigration,
  updateMigration,
  getMigration,
  checkConnection,
  controlMigration,
} from '../utils/api/migrations.js';

const PROVIDERS = [
  { id: 'kaltura', label: 'Kaltura', available: true },
  { id: 'panopto', label: 'Panopto', available: false },
  { id: 'youtube', label: 'YouTube', available: false },
];

const PLACEHOLDER_TEXT = {
  panopto: 'Panopto migration is not implemented yet. Kaltura is the only source available today.',
  youtube: 'YouTube migration is not implemented yet. Kaltura is the only source available today.',
};

const CONNECTION_FIELDS = {
  kaltura: [
    { key: 'service_url', label: 'Service URL', type: 'text' },
    { key: 'partner_id', label: 'Partner ID', type: 'text' },
    { key: 'admin_secret', label: 'Admin secret', type: 'password' },
    { key: 'kms_root_category', label: 'KMS instance (for galleries)', type: 'text' },
  ],
  panopto: [
    { key: 'service_url', label: 'Service URL', type: 'text' },
    { key: 'client_id', label: 'Client ID', type: 'text' },
    { key: 'client_secret', label: 'Client secret', type: 'password' },
  ],
  youtube: [
    { key: 'channel_id', label: 'Channel', type: 'text' },
    { key: 'api_key', label: 'API key', type: 'password' },
  ],
};

const OPTIONS = [
  { key: 'create_users', label: 'Create users', help: 'Recreate source users and assign media to owners. If off, all media goes to the fallback owner.' },
  { key: 'create_categories', label: 'Create categories', help: 'KMS galleries and channels become flat categories; the tree path is written to the description.' },
  { key: 'map_permissions', label: 'Map permissions', help: 'Unrestricted categories become public; restricted ones become RBAC with a manager and members.' },
  { key: 'import_captions', label: 'Import captions and transcripts', help: 'Caption assets are attached as subtitles. Plain text transcripts are logged as skipped.' },
  { key: 'preserve_views', label: 'Preserve views', help: 'Play counts are copied onto the migrated media.' },
  { key: 'preserve_publish_state', label: 'Preserve publish state', help: 'Public, unlisted and private are derived from the source category privacy.' },
  { key: 'skip_transcoding', label: 'Attempt to skip transcoding', help: 'Import the existing flavors as MediaCMS encodings instead of re-encoding every file.' },
];

const DEFAULT_OPTIONS = {
  create_users: true,
  fallback_username: 'admin',
  create_categories: true,
  map_permissions: true,
  import_captions: true,
  preserve_views: true,
  preserve_publish_state: true,
  skip_transcoding: true,
  max_items: null,
};

function migrationIdFromPath() {
  const match = window.location.pathname.match(/^\/migrations\/(\d+)\/edit$/);
  return match ? parseInt(match[1], 10) : null;
}

export class MigrationEditPage extends Page {
  constructor(props) {
    super(props, 'migration-edit');

    this.state = {
      id: migrationIdFromPath(),
      name: '',
      provider: 'kaltura',
      connection: {},
      options: Object.assign({}, DEFAULT_OPTIONS),
      checking: false,
      checkResult: null,
      saving: false,
      error: null,
    };

    this.onCheckClick = this.onCheckClick.bind(this);
    this.onSaveClick = this.onSaveClick.bind(this);
    this.onSaveAndStartClick = this.onSaveAndStartClick.bind(this);
  }

  componentDidMount() {
    if (this.state.id) {
      getMigration(this.state.id).then((response) => {
        const data = response.data;
        this.setState({
          name: data.name,
          provider: data.provider,
          connection: data.connection || {},
          options: Object.assign({}, DEFAULT_OPTIONS, data.options || {}),
        });
      });
    }
  }

  setConnectionValue(key, value) {
    this.setState({ connection: Object.assign({}, this.state.connection, { [key]: value }) });
  }

  setOptionValue(key, value) {
    this.setState({ options: Object.assign({}, this.state.options, { [key]: value }) });
  }

  payload() {
    return {
      name: this.state.name,
      provider: this.state.provider,
      connection: this.state.connection,
      options: this.state.options,
    };
  }

  onCheckClick() {
    this.setState({ checking: true, checkResult: null });
    checkConnection({ provider: this.state.provider, connection: this.state.connection })
      .then((response) => this.setState({ checking: false, checkResult: response.data }))
      .catch(() => this.setState({ checking: false, checkResult: { ok: false, error: 'Request failed' } }));
  }

  save() {
    const { id } = this.state;
    this.setState({ saving: true, error: null });
    const request = id ? updateMigration(id, this.payload()) : createMigration(this.payload());
    return request.catch((error) => {
      const data = error.response && error.response.data;
      this.setState({ saving: false, error: data ? JSON.stringify(data) : 'Could not save' });
      return Promise.reject(error);
    });
  }

  onSaveClick() {
    this.save()
      .then(() => {
        window.location.href = '/migrations';
      })
      .catch(() => {
        // already surfaced by save(); swallow so it is not an unhandled rejection
      });
  }

  onSaveAndStartClick() {
    this.save().then((response) => {
      const id = this.state.id || response.data.id;
      controlMigration(id, 'start').then(() => {
        window.location.href = '/migrations/' + id;
      });
    });
  }

  renderCheckResult() {
    const result = this.state.checkResult;
    if (this.state.checking) {
      return <span className="migrations-check">Checking…</span>;
    }
    if (!result) {
      return null;
    }
    if (!result.ok) {
      return <span className="migrations-check migrations-check--error">{result.error}</span>;
    }
    const stats = result.stats || {};
    return (
      <span className="migrations-check migrations-check--ok">
        Connected — {stats.entries || 0} entries, {stats.users || 0} users, {stats.categories || 0} categories found
      </span>
    );
  }

  pageContent() {
    const { provider, connection, options } = this.state;
    const fields = CONNECTION_FIELDS[provider] || [];
    const available = (PROVIDERS.find((item) => item.id === provider) || {}).available;

    return (
      <div className="migration-edit-page">
        <h1>{this.state.id ? 'Migration settings' : 'New migration'}</h1>
        <p>Step 1 of 2 — configure and save. Nothing is imported until you start the migration.</p>

        <label>
          Name
          <input type="text" value={this.state.name} onChange={(e) => this.setState({ name: e.target.value })} />
        </label>

        <p className="migration-edit-section">Source platform</p>
        <div className="migration-edit-providers">
          {PROVIDERS.map((item) => (
            <button
              key={item.id}
              className={item.id === provider ? 'is-selected' : ''}
              onClick={() => this.setState({ provider: item.id, connection: {}, checkResult: null })}
            >
              {item.label}
              {item.available ? null : <span className="migration-edit-soon">soon</span>}
            </button>
          ))}
        </div>

        {available ? null : <p className="migration-edit-placeholder">{PLACEHOLDER_TEXT[provider]}</p>}

        <p className="migration-edit-section">Connection</p>
        <div className="migration-edit-connection">
          {fields.map((field) => (
            <label key={field.key}>
              {field.label}
              <input
                type={field.type}
                value={connection[field.key] || ''}
                onChange={(e) => this.setConnectionValue(field.key, e.target.value)}
              />
            </label>
          ))}
        </div>

        <button onClick={this.onCheckClick} disabled={!available}>
          Test connection
        </button>
        {this.renderCheckResult()}

        <p className="migration-edit-section">Import options</p>
        <div className="migration-edit-options">
          {OPTIONS.map((option) => (
            <label key={option.key}>
              <input
                type="checkbox"
                checked={!!options[option.key]}
                onChange={(e) => this.setOptionValue(option.key, e.target.checked)}
              />
              <span>
                {option.label}
                <span className="migration-edit-help">{option.help}</span>
              </span>
            </label>
          ))}

          <label>
            Fallback owner
            <input
              type="text"
              value={options.fallback_username || ''}
              onChange={(e) => this.setOptionValue('fallback_username', e.target.value)}
            />
          </label>

          <label>
            Maximum items (leave empty for all)
            <input
              type="number"
              value={options.max_items === null || options.max_items === undefined ? '' : options.max_items}
              onChange={(e) => this.setOptionValue('max_items', e.target.value === '' ? null : parseInt(e.target.value, 10))}
            />
          </label>
        </div>

        {this.state.error ? <p className="migrations-error">{this.state.error}</p> : null}

        <div className="migration-edit-actions">
          <button onClick={this.onSaveClick} disabled={this.state.saving || !available}>
            Save draft
          </button>
          <button onClick={this.onSaveAndStartClick} disabled={this.state.saving || !available}>
            Save and start migration
          </button>
          <span className="migration-edit-note">Credentials are stored encrypted</span>
        </div>
      </div>
    );
  }
}
```

- [ ] **Step 2: Export the page**

In `frontend/src/static/js/pages/index.ts`, add:

```typescript
export * from './MigrationEditPage';
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/static/js/pages/MigrationEditPage.js frontend/src/static/js/pages/index.ts
git commit -m "feat(frontend): add migration settings page"
```

---

## Task 17: Migration dashboard page

**Files:**
- Create: `frontend/src/static/js/pages/MigrationDetailPage.js`
- Modify: `frontend/src/static/js/pages/index.ts`

**Interfaces:**
- Consumes: `getMigration`, `getProgress`, `getRecords`, `controlMigration` from Task 15, and `window.MIGRATION_ID` set by `templates/cms/migration_detail.html`.
- Produces: `MigrationDetailPage` exported from `pages/index.ts`.

**Behaviour:** status header with Pause and Abort, stat tiles, progress per object type, a live log that refreshes every five seconds with an errors-only toggle, and the ID mapping table.

- [ ] **Step 1: Write the page**

`frontend/src/static/js/pages/MigrationDetailPage.js`:

```javascript
import React from 'react';
import { Page } from './_Page';
import { getMigration, getProgress, getRecords, controlMigration } from '../utils/api/migrations.js';

const POLL_INTERVAL = 5000;

const TYPES = [
  { key: 'user', label: 'Users' },
  { key: 'category', label: 'Categories' },
  { key: 'media', label: 'Media' },
  { key: 'caption', label: 'Captions' },
];

function counts(totals, type) {
  const migrated = totals[type + '_migrated'] || 0;
  const skipped = totals[type + '_skipped'] || 0;
  const failed = totals[type + '_failed'] || 0;
  const discovered = totals[type + '_discovered'] || 0;
  const handled = migrated + skipped + failed;
  const percent = discovered ? Math.min(100, Math.round((handled / discovered) * 100)) : 0;
  return { migrated, skipped, failed, discovered, handled, percent };
}

export class MigrationDetailPage extends Page {
  constructor(props) {
    super(props, 'migration-detail');

    this.state = {
      id: window.MIGRATION_ID,
      migration: null,
      progress: null,
      records: [],
      errorsOnly: false,
      error: null,
    };

    this.poll = this.poll.bind(this);
    this.onErrorsOnlyClick = this.onErrorsOnlyClick.bind(this);
  }

  componentDidMount() {
    getMigration(this.state.id).then((response) => this.setState({ migration: response.data }));
    this.poll();
    this.timer = setInterval(this.poll, POLL_INTERVAL);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  poll() {
    getProgress(this.state.id)
      // clear any earlier error: a transient blip must not leave a permanent
      // banner on a dashboard that is now updating fine
      .then((response) => this.setState({ progress: response.data, error: null }))
      .catch(() => this.setState({ error: 'Could not load progress' }));

    const params = this.state.errorsOnly ? { status: 'failed' } : {};
    getRecords(this.state.id, params).then((response) => {
      const data = response.data;
      this.setState({ records: data.results || data });
    });
  }

  onErrorsOnlyClick() {
    this.setState({ errorsOnly: !this.state.errorsOnly }, this.poll);
  }

  onControlClick(action) {
    controlMigration(this.state.id, action)
      .then(this.poll)
      .catch((error) => {
        const detail = error.response && error.response.data && error.response.data.detail;
        this.setState({ error: detail || 'Action failed' });
      });
  }

  renderControls(status) {
    return (
      <div className="migration-detail-controls">
        {'running' === status ? <button onClick={() => this.onControlClick('pause')}>Pause</button> : null}
        {'paused' === status ? <button onClick={() => this.onControlClick('resume')}>Resume</button> : null}
        {'running' === status || 'paused' === status ? (
          <button className="is-danger" onClick={() => this.onControlClick('abort')}>
            Abort
          </button>
        ) : null}
      </div>
    );
  }

  pageContent() {
    const { migration, progress, records } = this.state;
    if (!migration || !progress) {
      return <p>Loading…</p>;
    }

    const totals = progress.totals || {};
    const media = counts(totals, 'media');

    return (
      <div className="migration-detail-page">
        <div className="migration-detail-header">
          <h1>{migration.name}</h1>
          <span className={'migrations-badge migrations-badge--' + progress.status}>{progress.status}</span>
          {this.renderControls(progress.status)}
        </div>

        {this.state.error ? <p className="migrations-error">{this.state.error}</p> : null}

        <div className="migration-detail-tiles">
          <div>
            <p>Items migrated</p>
            <strong>{media.migrated}</strong>
            <span>of {media.discovered || 'unknown'} discovered</span>
          </div>
          <div>
            <p>Skipped</p>
            <strong>{media.skipped}</strong>
            <span>already in MediaCMS</span>
          </div>
          <div>
            <p>Errors</p>
            <strong className="is-danger">{media.failed}</strong>
            <span>retried on resume</span>
          </div>
          <div>
            <p>Phase</p>
            <strong>{progress.cursor_phase || '—'}</strong>
            <span>started {progress.started_at || '—'}</span>
          </div>
        </div>

        <p className="migration-detail-section">Progress by type</p>
        <div className="migration-detail-progress">
          {TYPES.map((type) => {
            const typeCounts = counts(totals, type.key);
            return (
              <div key={type.key}>
                <span>{type.label}</span>
                {typeCounts.discovered ? (
                  <div className="migrations-bar">
                    <div className="migrations-bar-fill" style={{ width: typeCounts.percent + '%' }} />
                  </div>
                ) : (
                  // no up front total for this type - captions are discovered per
                  // media as the run proceeds. An always empty bar would read as
                  // "stalled" rather than "total unknown".
                  <span className="migration-detail-no-total">so far</span>
                )}
                <span>
                  {typeCounts.handled}
                  {typeCounts.discovered ? ' / ' + typeCounts.discovered : ''}
                </span>
              </div>
            );
          })}
        </div>

        <div className="migration-detail-section-row">
          <p className="migration-detail-section">Live log</p>
          <span>auto-refresh 5s</span>
          <button onClick={this.onErrorsOnlyClick}>{this.state.errorsOnly ? 'All records' : 'Errors only'}</button>
        </div>
        <pre className="migration-detail-log">{(progress.log || []).join('\n')}</pre>

        <p className="migration-detail-section">ID mapping</p>
        <div className="migration-detail-records">
          <div className="migration-detail-record migration-detail-record--head">
            <span>Type</span>
            <span>Source ID</span>
            <span>MediaCMS ID</span>
            <span>Status</span>
            <span>Migrated at</span>
          </div>
          {records.map((record) => (
            <div className="migration-detail-record" key={record.id}>
              <span>{record.object_type}</span>
              <span className="is-mono">{record.source_id}</span>
              <span className="is-mono">{record.target_id === null ? '—' : record.object_type + '/' + record.target_id}</span>
              <span className={'is-' + record.status}>{record.status}</span>
              <span>{record.created_at}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
}
```

- [ ] **Step 2: Export the page**

In `frontend/src/static/js/pages/index.ts`, add:

```typescript
export * from './MigrationDetailPage';
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/static/js/pages/MigrationDetailPage.js frontend/src/static/js/pages/index.ts
git commit -m "feat(frontend): add migration dashboard page"
```

---

## Task 18: Discovery totals, documentation and full verification

**Files:**
- Modify: `migrationservice/tasks.py`
- Create: `docs/migration_service.md`, `migrationservice/tests/test_totals.py`
- Modify: `docs/admins_docs.md`
- Test: `migrationservice/tests/test_totals.py`

**Interfaces:**
- Consumes: `start_migration` (Task 12), `check_connection` (Task 4).
- Produces:
  - `record_discovery_totals(service, provider) -> None`, called once when a migration starts, filling `totals["media_discovered"]`, `totals["user_discovered"]`, `totals["category_discovered"]` (singular, matching what the frontend reads)

**Why:** the dashboard and the list page both show "N of M discovered". `M` comes from the source system's own totals, which `check_connection()` already reports, so the migration asks for them once at start rather than counting as it goes.

- [ ] **Step 1: Write the failing tests**

`migrationservice/tests/test_totals.py`:

```python
from unittest import mock

from django.test import TestCase

from files.tests import create_account
from migrationservice.models import MigrationService
from migrationservice.tasks import start_migration
from migrationservice.tests.fakes import FakeProvider


def make_service():
    return MigrationService.objects.create(
        name="Kaltura production",
        provider="kaltura",
        connection={"service_url": "https://kaltura.example.edu", "partner_id": "342", "admin_secret": "x"},
        options={"create_users": False, "create_categories": False, "fallback_username": "admin"},
    )


class TestDiscoveryTotals(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        create_account(username="admin")
        self.provider = FakeProvider()
        self.provider.check_connection = mock.Mock(
            return_value={"ok": True, "error": "", "stats": {"entries": 11960, "users": 214, "categories": 87}}
        )
        patcher = mock.patch("migrationservice.tasks.get_provider", return_value=self.provider)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_discovery_totals_are_stored_on_start(self):
        service = make_service()
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.totals["media_discovered"], 11960)
        self.assertEqual(service.totals["user_discovered"], 214)
        self.assertEqual(service.totals["category_discovered"], 87)

    def test_a_failing_connection_check_does_not_stop_the_migration(self):
        service = make_service()
        self.provider.check_connection = mock.Mock(side_effect=RuntimeError("kaboom"))
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.status, "success")
        self.assertIn("could not read source totals", service.log)

    def test_resuming_does_not_reset_the_totals(self):
        service = make_service()
        start_migration(service)
        service.refresh_from_db()
        service.status = "paused"
        service.save(update_fields=["status"])

        self.provider.check_connection = mock.Mock(return_value={"ok": True, "error": "", "stats": {"entries": 1}})
        start_migration(service)
        service.refresh_from_db()
        self.assertEqual(service.totals["media_discovered"], 11960)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pytest migrationservice/tests/test_totals.py -v`
Expected: FAIL — `KeyError: 'media_discovered'`

- [ ] **Step 3: Implement the discovery totals**

Add to `migrationservice/tasks.py`:

```python
def record_discovery_totals(service, provider):
    """Ask the source how much there is, once, when a migration first starts.

    Best effort: a source that cannot answer must not stop the migration, the
    progress bars simply show counts without a denominator.
    """
    totals = dict(service.totals or {})
    if totals.get("media_discovered"):
        # already known, a resume must not reset it
        return

    try:
        result = provider.check_connection()
    except Exception as exc:  # noqa: BLE001 - informational only
        service.append_log(f"could not read source totals: {exc}")
        return

    if not result.get("ok"):
        service.append_log(f"could not read source totals: {result.get('error')}")
        return

    stats = result.get("stats") or {}
    totals["media_discovered"] = stats.get("entries", 0)
    totals["user_discovered"] = stats.get("users", 0)
    totals["category_discovered"] = stats.get("categories", 0)
    service.totals = totals
    MigrationService.objects.filter(pk=service.pk).update(totals=totals)
```

Then call it from `start_migration`, between the status save and the `append_log`:

```python
    service.save(update_fields=["status", "started_at", "ended_at", "last_activity"])
    record_discovery_totals(service, get_provider(service))
    service.append_log("migration started")
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pytest migrationservice/tests/test_totals.py -v`
Expected: PASS, 3 tests

- [ ] **Step 5: Write the documentation**

`docs/migration_service.md`:

```markdown
# Migration Service

The Migration Service imports media, users, categories, permissions and captions from
another video platform into MediaCMS. Kaltura is implemented; Panopto and YouTube appear
in the interface as placeholders.

Only superusers can see or use it. The entry point is **Migrations** in the top right menu,
directly under MediaCMS administration.

## Setting up a migration

1. Go to `/migrations` and choose **New migration**.
2. Pick Kaltura and fill in the connection:
   - **Service URL** — for example `https://kaltura.example.edu`
   - **Partner ID** — the numeric partner account id
   - **Admin secret** — the partner's administrator secret
   - **KMS instance** — the root category name of your MediaSpace instance, usually
     `MediaSpace`. Galleries and channels are found under `<root>>site`.
3. Press **Test connection**. It starts a Kaltura session and reports how many entries,
   users and categories the account holds. It is safe to run at any time and imports nothing.
4. Choose the import options, then **Save draft** or **Save and start migration**.

Credentials are encrypted at rest with a key derived from `SECRET_KEY`, and the API never
returns a secret — the settings form shows a mask and keeps the stored value if you save
without retyping it.

## Import options

| Option | Default | Effect |
| --- | --- | --- |
| Create users | on | Recreate source users and assign media to them. Off means everything goes to the fallback owner. |
| Fallback owner | `admin` | Owner used when user creation is off or the source owner cannot be resolved. |
| Create categories | on | Import KMS galleries and channels as flat MediaCMS categories. |
| Map permissions | on | Category privacy becomes public or RBAC; Kaltura roles become MediaCMS roles. |
| Import captions | on | Caption assets become WebVTT subtitles. |
| Preserve views | on | Copy play counts. |
| Preserve publish state | on | Derive public / unlisted / private from category privacy. |
| Attempt to skip transcoding | on | Import existing Kaltura flavors as MediaCMS encodings instead of re-encoding. |
| Maximum items | empty | Cap the media phase. Useful for a trial run. |

## What maps to what

Categories are flattened. A Kaltura category at
`MediaSpace>site>galleries>Engineering>1. Term>Electronics` becomes a MediaCMS category
titled `Electronics` with the description `Engineering: 1. Term: Electronics`. Because
MediaCMS category titles appear in URLs, a title collision appends the parent name —
`Electronics (Physics)`.

| Kaltura | MediaCMS |
| --- | --- |
| category with no restrictions | public category |
| restricted category | RBAC category with an RBAC group |
| category manager, category owner | RBAC manager |
| category moderator or contributor | RBAC contributor |
| category member | RBAC member |
| viewerRole, privateOnlyRole | plain user |
| adminRole, unmoderatedAdminRole | advanced user |
| partnerAdminRole | MediaCMS manager |

A migration never grants Django superuser or staff. Kaltura role names differ per partner;
override the mapping with `KALTURA_ROLE_MAP` in `local_settings.py`.

Publish state comes from the categories an entry belongs to: in a public category it is
public, in only restricted categories it is unlisted, in no category it is private.

## Skipping transcoding

With the option on, MediaCMS does not re-encode anything. The source flavor becomes the
original media file, and each transcoded Kaltura flavor is attached as an `Encoding` on the
closest **active** MediaCMS encoding profile. Only active profiles are used, so a portal
that has disabled 1080p will not gain 1080p encodings from a migration.

HLS is packaged once per media after its encodings are in place, exactly as it would be for
a normal upload.

If a Kaltura account has purged its source flavors, the tallest available flavor is used as
the original and the substitution is logged.

## Running, pausing and resuming

A migration walks three phases in order: users, categories, then media. It handles ten items
at a time, so a pause takes effect within a few items rather than at the end of the run.

- **Pause** stops after the items already in flight. The resume position is kept.
- **Resume** continues from that position.
- **Abort** stops for good but keeps everything already imported and the resume position, so
  an aborted migration can still be restarted.

Nothing is ever imported twice. Every object that is migrated is written to the mapping
table, and each item checks that table before anything is downloaded — both for this
migration and for any other migration pointing at the same source installation. Failed items
are the exception: they are retried on the next run.

## Monitoring

The dashboard at `/migrations/<id>` shows counts per object type, a live log refreshing
every five seconds, and the ID mapping table: source ID, MediaCMS ID, status and time. The
same rows are in the Django admin under Migration Records, where they can be searched and
exported.

Because the mapping is stored rather than derived, a migration can be monitored while it
runs, verified afterwards, rerun safely, and — with the records as the source of truth —
reversed by a later version of this feature.

## Troubleshooting

**"Fallback user 'admin' does not exist"** — set an existing username as the fallback owner.

**Media imported but not visible** — check the publish state option and the entry's Kaltura
categories. Entries in no category become private by design.

**Encodings missing after a migration** — the portal's active encoding profiles decide what
can be attached. Check `/admin/files/encodeprofile/`.

**A migration is stuck in running** — look at Last activity on the list page. If a worker
died, pause and then resume; the run continues from the stored position.
```

- [ ] **Step 6: Link the documentation**

In `docs/admins_docs.md`, add a line to the table of contents or the related documents list pointing at `migration_service.md`, matching the file's existing style:

```markdown
- [Migration Service](migration_service.md) - import media, users and categories from Kaltura
```

- [ ] **Step 7: Run the entire test suite**

Run: `pytest migrationservice/ tests/ files/ -v`
Expected: PASS, no failures. Every test in this plan plus the pre-existing suite.

Run: `flake8 migrationservice/ files/models/media.py users/models.py cms/settings.py cms/urls.py`
Expected: no output

- [ ] **Step 8: Verify the Django migration is complete**

Run: `python manage.py makemigrations --check --dry-run`
Expected: `No changes detected`

If changes are detected, a model field was added after Task 1's migration. Run
`python manage.py makemigrations migrationservice` and commit the result.

- [ ] **Step 9: Commit**

```bash
git add migrationservice/tasks.py migrationservice/tests/test_totals.py docs/migration_service.md docs/admins_docs.md
git commit -m "feat(migrationservice): add discovery totals and documentation"
```

---

## Handover notes

**The maintainer runs the frontend build.** After Tasks 15–17 are merged, `make build-frontend`
produces `static/js/migrations.js`, `static/js/migration-edit.js` and
`static/js/migration-detail.js`, which the templates from Task 14 reference. Until then the
pages render an empty container.

**Styling.** The React pages use semantic class names (`migrations-row`, `migration-detail-tiles`,
and so on) and no styles of their own. They inherit the portal's base styles and are legible
without extra CSS; matching the mockups pixel for pixel is a follow-up styling pass, not part
of this plan.

**Deliberately not built**, recorded in the spec as future work: Panopto and YouTube providers,
a revert action, a verification pass over the mapping table, custom thumbnails, chapters,
playlists, comments, and a home for plain-text transcripts.
