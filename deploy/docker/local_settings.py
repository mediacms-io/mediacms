FRONTEND_HOST = 'https://trm-mediacms-production.up.railway.app'
PORTAL_NAME = 'MediaCMS'
SECRET_KEY = 'ma!s3^b-cw!f#7s6s0m3*jx77a@riw(7701**(r=ww%w!2+yk2'
POSTGRES_HOST = 'junction.proxy.rlwy.net'
REDIS_LOCATION = "redis://default:PunWLBWrCsLVcYWVQpledLchanmIQloP@junction.proxy.rlwy.net:22595"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "railway",
        "HOST": "junction.proxy.rlwy.net",
        "PORT": "12762",
        "USER": "postgres",
        "PASSWORD": "mabaOYfZjlpnUJvMnGgxTAdFgzOfuXxx",
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
