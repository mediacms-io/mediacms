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

exec "$@"
