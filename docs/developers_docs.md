# Developers documentation

## Table of contents
- [1. Welcome](#1-welcome)
- [2. System architecture](#2-system-architecture)
- [3. API documentation](#3-api-documentation)
- [4. How to contribute](#4-how-to-contribute)
- [5. Working with Docker tips](#5-working-with-docker-tips)
- [6. Working with the automated tests](#6-working-with-the-automated-tests)
- [7. How video is transcoded](#7-how-video-is-transcoded)

## 1. Welcome
This page is created for MediaCMS developers and contains related information.

## 2. System architecture
to be written

## 3. API documentation
API is documented using Swagger - checkout ot http://your_installation/swagger - example https://demo.mediacms.io/swagger/
This page allows you to login to perform authenticated actions - it will also use your session if logged in.


An example of working with Python requests library:

```
import requests

auth = ('user' ,'password')
upload_url = "https://domain/api/v1/media"
title = 'x title'
description = 'x description'
media_file = '/tmp/file.mp4'

requests.post(
    url=upload_url,
    files={'media_file': open(media_file,'rb')},
    data={'title': title, 'description': description},
    auth=auth
)
```

## 4. How to contribute
Before you send a PR, make sure your code is properly formatted. For that, use `pre-commit install` to install a pre-commit hook and run `pre-commit run --all` and fix everything before you commit. This pre-commit will check for your code lint everytime you commit a code.

Checkout the [Code of conduct page](../CODE_OF_CONDUCT.md) if you want to contribute to this repository


## 5. Working with Docker tips

To perform the Docker installation, follow instructions to install Docker + Docker compose (docs/Docker_Compose.md) and then build/start docker-compose-dev.yaml . This will run the frontend application on port 8088 on top of all other containers (including the Django web application on port 80)

```
docker compose -f docker-compose-dev.yaml build
docker compose -f docker-compose-dev.yaml up
```

An `admin` user is created during the installation process. Its attributes are defined in `docker-compose-dev.yaml`:
```
ADMIN_USER: 'admin'
ADMIN_PASSWORD: 'admin'
ADMIN_EMAIL: 'admin@localhost'
```

### Frontend application changes
Eg change `frontend/src/static/js/pages/HomePage.tsx` , dev application refreshes in a number of seconds (hot reloading) and I see the changes, once I'm happy I can run

```
docker compose -f docker-compose-dev.yaml exec -T frontend npm run dist
```

And then in order for the changes to be visible on the application while served through nginx,

```
cp -r frontend/dist/static/* static/
```

POST calls: cannot be performed through the dev server, you have to make through the normal application (port 80) and then see changes on the dev application on port 8088.
Make sure the urls are set on `frontend/.env` if different than localhost


Media page: need to upload content through the main application (nginx/port 80), and then use an id for page media.html, for example `http://localhost:8088/media.html?m=nc9rotyWP`

There are some issues with CORS too to resolve, in order for some pages to function, eg the manage comments page

```
http://localhost:8088/manage-media.html manage_media
```

### Backend application changes
After I make changes to the django application (eg make a change on `files/forms.py`) in order to see the changes I have to restart the web container

```
docker compose -f docker-compose-dev.yaml restart web
```

## How video is transcoded

Original files get uploaded to the application server, and they get stored there as FileFields.

If files are videos and the duration is greater than a number (defined on settings, I think 4minutes), they are also broken in chunks, so one Encode object per chunk, for all enabled EncodeProfiles.

Then the workers start picking Encode objects and they transcode the chunks, so if a chunk gets transcoded correctly, the original file (the small chunk) gets replaced by the transcoded file, and the Encode object status is marked as 'success'.


original.mp4 (1G, 720px)--> Encode1 (100MB, 240px, chunk=True), Encode2 (100MB, 240px, chunk=True)...EncodeXX (100MB, 720px, chunk=True) ---> when all Encode objects are success, for a resolution, they get concatenated to the original_resolution.mp4 file and this gets stored as Encode object (chunk=False). This is what is available for download.

Apparently the Encode object is used to store Encoded files that are served eventually (chunk=False, status='success'), but also files while they are on their way to get transcoded (chunk=True, status='pending/etc')

(Parenthesis opening)
there is also an experimental small service (not commited to the repo currently) that speaks only through API and a) gets tasks to run, b) returns results. So it makes a request and receives an ffmpeg command, plus a file, it runs the ffmpeg command, and returns the result.I've used this mechanism on a number of installations to migrate existing videos through more servers/cpu and has worked with only one problem, some temporary files needed to be removed from the servers (through a periodic task, not so big problem)
(Parenthesis closing)


When the Encode object is marked as success and chunk=False, and thus is available for download/stream, there is a task that gets started and saves an HLS version of the file (1 mp4-->x number of small .ts chunks). This would be FILES_C

This mechanism allows for workers that have access on the same filesystem (either localhost, or through a shared network filesystem, eg NFS/EFS) to work on the same time and produce results.

## 6. Working with the automated tests

This instructions assume that you're using the docker installation

1. start docker-compose

```
docker compose up
```

2. Install the requirements on `requirements-dev.txt ` on web container (we'll use the web container for this)

```
docker compose exec -T web pip install -r requirements-dev.txt
```

3. Now you can run the existing tests

```
docker compose exec --env TESTING=True -T web pytest
```

The `TESTING=True` is passed for Django to be aware this is a testing environment (so that it runs Celery tasks as functions for example and not as background tasks, since Celery is not started in the case of pytest)


4. You may try a single test, by specifying the path, for example

```
docker compose exec --env TESTING=True -T web pytest tests/test_fixtures.py
```

5. You can also see the coverage

```
docker compose exec --env TESTING=True -T web pytest --cov=. --cov-report=html
```

and of course...you are very welcome to help us increase it ;)
