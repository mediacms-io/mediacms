from rest_framework import serializers

from .models import MigrationRecord, MigrationService
from .providers import get_provider_class
from .providers.kaltura import MEDIACMS_ROLES, parse_comma_list

SECRET_MASK = "••••••••"


def clean_role_map(rows):
    """Normalise the role mapping rows the form sends.

    Rows are dropped rather than rejected when they carry no target, since an operator
    clearing a row is how a role is meant to become a plain user. A target the MediaCMS
    side does not understand is refused, because set_role_from_mapping resets every
    permission when handed a value it does not recognise.
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
                        # nothing stored to fall back on: storing the placeholder
                        # itself would fail authentication later with a baffling error
                        raise serializers.ValidationError({"connection": f"'{key}' was submitted as the placeholder; enter the real value."})
            missing = [key for key in klass.required_connection_keys if not str(connection.get(key) or "").strip()]
            if missing:
                raise serializers.ValidationError({"connection": f"Missing required fields: {', '.join(missing)}"})

            if self.instance and self.instance.status == "running" and connection != self.instance.connection:
                # the run is walking the source right now, from a cursor built against
                # these credentials. Pointing it somewhere else mid sweep would carry that
                # cursor to a portal it means nothing on. Options stay editable
                raise serializers.ValidationError({"connection": "This migration is running. Pause it before changing the connection."})

            attrs["connection"] = connection

        options = attrs.get("options")
        if options is not None:
            options = dict(options)
            retired = set(getattr(klass, "retired_options", ()))
            unknown = sorted(set(options) - set(klass.default_options) - retired)
            if unknown:
                raise serializers.ValidationError({"options": f"Unknown options: {', '.join(unknown)}"})

            # a record saved before an option was removed still carries it, and the form
            # posts back what it loaded. Drop it here so the record cleans itself up on
            # the next save rather than failing to save at all
            for key in retired:
                options.pop(key, None)

            if "role_map" in options:
                options["role_map"] = clean_role_map(options["role_map"])

            if "source_category_ids" in options:
                # no toggle for this one: an empty selection means the whole portal, so
                # there is no way to switch on a restriction that filters on nothing
                options["source_category_ids"] = ",".join(parse_comma_list(options["source_category_ids"]))

            if options.get("restrict_to_users"):
                user_ids = parse_comma_list(options.get("source_user_ids"))
                if not user_ids:
                    raise serializers.ValidationError({"options": "Restricting to specific users needs at least one Kaltura user id."})
                if len(user_ids) > MAX_SOURCE_USER_IDS:
                    raise serializers.ValidationError({"options": f"Too many users listed, the maximum is {MAX_SOURCE_USER_IDS}."})
                # store the cleaned list, so the filter sent to Kaltura is exactly
                # what the page shows and no stray whitespace reaches the query
                options["source_user_ids"] = ",".join(user_ids)
            attrs["options"] = options

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # the list page shows progress, so it needs the derived counts too
        data["totals"] = instance.counted_totals()
        klass = get_provider_class(instance.provider)
        connection = dict(data.get("connection") or {})
        for key in getattr(klass, "retired_connection_keys", ()):
            # a record saved before a credential was replaced still holds it. Nothing
            # reads it, so it is not shown either, masked or otherwise
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

        A primary key means nothing to an operator comparing the two systems, and
        for media it is not even what the URL uses. Each type has one natural
        identifier: the friendly token, the username, the category title.
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
