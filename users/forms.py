import logging

from allauth.account.forms import LoginForm as AllAuthLoginForm
from django import forms
from django.conf import settings

from cms.utils import get_client_ip_for_logging
from files.methods import is_mediacms_manager

from .models import Channel, User

logger = logging.getLogger(__name__)


class LoginForm(AllAuthLoginForm):
    """Custom login form to capture failed login attempts"""

    def clean(self):
        """Override clean to log failed login attempts before parent validation"""
        login = self.cleaned_data.get('login') if hasattr(self, 'cleaned_data') else self.data.get('login')
        password = self.cleaned_data.get('password') if hasattr(self, 'cleaned_data') else self.data.get('password')

        # Get IP address from request
        request = self.request if hasattr(self, 'request') else None
        client_ip = get_client_ip_for_logging(request) if request else 'unknown'

        # Call parent clean which will handle authentication
        try:
            cleaned_data = super().clean()
        except forms.ValidationError:
            # Authentication failed - log it
            if login and password:
                try:
                    if '@' in login:
                        user_exists = User.objects.filter(email=login).exists()
                    else:
                        user_exists = User.objects.filter(username=login).exists()
                except Exception:
                    user_exists = False

                if user_exists:
                    # User exists but password is wrong
                    logger.warning(
                        "Login failed (django-allauth) - wrong_password, attempted_username_or_email=%s, ip=%s",
                        login,
                        client_ip,
                    )
                else:
                    # User doesn't exist
                    logger.warning(
                        "Login failed (django-allauth) - user_not_found, attempted_username_or_email=%s, ip=%s",
                        login,
                        client_ip,
                    )
            # Re-raise the validation error
            raise

        return cleaned_data


class SignupForm(forms.Form):
    name = forms.CharField(max_length=100, label="Name")

    def signup(self, request, user):
        user.name = self.cleaned_data["name"]
        user.save()


class UserForm(forms.ModelForm):
    class Meta:
        model = User
        fields = (
            "name",
            "description",
            "logo",
            "notification_on_comments",
            "is_featured",
            "advancedUser",
            "is_manager",
            "is_editor",
            "is_approved",
            # "allow_contact",
        )

    def clean_logo(self):
        image = self.cleaned_data.get("logo", False)
        if image:
            if image.size > 2 * 1024 * 1024:
                raise forms.ValidationError("Image file too large ( > 2mb )")
            return image
        else:
            raise forms.ValidationError("Please provide a logo")

    def __init__(self, user, *args, **kwargs):
        super(UserForm, self).__init__(*args, **kwargs)
        self.fields.pop("is_featured")
        if not is_mediacms_manager(user):
            self.fields.pop("advancedUser")
            self.fields.pop("is_manager")
            self.fields.pop("is_editor")

        if not settings.USERS_NEEDS_TO_BE_APPROVED or not is_mediacms_manager(user):
            if "is_approved" in self.fields:
                self.fields.pop("is_approved")

        if user.socialaccount_set.exists():
            # for Social Accounts do not allow to edit the name
            self.fields["name"].widget.attrs['readonly'] = True


class ChannelForm(forms.ModelForm):
    class Meta:
        model = Channel
        fields = ("banner_logo",)

    def clean_banner_logo(self):
        image = self.cleaned_data.get("banner_logo", False)
        if image:
            if image.size > 2 * 1024 * 1024:
                raise forms.ValidationError("Image file too large ( > 2mb )")
            return image
        else:
            raise forms.ValidationError("Please provide a banner")
