import logging

from django.conf import settings
from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework.authtoken.models import Token

from cms.utils import get_client_ip_for_logging

from .models import User

logger = logging.getLogger(__name__)


class UserSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_api_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url(api=True))

    def get_thumbnail_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.thumbnail_url())

    class Meta:
        model = User
        read_only_fields = [
            "date_added",
            "is_featured",
            "uid",
            "username",
            "advancedUser",
            "is_editor",
            "is_manager",
            "email_is_verified",
        ]
        fields = [
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
        ]

        if settings.USER_SEARCH_FIELD == "name_username_email":
            fields.append("email")
            read_only_fields.append("email")

        if settings.USERS_NEEDS_TO_BE_APPROVED:
            fields.append("is_approved")
            read_only_fields.append("is_approved")


class UserDetailSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_api_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url(api=True))

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


class LoginSerializer(serializers.Serializer):
    email = serializers.CharField(max_length=255, required=False)
    username = serializers.CharField(max_length=255, required=False)
    password = serializers.CharField(max_length=128, write_only=True)
    token = serializers.CharField(max_length=255, required=False)

    def validate(self, data):
        email = data.get('email', None)
        username = data.get('username', None)
        password = data.get('password', None)

        if settings.ACCOUNT_LOGIN_METHODS == {"username"} and not username:
            raise serializers.ValidationError('username is required to log in.')
        else:
            username_or_email = username
        if settings.ACCOUNT_LOGIN_METHODS == {"email"} and not email:
            raise serializers.ValidationError('email is required to log in.')
        else:
            username_or_email = email

        if settings.ACCOUNT_LOGIN_METHODS == {"username", "email"} and not (username or email):
            raise serializers.ValidationError('username or email is required to log in.')
        else:
            username_or_email = username or email

        if password is None:
            raise serializers.ValidationError('password is required to log in.')

        # Get IP address from request context
        request = self.context.get('request')
        client_ip = get_client_ip_for_logging(request) if request else 'unknown'

        # Check if user exists before authenticating to distinguish failure types
        try:
            if '@' in username_or_email:
                user_exists = User.objects.filter(email=username_or_email).exists()
            else:
                user_exists = User.objects.filter(username=username_or_email).exists()
        except Exception:
            user_exists = False

        user = authenticate(username=username_or_email, password=password)

        if user is None:
            if user_exists:
                # User exists but password is wrong
                logger.warning(
                    "Login failed - wrong_password, attempted_username_or_email=%s, ip=%s",
                    username_or_email,
                    client_ip,
                )
                raise serializers.ValidationError('Invalid credentials.')
            else:
                # User doesn't exist
                logger.warning(
                    "Login failed - user_not_found, attempted_username_or_email=%s, ip=%s",
                    username_or_email,
                    client_ip,
                )
                raise serializers.ValidationError('User not found.')

        if not user.is_active:
            logger.warning(
                "Login failed - user_deactivated, user_id=%s, username=%s, ip=%s",
                user.id,
                user.username,
                client_ip,
            )
            raise serializers.ValidationError('User has been deactivated.')

        if settings.USERS_NEEDS_TO_BE_APPROVED and not user.is_approved:
            logger.warning(
                "Login failed - user_not_approved, user_id=%s, username=%s, ip=%s",
                user.id,
                user.username,
                client_ip,
            )
            raise serializers.ValidationError('User account is pending approval.')

        token = Token.objects.filter(user=user).first()
        if not token:
            token = Token.objects.create(user=user)

        return {'email': user.email, 'username': user.username, 'token': token.key}
