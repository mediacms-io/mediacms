from rest_framework import serializers
from .models import User


class UserSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_api_url(self, obj):
        return self.context["request"].build_absolute_uri(
            obj.get_absolute_url(api=True)
        )

    def get_thumbnail_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.thumbnail_url())

    class Meta:
        model = User
        read_only_fields = (
            "date_added",
            "is_featured",
            "uid",
            "username",
            "advancedUser",
            "is_editor",
            "is_manager",
            "email_is_verified",
        )
        fields = (
            "description",
            "date_added",
            "name",
            "is_featured",
            "thumbnail_url",
            "url",
            "api_url",
            "username",
            "advancedUser",
            "is_editor",
            "is_manager",
            "email_is_verified",
        )


class UserDetailSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_api_url(self, obj):
        return self.context["request"].build_absolute_uri(
            obj.get_absolute_url(api=True)
        )

    def get_thumbnail_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.thumbnail_url())

    class Meta:
        model = User
        read_only_fields = ("date_added", "is_featured", "uid", "username")
        fields = (
            "description",
            "date_added",
            "name",
            "is_featured",
            "thumbnail_url",
            "banner_thumbnail_url",
            "url",
            "username",
            "media_info",
            "api_url",
            "edit_url",
            "default_channel_edit_url",
        )
        extra_kwargs = {"name": {"required": False}}
