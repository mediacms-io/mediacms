# Development settings, used in docker-compose-dev.yaml
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

INSTALLED_APPS = [
    "admin_customizations",
    "django.contrib.auth",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "jazzmin",
    "django.contrib.admin",
    "django.contrib.sites",
    "rest_framework",
    "rest_framework.authtoken",
    "imagekit",
    "files.apps.FilesConfig",
    "users.apps.UsersConfig",
    "actions.apps.ActionsConfig",
    "rbac.apps.RbacConfig",
    "identity_providers.apps.IdentityProvidersConfig",
    "debug_toolbar",
    "mptt",
    "crispy_forms",
    "crispy_bootstrap5",
    "uploader.apps.UploaderConfig",
    "djcelery_email",
    "drf_yasg",
    "allauth.socialaccount.providers.saml",
    "saml_auth.apps.SamlAuthConfig",
    "corsheaders",
    "tinymce",
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    "django.middleware.locale.LocaleMiddleware",
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'debug_toolbar.middleware.DebugToolbarMiddleware',
    "allauth.account.middleware.AccountMiddleware",
]

DEBUG = True
CORS_ORIGIN_ALLOW_ALL = True
STATICFILES_DIRS = (os.path.join(BASE_DIR, 'static'),)
STATIC_ROOT = os.path.join(BASE_DIR, 'static_collected')
