import os

from celery.schedules import crontab

DEBUG = False

# PORTAL NAME, this is the portal title and
# is also shown on several places as emails
PORTAL_NAME = "MediaCMS"
PORTAL_DESCRIPTION = ""
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Europe/London"

# who can add media
# valid options include 'all', 'email_verified', 'advancedUser'
CAN_ADD_MEDIA = "all"

# who can comment
# valid options include 'all', 'email_verified', 'advancedUser'
CAN_COMMENT = "all"

# valid choices here are 'public', 'private', 'unlisted
PORTAL_WORKFLOW = "public"

# valid values: 'light', 'dark'.
DEFAULT_THEME = "light"


# These are passed on every request
# if set to False will not fetch external content
# this is only for the static files, as fonts/css/js files loaded from CDNs
# not for user uploaded media!
LOAD_FROM_CDN = False
LOGIN_ALLOWED = True  # whether the login button appears
REGISTER_ALLOWED = True  # whether the register button appears
UPLOAD_MEDIA_ALLOWED = True  # whether the upload media button appears
CAN_LIKE_MEDIA = True  # whether the like media appears
CAN_DISLIKE_MEDIA = True  # whether the dislike media appears
CAN_REPORT_MEDIA = True  # whether the report media appears
CAN_SHARE_MEDIA = True  # whether the share media appears
# how many times an item need be reported
# to get to private state automatically
REPORTED_TIMES_THRESHOLD = 10
ALLOW_ANONYMOUS_ACTIONS = ["report", "like", "dislike", "watch"]  # need be a list

# experimental functionality for user ratings - does not work
ALLOW_RATINGS = False
ALLOW_RATINGS_CONFIRMED_EMAIL_ONLY = True

# ip of the server should be part of this
ALLOWED_HOSTS = ["*", "mediacms.io", "127.0.0.1", "localhost"]

FRONTEND_HOST = "http://localhost"
# this variable - along with SSL_FRONTEND_HOST is used on several places
# as email where a URL need appear etc

# FRONTEND_HOST needs an http prefix - at the end of the file
# there's a conversion to https with the SSL_FRONTEND_HOST env
INTERNAL_IPS = "127.0.0.1"

# settings that are related with UX/appearance
# whether a featured item appears enlarged with player on index page
VIDEO_PLAYER_FEATURED_VIDEO_ON_INDEX_PAGE = False

PRE_UPLOAD_MEDIA_MESSAGE = ""

# email settings
DEFAULT_FROM_EMAIL = "info@mediacms.io"
EMAIL_HOST_PASSWORD = "xyz"
EMAIL_HOST_USER = "info@mediacms.io"
EMAIL_USE_TLS = True
SERVER_EMAIL = DEFAULT_FROM_EMAIL
EMAIL_HOST = "mediacms.io"
EMAIL_PORT = 587
ADMIN_EMAIL_LIST = ["info@mediacms.io"]


MEDIA_IS_REVIEWED = True  # whether an admin needs to review a media file.
# By default consider this is not needed.
# If set to False, then each new media need be reviewed otherwise
# it won't appear on public listings

# if set to True the url for original file is returned to the API.
SHOW_ORIGINAL_MEDIA = True
# Keep in mind that nginx will serve the file unless there's
# some authentication taking place. Check nginx file and setup a
# basic http auth user/password if you want to restrict access

MAX_MEDIA_PER_PLAYLIST = 70
# bytes, size of uploaded media
UPLOAD_MAX_SIZE = 800 * 1024 * 1000 * 5

MAX_CHARS_FOR_COMMENT = 10000  # so that it doesn't end up huge
TIMESTAMP_IN_TIMEBAR = False  # shows timestamped comments in the timebar for videos
ALLOW_MENTION_IN_COMMENTS = False  # allowing to mention other users with @ in the comments

# valid options: content, author
RELATED_MEDIA_STRATEGY = "content"

# Whether or not to generate a sitemap.xml listing the pages on the site (default: False)
GENERATE_SITEMAP = False

USE_I18N = True
USE_L10N = True
USE_TZ = True
SITE_ID = 1

# protection agains anonymous users
# per ip address limit, for actions as like/dislike/report
TIME_TO_ACTION_ANONYMOUS = 10 * 60

# django-allauth settings
ACCOUNT_SESSION_REMEMBER = True
ACCOUNT_AUTHENTICATION_METHOD = "username_email"
ACCOUNT_EMAIL_REQUIRED = True  # new users need to specify email
ACCOUNT_EMAIL_VERIFICATION = "optional"  # 'mandatory' 'none'
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = True
ACCOUNT_USERNAME_MIN_LENGTH = "4"
ACCOUNT_ADAPTER = "users.adapter.MyAccountAdapter"
ACCOUNT_SIGNUP_FORM_CLASS = "users.forms.SignupForm"
ACCOUNT_USERNAME_VALIDATORS = "users.validators.custom_username_validators"
ACCOUNT_SIGNUP_PASSWORD_ENTER_TWICE = False
ACCOUNT_USERNAME_REQUIRED = True
ACCOUNT_LOGIN_ON_PASSWORD_RESET = True
ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS = 1
ACCOUNT_LOGIN_ATTEMPTS_LIMIT = 20
ACCOUNT_LOGIN_ATTEMPTS_TIMEOUT = 5
# registration won't be open, might also consider to remove links for register
USERS_CAN_SELF_REGISTER = True

