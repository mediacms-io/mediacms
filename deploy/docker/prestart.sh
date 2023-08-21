#!/bin/bash

RANDOM_ADMIN_PASS=`python -c "import secrets;chars = 'abcdefghijklmnopqrstuvwxyz0123456789';print(''.join(secrets.choice(chars) for i in range(10)))"`
ADMIN_PASSWORD=${ADMIN_PASSWORD:-$RANDOM_ADMIN_PASS}

if [ X"$ENABLE_MIGRATIONS" = X"yes" ]; then
    echo "Running migrations service"
    python manage.py migrate
    EXISTING_INSTALLATION=`echo "from users.models import User; print(User.objects.exists())" |python manage.py shell`
    if [ "$EXISTING_INSTALLATION" = "True" ]; then
        echo "Loaddata has already run"
    else
        echo "Running loaddata and creating admin user"
        python manage.py loaddata fixtures/encoding_profiles.json
        python manage.py loaddata fixtures/categories.json

    	# post_save, needs redis to succeed (ie. migrate depends on redis)
        DJANGO_SUPERUSER_PASSWORD=$ADMIN_PASSWORD python manage.py createsuperuser \
            --no-input \
            --username=$ADMIN_USER \
            --email=$ADMIN_EMAIL \
            --database=default || true
        echo "Created admin user with password: $ADMIN_PASSWORD"

    fi
    echo "RUNNING COLLECTSTATIC"

    python manage.py collectstatic --noinput

    # echo "Updating hostname ..."
    # TODO: Get the FRONTEND_HOST from cms/local_settings.py
    # echo "from django.contrib.sites.models import Site; Site.objects.update(name='$FRONTEND_HOST', domain='$FRONTEND_HOST')" | python manage.py shell
fi

# Setting up internal nginx server
# HTTPS setup is delegated to a reverse proxy running infront of the application

cp deploy/docker/nginx_http_only.conf /etc/nginx/sites-available/default
cp deploy/docker/nginx_http_only.conf /etc/nginx/sites-enabled/default
cp deploy/docker/uwsgi_params /etc/nginx/sites-enabled/uwsgi_params
cp deploy/docker/nginx.conf /etc/nginx/

#### Supervisord Configurations #####

cp deploy/docker/supervisord/supervisord-debian.conf /etc/supervisor/conf.d/supervisord-debian.conf

if [ X"$ENABLE_UWSGI" = X"yes" ] ; then
    echo "Enabling uwsgi app server"
    cp deploy/docker/supervisord/supervisord-uwsgi.conf /etc/supervisor/conf.d/supervisord-uwsgi.conf
fi

if [ X"$ENABLE_NGINX" = X"yes" ] ; then
    echo "Enabling nginx as uwsgi app proxy and media server"
    cp deploy/docker/supervisord/supervisord-nginx.conf /etc/supervisor/conf.d/supervisord-nginx.conf
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
    rm /var/run/mediacms/* -f # remove any stale id, so that on forced restarts of celery workers there are no stale processes that prevent new ones
fi
