import logging

from django.dispatch import receiver
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.signals import social_account_updated, social_account_added

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
        perform_user_actions(user)
        return user

@receiver(social_account_updated)
def social_account_updated(sender, request, sociallogin, **kwargs):
    # Runs after existing user is updated
    user = sociallogin.user
    perform_user_actions(user)


def perform_user_actions(user):
    try:
        # set logo, if not set, and it exists
        # get groups, create + add user (based in option)
        # remove from groups (based in option)

        except Exception as e:
            logging.error(e)
    return user
