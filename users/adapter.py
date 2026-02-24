import logging

from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings
from django.core.exceptions import ValidationError
from django.urls import reverse

from cms.utils import get_client_ip_for_logging

from .models import User

logger = logging.getLogger(__name__)


class MyAccountAdapter(DefaultAccountAdapter):
    def get_email_confirmation_url_stub(self, request, emailconfirmation):
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
        msg.send(fail_silently=True)

    def login(self, request, user):
        """Override login - django-allauth will send user_logged_in signal"""
        return super().login(request, user)

    def respond_user_inactive(self, request, user):
        """Called when login is attempted with an inactive user"""
        client_ip = get_client_ip_for_logging(request) if request else 'unknown'
        logger.warning(
            "Login failed (django-allauth) - user_deactivated, user_id=%s, username=%s, ip=%s",
            user.id if user else None,
            user.username if user else 'unknown',
            client_ip,
        )
        return super().respond_user_inactive(request, user)

    def authenticate(self, request, **credentials):
        """Override authenticate to log failed attempts"""
        user = super().authenticate(request, **credentials)

        if user is None and request:
            # Authentication failed - try to determine why
            client_ip = get_client_ip_for_logging(request)
            username_or_email = credentials.get('username') or credentials.get('email', '')

            # Check if user exists
            try:
                if '@' in username_or_email:
                    user_exists = User.objects.filter(email=username_or_email).exists()
                else:
                    user_exists = User.objects.filter(username=username_or_email).exists()
            except Exception:
                user_exists = False

            if user_exists:
                # User exists but password is wrong
                logger.warning(
                    "Login failed (django-allauth) - wrong_password, attempted_username_or_email=%s, ip=%s",
                    username_or_email,
                    client_ip,
                )
            else:
                # User doesn't exist
                logger.warning(
                    "Login failed (django-allauth) - user_not_found, attempted_username_or_email=%s, ip=%s",
                    username_or_email,
                    client_ip,
                )

        return user

    def pre_login(self, request, user, **kwargs):
        """Called before login - check for approval if needed"""
        if settings.USERS_NEEDS_TO_BE_APPROVED and not user.is_approved:
            client_ip = get_client_ip_for_logging(request) if request else 'unknown'
            logger.warning(
                "Login failed (django-allauth) - user_not_approved, user_id=%s, username=%s, ip=%s",
                user.id,
                user.username,
                client_ip,
            )
            from allauth.exceptions import ImmediateHttpResponse
            from django.http import HttpResponseRedirect
            from django.urls import reverse

            raise ImmediateHttpResponse(HttpResponseRedirect(reverse('account_login') + '?approval_required=1'))
        return super().pre_login(request, user, **kwargs)
