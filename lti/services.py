"""
LTI Names and Role Provisioning Service (NRPS) Client

Fetches course membership from Moodle via NRPS and syncs to MediaCMS RBAC groups
"""

import hashlib

from allauth.account.models import EmailAddress
from django.utils import timezone
from pylti1p3.names_roles import NamesRolesProvisioningService

from rbac.models import RBACMembership
from users.models import User

from .adapters import DjangoToolConfig
from .handlers import apply_lti_roles, generate_username_from_lti
from .models import LTIUserMapping


class LTINRPSClient:
    """Client for Names and Role Provisioning Service"""

    def __init__(self, platform, launch_claims):
        """
        Initialize NRPS client

        Args:
            platform: LTIPlatform instance
            launch_claims: Dict of LTI launch claims containing NRPS endpoint
        """
        self.platform = platform
        self.launch_claims = launch_claims

        # Extract NRPS claim
        self.nrps_claim = launch_claims.get('https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice')

    def can_sync(self):
        """Check if NRPS sync is available"""
        if not self.platform.enable_nrps:
            return False

        if not self.nrps_claim:
            return False

        service_url = self.nrps_claim.get('context_memberships_url')
        if not service_url:
            return False

        return True

    def fetch_members(self):
        """
        Fetch all course members from Moodle via NRPS

        Returns:
            List of member dicts with keys: user_id, name, email, roles, etc.
        """
        if not self.can_sync():
            return []

        try:
            # Use PyLTI1p3's NRPS service
            # Note: This requires proper configuration in the tool config
            tool_config = DjangoToolConfig.from_platform(self.platform)

            # Pass the entire NRPS claim as service_data, not just the URL
            nrps = NamesRolesProvisioningService(tool_config, self.nrps_claim)

            # Fetch members
            members = nrps.get_members()

            return members

        except Exception:
            return []

    def sync_members_to_rbac_group(self, rbac_group):
        """
        Sync NRPS members to MediaCMS RBAC group

        Args:
            rbac_group: RBACGroup instance

        Returns:
            Dict with sync results
        """
        members = self.fetch_members()

        if not members:
            return {'synced': 0, 'removed': 0, 'synced_at': timezone.now().isoformat()}

        processed_users = set()
        synced_count = 0

        for member in members:
            try:
                user = self._get_or_create_user_from_nrps(member)
                if not user:
                    continue

                processed_users.add(user.id)

                # Get roles from member
                roles = member.get('roles', [])

                # Apply role mapping
                apply_lti_roles(user, self.platform, roles, rbac_group)

                synced_count += 1

            except Exception:
                continue

        # Remove unenrolled users if configured
        removed_count = 0
        if self.platform.remove_from_groups_on_unenroll:
            removed = RBACMembership.objects.filter(rbac_group=rbac_group).exclude(user_id__in=processed_users)

            removed_count = removed.count()
            removed.delete()

        result = {'synced': synced_count, 'removed': removed_count, 'synced_at': timezone.now().isoformat()}

        return result

    def _get_or_create_user_from_nrps(self, member):
        """
        Get or create MediaCMS user from NRPS member data

        Args:
            member: Dict of member data from NRPS

        Returns:
            User instance or None
        """
        user_id = member.get('user_id')
        if not user_id:
            return None

        # Get user details from NRPS data
        name = member.get('name', '')
        email = member.get('email', '')
        given_name = member.get('given_name', '')
        family_name = member.get('family_name', '')

        # Check for existing mapping
        mapping = LTIUserMapping.objects.filter(platform=self.platform, lti_user_id=user_id).select_related('user').first()

        if mapping:
            # Update existing user details if they changed
            user = mapping.user
            update_fields = []

            # Update email if changed and not empty
            if email and user.email != email:
                user.email = email
                update_fields.append('email')

            # Update name fields if changed
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

            # Update mapping cache
            mapping_update_fields = []
            if email and mapping.email != email:
                mapping.email = email
                mapping_update_fields.append('email')
            if given_name and mapping.given_name != given_name:
                mapping.given_name = given_name
                mapping_update_fields.append('given_name')
            if family_name and mapping.family_name != family_name:
                mapping.family_name = family_name
                mapping_update_fields.append('family_name')
            if name and mapping.name != name:
                mapping.name = name
                mapping_update_fields.append('name')

            if mapping_update_fields:
                mapping.save(update_fields=mapping_update_fields)

            return user

        # Create new user from NRPS data

        # Generate username
        username = generate_username_from_lti(user_id, email, given_name, family_name)

        # Check if username exists
        if User.objects.filter(username=username).exists():
            username = f"{username}_{hashlib.md5(user_id.encode()).hexdigest()[:6]}"

        # Create user
        user = User.objects.create_user(username=username, email=email or '', first_name=given_name, last_name=family_name, name=name or username, is_active=True)

        # Create mapping
        LTIUserMapping.objects.create(platform=self.platform, lti_user_id=user_id, user=user, email=email, given_name=given_name, family_name=family_name, name=name)

        # Mark email as verified
        if email:
            try:
                EmailAddress.objects.create(user=user, email=email, verified=True, primary=True)
            except Exception:
                pass

        return user
