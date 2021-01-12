FROM python:3.8-buster AS compile-image

SHELL ["/bin/bash", "-c"]

# Set up virtualenv
ENV VIRTUAL_ENV=/home/mediacms.io
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
ENV PIP_NO_CACHE_DIR=1

RUN mkdir -p /home/mediacms.io/mediacms/{logs,pids} && cd /home/mediacms.io && python3 -m venv $VIRTUAL_ENV

# Install dependencies:
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . /home/mediacms.io/mediacms
WORKDIR /home/mediacms.io/mediacms

RUN wget -q http://zebulon.bok.net/Bento4/binaries/Bento4-SDK-1-6-0-632.x86_64-unknown-linux.zip && \
    mkdir -p /home/mediacms.io/mediacms/media_files/hls Bento4-SDK-1-6-0-632.x86_64-unknown-linux/bin/ && \
    unzip -j Bento4-SDK-1-6-0-632.x86_64-unknown-linux.zip Bento4-SDK-1-6-0-632.x86_64-unknown-linux/bin/mp4hls -d Bento4-SDK-1-6-0-632.x86_64-unknown-linux/bin/ && \
    rm Bento4-SDK-1-6-0-632.x86_64-unknown-linux.zip

RUN chown -R www-data. /home/mediacms.io/ && chmod +x /home/mediacms.io/mediacms/deploy/docker/start.sh /home/mediacms.io/mediacms/deploy/docker/prestart.sh

############ RUNTIME IMAGE ############
FROM python:3.8-slim-buster as runtime-image

ENV PYTHONUNBUFFERED=1
ENV ADMIN_USER='admin'
ENV ADMIN_PASSWORD='mediacms'
ENV ADMIN_EMAIL='admin@localhost'

# See: https://github.com/celery/celery/issues/6285#issuecomment-715316219
ENV CELERY_APP='cms'

# Use these to toggle which processes supervisord should run
ENV ENABLE_UWSGI='yes'
ENV ENABLE_NGINX='yes'
ENV ENABLE_CELERY_BEAT='yes'
ENV ENABLE_CELERY_SHORT='yes'
ENV ENABLE_CELERY_LONG='yes'
ENV ENABLE_MIGRATIONS='yes'

# Set up virtualenv
ENV VIRTUAL_ENV=/home/mediacms.io
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

COPY --from=compile-image /home/mediacms.io /home/mediacms.io

RUN apt-get update -y && apt-get -y upgrade && apt-get install --no-install-recommends \
    supervisor nginx ffmpeg imagemagick procps -y && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get purge --auto-remove && \
    apt-get clean

# forward request and error logs to docker log collector
RUN ln -sf /dev/stdout /var/log/nginx/access.log && ln -sf /dev/stderr /var/log/nginx/error.log && \
    ln -sf /dev/stdout /var/log/nginx/mediacms.io.access.log && ln -sf /dev/stderr /var/log/nginx/mediacms.io.error.log

WORKDIR /home/mediacms.io/mediacms

EXPOSE 9000 80

CMD ["./deploy/docker/start.sh"]
  