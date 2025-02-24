import logging

from django.core.files import File
from django.dispatch import receiver
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialAccount, SocialApp
from allauth.socialaccount.signals import social_account_updated, social_account_added

from rbac.models import RBACGroup, RBACMembership
from saml_auth.models import SAMLLog


class SAMLAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        user = sociallogin.user
        data = sociallogin.data
        role = data.get("role", "")

        return super().pre_social_login(request, sociallogin)

    def populate_user(self, request, sociallogin, data):
        user = sociallogin.user
        uid = sociallogin.account.uid
        user.username = sociallogin.account.uid
        for item in ["name", "first_name", "last_name"]:
            if data.get(item):
                setattr(user, item, data[item])
        sociallogin.data = data
        # User is not retrieved through DB. Id is None.
        
        return user

    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)
        # Runs after new user is created
        perform_user_actions(user, sociallogin.account)
        return user

@receiver(social_account_updated)
def social_account_updated(sender, request, sociallogin, **kwargs):
    # Runs after existing user is updated
    user = sociallogin.user
    perform_user_actions(user, sociallogin.account)


def perform_user_actions(user, social_account):
    extra_data = social_account.extra_data
    # there's no FK from Social Account to Social App
    social_app = SocialApp.objects.filter(provider_id=social_account.provider).first()
    saml_configuration = None
    if social_app:
        saml_configuration = social_app.saml_configurations.first()

    add_user_logo(user, extra_data)
    handle_rbac_groups(user, extra_data, social_app, saml_configuration)
    if saml_configuration and saml_configuration.save_saml_response_logs:
        handle_saml_logs_save(user, extra_data, social_app)

    return user

def add_user_logo(user, extra_data):
    try:
        if user.logo.name == "userlogos/user.jpg" and extra_data.get("jpegPhoto"):
            image_data = extra_data.get("jpegPhoto")[0]
            logo = File(image_data)
            user.logo.save(content=logo, name="jpegPhoto")
    except Exception as e:
        logging.error(e)
    return True    

def handle_rbac_groups(user, extra_data, social_app, saml_configuration):
    rbac_groups = []
    role = "member"
    if saml_configuration:
        # get groups key from configuration / attributes mapping
        groups_key = saml_configuration.groups
        groups = extra_data.get(groups_key, [])
        
        try:
            # try to get the role, always use member as fallback
            role_key = saml_configuration.role
            role = extra_data.get(role_key, "student")
            if role and isinstance(role, list):
                role = role[0]
            
            role = saml_configuration.role_mapping.get(role, "member")
            
            if role not in ['member', 'contributor', 'manager']:
                role = 'member'
            # TODO: move to helper function for consistent checking
        except Exception as e:
            logging.error(e)
        if saml_configuration.create_groups and groups:
            try:
                for group_name in groups:
                    rbac_group, created = RBACGroup.objects.get_or_create(
                        uid=group_name,
                        social_app=social_app,
                        defaults={
                        "name": f"{group_name} Group",
                        "description": f"Group for {group_name}",
                        }
                    )
                    rbac_groups.append(rbac_group)        
            except Exception as e:
                logging.error(e)

    for rbac_group in rbac_groups:
        membership = RBACMembership.objects.filter(user=user, rbac_group=rbac_group).first()
        if not membership:
            try:
                # use role from early above
                membership = RBACMembership.objects.create(user=user, rbac_group=rbac_group, role=role)
            except Exception as e:
                logging.error(e)
    # if remove_from_groups setting is True and user is part of groups for this
    # social app that are not included anymore on the response, then remove user from group
    if saml_configuration and saml_configuration.remove_from_groups:
        for group in user.rbac_groups.filter(social_app=social_app):
            if group not in rbac_groups:
                group.members.remove(user)

    return True


def handle_saml_logs_save(user, extra_data, social_app):
    # do not save jpegPhoto, if it exists
    extra_data.pop("jpegPhoto", None)
    log = SAMLLog.objects.create(user=user, social_app=social_app, logs=extra_data)
    return True

