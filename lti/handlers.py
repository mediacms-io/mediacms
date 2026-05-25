"""
LTI Launch Handlers for User and Context Provisioning

Provides functions to:
- Create/update MediaCMS users from LTI launches
- Create/update categories and RBAC groups for courses
- Apply role mappings from LTI to MediaCMS
- Create and manage LTI sessions
"""

import base64
import hashlib
import json
import logging

from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth import login
from django.utils import timezone

from files.models import Category
from rbac.models import RBACGroup, RBACMembership, RBACRole
from users.models import User

from .models import LTIResourceLink, LTIRoleMapping, LTIUserMapping

logger = logging.getLogger(__name__)

DEFAULT_LTI_ROLE_MAPPINGS = {
    # LTI role names (used in standard launches)
    'Instructor': {'global_role': '', 'group_role': 'manager'},
    'TeachingAssistant': {'global_role': '', 'group_role': 'contributor'},
    'Learner': {'global_role': '', 'group_role': 'member'},
    'Student': {'global_role': '', 'group_role': 'member'},
    'Administrator': {'global_role': '', 'group_role': 'manager'},
    'Faculty': {'global_role': '', 'group_role': 'manager'},
    # Moodle role shortnames (used in custom_publishdata from My Media launches)
    'student': {'global_role': '', 'group_role': 'member'},
    'guest': {'global_role': '', 'group_role': 'member'},
    'teacher': {'global_role': '', 'group_role': 'manager'},
    'editingteacher': {'global_role': '', 'group_role': 'manager'},
    'manager': {'global_role': '', 'group_role': 'manager'},
    'coursecreator': {'global_role': '', 'group_role': 'manager'},
    'ta': {'global_role': '', 'group_role': 'contributor'},
}


def _ensure_course_context(platform, context_id, title, label, resource_link_id):
    """
    Find or create the LTIResourceLink, Category, and RBACGroup for a course.

    When a record already exists (e.g. created by a bulk My Media launch), it is
    reused and its metadata is kept in sync.  The resource_link_id is only
    promoted when a real launch ID arrives to replace a 'bulk_*' placeholder.

    Returns:
        Tuple of (category, rbac_group, resource_link)
    """
    resource_link = LTIResourceLink.objects.filter(
        platform=platform,
        context_id=context_id,
    ).first()

    if resource_link:
        category = resource_link.category
        rbac_group = resource_link.rbac_group

        rl_updates = []
        if title and resource_link.context_title != title:
            resource_link.context_title = title
            rl_updates.append('context_title')
        if label and resource_link.context_label != label:
            resource_link.context_label = label
            rl_updates.append('context_label')
        # Promote from bulk placeholder to real resource link ID.
        if resource_link_id and not resource_link_id.startswith('bulk_') and resource_link.resource_link_id != resource_link_id:
            resource_link.resource_link_id = resource_link_id
            rl_updates.append('resource_link_id')
        if rl_updates:
            resource_link.save(update_fields=rl_updates)

        if title and category and category.title != title:
            category.title = title
            category.save(update_fields=['title'])

    else:
        category = Category.objects.create(
            title=title or label or f'Course {context_id}',
            description=f'Auto-created from {platform.name}: {title}',
            is_global=False,
            is_rbac_category=True,
            is_lms_course=True,
            lti_platform=platform,
            lti_context_id=context_id,
        )
        rbac_group = RBACGroup.objects.create(
            name=f'{title or label} ({platform.name})',
            description=f'LTI course group from {platform.name}',
        )
        rbac_group.categories.add(category)
        resource_link = LTIResourceLink.objects.create(
            platform=platform,
            context_id=context_id,
            resource_link_id=resource_link_id,
            context_title=title,
            context_label=label,
            category=category,
            rbac_group=rbac_group,
        )

    return category, rbac_group, resource_link


_VALID_RBAC_ROLES = {r.value for r in RBACRole}


def _ensure_membership(user, rbac_group, group_role):
    """
    Ensure the user is a member of rbac_group with group_role.
    Updates the role if it differs from the current one, in either direction.
    """
    if group_role not in _VALID_RBAC_ROLES:
        return
    existing = RBACMembership.objects.filter(user=user, rbac_group=rbac_group).first()
    if existing:
        if group_role != existing.role:
            existing.role = group_role
            existing.save(update_fields=['role'])
    else:
        try:
            RBACMembership.objects.create(user=user, rbac_group=rbac_group, role=group_role)
        except Exception:
            pass


