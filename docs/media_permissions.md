# Media Permissions in MediaCMS

This document explains the permission system in MediaCMS, which controls who can view, edit, and manage media files.

## Overview

MediaCMS provides a flexible permission system that allows fine-grained control over media access. The system supports:

1. **Basic permissions** - Public, private, and unlisted media
2. **User-specific permissions** - Direct permissions granted to specific users
3. **Role-Based Access Control (RBAC)** - Category-based permissions through group membership

## Media States

Every media file has a state that determines its basic visibility:

- **Public** - Visible to everyone
- **Private** - Only visible to the owner and users with explicit permissions
- **Unlisted** - Not listed in public listings but accessible via direct link


## User Roles

MediaCMS has several user roles that affect permissions:

- **Regular User** - Can upload and manage their own media
- **Advanced User** - Additional capabilities (configurable)
- **MediaCMS Editor** - Can edit and review content across the platform
- **MediaCMS Manager** - Full management capabilities
- **Admin** - Complete system access

## Direct Media Permissions

The `MediaPermission` model allows granting specific permissions to individual users:

### Permission Levels

- **Viewer** - Can view the media even if it's private
- **Editor** - Can view and edit the media's metadata
- **Owner** - Full control, including deletion

## Role-Based Access Control (RBAC)

When RBAC is enabled (`USE_RBAC` setting), permissions can be managed through categories and groups:

1. Categories can be marked as RBAC-controlled
2. Users are assigned to RBAC groups with specific roles
3. RBAC groups are associated with categories
4. Users inherit permissions to media in those categories based on their role

### RBAC Roles

- **Member** - Can view media in the category
- **Contributor** - Can view and edit media in the category
- **Manager** - Full control over media in the category

## Permission Checking Methods

The User model provides several methods to check permissions:

```python
# From users/models.py
def has_member_access_to_media(self, media):
    # Check if user can view the media
    # ...

def has_contributor_access_to_media(self, media):
    # Check if user can edit the media
    # ...

def has_owner_access_to_media(self, media):
    # Check if user has full control over the media
    # ...
```

## How Permissions Are Applied

When a user attempts to access media, the system checks permissions in this order:

1. Is the media public? If yes, allow access.
2. Is the user the owner of the media? If yes, allow full access.
3. Does the user have direct permissions through MediaPermission? If yes, grant the corresponding access level.
4. If RBAC is enabled, does the user have access through category membership? If yes, grant the corresponding access level.
5. If none of the above, deny access.

## Media Sharing

Users can share media with others by:

1. Making it public or unlisted
2. Granting direct permissions to specific users
3. Adding it to a category that's accessible to an RBAC group

## Implementation Details

### Media Listing

When listing media, the system filters based on permissions:

```python
# Simplified example from files/views/media.py
def _get_media_queryset(self, request, user=None):
    # 1. Public media
    listable_media = Media.objects.filter(listable=True)

    if not request.user.is_authenticated:
        return listable_media

    # 2. User permissions for authenticated users
    user_media = Media.objects.filter(permissions__user=request.user)

    # 3. RBAC for authenticated users
    if getattr(settings, 'USE_RBAC', False):
        rbac_categories = request.user.get_rbac_categories_as_member()
        rbac_media = Media.objects.filter(category__in=rbac_categories)

    # Combine all accessible media
    return listable_media.union(user_media, rbac_media)
```

### Permission Checking

The system uses helper methods to check permissions:

```python
# From users/models.py
def has_member_access_to_media(self, media):
    # First check if user is the owner
    if media.user == self:
        return True

    # Then check RBAC permissions
    if getattr(settings, 'USE_RBAC', False):
        rbac_groups = RBACGroup.objects.filter(
            memberships__user=self,
            memberships__role__in=["member", "contributor", "manager"],
            categories__in=media.category.all()
        ).distinct()
        if rbac_groups.exists():
            return True

    # Then check MediaShare permissions for any access
    media_permission_exists = MediaPermission.objects.filter(
        user=self,
        media=media,
    ).exists()

    return media_permission_exists
```

## Best Practices

1. **Default to Private** - Consider setting new uploads to private by default
2. **Use Categories** - Organize media into categories for easier permission management
3. **RBAC for Teams** - Use RBAC for team collaboration scenarios
4. **Direct Permissions for Exceptions** - Use direct permissions for one-off sharing

## Configuration

The permission system can be configured through several settings:

- `USE_RBAC` - Enable/disable Role-Based Access Control

## Conclusion

MediaCMS provides a flexible and powerful permission system that can accommodate various use cases, from simple personal media libraries to complex team collaboration scenarios with fine-grained access control.