RESTRICTED_DOMAINS_FOR_USER_REGISTRATION = ["xxx.com", "emaildomainwhatever.com"]

# django rest settings
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
        "rest_framework.authentication.TokenAuthentication",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
}


SECRET_KEY = "2dii4cog7k=5n37$fz)8dst)kg(s3&10)^qa*gv(kk+nv-z&cu"
# TODO: this needs to be changed!

TEMP_DIRECTORY = "/tmp"  # Don't use a temp directory inside BASE_DIR!!!
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_URL = "/static/"  # where js/css files are stored on the filesystem
MEDIA_URL = "/media/"  # URL where static files are served from the server
STATIC_ROOT = BASE_DIR + "/static/"
# where uploaded + encoded media are stored
MEDIA_ROOT = BASE_DIR + "/media_files/"

# these used to be os.path.join(MEDIA_ROOT, "folder/") but update to
# Django 3.1.9 requires not absolute paths to be utilized...

MEDIA_UPLOAD_DIR = "original/"
MEDIA_ENCODING_DIR = "encoded/"
THUMBNAIL_UPLOAD_DIR = f"{MEDIA_UPLOAD_DIR}/thumbnails/"
SUBTITLES_UPLOAD_DIR = f"{MEDIA_UPLOAD_DIR}/subtitles/"
HLS_DIR = os.path.join(MEDIA_ROOT, "hls/")

FFMPEG_COMMAND = "ffmpeg"  # this is the path
FFPROBE_COMMAND = "ffprobe"  # this is the path
MP4HLS = "mp4hls"

MASK_IPS_FOR_ACTIONS = True
# how many seconds a process in running state without reporting progress is
# considered as stale...unfortunately v9 seems to not include time
# some times so raising this high
RUNNING_STATE_STALE = 60 * 60 * 2

FRIENDLY_TOKEN_LEN = 9

# for videos, after that duration get split into chunks
# and encoded independently
CHUNKIZE_VIDEO_DURATION = 60 * 5
# aparently this has to be smaller than VIDEO_CHUNKIZE_DURATION
VIDEO_CHUNKS_DURATION = 60 * 4

# always get these two, even if upscaling
MINIMUM_RESOLUTIONS_TO_ENCODE = [240, 360]

# default settings for notifications
# not all of them are implemented

USERS_NOTIFICATIONS = {
    "MEDIA_ADDED": True,  # in use
    "MEDIA_ENCODED": False,  # not implemented
    "MEDIA_REPORTED": True,  # in use
}

ADMINS_NOTIFICATIONS = {
    "NEW_USER": True,  # in use
    "MEDIA_ADDED": True,  # in use
    "MEDIA_ENCODED": False,  # not implemented
    "MEDIA_REPORTED": True,  # in use
}


# this is for fineuploader - media uploads
UPLOAD_DIR = "uploads/"
CHUNKS_DIR = "chunks/"

# number of files to upload using fineuploader at once
UPLOAD_MAX_FILES_NUMBER = 100
CONCURRENT_UPLOADS = True
CHUNKS_DONE_PARAM_NAME = "done"
FILE_STORAGE = "django.core.files.storage.DefaultStorage"

X_FRAME_OPTIONS = "ALLOWALL"
EMAIL_BACKEND = "djcelery_email.backends.CeleryEmailBackend"
CELERY_EMAIL_TASK_CONFIG = {
    "queue": "short_tasks",
}

POST_UPLOAD_AUTHOR_MESSAGE_UNLISTED_NO_COMMENTARY = ""
# a message to be shown on the author of a media file and only
# only in case where unlisted workflow is used and no commentary
# exists

CANNOT_ADD_MEDIA_MESSAGE = ""

# mp4hls command, part of Bendo4
MP4HLS_COMMAND = "/home/mediacms.io/mediacms/Bento4-SDK-1-6-0-637.x86_64-unknown-linux/bin/mp4hls"

# highly experimental, related with remote workers
ADMIN_TOKEN = "c2b8e1838b6128asd333ddc5e24"
# this is used by remote workers to push
# encodings once they are done
# USE_BASIC_HTTP = True
# BASIC_HTTP_USER_PAIR = ('user', 'password')
# specify basic auth user/password pair for use with the
# remote workers, if nginx basic auth is setup
# apache2-utils need be installed
# then run
# htpasswd -c /home/mediacms.io/mediacms/deploy/.htpasswd user
# and set a password
# edit /etc/nginx/sites-enabled/mediacms.io and
# uncomment the two lines related to htpasswd


CKEDITOR_CONFIGS = {
    "default": {
        "toolbar": "Custom",
        "width": "100%",
        "toolbar_Custom": [
            ["Styles"],
            ["Format"],
            ["Bold", "Italic", "Underline"],
            ["HorizontalRule"],
            [
                "NumberedList",
                "BulletedList",
                "-",
                "Outdent",
                "Indent",
                "-",
                "JustifyLeft",
                "JustifyCenter",
                "JustifyRight",
                "JustifyBlock",
            ],
            ["Link", "Unlink"],
            ["Image"],
            ["RemoveFormat", "Source"],
        ],
    }
}


