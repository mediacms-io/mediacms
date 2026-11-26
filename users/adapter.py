import logging

from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings
from django.core.exceptions import ValidationError
from django.urls import reverse

from cms.utils import get_client_ip_for_logging
from files.methods import get_interactive_email_connection

logger = logging.getLogger(__name__)


class MyAccountAdapter(DefaultAccountAdapter):
    def get_email_confirmation_url(self, request, emailconfirmation):
        url = reverse("account_confirm_email", args=[emailconfirmation.key])
        return settings.SSL_FRONTEND_HOST + url

    def clean_email(self, email):
        if "@" not in email:
            raise ValidationError("Email is not valid")

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
        msg.connection = get_interactive_email_connection()
        msg.send(fail_silently=False)

    def respond_user_inactive(self, request, user):
        logger.warning(
            "Login failed (django-allauth) - user_inactive, ip=%s",
            get_client_ip_for_logging(request) if request else 'unknown',
        )
        return super().respond_user_inactive(request, user)

    def authentication_failed(self, request, **credentials):
        logger.warning(
            "Login failed (django-allauth) - invalid_credentials, ip=%s",
            get_client_ip_for_logging(request) if request else 'unknown',
        )
        return super().authentication_failed(request, **credentials)

    def pre_login(self, request, user, **kwargs):
        if settings.USERS_NEEDS_TO_BE_APPROVED and not user.is_approved:
            logger.warning(
                "Login of unapproved user (django-allauth) - user_id=%s, ip=%s",
                user.id,
                get_client_ip_for_logging(request) if request else 'unknown',
            )
        return super().pre_login(request, user, **kwargs)
