# Development settings, used in docker-compose-dev.yaml
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.sites',
    'rest_framework',
    'rest_framework.authtoken',
    'imagekit',
    'files.apps.FilesConfig',
    'users.apps.UsersConfig',
    'actions.apps.ActionsConfig',
    'debug_toolbar',
    'mptt',
    'crispy_forms',
    'uploader.apps.UploaderConfig',
    'djcelery_email',
    'ckeditor',
    'drf_yasg',
    'corsheaders',
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
]

DEBUG = True
CORS_ORIGIN_ALLOW_ALL = True
STATICFILES_DIRS = (os.path.join(BASE_DIR, 'static/'),)
STATIC_ROOT = None
