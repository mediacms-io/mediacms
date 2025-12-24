"""
REST API Serializers for LTI

Currently minimal - can be expanded for API endpoints if needed
"""

from rest_framework import serializers

from .models import LTIPlatform, LTIResourceLink, LTIUserMapping


class LTIPlatformSerializer(serializers.ModelSerializer):
    """Serializer for LTI Platform"""

    class Meta:
        model = LTIPlatform
        fields = ['id', 'name', 'platform_id', 'active', 'enable_nrps', 'enable_deep_linking']
        read_only_fields = ['id']


class LTIResourceLinkSerializer(serializers.ModelSerializer):
    """Serializer for LTI Resource Link"""

    platform_name = serializers.CharField(source='platform.name', read_only=True)
    category_title = serializers.CharField(source='category.title', read_only=True)

    class Meta:
        model = LTIResourceLink
        fields = ['id', 'platform', 'platform_name', 'context_id', 'context_title', 'category', 'category_title', 'launch_count', 'last_launch']
        read_only_fields = ['id', 'launch_count', 'last_launch']


class LTIUserMappingSerializer(serializers.ModelSerializer):
    """Serializer for LTI User Mapping"""

    username = serializers.CharField(source='user.username', read_only=True)
    platform_name = serializers.CharField(source='platform.name', read_only=True)

    class Meta:
        model = LTIUserMapping
        fields = ['id', 'platform', 'platform_name', 'lti_user_id', 'user', 'username', 'email', 'name', 'last_login']
        read_only_fields = ['id', 'last_login']
