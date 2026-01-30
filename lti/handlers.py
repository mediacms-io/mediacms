"""
LTI Launch Handlers for User and Context Provisioning

Provides functions to:
- Create/update MediaCMS users from LTI launches
- Create/update categories and RBAC groups for courses
- Apply role mappings from LTI to MediaCMS
- Create and manage LTI sessions
"""

import hashlib
import logging

from allauth.account.models import EmailAddress
from django.conf import settings
from django.contrib.auth import login
from django.utils import timezone

from files.models import Category
from rbac.models import RBACGroup, RBACMembership
from users.models import User

from .models import LTIResourceLink, LTIRoleMapping, LTIUserMapping

logger = logging.getLogger(__name__)

DEFAULT_LTI_ROLE_MAPPINGS = {
    'Instructor': {'global_role': '', 'group_role': 'manager'},
    'TeachingAssistant': {'global_role': '', 'group_role': 'contributor'},
    'Learner': {'global_role': '', 'group_role': 'member'},
    'Student': {'global_role': '', 'group_role': 'member'},
    'Administrator': {'global_role': '', 'group_role': 'manager'},
    'Faculty': {'global_role': '', 'group_role': 'manager'},
}


def provision_lti_user(platform, claims):
    """
    Provision MediaCMS user from LTI launch claims

    Args:
        platform: LTIPlatform instance
        claims: Dict of LTI launch claims

    Returns:
        User instance

    Pattern: Similar to saml_auth.adapter.perform_user_actions()
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

        user = User.objects.create_user(username=username, email=email or '', first_name=given_name, last_name=family_name, name=name or username, is_active=True)

        if email:
            try:
                EmailAddress.objects.create(user=user, email=email, verified=True, primary=True)
            except Exception:
                pass

        LTIUserMapping.objects.create(platform=platform, lti_user_id=lti_user_id, user=user)

    return user


def generate_username_from_lti(lti_user_id, email, given_name, family_name):
    """Generate a username from LTI user info"""

    if email and '@' in email:
        username = email.split('@')[0]
        username = ''.join(c if c.isalnum() or c in '_-' else '_' for c in username)
        if len(username) >= 4:
            return username[:30]  # Max 30 chars

    if given_name and family_name:
        username = f"{given_name}.{family_name}".lower()
        username = ''.join(c if c.isalnum() or c in '_-.' else '_' for c in username)
        if len(username) >= 4:
            return username[:30]

    user_hash = hashlib.md5(lti_user_id.encode()).hexdigest()[:10]
    return f"lti_user_{user_hash}"


def provision_lti_context(platform, claims, resource_link_id):
    """
    Provision MediaCMS category and RBAC group for LTI context (course)

    Args:
        platform: LTIPlatform instance
        claims: Dict of LTI launch claims
        resource_link_id: Resource link ID

    Returns:
        Tuple of (category, rbac_group, resource_link)

    Pattern: Integrates with existing Category and RBACGroup models
    """
    context = claims.get('https://purl.imsglobal.org/spec/lti/claim/context', {})
    context_id = context.get('id')
    if not context_id:
        raise ValueError("Missing context ID in LTI launch")

    context_title = context.get('title', '')
    context_label = context.get('label', '')

    resource_link = LTIResourceLink.objects.filter(
        platform=platform,
        context_id=context_id,
    ).first()

    if resource_link:
        category = resource_link.category
        rbac_group = resource_link.rbac_group

        update_fields = []
        if context_title and resource_link.context_title != context_title:
            resource_link.context_title = context_title
            update_fields.append('context_title')
        if context_label and resource_link.context_label != context_label:
            resource_link.context_label = context_label
            update_fields.append('context_label')
        # TODO / TOCHECK: consider whether we need to update this or not
        if resource_link.resource_link_id != resource_link_id:
            resource_link.resource_link_id = resource_link_id
            update_fields.append('resource_link_id')

        if update_fields:
            resource_link.save(update_fields=update_fields)

        if context_title and category and category.title != context_title:
            category.title = context_title
            category.save(update_fields=['title'])

    else:
        category = Category.objects.create(
            title=context_title or context_label or f"Course {context_id}",
            description=f"Auto-created from {platform.name}: {context_title}",
            is_global=False,
            is_rbac_category=True,
            is_lms_course=True,
            lti_platform=platform,
            lti_context_id=context_id,
        )

        rbac_group = RBACGroup.objects.create(
            name=f"{context_title or context_label} ({platform.name})",
            description=f"LTI course group from {platform.name}",
        )

        rbac_group.categories.add(category)

        resource_link = LTIResourceLink.objects.create(
            platform=platform,
            context_id=context_id,
            resource_link_id=resource_link_id,
            context_title=context_title,
            context_label=context_label,
            category=category,
            rbac_group=rbac_group,
        )

    return category, rbac_group, resource_link


def apply_lti_roles(user, platform, lti_roles, rbac_group):
    """
    Apply role mappings from LTI to MediaCMS

    Args:
        user: User instance
        platform: LTIPlatform instance
        lti_roles: List of LTI role URIs
        rbac_group: RBACGroup instance for course

    Pattern: Similar to saml_auth.adapter.handle_role_mapping()
    """
    if not lti_roles:
        lti_roles = []

    short_roles = []
    for role in lti_roles:
        if '#' in role:
            short_roles.append(role.split('#')[-1])
        elif '/' in role:
            short_roles.append(role.split('/')[-1])
        else:
            short_roles.append(role)

    custom_mappings = {}
    for mapping in LTIRoleMapping.objects.filter(platform=platform):
        custom_mappings[mapping.lti_role] = {
            'global_role': mapping.global_role,
            'group_role': mapping.group_role,
        }

    all_mappings = {**DEFAULT_LTI_ROLE_MAPPINGS, **custom_mappings}

    global_role = 'user'
    for role in short_roles:
        if role in all_mappings:
            role_global = all_mappings[role].get('global_role')
            if role_global:
                global_role = get_higher_privilege_global(global_role, role_global)

    user.set_role_from_mapping(global_role)

    group_role = 'member'
    for role in short_roles:
        if role in all_mappings:
            role_group = all_mappings[role].get('group_role')
            if role_group:
                group_role = get_higher_privilege_group(group_role, role_group)

    memberships = RBACMembership.objects.filter(user=user, rbac_group=rbac_group)

    if memberships.exists():
        if not memberships.filter(role=group_role).exists():
            first_membership = memberships.first()
            first_membership.role = group_role
            try:
                first_membership.save()
            except Exception:
                pass
    else:
        try:
            RBACMembership.objects.create(user=user, rbac_group=rbac_group, role=group_role)
        except Exception:
            pass

    return global_role, group_role


def get_higher_privilege_global(role1, role2):
    """Return the higher privilege global role"""
    privilege_order = ['user', 'advancedUser', 'editor', 'manager', 'admin']
    try:
        index1 = privilege_order.index(role1)
        index2 = privilege_order.index(role2)
        return privilege_order[max(index1, index2)]
    except ValueError:
        return role2  # Default to role2 if role1 is unknown


def get_higher_privilege_group(role1, role2):
    """Return the higher privilege group role"""
    privilege_order = ['member', 'contributor', 'manager']
    try:
        index1 = privilege_order.index(role1)
        index2 = privilege_order.index(role2)
        return privilege_order[max(index1, index2)]
    except ValueError:
        return role2  # Default to role2 if role1 is unknown


def create_lti_session(request, user, launch_data, platform):
    """
    Create MediaCMS session from LTI launch

    Args:
        request: Django request
        user: User instance
        launch_data: Dict of validated LTI launch data
        platform: LTIPlatform instance

    Pattern: Uses Django's session framework
    """
    login(request, user, backend='django.contrib.auth.backends.ModelBackend')

    context = launch_data.get_launch_data().get('https://purl.imsglobal.org/spec/lti/claim/context', {})
    resource_link = launch_data.get_launch_data().get('https://purl.imsglobal.org/spec/lti/claim/resource_link', {})
    roles = launch_data.get_launch_data().get('https://purl.imsglobal.org/spec/lti/claim/roles', [])

    request.session['lti_session'] = {
        'platform_id': platform.id,
        'platform_name': platform.name,
        'context_id': context.get('id'),
        'context_title': context.get('title'),
        'resource_link_id': resource_link.get('id'),
        'roles': roles,
        'launch_time': timezone.now().isoformat(),
    }

    timeout = getattr(settings, 'LTI_SESSION_TIMEOUT', 3600)
    request.session.set_expiry(timeout)

    # CRITICAL: Explicitly save session before redirect (for cross-site contexts)
    request.session.modified = True
    request.session.save()

    return True


def validate_lti_session(request):
    """
    Validate that an LTI session exists and is valid

    Returns:
        Dict of LTI session data or None
    """

    lti_session = request.session.get('lti_session')

    if not lti_session:
        return None

    if not request.user.is_authenticated:
        return None

    return lti_session
