#!/bin/bash
set -e

# Set PORT environment variable
export PORT=${PORT:-8000}
echo "Starting uWSGI on port: $PORT"

# Copy settings
cp /home/mediacms.io/mediacms/deploy/docker/local_settings.py /home/mediacms.io/mediacms/cms/local_settings.py

# Create necessary directories
mkdir -p /home/mediacms.io/mediacms/{logs,media_files/hls}
touch /home/mediacms.io/mediacms/logs/debug.log

# Enable services
if [ X"$ENABLE_UWSGI" = X"yes" ] ; then
    echo "Enabling uwsgi app server"
    cp deploy/docker/supervisord/supervisord-uwsgi.conf /etc/supervisor/conf.d/supervisord-uwsgi.conf
fi

if [ X"$ENABLE_CELERY_BEAT" = X"yes" ] ; then
    echo "Enabling celery-beat scheduling server"
    cp deploy/docker/supervisord/supervisord-celery_beat.conf /etc/supervisor/conf.d/supervisord-celery_beat.conf
fi

if [ X"$ENABLE_CELERY_SHORT" = X"yes" ] ; then
    echo "Enabling celery-short task worker"
    cp deploy/docker/supervisord/supervisord-celery_short.conf /etc/supervisor/conf.d/supervisord-celery_short.conf
fi

if [ X"$ENABLE_CELERY_LONG" = X"yes" ] ; then
    echo "Enabling celery-long task worker"
    cp deploy/docker/supervisord/supervisord-celery_long.conf /etc/supervisor/conf.d/supervisord-celery_long.conf
    rm /var/run/mediacms/* -f
fi

# Create necessary directories
mkdir -p /home/mediacms.io/mediacms/{logs,media_files/hls}
touch /home/mediacms.io/mediacms/logs/debug.log
chown -R www-data:www-data /home/mediacms.io/mediacms/