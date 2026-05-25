#!/bin/bash
set -e

# forward request and error logs to docker log collector
ln -sf /dev/stdout /var/log/nginx/access.log && ln -sf /dev/stderr /var/log/nginx/error.log && \
ln -sf /dev/stdout /var/log/nginx/mediacms.io.access.log && ln -sf /dev/stderr /var/log/nginx/mediacms.io.error.log

cp /home/mediacms.io/mediacms/deploy/docker/local_settings.py /home/mediacms.io/mediacms/cms/local_settings.py


mkdir -p /home/mediacms.io/mediacms/{logs,media_files/hls}
touch /home/mediacms.io/mediacms/logs/debug.log

mkdir -p /var/run/mediacms
chown www-data:www-data /var/run/mediacms

TARGET_GID=$(stat -c "%g" /home/mediacms.io/mediacms/)

EXISTS=$(cat /etc/group | grep $TARGET_GID | wc -l)

# Create new group using target GID and add www-data user
if [ $EXISTS == "0" ]; then
    groupadd -g $TARGET_GID tempgroup
    usermod -a -G tempgroup www-data
else
    # GID exists, find group name and add
    GROUP=$(getent group $TARGET_GID | cut -d: -f1)
    usermod -a -G $GROUP www-data
fi

# We should do this only for folders that have a different owner, since it is an expensive operation
# Also ignoring .git folder to fix this issue https://github.com/mediacms-io/mediacms/issues/934
# Exclude package-lock.json files that may not exist or be removed during frontend setup
find /home/mediacms.io/mediacms ! \( -path "*.git*" -o -name "package-lock.json" \) -exec chown www-data:$TARGET_GID {} + 2>/dev/null || true

chmod +x /home/mediacms.io/mediacms/deploy/docker/start.sh /home/mediacms.io/mediacms/deploy/docker/prestart.sh

# Generate or read SECRET_KEY once, shared across all containers via the
# host-mounted project volume. Atomic create-or-read so parallel container
# starts (web + celery_worker + celery_beat + migrations) can't race.
# Uses `mkdir` as the lock primitive (POSIX-atomic, no dependency on flock).
SECRET_KEY_FILE="${SECRET_KEY_FILE:-/home/mediacms.io/mediacms/.secret_key}"
SECRET_KEY_LOCK="${SECRET_KEY_FILE}.lock"

if [ -z "${SECRET_KEY:-}" ]; then
    if [ ! -s "$SECRET_KEY_FILE" ]; then
        # Spin-acquire the lock. mkdir is atomic; first caller wins, others retry.
        while ! mkdir "$SECRET_KEY_LOCK" 2>/dev/null; do
            sleep 0.2
        done
        # Re-check inside the lock: another container may have just written it.
        if [ ! -s "$SECRET_KEY_FILE" ]; then
            python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())' > "$SECRET_KEY_FILE"
            chown www-data:www-data "$SECRET_KEY_FILE"
            chmod 600 "$SECRET_KEY_FILE"
            echo "entrypoint.sh: generated new SECRET_KEY at $SECRET_KEY_FILE"
        fi
        rmdir "$SECRET_KEY_LOCK"
    fi
    export SECRET_KEY="$(cat "$SECRET_KEY_FILE")"
fi

exec "$@"
