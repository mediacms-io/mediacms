import re

from django.core import validators
from django.utils.deconstruct import deconstructible
from django.utils.translation import gettext_lazy as _


@deconstructible
class ASCIIUsernameValidator(validators.RegexValidator):
    regex = r"^[\w.@]+$"
    message = _("Enter a valid username. This value may contain only " "English letters and numbers")
    flags = re.ASCII


@deconstructible
class LEssRestrictiveUsernameValidator(validators.RegexValidator):
    regex = r"^[^\x00-\x1F\\/:*?\"<>|%#&`=~]+$"
    message = _("Enter a valid username. This value may contain UTF-8 characters except those reserved for file systems")
    flags = 0  # Allow UTF-8 characters


custom_username_validators = [ASCIIUsernameValidator()]
less_restrictive_username_validators = [LEssRestrictiveUsernameValidator]
