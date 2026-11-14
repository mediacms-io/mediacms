from django.conf import settings
from django.urls import reverse
from rest_framework import serializers

from users.models import User

from .helpers import get_alphanumeric_and_spaces
from .methods import can_edit_category, change_media_owner, is_mediacms_editor
from .models import Category, Comment, EncodeProfile, Media, Playlist, Tag

# TODO: put them in a more DRY way


class CommaSeparatedOrListField(serializers.Field):
    """Accept a list or a comma-separated string (multipart-friendly)."""

    default_error_messages = {"invalid": "Expected a list of strings or a comma-separated string."}

    def to_internal_value(self, data):
        if data is None or data == "":
            return []
        if isinstance(data, str):
            return [item.strip() for item in data.split(",") if item.strip()]
        if isinstance(data, list):
            items = []
            for item in data:
                if isinstance(item, str) and "," in item:
                    items.extend([part.strip() for part in item.split(",") if part.strip()])
                elif item is not None and str(item).strip():
                    items.append(str(item).strip())
            return items
        self.fail("invalid")

    def to_representation(self, value):
        return value or []


class MediaSerializer(serializers.ModelSerializer):
    # to be used in APIs as show related media
    user = serializers.ReadOnlyField(source="user.username")
    url = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    author_profile = serializers.SerializerMethodField()
    author_thumbnail = serializers.SerializerMethodField()
    category_uids = CommaSeparatedOrListField(required=False, write_only=True)
    category_titles = CommaSeparatedOrListField(required=False, write_only=True)
    tag_titles = CommaSeparatedOrListField(required=False, write_only=True)
    owner = serializers.CharField(required=False, write_only=True, allow_blank=False)

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_api_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url(api=True))

    def get_thumbnail_url(self, obj):
        if obj.thumbnail_url:
            return self.context["request"].build_absolute_uri(obj.thumbnail_url)
        else:
            return None

    def get_author_profile(self, obj):
        return self.context["request"].build_absolute_uri(obj.author_profile())

    def get_author_thumbnail(self, obj):
        return self.context["request"].build_absolute_uri(obj.author_thumbnail())

    class Meta:
        model = Media
        read_only_fields = (
            "friendly_token",
            "user",
            "add_date",
            "media_type",
            "duration",
            "encoding_status",
            "views",
            "likes",
            "dislikes",
            "reported_times",
            "size",
            "is_reviewed",
            "featured",
        )
        fields = (
            "friendly_token",
            "url",
            "api_url",
            "user",
            "title",
            "description",
            "add_date",
            "views",
            "media_type",
            "state",
            "duration",
            "thumbnail_url",
            "is_reviewed",
            "preview_url",
            "author_name",
            "author_profile",
            "author_thumbnail",
            "encoding_status",
            "views",
            "likes",
            "dislikes",
            "reported_times",
            "featured",
            "user_featured",
            "size",
            "enable_comments",
            "allow_download",
            "category_uids",
            "category_titles",
            "tag_titles",
            "owner",
        )

    def validate_state(self, value):
        valid_states = ["private", "public", "unlisted"]
        if value not in valid_states:
            raise serializers.ValidationError(f"state must be one of {valid_states}")

        request = self.context.get("request")
        user = getattr(request, "user", None)
        if user and not is_mediacms_editor(user) and settings.PORTAL_WORKFLOW != "public" and value == "public":
            raise serializers.ValidationError("You are not allowed to set media to public state")
        return value

    def validate_owner(self, value):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        if not user or not is_mediacms_editor(user):
            raise serializers.ValidationError("Only editors can set owner")
        if not User.objects.filter(username=value).exists():
            raise serializers.ValidationError("User not found")
        return value

    def _apply_state(self, media, state):
        media.state = state
        if media.state == "public" and media.encoding_status == "success" and media.is_reviewed is True:
            media.listable = True
        else:
            media.listable = False
        media.save(update_fields=["state", "listable"])

    def _user_can_use_category(self, user, category):
        if category.is_rbac_category and not (user and user.has_contributor_access_to_category(category)):
            return False
        return True

    def _resolve_categories(self, identifiers=None, titles=None):
        """Resolve categories by uid and/or title.

        Values in ``identifiers`` (from category_uids) match uid first, then exact title.
        Values in ``titles`` (from category_titles) match exact title only.
        """
        request = self.context.get("request")
        user = getattr(request, "user", None)
        resolved = []
        seen_ids = set()

        def add_category(category):
            if category is None or category.id in seen_ids:
                return
            if not self._user_can_use_category(user, category):
                return
            seen_ids.add(category.id)
            resolved.append(category)

        for ident in identifiers or []:
            category = Category.objects.filter(uid=ident).first()
            if category is None:
                category = Category.objects.filter(title=ident).first()
            add_category(category)

        for title in titles or []:
            for category in Category.objects.filter(title=title):
                add_category(category)

        return resolved

    def _apply_categories(self, media, identifiers=None, titles=None):
        for category in self._resolve_categories(identifiers=identifiers, titles=titles):
            media.category.add(category)

    def _apply_tags(self, media, tag_titles):
        if not tag_titles:
            return
        request = self.context.get("request")
        user = getattr(request, "user", None)
        for raw_title in tag_titles:
            title = get_alphanumeric_and_spaces(raw_title)[:100]
            if not title:
                continue
            tag, _created = Tag.objects.get_or_create(title=title, defaults={"user": user})
            media.tags.add(tag)

    def create(self, validated_data):
        category_uids = validated_data.pop("category_uids", None) or []
        category_titles = validated_data.pop("category_titles", None) or []
        tag_titles = validated_data.pop("tag_titles", None) or []
        owner_username = validated_data.pop("owner", None)
        # Media.save() always resets state on create; apply explicitly afterwards.
        explicit_state = validated_data.pop("state", None)

        if owner_username:
            validated_data["user"] = User.objects.get(username=owner_username)

        media = super().create(validated_data)

        if explicit_state:
            self._apply_state(media, explicit_state)

        self._apply_categories(media, identifiers=category_uids, titles=category_titles)
        self._apply_tags(media, tag_titles)
        return media

    def update(self, instance, validated_data):
        category_uids = validated_data.pop("category_uids", None)
        category_titles = validated_data.pop("category_titles", None)
        tag_titles = validated_data.pop("tag_titles", None)
        owner_username = validated_data.pop("owner", None)

        media = super().update(instance, validated_data)

        if owner_username:
            new_user = User.objects.get(username=owner_username)
            change_media_owner(media.id, new_user)
            media.refresh_from_db()

        if category_uids is not None or category_titles is not None:
            self._apply_categories(media, identifiers=category_uids or [], titles=category_titles or [])
        if tag_titles is not None:
            self._apply_tags(media, tag_titles)
        return media


