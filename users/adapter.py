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
    def pre_social_login(self, request, sociallogin):
#        email = sociallogin.user.email
 #       if email:
  #          try:
   #             user = User.objects.get(email=email)
#                sociallogin.connect(request, user)
 #           except User.DoesNotExist:
  #              pass
        
   #     # Call parent class's pre_social_login
    #    super().pre_social_login(request, sociallogin)
#We first try to connect the social account to an existing user by email
#Then we let the parent class handle any other default pre-login processing
#No default functionality is lost


        # Log the entire SAML response
        #logger.info("SAML Response Data: %s", sociallogin.account.extra_data)
#        import rpdb; rpdb.set_trace()
        print(sociallogin.account.extra_data)     
        # Log all available attributes
        #logger.info("SAML Attributes: %s", sociallogin.account.user)
        
        return super().pre_social_login(request, sociallogin)
#
