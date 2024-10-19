from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings
from django.core.exceptions import ValidationError
from django.urls import reverse


class MyAccountAdapter(DefaultAccountAdapter):
    def get_email_confirmation_url_stub(self, request, emailconfirmation):
        url = reverse("account_confirm_email", args=[emailconfirmation.key])
        return settings.SSL_FRONTEND_HOST + url

    def clean_email(self, email):
        if hasattr(settings,"ALLOWED_DOMAINS_FOR_USER_REGISTRATION") and settings.ALLOWED_DOMAINS_FOR_USER_REGISTRATION:
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