class CategoriesInfoMixin(serializers.Serializer):
    categories_info = serializers.SerializerMethodField()

    def get_categories_info(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None)

        if user and user.is_authenticated:
            accessible_rbac = set(user.get_rbac_categories_as_member().values_list("pk", flat=True))
        else:
            accessible_rbac = set()

        ret = []
        for cat in obj.category.all():
            if cat.is_rbac_category and cat.pk not in accessible_rbac:
                continue
            ret.append({"title": cat.title, "uid": cat.uid, "url": cat.get_absolute_url(), "is_lms_course": cat.is_lms_course})
        return ret


class SingleMediaSerializer(CategoriesInfoMixin, serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source="user.username")
    url = serializers.SerializerMethodField()
    is_shared = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_is_shared(self, obj):
        """Check if media has custom permissions or RBAC categories"""
        custom_permissions = obj.permissions.exists()
        rbac_categories = obj.category.filter(is_rbac_category=True).exists()
        return custom_permissions or rbac_categories

    class Meta:
        model = Media
        read_only_fields = (
            "friendly_token",
            "user",
            "add_date",
            "views",
            "media_type",
            "state",
            "duration",
            "encoding_status",
            "views",
            "likes",
            "dislikes",
            "reported_times",
            "size",
            "video_height",
            "is_reviewed",
        )
        fields = (
            "url",
            "user",
            "title",
            "description",
            "add_date",
            "edit_date",
            "media_type",
            "state",
            "is_shared",
            "duration",
            "thumbnail_url",
            "poster_url",
            "thumbnail_time",
            "url",
            "sprites_url",
            "preview_url",
            "author_name",
            "author_profile",
            "author_thumbnail",
            "encodings_info",
            "encoding_status",
            "views",
            "likes",
            "dislikes",
            "reported_times",
            "user_featured",
            "original_media_url",
            "size",
            "video_height",
            "enable_comments",
            "categories_info",
            "is_reviewed",
            "edit_url",
            "tags_info",
            "hls_info",
            "license",
            "subtitles_info",
            "chapter_data",
            "ratings_info",
            "add_subtitle_url",
            "allow_download",
            "slideshow_items",
        )


class MediaSearchSerializer(CategoriesInfoMixin, serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_api_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url(api=True))

    class Meta:
        model = Media
        fields = (
            "title",
            "author_name",
            "author_profile",
            "thumbnail_url",
            "add_date",
            "views",
            "description",
            "friendly_token",
            "duration",
            "url",
            "api_url",
            "media_type",
            "preview_url",
            "categories_info",
        )


class EncodeProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = EncodeProfile
        fields = ("name", "extension", "resolution", "codec", "description")


class CategorySerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source="user.username")
    edit_url = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = (
            "title",
            "uid",
            "description",
            "is_global",
            "media_count",
            "user",
            "thumbnail_url",
            "is_lms_course",
            "edit_url",
        )

    def get_edit_url(self, obj):
        """Where this viewer may edit the category, or empty if they may not.

        Per viewer rather than a flag, so a listing cannot offer a link that leads to a
        redirect. The page checks again itself.
        """
        request = self.context.get("request")
        if request is None or not can_edit_category(request.user, obj):
            return ""
        return reverse("edit_category", args=[obj.uid])


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("title", "media_count", "thumbnail_url")


class PlaylistSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source="user.username")

    class Meta:
        model = Playlist
        read_only_fields = ("add_date", "user", "friendly_token")
        fields = ("id", "add_date", "title", "description", "user", "media_count", "url", "api_url", "thumbnail_url", "friendly_token")


class PlaylistDetailSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source="user.username")

    class Meta:
        model = Playlist
        read_only_fields = ("add_date", "user")
        fields = ("title", "add_date", "user_thumbnail_url", "description", "user", "media_count", "url", "thumbnail_url")


class CommentSerializer(serializers.ModelSerializer):
    author_profile = serializers.ReadOnlyField(source="user.get_absolute_url")
    author_name = serializers.ReadOnlyField(source="user.name")
    author_thumbnail_url = serializers.ReadOnlyField(source="user.thumbnail_url")

    class Meta:
        model = Comment
        read_only_fields = ("add_date", "uid")
        fields = (
            "add_date",
            "text",
            "parent",
            "author_thumbnail_url",
            "author_profile",
            "author_name",
            "media_url",
            "uid",
        )
