import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models
from django.db.models import Count, F, Value
from django.db.models.functions import Concat, Right
from django.utils import timezone

from files.models import Category, Media, Subtitle
from users.models import User

from .providers import get_provider_class

logger = logging.getLogger(__name__)

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
        return _fernet().decrypt(value[len(ENCRYPTED_PREFIX) :].encode("utf-8")).decode("utf-8")
    except InvalidToken:
        # most likely SECRET_KEY was rotated after this value was stored
        logger.warning("Could not decrypt a stored migration credential; returning an empty value")
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

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Migration"
        verbose_name_plural = "Migrations"

    def __str__(self):
        return f"{self.name} ({self.provider})"

    @property
    def provider_class(self):
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
        """Append one timestamped line to the phase level log.

        Appended in the database, not read-modify-written in Python: several
        workers import in parallel and each holds its own snapshot of the row, so
        a Python level append silently erases every line another worker wrote in
        the meantime. Right() caps the column without a second query.
        """
        stamp = timezone.now().strftime("%Y-%m-%d %H:%M:%S")
        entry = f"{stamp} {line}\n"
        MigrationService.objects.filter(pk=self.pk).update(
            log=Right(Concat(F("log"), Value(entry)), LOG_MAX_CHARS),
            last_activity=timezone.now(),
        )

    def counted_totals(self):
        """Progress counts, derived from the mapping table.

        Derived rather than incremented, for the same reason append_log appends in
        the database: parallel workers lose read-modify-write counter updates, and
        the symptom is a dashboard that under-reports for the whole run. The
        mapping table is the source of truth and is indexed for this.
        """
        totals = dict(self.totals or {})
        suffixes = {"success": "migrated", "failed": "failed", "skipped": "skipped"}
        rows = MigrationRecord.objects.filter(service=self).values("object_type", "status").annotate(number=Count("id"))
        for row in rows:
            suffix = suffixes.get(row["status"])
            if suffix:
                totals[f"{row['object_type']}_{suffix}"] = row["number"]
        return totals


class MigrationRecord(models.Model):
    """Maps one source object to the MediaCMS object it produced"""

    service = models.ForeignKey(MigrationService, on_delete=models.CASCADE, related_name="records")

    object_type = models.CharField(max_length=20, choices=OBJECT_TYPES, db_index=True)

    source_id = models.CharField(max_length=255, db_index=True)

    target_id = models.IntegerField(blank=True, null=True, help_text="pk of the created object, resolved through object_type")

    status = models.CharField(max_length=20, choices=RECORD_STATUS, default="success", db_index=True)

    log = models.CharField(max_length=500, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [["service", "object_type", "source_id"]]
        indexes = [
            models.Index(fields=["object_type", "source_id"]),
            models.Index(fields=["service", "status"]),
            models.Index(fields=["object_type", "target_id"]),
        ]

    def __str__(self):
        return f"{self.object_type} {self.source_id} -> {self.target_id}"

    def target_model(self):
        """The MediaCMS model this record's object_type refers to"""
        return {
            "media": Media,
            "user": User,
            "category": Category,
            "caption": Subtitle,
        }.get(self.object_type)

    def target(self):
        """The MediaCMS object this record points at, or None if it is gone.

        Resolved by lookup rather than held as a foreign key: object_type plus
        target_id already identify it, and a per type FK does not generalise —
        it is what left caption records with no way to detect a deleted target.
        """
        model = self.target_model()
        if model is None or self.target_id is None:
            return None
        return model.objects.filter(pk=self.target_id).first()

    def target_exists(self):
        """Whether the MediaCMS object this record points at is still there"""
        return self.target() is not None

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
