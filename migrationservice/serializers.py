from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from lti.models import LTIPlatform

from .models import MigrationRecord, MigrationService
from .providers import get_provider_class
from .providers.kaltura import MEDIACMS_ROLES, parse_comma_list
from .scheduling import (
    SCHEDULE_OPTIONS,
    parse_clock,
    parse_scheduled_at,
    scheduled_at_text,
)

SECRET_MASK = "••••••••"


SERVER_OPTIONS = ("initiated_by",)

USER_CHOICES = ("restrict_to_users", "create_users", "migrate_all_users")


def one_user_choice(options):
    """The options with exactly one user choice set: the narrowest named, or migrate all"""
    if not any(key in options for key in USER_CHOICES):
        return options

    chosen = next((key for key in USER_CHOICES if options.get(key)), "migrate_all_users")
    return dict(options, **{key: key == chosen for key in USER_CHOICES})


def clean_role_map(rows):
    """Normalise the role mapping rows the form sends.

    A row with no target is dropped, since clearing one is how a role becomes a plain
    user. An unrecognised target is refused: set_role_from_mapping resets every
    permission when handed a value it does not know.
    """
    if not isinstance(rows, list):
        raise serializers.ValidationError({"options": "role_map must be a list of rows."})

    cleaned = []
    for row in rows:
        if not isinstance(row, dict):
            raise serializers.ValidationError({"options": "each role_map row must be an object."})

        role = str(row.get("role") or "").strip()
        if role and role not in MEDIACMS_ROLES:
            raise serializers.ValidationError({"options": f"unknown MediaCMS role: {role}"})

        identifier = str(row.get("id") or "").strip()
        name = str(row.get("name") or "").strip()
        if not identifier and not name:
            continue

        cleaned.append({"id": identifier, "name": name, "role": role})

    return cleaned