AUTH_USER_MODEL = "users.User"
LOGIN_REDIRECT_URL = "/"

AUTHENTICATION_BACKENDS = (
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "rest_framework",
    "rest_framework.authtoken",
    "imagekit",
    "files.apps.FilesConfig",
    "users.apps.UsersConfig",
    "actions.apps.ActionsConfig",
    "debug_toolbar",
    "mptt",
    "crispy_forms",
    "uploader.apps.UploaderConfig",
    "djcelery_email",
    "ckeditor",
    "drf_yasg",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "debug_toolbar.middleware.DebugToolbarMiddleware",
]

ROOT_URLCONF = "cms.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": ["templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.template.context_processors.media",
                "django.contrib.messages.context_processors.messages",
                "files.context_processors.stuff",
            ],
        },
    },
]

WSGI_APPLICATION = "cms.wsgi.application"

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {
            "min_length": 5,
        },
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
]

FILE_UPLOAD_HANDLERS = [
    "django.core.files.uploadhandler.TemporaryFileUploadHandler",
]

LOGS_DIR = os.path.join(BASE_DIR, "logs")

error_filename = os.path.join(LOGS_DIR, "debug.log")
if not os.path.exists(LOGS_DIR):
    try:
        os.mkdir(LOGS_DIR)
    except PermissionError:
        pass

if not os.path.isfile(error_filename):
    open(error_filename, 'a').close()

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "file": {
            "level": "ERROR",
            "class": "logging.FileHandler",
            "filename": error_filename,
        },
    },
    "loggers": {
        "django": {
            "handlers": ["file"],
            "level": "ERROR",
            "propagate": True,
        },
    },
}

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


REDIS_LOCATION = "redis://127.0.0.1:6379/1"
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_LOCATION,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }
}

SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"

# CELERY STUFF
BROKER_URL = REDIS_LOCATION
CELERY_RESULT_BACKEND = BROKER_URL
CELERY_ACCEPT_CONTENT = ["application/json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_SOFT_TIME_LIMIT = 2 * 60 * 60
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERYD_PREFETCH_MULTIPLIER = 1

CELERY_BEAT_SCHEDULE = {
    # clear expired sessions, every sunday 1.01am. By default Django has 2week
    # expire date
    "clear_sessions": {
        "task": "clear_sessions",
        "schedule": crontab(hour=1, minute=1, day_of_week=6),
    },
    "get_list_of_popular_media": {
        "task": "get_list_of_popular_media",
        "schedule": crontab(minute=1, hour="*/10"),
    },
    "update_listings_thumbnails": {
        "task": "update_listings_thumbnails",
        "schedule": crontab(minute=2, hour="*/30"),
    },
}
# TODO: beat, delete chunks from media root
# chunks_dir after xx days...(also uploads_dir)


LOCAL_INSTALL = False

# this is an option to make the whole portal available to logged in users only
# it is placed here so it can be overrided on local_settings.py
GLOBAL_LOGIN_REQUIRED = False

# TODO: separate settings on production/development more properly, for now
# this should be ok
CELERY_TASK_ALWAYS_EAGER = False
if os.environ.get("TESTING"):
    CELERY_TASK_ALWAYS_EAGER = True


try:
    # keep a local_settings.py file for local overrides
    from .local_settings import *  # noqa

    # ALLOWED_HOSTS needs a url/ip
    ALLOWED_HOSTS.append(FRONTEND_HOST.replace("http://", "").replace("https://", ""))
except ImportError:
    # local_settings not in use
    pass


if "http" not in FRONTEND_HOST:
    # FRONTEND_HOST needs a http:// preffix
    FRONTEND_HOST = f"http://{FRONTEND_HOST}"  # noqa

if LOCAL_INSTALL:
    SSL_FRONTEND_HOST = FRONTEND_HOST.replace("http", "https")
else:
    SSL_FRONTEND_HOST = FRONTEND_HOST

if GLOBAL_LOGIN_REQUIRED:
    # this should go after the AuthenticationMiddleware middleware
    MIDDLEWARE.insert(5, "login_required.middleware.LoginRequiredMiddleware")
    LOGIN_REQUIRED_IGNORE_PATHS = [
        r'/accounts/login/$',
        r'/accounts/logout/$',
        r'/accounts/signup/$',
        r'/accounts/password/.*/$',
        r'/accounts/confirm-email/.*/$',
        r'/api/v[0-9]+/',
    ]

# if True, only show original, don't perform any action on videos
DO_NOT_TRANSCODE_VIDEO = False

DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'

# the following is related to local development using docker
# and docker-compose-dev.yaml
try:
    DEVELOPMENT_MODE = os.environ.get("DEVELOPMENT_MODE")
    if DEVELOPMENT_MODE:
        # keep a dev_settings.py file for local overrides
        from .dev_settings import *  # noqa
except ImportError:
    pass
