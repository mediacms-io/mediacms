FRONTEND_HOST = 'https://micrufun.com'
PORTAL_NAME = 'MICRUFUN'
SECRET_KEY = 'ma!s3^b-cw!f#7s6s0m3*jx77a@riw(7701**(r=ww%w!2+yk2'
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

### Set email settings
### Set correct settings per provider
DEFAULT_FROM_EMAIL = 'micrufun@gmail.com'
EMAIL_HOST_PASSWORD = '***REMOVED***'
EMAIL_HOST_USER = 'micrufun@gmail.com'
EMAIL_USE_TLS = True
SERVER_EMAIL = DEFAULT_FROM_EMAIL
EMAIL_HOST = 'gmail.com'
EMAIL_PORT = 587
ADMIN_EMAIL_LIST = ['micrufun@gmail.com']

### To fix error when receiving POST response: Error: Network Error
### Error is thrown by Axios when POST response is received.
### https://stackoverflow.com/a/58018865/3405291
###
### Have to install the Django library by using Docker.
### The library version should be compatibale with our Django==3.1.12 version:
### /usr/local/bin/docker-compose exec web python -m pip install "django-cors-headers==3.11.0"
###
INSTALLED_APPS.append("corsheaders")
# Before any middleware that can generate responses such as Django’s CommonMiddleware.
# If it is not before, it will not be able to add the CORS headers to these responses.
MIDDLEWARE.insert(1, "corsheaders.middleware.CorsMiddleware") # It would be after "SecurityMiddleware"
# Allow all URLs to access our website.
CORS_ALLOW_ALL_ORIGINS = True

