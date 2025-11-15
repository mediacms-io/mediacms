FROM python:3.13.5-slim-bookworm AS build-image

# Install system dependencies needed for downloading and extracting
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends wget xz-utils unzip && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get purge --auto-remove && \
    apt-get clean

RUN wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz

RUN mkdir -p ffmpeg-tmp && \
    tar -xf ffmpeg-release-amd64-static.tar.xz --strip-components 1 -C ffmpeg-tmp && \
    cp -v ffmpeg-tmp/ffmpeg ffmpeg-tmp/ffprobe ffmpeg-tmp/qt-faststart /usr/local/bin && \
    rm -rf ffmpeg-tmp ffmpeg-release-amd64-static.tar.xz

# Install Bento4 in the specified location
RUN mkdir -p /home/mediacms.io/bento4 && \
    wget -q http://zebulon.bok.net/Bento4/binaries/Bento4-SDK-1-6-0-637.x86_64-unknown-linux.zip && \
    unzip Bento4-SDK-1-6-0-637.x86_64-unknown-linux.zip -d /home/mediacms.io/bento4 && \
    mv /home/mediacms.io/bento4/Bento4-SDK-1-6-0-637.x86_64-unknown-linux/* /home/mediacms.io/bento4/ && \
    rm -rf /home/mediacms.io/bento4/Bento4-SDK-1-6-0-637.x86_64-unknown-linux && \
    rm -rf /home/mediacms.io/bento4/docs && \
    rm Bento4-SDK-1-6-0-637.x86_64-unknown-linux.zip

############ BASE RUNTIME IMAGE ############
FROM python:3.13.5-slim-bookworm AS base

LABEL org.opencontainers.image.version="7.3"
LABEL org.opencontainers.image.title="MediaCMS"
LABEL org.opencontainers.image.description="Modern, scalable and open source video platform"

SHELL ["/bin/bash", "-c"]

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    CELERY_APP='cms' \
    VIRTUAL_ENV=/home/mediacms.io \
    PATH="$VIRTUAL_ENV/bin:$PATH"

# Install system dependencies (no nginx, no supervisor)
RUN apt-get update -y && \
    apt-get -y upgrade && \
    apt-get install --no-install-recommends -y \
        imagemagick \
        procps \
        build-essential \
        pkg-config \
        zlib1g-dev \
        zlib1g \
        libxml2-dev \
        libxmlsec1-dev \
        libxmlsec1-openssl \
        libpq-dev \
        gosu \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set up virtualenv
RUN mkdir -p /home/mediacms.io/mediacms/{logs,media_files,static} && \
    cd /home/mediacms.io && \
    python3 -m venv $VIRTUAL_ENV

# Copy requirements files
COPY requirements.txt requirements-dev.txt ./

# Install Python dependencies using pip (within virtualenv)
ARG DEVELOPMENT_MODE=False
RUN pip install --no-cache-dir uv && \
    uv pip install --no-binary lxml --no-binary xmlsec -r requirements.txt && \
    if [ "$DEVELOPMENT_MODE" = "True" ]; then \
        echo "Installing development dependencies..." && \
        uv pip install -r requirements-dev.txt; \
    fi && \
    apt-get purge -y --auto-remove \
        build-essential \
        pkg-config \
        libxml2-dev \
        libxmlsec1-dev \
        libpq-dev

# Copy ffmpeg and Bento4 from build image
COPY --from=build-image /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg
COPY --from=build-image /usr/local/bin/ffprobe /usr/local/bin/ffprobe
COPY --from=build-image /usr/local/bin/qt-faststart /usr/local/bin/qt-faststart
COPY --from=build-image /home/mediacms.io/bento4 /home/mediacms.io/bento4

# Copy application files with correct ownership
COPY --chown=www-data:www-data . /home/mediacms.io/mediacms
WORKDIR /home/mediacms.io/mediacms

# Copy imagemagick policy for sprite thumbnail generation
COPY config/imagemagick/policy.xml /etc/ImageMagick-6/policy.xml

# Copy local_settings.py from config to cms/ for default Docker config (if exists)
RUN if [ -f config/local_settings.py ]; then \
        cp config/local_settings.py cms/local_settings.py && \
        chown www-data:www-data cms/local_settings.py && \
        echo "Docker local_settings.py applied"; \
    else \
        echo "No config/local_settings.py found, using default settings"; \
    fi

# Create www-data user directories and set permissions
RUN mkdir -p /var/run/mediacms && \
    chown -R www-data:www-data /home/mediacms.io/mediacms/logs \
                                /home/mediacms.io/mediacms/media_files \
                                /home/mediacms.io/mediacms/static \
                                /var/run/mediacms

# Copy and set up entrypoint script
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

############ WEB IMAGE (Django/uWSGI) ############
FROM base AS web

# Install uWSGI
RUN uv pip install uwsgi

# Copy uWSGI configuration
COPY config/uwsgi/uwsgi.ini /home/mediacms.io/mediacms/uwsgi.ini

EXPOSE 9000

CMD ["/home/mediacms.io/bin/uwsgi", "--ini", "/home/mediacms.io/mediacms/uwsgi.ini"]

############ WORKER IMAGE (Celery) ############
FROM base AS worker

# CMD will be overridden in docker-compose for different worker types

############ FULL WORKER IMAGE (Celery with extra codecs) ############
FROM worker AS worker-full

COPY requirements-full.txt ./
RUN mkdir -p /root/.cache/ && \
    chmod go+rwx /root/ && \
    chmod go+rwx /root/.cache/ && \
    uv pip install -r requirements-full.txt
