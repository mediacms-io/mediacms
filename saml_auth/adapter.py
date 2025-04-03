import base64
import logging

from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialApp
from allauth.socialaccount.signals import social_account_updated
from django.core.files.base import ContentFile
from django.dispatch import receiver

from identity_providers.models import IdentityProviderUserLog
from rbac.models import RBACGroup, RBACMembership


class SAMLAccountAdapter(DefaultSocialAccountAdapter):
    def is_open_for_signup(self, request, socialaccount):
        return True

    def pre_social_login(self, request, sociallogin):
        # data = sociallogin.data

        return super().pre_social_login(request, sociallogin)

    def populate_user(self, request, sociallogin, data):
        user = sociallogin.user
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
    # data is there due to populate_user
    common_fields = sociallogin.data
    perform_user_actions(user, sociallogin.account, common_fields)


def perform_user_actions(user, social_account, common_fields=None):
    # common_fields is data already mapped to the attributes we want
    if common_fields:
        # check the following fields, if they are updated from the IDP side, update
        # the user object too
        fields_to_update = []
        for item in ["name", "first_name", "last_name", "email"]:
            if common_fields.get(item) and common_fields[item] != getattr(user, item):
                setattr(user, item, common_fields[item])
                fields_to_update.append(item)
        if fields_to_update:
            user.save(update_fields=fields_to_update)

    # extra_data is the plain response from SAML provider

    extra_data = social_account.extra_data
    # there's no FK from Social Account to Social App
    social_app = SocialApp.objects.filter(provider_id=social_account.provider).first()
    saml_configuration = None
    if social_app:
        saml_configuration = social_app.saml_configurations.first()

    add_user_logo(user, extra_data)
    handle_role_mapping(user, extra_data, social_app, saml_configuration)
    if saml_configuration and saml_configuration.save_saml_response_logs:
        handle_saml_logs_save(user, extra_data, social_app)

    return user


def add_user_logo(user, extra_data):
    try:
        if extra_data.get("jpegPhoto") and user.logo.name in ["userlogos/user.jpg", "", None]:
            base64_string = extra_data.get("jpegPhoto")[0]
            image_data = base64.b64decode(base64_string)
            image_content = ContentFile(image_data)
            user.logo.save('user.jpg', image_content, save=True)
    except Exception as e:
        logging.error(e)
    return True


def handle_role_mapping(user, extra_data, social_app, saml_configuration):
    if not saml_configuration:
        return False

    rbac_groups = []
    role = "member"
    # get groups key from configuration / attributes mapping
    groups_key = saml_configuration.groups
    groups = extra_data.get(groups_key, [])
    # groups is a list of group_ids here

    if groups:
        rbac_groups = RBACGroup.objects.filter(identity_provider=social_app, uid__in=groups)

    try:
        # try to get the role, always use member as fallback
        role_key = saml_configuration.role
        role = extra_data.get(role_key, "student")
        if role and isinstance(role, list):
            role = role[0]

        # populate global role
        global_role = social_app.global_roles.filter(name=role).first()
        if global_role:
            user.set_role_from_mapping(global_role.map_to)

        group_role = social_app.group_roles.filter(name=role).first()
        if group_role:
            if group_role.map_to in ['member', 'contributor', 'manager']:
                role = group_role.map_to

    except Exception as e:
        logging.error(e)

    role = role if role in ['member', 'contributor', 'manager'] else 'member'

    for rbac_group in rbac_groups:
        membership = RBACMembership.objects.filter(user=user, rbac_group=rbac_group).first()
        if membership and role != membership.role:
            membership.role = role
            membership.save(update_fields=["role"])
        if not membership:
            try:
                # use role from early above
                membership = RBACMembership.objects.create(user=user, rbac_group=rbac_group, role=role)
            except Exception as e:
                logging.error(e)
    # if remove_from_groups setting is True and user is part of groups for this
    # social app that are not included anymore on the response, then remove user from group
    if saml_configuration.remove_from_groups:
        for group in user.rbac_groups.filter(identity_provider=social_app):
            if group not in rbac_groups:
                group.members.remove(user)

    return True


def handle_saml_logs_save(user, extra_data, social_app):
    # do not save jpegPhoto, if it exists
    extra_data.pop("jpegPhoto", None)
    log = IdentityProviderUserLog.objects.create(user=user, identity_provider=social_app, logs=extra_data)  # noqa
    return True
