from __future__ import absolute_import
import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cms.settings")
app = Celery("cms")

app.config_from_object("django.conf:settings")
app.autodiscover_tasks()

app.conf.beat_schedule = app.conf.CELERY_BEAT_SCHEDULE
app.conf.broker_transport_options = {"visibility_timeout": 60 * 60 * 24}  # 1 day
# http://docs.celeryproject.org/en/latest/getting-started/brokers/redis.html#redis-caveats


app.conf.worker_prefetch_multiplier = 1
