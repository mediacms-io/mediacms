FROM python:3.11-bookworm AS compile-image

SHELL ["/bin/bash", "-c"]

# Set up virtualenv
ENV VIRTUAL_ENV=/home/mediacms.io
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
ENV PIP_NO_CACHE_DIR=1

RUN mkdir -p /home/mediacms.io/mediacms/{logs} && cd /home/mediacms.io && python3 -m venv $VIRTUAL_ENV

# Install dependencies:
COPY requirements.txt .

RUN pip install -r requirements.txt

COPY . /home/mediacms.io/mediacms
WORKDIR /home/mediacms.io/mediacms

RUN wget -q http://zebulon.bok.net/Bento4/binaries/Bento4-SDK-1-6-0-637.x86_64-unknown-linux.zip && \
    unzip Bento4-SDK-1-6-0-637.x86_64-unknown-linux.zip -d ../bento4 && \
    mv ../bento4/Bento4-SDK-1-6-0-637.x86_64-unknown-linux/* ../bento4/ && \
    rm -rf ../bento4/Bento4-SDK-1-6-0-637.x86_64-unknown-linux && \
    rm -rf ../bento4/docs && \
    rm Bento4-SDK-1-6-0-637.x86_64-unknown-linux.zip

############ RUNTIME IMAGE ############
FROM python:3.11-bookworm

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

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

COPY --chown=www-data:www-data --from=compile-image /home/mediacms.io /home/mediacms.io

RUN apt-get update -y && apt-get -y upgrade && apt-get install --no-install-recommends \
    supervisor nginx imagemagick procps wget xz-utils -y && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get purge --auto-remove && \
    apt-get clean

RUN wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    mkdir -p ffmpeg-tmp && \
    tar -xf ffmpeg-release-amd64-static.tar.xz --strip-components 1 -C ffmpeg-tmp && \
    cp -v ffmpeg-tmp/ffmpeg ffmpeg-tmp/ffprobe ffmpeg-tmp/qt-faststart /usr/local/bin && \
    rm -rf ffmpeg-tmp ffmpeg-release-amd64-static.tar.xz

WORKDIR /home/mediacms.io/mediacms

EXPOSE 9000 80

RUN chmod +x ./deploy/docker/entrypoint.sh

ENTRYPOINT ["./deploy/docker/entrypoint.sh"]

CMD ["./deploy/docker/start.sh"]
