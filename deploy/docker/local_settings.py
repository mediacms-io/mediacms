FRONTEND_HOST = 'https://guys.network'
PORTAL_NAME = 'Guys.Network'
SECRET_KEY = 'ma!s3^b-cw!f#7s6sjsdfjj2j5j2l%J#J25L3j6*)#J21lj1jf052j2jf'
POSTGRES_HOST = '10.108.0.2'
REDIS_LOCATION = "redis://10.108.0.2:6379/1"
POSTGRES_DB = "mediacms"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": POSTGRES_DB,
        "HOST": POSTGRES_HOST,
        "PORT": "5432",
        "USER": "mediacms",
        "PASSWORD": "mediacms_guys_network_32",
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
