from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.socialaccount.models import SocialAccount
from allauth.socialaccount.signals import social_account_added, social_account_updated
from allauth.account.utils import user_email, user_field, user_username

from django.conf import settings
from django.core.exceptions import ValidationError
from django.urls import reverse
from django.dispatch import receiver


class MyAccountAdapter(DefaultAccountAdapter):
    def get_email_confirmation_url_stub(self, request, emailconfirmation):
        url = reverse("account_confirm_email", args=[emailconfirmation.key])
        return settings.SSL_FRONTEND_HOST + url

    def clean_email(self, email):
        if hasattr(settings, "ALLOWED_DOMAINS_FOR_USER_REGISTRATION") and settings.ALLOWED_DOMAINS_FOR_USER_REGISTRATION:
            if email.split("@")[1] not in settings.ALLOWED_DOMAINS_FOR_USER_REGISTRATION:
                raise ValidationError("Domain is not in the permitted list")

        if email.split("@")[1] in settings.RESTRICTED_DOMAINS_FOR_USER_REGISTRATION:
            raise ValidationError("Domain is restricted from registering")
        return email

    def is_open_for_signup(self, request):
        return settings.USERS_CAN_SELF_REGISTER

    def send_mail(self, template_prefix, email, context):
        msg = self.render_mail(template_prefix, email, context)
        msg.send(fail_silently=True)


class SAMLAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        user = sociallogin.user
        data = sociallogin.data

        first_name = data.get("first_name", "")
        last_name = data.get("last_name", "")
        name = data.get("name", "")
        role = data.get("role", "")
        user.name = name
        user.first_name = first_name
        user.last_name = last_name
        if role in ["staff"]:
            user.advancedUser = True
        # the whole list is available here. data has only the first
        if user.id:
            user.save()
        social_account = sociallogin.account
        groups = social_account.extra_data.get("isMemberOf", [])
        print(groups)
                
        return super().pre_social_login(request, sociallogin)

    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)
        sociallogin.data = data
        return user