MAX_SOURCE_USER_IDS = 50


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
            for key in getattr(klass, "retired_connection_keys", ()):
                connection.pop(key, None)
            stored = self.instance.connection if self.instance else {}
            for key in klass.secret_keys:
                # the form sends the mask back when the secret was not retyped
                if connection.get(key) == SECRET_MASK:
                    if stored.get(key):
                        connection[key] = stored[key]
                    else:
                        # nothing to fall back on: storing the placeholder would fail
                        # authentication later with a baffling error
                        raise serializers.ValidationError({"connection": f"'{key}' was submitted as the placeholder; enter the real value."})
            missing = [key for key in klass.required_connection_keys if not str(connection.get(key) or "").strip()]
            if missing:
                raise serializers.ValidationError({"connection": f"Missing required fields: {', '.join(missing)}"})

            if self.instance and self.instance.status == "running" and connection != self.instance.connection:
                # the run is walking the source from a cursor built against these
                # credentials, and pointing it elsewhere mid sweep would carry that
                # cursor to a portal it means nothing on. Options stay editable.
                raise serializers.ValidationError({"connection": "This migration is running. Pause it before changing the connection."})

            attrs["connection"] = connection

        options = attrs.get("options")
        if options is not None:
            options = dict(options)
            retired = set(getattr(klass, "retired_options", ()))
            unknown = sorted(set(options) - set(klass.default_options) - retired - set(SCHEDULE_OPTIONS) - set(SERVER_OPTIONS))
            if unknown:
                raise serializers.ValidationError({"options": f"Unknown options: {', '.join(unknown)}"})

            # a record saved before an option was removed still carries it, and the form posts
            # back what it loaded, so it is dropped rather than failing the save
            for key in retired:
                options.pop(key, None)

            if "role_map" in options:
                options["role_map"] = clean_role_map(options["role_map"])

            if "source_category_ids" in options:
                category_ids = parse_comma_list(options["source_category_ids"])
                if not category_ids:
                    # there is no "migrate everything": an unscoped migration would sweep a
                    # whole portal by accident
                    raise serializers.ValidationError({"options": "Pick at least one category to migrate. Test the connection first to load them."})
                options["source_category_ids"] = ",".join(category_ids)

            options = one_user_choice(options)
            stored_options = self.instance.options if self.instance else {}
            if stored_options.get("initiated_by"):
                options["initiated_by"] = stored_options["initiated_by"]
            else:
                options.pop("initiated_by", None)

            if options.get("restrict_to_users"):
                user_ids = parse_comma_list(options.get("source_user_ids"))
                if not user_ids:
                    raise serializers.ValidationError({"options": "Restricting to specific users needs at least one Kaltura user id."})
                if len(user_ids) > MAX_SOURCE_USER_IDS:
                    raise serializers.ValidationError({"options": f"Too many users listed, the maximum is {MAX_SOURCE_USER_IDS}."})
                # store the cleaned list, so the filter matches what the page shows
                options["source_user_ids"] = ",".join(user_ids)

            if str(options.get("lti_platform_id") or "").strip():
                if not getattr(settings, "USE_LTI", False):
                    raise serializers.ValidationError({"options": "LTI is not enabled on this portal."})
                platform_id = str(options["lti_platform_id"]).strip()
                if not LTIPlatform.objects.filter(pk=platform_id).exists():
                    raise serializers.ValidationError({"options": "That LTI platform no longer exists."})
                options["lti_platform_id"] = platform_id

            if options.get("quiet_hours_enabled"):
                # refused rather than ignored: a window that silently does nothing would let a run
                # hammer the portal through the hours it was told to avoid
                for key in ("quiet_from", "quiet_to"):
                    if parse_clock(options.get(key)) is None:
                        raise serializers.ValidationError({"options": "Quiet hours need a start and an end, as HH:MM."})
                if parse_clock(options["quiet_from"]) == parse_clock(options["quiet_to"]):
                    raise serializers.ValidationError({"options": "Quiet hours need a start and an end that differ."})

            if options.get("schedule_enabled"):
                when = parse_scheduled_at(options.get("scheduled_at"))
                if when is None:
                    raise serializers.ValidationError({"options": "Scheduling this migration needs a date and a time."})
                if when < timezone.now():
                    raise serializers.ValidationError({"options": "Pick a time in the future. The portal's own clock is shown next to the field."})
                # canonical form, so an armed task can recognise a stale schedule
                options["scheduled_at"] = scheduled_at_text(when)
            else:
                options["scheduled_at"] = ""

            attrs["options"] = options

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # the list page shows progress, so it needs the derived counts too
        data["totals"] = instance.counted_totals()
        klass = get_provider_class(instance.provider)
        connection = dict(data.get("connection") or {})
        for key in getattr(klass, "retired_connection_keys", ()):
            # a record saved before a credential was replaced still holds it, and nothing
            # reads it, so it is not shown either
            connection.pop(key, None)
        for key in klass.secret_keys:
            if connection.get(key):
                connection[key] = SECRET_MASK
        data["connection"] = connection
        data["options"] = instance.get_options()
        return data


class MigrationRecordSerializer(serializers.ModelSerializer):
    target_url = serializers.SerializerMethodField()
    target_label = serializers.SerializerMethodField()

    class Meta:
        model = MigrationRecord
        fields = [
            "id",
            "object_type",
            "source_id",
            "target_id",
            "target_url",
            "target_label",
            "status",
            "log",
            "created_at",
        ]
        read_only_fields = fields

    def get_target_label(self, record):
        """How the imported object is named in MediaCMS.

        A primary key means nothing to an operator comparing the two systems, so each
        type uses its natural identifier: friendly token, username, category title.
        """
        target = record.target()
        if target is None:
            return None
        for attribute in ("friendly_token", "username", "title"):
            value = getattr(target, attribute, None)
            if value:
                return str(value)
        return str(record.target_id)

    def get_target_url(self, record):
        """Where the imported object lives in MediaCMS, so the dashboard can link
        it next to the source. Null when the object is gone or has no page.
        """
        target = record.target()
        if target is None:
            return None
        get_url = getattr(target, "get_absolute_url", None)
        if get_url is None:
            return None
        try:
            return get_url()
        except Exception:  # noqa: BLE001 - a broken url must not break the listing
            return None
