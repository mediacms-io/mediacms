import os

FRONTEND_HOST = 'https://deic.mediacms.io'
PORTAL_NAME = 'MediaCMS @ DEIC'
SECRET_KEY = 'ma!s3^b-cw!f#7s6s0m7fa@adsdu7ddsariw(7701**(r=ww%w!2+yk2'
POSTGRES_HOST = 'db'
REDIS_LOCATION = "redis://redis:6379/1"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "mediacms",
        "HOST": POSTGRES_HOST,
        "PORT": "5432",
        "USER": "mediacms",
        "PASSWORD": "mediacms",
    }
}

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_LOCATION,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }
}

# CELERY STUFF
BROKER_URL = REDIS_LOCATION
CELERY_RESULT_BACKEND = BROKER_URL

MP4HLS_COMMAND = "/home/mediacms.io/bento4/bin/mp4hls"

DEBUG = False

TIME_ZONE = "Europe/London"
PORTAL_WORKFLOW = 'private'

DEFAULT_FROM_EMAIL = 'info@mediacms.io'
SERVER_EMAIL = DEFAULT_FROM_EMAIL
ADMIN_EMAIL_LIST = ['info@mediacms.io']
#EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_BACKEND = 'djcelery_email.backends.CeleryEmailBackend'



EMAIL_HOST = 'smtp.eu.sparkpostmail.com'
EMAIL_PORT = 587
EMAIL_HOST_USER = 'SMTP_Injection'
EMAIL_HOST_PASSWORD = 'e49ef5d393e3c59e8a7a9010e822b68966dfda58'
EMAIL_USE_TLS = True

ALLOWED_HOSTS = [
    "*",
    'deic.mediacms.io',
    '65.21.244.123',
    'cc.mediacms.io']


# this is for the top right link
REGISTER_ALLOWED = False
USERS_CAN_SELF_REGISTER = True

USE_RBAC = True
USE_SAML = True
USE_IDENTITY_PROVIDERS = True

USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_SECURE = True

ACCOUNT_USERNAME_VALIDATORS = "users.validators.less_restrictive_username_validators"

SOCIALACCOUNT_ADAPTER = 'saml_auth.adapter.SAMLAccountAdapter'

SOCIALACCOUNT_PROVIDERS = {
    "saml": {
        "provider_class": "saml_auth.custom.provider.CustomSAMLProvider",
    }
}

EXTRA_APPS = [
    "allauth.socialaccount.providers.saml",
    "saml_auth.apps.SamlAuthConfig",
]

# bypass the signup form by using fields
# ensure that email won't be used for authentication, so even if email 
# is found for another account, it won't bse used as uid
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_EMAIL_REQUIRED = False

