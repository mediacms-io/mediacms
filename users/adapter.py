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
    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)
        
        role = sociallogin.account.extra_data.get("role", "")
        print(role, user, "x"*200)
        if role in ["staff"] and not user.advancedUser:
            user.advancedUser = True
            user.save()

        return user
    
    def pre_social_login(self, request, sociallogin):
        #import rpdb; rpdb.set_trace()
        # ACCESS to request with what to save as logs???
#        user = sociallogin.user
 #       if user:
  #          social_account = SocialAccount.objects.filter(provider=sociallogin.account.provider, uid=sociallogin.account.uid).first()
   #         if social_account:
    #            social_account.extra_data = sociallogin.account.extra_data
     #           social_account.save()
      #          print("WILL SAVE LOGS ALSO?")
                
        return super().pre_social_login(request, sociallogin)

    def populate_user(self, request, sociallogin, data):
        # This is used to populate the `name`
        first_name = data.get("first_name", "")
        last_name = data.get("last_name", "")
        name = data.get("name", "")
        user = sociallogin.user
        user.name = name
        user.first_name = first_name
        user.last_name = last_name
        user.advancedUser = True
        return user


@receiver(social_account_updated)
def user_updated(sociallogin, **kwargs):
    print("I WAS CALLED")
    from files.models import Comment
    new_comment = Comment.objects.create(media_id=1, text="123", user_id=1)
    social_account = sociallogin.account
    social_account.extra_data = sociallogin.account.extra_data
    social_account.save()
    user = social_account.user
    role = sociallogin.account.extra_data.get("eduPersonPrimaryAffiliation", [])
    groups = sociallogin.account.extra_data.get("isMemberOf", [])
    # XX: implement logs, groups
    if role == ["staff"] and not user.advancedUser:
        user.advancedUser = True
        user.save()