def provision_lti_user(platform, claims):
    """
    Provision MediaCMS user from LTI launch claims.

    Returns:
        User instance
    """
    lti_user_id = claims.get('sub')
    if not lti_user_id:
        raise ValueError("Missing 'sub' claim in LTI launch")

    email = claims.get('email', '')
    given_name = claims.get('given_name', '')
    family_name = claims.get('family_name', '')
    name = claims.get('name', f"{given_name} {family_name}").strip()

    mapping = LTIUserMapping.objects.filter(platform=platform, lti_user_id=lti_user_id).select_related('user').first()

    if mapping:
        user = mapping.user
        update_fields = []

        if email and user.email != email:
            user.email = email
            update_fields.append('email')
        if given_name and user.first_name != given_name:
            user.first_name = given_name
            update_fields.append('first_name')
        if family_name and user.last_name != family_name:
            user.last_name = family_name
            update_fields.append('last_name')
        if name and user.name != name:
            user.name = name
            update_fields.append('name')

        if update_fields:
            user.save(update_fields=update_fields)

    else:
        username = generate_username_from_lti(lti_user_id, email, given_name, family_name)
        if User.objects.filter(username=username).exists():
            username = f"{username}_{hashlib.md5(lti_user_id.encode()).hexdigest()[:6]}"

        user = User.objects.create_user(
            username=username,
            email=email or '',
            first_name=given_name,
            last_name=family_name,
            name=name or username,
            is_active=True,
        )

        if email:
            try:
                EmailAddress.objects.create(user=user, email=email, verified=True, primary=True)
            except Exception:
                pass

        LTIUserMapping.objects.create(platform=platform, lti_user_id=lti_user_id, user=user)

    return user


def generate_username_from_lti(lti_user_id, email, given_name, family_name):
    """Generate a username from LTI user info."""
    if email and '@' in email:
        username = email.split('@')[0]
        username = ''.join(c if c.isalnum() or c in '_-' else '_' for c in username)
        if len(username) >= 4:
            return username[:30]

    if given_name and family_name:
        username = f"{given_name}.{family_name}".lower()
        username = ''.join(c if c.isalnum() or c in '_-.' else '_' for c in username)
        if len(username) >= 4:
            return username[:30]

    return f"lti_user_{hashlib.md5(lti_user_id.encode()).hexdigest()[:10]}"


def provision_lti_context(platform, claims, resource_link_id):
    """
    Provision MediaCMS category and RBAC group for an LTI context (course).

    Returns:
        Tuple of (category, rbac_group, resource_link)
    """
    context = claims.get('https://purl.imsglobal.org/spec/lti/claim/context', {})
    context_id = context.get('id')
    if not context_id:
        raise ValueError("Missing context ID in LTI launch")

    return _ensure_course_context(
        platform=platform,
        context_id=str(context_id),
        title=context.get('title', ''),
        label=context.get('label', ''),
        resource_link_id=resource_link_id,
    )


