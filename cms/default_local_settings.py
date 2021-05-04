# This is a template for your local settingsfile.
# Copy this file to local_settings.py and you're able to override
# every setting from settings.py for your local setup.

DEBUG = False

# email settings
DEFAULT_FROM_EMAIL = "info@mediacms.io"
EMAIL_HOST_PASSWORD = "xyz"
EMAIL_HOST_USER = "info@mediacms.io"
EMAIL_USE_TLS = True
SERVER_EMAIL = DEFAULT_FROM_EMAIL
EMAIL_HOST = "mediacms.io"
EMAIL_PORT = 587
ADMIN_EMAIL_LIST = ["info@mediacms.io"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "mediacms",
        "HOST": "127.0.0.1",
        "PORT": "5432",
        "USER": "mediacms",
        "PASSWORD": "mediacms",
    }
}

