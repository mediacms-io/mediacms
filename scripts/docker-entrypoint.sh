#!/bin/bash
set -e

# Fix permissions on volume mounts
chown -R www-data:www-data \
    /home/mediacms.io/mediacms/logs \
    /home/mediacms.io/mediacms/media_files \
    /home/mediacms.io/mediacms/static_files \
    2>/dev/null || true

# Run as www-data user
exec gosu www-data "$@"