def provision_lti_bulk_contexts(platform, user, publish_data_raw):
    """
    Bulk-provision categories, groups, and memberships for every course the
    user is enrolled in, as reported by the LMS via custom_publishdata.

    Called on My Media launches. Skips the Moodle site course (ID 1).
    """
    try:
        padding = 4 - len(publish_data_raw) % 4
        if padding != 4:
            publish_data_raw += '=' * padding
        courses = json.loads(base64.b64decode(publish_data_raw).decode('utf-8'))
    except Exception as exc:
        logger.warning('provision_lti_bulk_contexts: failed to decode publishdata: %s', exc)
        return

    if not isinstance(courses, list):
        logger.warning('provision_lti_bulk_contexts: publishdata is not a list')
        return

    seen_group_ids = set()

    for course in courses:
        try:
            course_id = str(course.get('id', '')).strip()
            if not course_id:
                continue

            fullname = course.get('fullname', '')
            shortname = course.get('shortname', '')
            group_role = DEFAULT_LTI_ROLE_MAPPINGS.get(course.get('role', 'student'), {}).get('group_role', 'member')

            _, rbac_group, _ = _ensure_course_context(
                platform=platform,
                context_id=course_id,
                title=fullname,
                label=shortname,
                resource_link_id=f'bulk_{course_id}',
            )

            if rbac_group:
                _ensure_membership(user, rbac_group, group_role)
                seen_group_ids.add(rbac_group.id)

        except Exception as exc:
            logger.warning(
                'provision_lti_bulk_contexts: error processing course %s: %s',
                course.get('id'),
                exc,
            )

    # Remove memberships for groups that belong to this platform but were absent
    # from the current publishdata — meaning the user is no longer enrolled.
    if seen_group_ids:
        platform_group_ids = set(LTIResourceLink.objects.filter(platform=platform, rbac_group__isnull=False).values_list('rbac_group_id', flat=True))
        stale_ids = platform_group_ids - seen_group_ids
        if stale_ids:
            deleted, _ = RBACMembership.objects.filter(user=user, rbac_group_id__in=stale_ids).delete()
            if deleted:
                logger.info(
                    'provision_lti_bulk_contexts: removed %d stale membership(s) for user %s',
                    deleted,
                    user.username,
                )


def apply_lti_roles(user, platform, lti_roles, rbac_group):
    """
    Apply role mappings from LTI role URIs to MediaCMS global and group roles.

    Returns:
        Tuple of (global_role, group_role)
    """
    short_roles = []
    for role in lti_roles or []:
        if '#' in role:
            short_roles.append(role.split('#')[-1])
        elif '/' in role:
            short_roles.append(role.split('/')[-1])
        else:
            short_roles.append(role)

    custom_mappings = {m.lti_role: {'global_role': m.global_role, 'group_role': m.group_role} for m in LTIRoleMapping.objects.filter(platform=platform)}
    all_mappings = {**DEFAULT_LTI_ROLE_MAPPINGS, **custom_mappings}

    global_role = 'user'
    group_role = 'member'
    for role in short_roles:
        if role in all_mappings:
            if all_mappings[role].get('global_role'):
                global_role = get_higher_privilege_global(global_role, all_mappings[role]['global_role'])
            if all_mappings[role].get('group_role'):
                group_role = resolve_group_role(group_role, all_mappings[role]['group_role'])

    user.set_role_from_mapping(global_role)
    _ensure_membership(user, rbac_group, group_role)

    return global_role, group_role


def get_higher_privilege_global(role1, role2):
    """Return the higher privilege global role."""
    privilege_order = ['user', 'advancedUser', 'editor', 'manager', 'admin']
    try:
        return privilege_order[max(privilege_order.index(role1), privilege_order.index(role2))]
    except ValueError:
        return role2


def resolve_group_role(role1, role2):
    """Return whichever of role1/role2 has higher privilege."""
    privilege_order = ['member', 'contributor', 'manager']
    try:
        return privilege_order[max(privilege_order.index(role1), privilege_order.index(role2))]
    except ValueError:
        return role2


def create_lti_session(request, user, launch_data, platform):
    """Create a MediaCMS session from an LTI launch."""
    login(request, user, backend='django.contrib.auth.backends.ModelBackend')

    ld = launch_data.get_launch_data()
    context = ld.get('https://purl.imsglobal.org/spec/lti/claim/context', {})
    resource_link = ld.get('https://purl.imsglobal.org/spec/lti/claim/resource_link', {})
    roles = ld.get('https://purl.imsglobal.org/spec/lti/claim/roles', [])

    request.session['lti_session'] = {
        'platform_id': platform.id,
        'platform_name': platform.name,
        'context_id': context.get('id'),
        'context_title': context.get('title'),
        'resource_link_id': resource_link.get('id'),
        'roles': roles,
        'launch_time': timezone.now().isoformat(),
    }

    request.session.set_expiry(getattr(settings, 'LTI_SESSION_TIMEOUT', 3600))
    request.session.modified = True
    request.session.save()

    return True


def validate_lti_session(request):
    """
    Validate that an LTI session exists and is valid.

    Returns:
        Dict of LTI session data or None
    """
    if not request.user.is_authenticated:
        return None
    return request.session.get('lti_session')
