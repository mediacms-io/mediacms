from __future__ import absolute_import

import os

from celery import Celery
from celery.signals import worker_process_init
from django.conf import settings
from django.db import connections

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cms.settings")
app = Celery("cms")

app.config_from_object("django.conf:settings")
app.autodiscover_tasks()

app.conf.beat_schedule = app.conf.CELERY_BEAT_SCHEDULE
app.conf.broker_transport_options = {"visibility_timeout": 60 * 60 * 24}  # 1 day
# http://docs.celeryproject.org/en/latest/getting-started/brokers/redis.html#redis-caveats

# setting this to settings.py file only is not respected. Setting here too
app.conf.task_always_eager = settings.CELERY_TASK_ALWAYS_EAGER


app.conf.worker_prefetch_multiplier = 1


@worker_process_init.connect
def close_db_pool_on_fork(**_):
    # psycopg3's ConnectionPool is not fork-safe: children inherit dead sockets
    # from the parent's pool and block on getconn() until PoolTimeout. Dispose
    # the inherited pool here so each prefork child opens its own on first use.
    # NB: plain conn.close() would only putconn() back into the broken pool.
    for conn in connections.all():
        conn.close_pool()
