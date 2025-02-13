FROM python:3.13-bookworm AS build-image

# Install system dependencies needed for downloading and extracting
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends wget xz-utils unzip && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get purge --auto-remove && \
    apt-get clean

# Install ffmpeg
RUN wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    mkdir -p ffmpeg-tmp && \
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

############ RUNTIME IMAGE ############
FROM python:3.13-bookworm AS runtime_image

SHELL ["/bin/bash", "-c"]

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV CELERY_APP='cms'
ENV VIRTUAL_ENV=/home/mediacms.io
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install runtime system dependencies
RUN apt-get update -y && \
    apt-get -y upgrade && \
    apt-get install --no-install-recommends supervisor nginx imagemagick procps -y && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get purge --auto-remove && \
    apt-get clean

# Copy ffmpeg and Bento4 from build image
COPY --from=build-image /usr/local/bin/ffmpeg /usr/local/bin/ffmpeg
COPY --from=build-image /usr/local/bin/ffprobe /usr/local/bin/ffprobe
COPY --from=build-image /usr/local/bin/qt-faststart /usr/local/bin/qt-faststart
COPY --from=build-image /home/mediacms.io/bento4 /home/mediacms.io/bento4

# Set up virtualenv
RUN mkdir -p /home/mediacms.io/mediacms/{logs} && \
    cd /home/mediacms.io && \
    python3 -m venv $VIRTUAL_ENV

# Install Python dependencies
COPY requirements.txt requirements-dev.txt ./

ARG DEVELOPMENT_MODE=False

RUN pip install --no-cache-dir -r requirements.txt && \
    if [ "$DEVELOPMENT_MODE" = "True" ]; then \
        echo "Installing development dependencies..." && \
        pip install --no-cache-dir -r requirements-dev.txt; \
    fi

# Copy application files
COPY . /home/mediacms.io/mediacms
WORKDIR /home/mediacms.io/mediacms

# required for sprite thumbnail generation for large video files

COPY deploy/docker/policy.xml /etc/ImageMagick-6/policy.xml

# Set process control environment variables
ENV ENABLE_UWSGI='yes' \
    ENABLE_NGINX='yes' \
    ENABLE_CELERY_BEAT='yes' \
    ENABLE_CELERY_SHORT='yes' \
    ENABLE_CELERY_LONG='yes' \
    ENABLE_MIGRATIONS='yes'

EXPOSE 9000 80

RUN chmod +x ./deploy/docker/entrypoint.sh

ENTRYPOINT ["./deploy/docker/entrypoint.sh"]
CMD ["./deploy/docker/start.sh"]