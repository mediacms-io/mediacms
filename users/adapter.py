from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.account.utils import user_email, user_field, user_username

from django.conf import settings
from django.core.exceptions import ValidationError
from django.urls import reverse


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


class MySocialAccountAdapter(DefaultSocialAccountAdapter):
    def populate_user(self, request, sociallogin, data):
        # This is used to populate the `name`
        username = data.get("username")
        first_name = data.get("first_name")
        last_name = data.get("last_name")
        email = data.get("email")
        name = data.get("name")
        user = sociallogin.user
        user_username(user, username or "")
        user_email(user, valid_email_or_none(email) or "")
        name_parts = (name or "").partition(" ")
        user_field(user, "first_name", first_name or name_parts[0])
        user_field(user, "last_name", last_name or name_parts[2])
        user.name = name
        return user

