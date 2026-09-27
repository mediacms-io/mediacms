from django.conf import settings
from rest_framework.settings import api_settings
from rest_framework.throttling import SimpleRateThrottle, UserRateThrottle


class SettingRateThrottle(SimpleRateThrottle):
    """Throttle whose rate is read from a Django setting at request time"""

    setting = None
    default_rate = None

    def get_rate(self):
        return getattr(settings, self.setting, self.default_rate)


class ContactFormThrottle(SettingRateThrottle):
    """Messages sent through the contact form, per client address"""

    scope = "contact_form"
    setting = "CONTACT_FORM_RATE"
    default_rate = "5/hour"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class ContactFormGlobalThrottle(SettingRateThrottle):
    """Messages sent through the contact form, all clients together"""

    scope = "contact_form_global"
    setting = "CONTACT_FORM_GLOBAL_RATE"
    default_rate = "50/hour"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": "all"}


class ContactUserThrottle(UserRateThrottle):
    """Messages sent to users through the contact user endpoint, per sender"""

    scope = "contact_user"
    default_rate = "10/hour"

    def get_rate(self):
        return api_settings.DEFAULT_THROTTLE_RATES.get(self.scope, self.default_rate)


def contact_form_allowed(request):
    """Record a contact form message; False when a rate is exceeded"""

    return all(throttle().allow_request(request, None) for throttle in (ContactFormThrottle, ContactFormGlobalThrottle))
