#!/bin/bash
set -e

# Fix permissions on mounted volumes if running as root
if [ "$(id -u)" = "0" ]; then
    echo "Fixing permissions on data directories..."
    chown -R www-data:www-data /home/mediacms.io/mediacms/logs \
                                /home/mediacms.io/mediacms/media_files \
                                /home/mediacms.io/mediacms/static_files \
                                /var/run/mediacms 2>/dev/null || true

    # If command starts with python or celery, run as www-data
    if [ "${1:0:1}" != '-' ]; then
        exec gosu www-data "$@"
    fi
fi

# Execute the command
exec "$@"
