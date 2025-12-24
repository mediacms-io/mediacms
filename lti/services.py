"""
LTI Names and Role Provisioning Service (NRPS) Client

Fetches course membership from Moodle via NRPS and syncs to MediaCMS RBAC groups
"""

import logging

from django.utils import timezone
from pylti1p3.names_roles import NamesRolesProvisioningService

from users.models import User

from .handlers import apply_lti_roles, generate_username_from_lti
from .models import LTIUserMapping

logger = logging.getLogger(__name__)


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
            logger.warning(f"NRPS disabled for platform {self.platform.name}")
            return False

        if not self.nrps_claim:
            logger.warning("NRPS claim missing in launch data")
            return False

        service_url = self.nrps_claim.get('context_memberships_url')
        if not service_url:
            logger.warning("NRPS context_memberships_url missing")
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
            service_url = self.nrps_claim.get('context_memberships_url')

            # Use PyLTI1p3's NRPS service
            # Note: This requires proper configuration in the tool config
            from .adapters import DjangoToolConfig

            tool_config = DjangoToolConfig.from_platform(self.platform)

            nrps = NamesRolesProvisioningService(tool_config, service_url)

            # Fetch members
            members = nrps.get_members()

            logger.info(f"Fetched {len(members)} members from NRPS for platform {self.platform.name}")
            return members

        except Exception as e:
            logger.error(f"NRPS fetch error: {str(e)}", exc_info=True)
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
            logger.warning("No members fetched from NRPS")
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

            except Exception as e:
                logger.error(f"Error syncing NRPS member {member.get('user_id')}: {str(e)}")
                continue

        # Remove unenrolled users if configured
        removed_count = 0
        if self.platform.remove_from_groups_on_unenroll:
            from rbac.models import RBACMembership

            removed = RBACMembership.objects.filter(rbac_group=rbac_group).exclude(user_id__in=processed_users)

            removed_count = removed.count()
            removed.delete()

            logger.info(f"Removed {removed_count} unenrolled users from RBAC group {rbac_group.name}")

        result = {'synced': synced_count, 'removed': removed_count, 'synced_at': timezone.now().isoformat()}

        logger.info(f"NRPS sync complete for {rbac_group.name}: {result}")

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
            logger.warning("NRPS member missing user_id")
            return None

        # Check for existing mapping
        mapping = LTIUserMapping.objects.filter(platform=self.platform, lti_user_id=user_id).select_related('user').first()

        if mapping:
            # User already exists
            return mapping.user

        # Create new user from NRPS data
        name = member.get('name', '')
        email = member.get('email', '')
        given_name = member.get('given_name', '')
        family_name = member.get('family_name', '')

        # Generate username
        username = generate_username_from_lti(user_id, email, given_name, family_name)

        # Check if username exists
        if User.objects.filter(username=username).exists():
            import hashlib

            username = f"{username}_{hashlib.md5(user_id.encode()).hexdigest()[:6]}"

        # Create user
        user = User.objects.create_user(username=username, email=email or '', first_name=given_name, last_name=family_name, name=name or username, is_active=True)

        # Create mapping
        LTIUserMapping.objects.create(platform=self.platform, lti_user_id=user_id, user=user, email=email, given_name=given_name, family_name=family_name, name=name)

        # Mark email as verified
        if email:
            try:
                from allauth.account.models import EmailAddress

                EmailAddress.objects.create(user=user, email=email, verified=True, primary=True)
            except Exception as e:
                logger.warning(f"Could not create EmailAddress for NRPS user: {e}")

        logger.info(f"Created user {username} from NRPS data")

        return user
