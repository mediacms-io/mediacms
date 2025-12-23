# Developers documentation

## Table of contents
- [1. Welcome](#1-welcome)
- [2. System architecture](#2-system-architecture)
- [3. API documentation](#3-api-documentation)
- [4. How to contribute](#4-how-to-contribute)
- [5. Working with Docker tips](#5-working-with-docker-tips)
- [6. Working with the automated tests](#6-working-with-the-automated-tests)
- [7. How video is transcoded](#7-how-video-is-transcoded)
- [8. Logging in MediaCMS](#8-logging-in-mediacms)

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

## 8. Logging in MediaCMS

MediaCMS uses Python's standard `logging` module throughout the codebase to capture exceptions, errors, and important events. This section covers logging patterns, best practices, and how to add logging to your code.

### Overview

MediaCMS implements consistent exception logging across the application to help with debugging and monitoring. All exception handlers use a standardized logging format that includes the exception type and message.

### Logger Initialization

To use logging in a new module, follow this pattern:

```python
import logging

logger = logging.getLogger(__name__)
```

**Important**: Always use `logging.getLogger(__name__)` to ensure loggers are properly namespaced by module. This allows fine-grained control over logging levels per module.

**For Celery Tasks**: Use the Celery task logger instead:

```python
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)
```

### Log Levels

MediaCMS uses the following log levels:

- **DEBUG**: Detailed information for diagnosing problems (only when DEBUG=True)
- **INFO**: General informational messages about application flow
- **WARNING**: Warning messages for potentially problematic situations (used for exceptions)
- **ERROR**: Error messages for serious problems
- **CRITICAL**: Critical errors that may cause the application to stop

**When to use each level:**

- **DEBUG**: Detailed diagnostic information, variable values during development
- **INFO**: Important application events (task started, media encoded, etc.)
- **WARNING**: Exception handling, recoverable errors, deprecated feature usage
- **ERROR**: Unrecoverable errors, failed operations
- **CRITICAL**: System-level failures, data corruption risks

### Exception Logging Pattern

MediaCMS uses a consistent pattern for logging exceptions throughout the codebase:

```python
except ExceptionType as e:
    logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
    # existing exception handling logic
```

**Key principles:**

1. **Preserve existing exception handling**: Only add logging statements, don't modify exception handling logic
2. **Use structured format**: Include exception type and message for better log parsing
3. **Use WARNING level**: Exceptions are typically logged at WARNING level unless they're critical
4. **Use `as e` syntax**: Always capture the exception object to access its properties

### Logging Locations

Logging is implemented in the following areas:

#### Celery Tasks (`files/tasks.py`)

Exception logging in background tasks:

```python
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@task(name="encode_media")
def encode_media(self, friendly_token, profile_id, encoding_id):
    try:
        media = Media.objects.get(friendly_token=friendly_token)
    except BaseException as e:
        logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
        # handle exception
        return False
```

#### FFmpeg Backend (`files/backends.py`)

Logging encoding-related exceptions:

```python
import logging

logger = logging.getLogger(__name__)

def _spawn(self, cmd):
    try:
        return Popen(cmd, ...)
    except OSError as e:
        logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
        raise VideoEncodingError("Error while running ffmpeg", e)
```

#### File Operations (`files/helpers.py`)

Logging file I/O and command execution errors:

```python
import logging

logger = logging.getLogger(__name__)

def run_command(cmd, cwd=None):
    # ... command execution ...
    try:
        ret["out"] = stdout.decode("utf-8")
    except BaseException as e:
        logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
        ret["out"] = ""
```

#### Django Views (`users/views.py`, `uploader/views.py`)

Logging view-level exceptions:

```python
import logging

logger = logging.getLogger(__name__)

def get_user(username):
    try:
        user = User.objects.get(username=username)
        return user
    except User.DoesNotExist as e:
        logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
        return None
```

#### Model Methods (`files/models/media.py`)

Logging model operation exceptions:

```python
import logging

logger = logging.getLogger(__name__)

class Media(models.Model):
    def media_init(self):
        try:
            self.media_info = json.dumps(ret)
        except TypeError as e:
            logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
            self.media_info = ""
```

### Best Practices

#### 1. Always Preserve Exception Handling Logic

**Good:**
```python
except BaseException as e:
    logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
    # existing handling logic unchanged
    return False
```

**Bad:**
```python
except BaseException as e:
    # Don't replace existing logic with logging
    logger.error("Error occurred")
    # missing original handling logic
```

#### 2. Use Structured Logging Format

**Good:**
```python
logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
```

**Bad:**
```python
logger.warning(f"Error: {e}")  # Less structured, harder to parse
```

#### 3. Don't Log Sensitive Information

**Good:**
```python
except AuthenticationError as e:
    logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
    # Don't log passwords, tokens, or user credentials
```

**Bad:**
```python
logger.warning(f"Login failed for user {username} with password {password}")  # Never log passwords!
```

#### 4. Use Appropriate Log Levels

- **WARNING**: For exceptions that are handled gracefully
- **ERROR**: For exceptions that cause operation failure
- **CRITICAL**: For exceptions that may cause system instability

#### 5. Add Context When Helpful

For complex operations, add context to log messages:

```python
except Exception as e:
    logger.warning("Caught exception during media encoding: type=%s, message=%s, media_id=%s", 
                   type(e).__name__, str(e), media.id)
```

### Examples

#### Adding Logging to a New Exception Handler

**Before:**
```python
def process_media(media_id):
    try:
        media = Media.objects.get(id=media_id)
        # process media
    except Media.DoesNotExist:
        return False
```

**After:**
```python
import logging

logger = logging.getLogger(__name__)

def process_media(media_id):
    try:
        media = Media.objects.get(id=media_id)
        # process media
    except Media.DoesNotExist as e:
        logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
        return False
```

#### Logging in Celery Tasks

```python
from celery import shared_task as task
from celery.utils.log import get_task_logger

logger = get_task_logger(__name__)

@task(name="process_video")
def process_video(video_id):
    try:
        video = Video.objects.get(id=video_id)
        # process video
    except Video.DoesNotExist as e:
        logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
        return False
    except Exception as e:
        logger.error("Unexpected error processing video: type=%s, message=%s", 
                     type(e).__name__, str(e))
        raise
```

#### Logging in Django Views

```python
from rest_framework.views import APIView
from rest_framework.response import Response
import logging

logger = logging.getLogger(__name__)

class MediaDetail(APIView):
    def get(self, request, friendly_token):
        try:
            media = Media.objects.get(friendly_token=friendly_token)
            return Response({"title": media.title})
        except Media.DoesNotExist as e:
            logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
            return Response({"error": "Media not found"}, status=404)
```

#### Logging in Model Methods

```python
import logging

logger = logging.getLogger(__name__)

class Media(models.Model):
    def save(self, *args, **kwargs):
        try:
            # custom save logic
            super().save(*args, **kwargs)
        except Exception as e:
            logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
            # handle exception
            raise
```

### Common Patterns

#### Handling Multiple Exception Types

```python
try:
    # operation
except SpecificException as e:
    logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
    # specific handling
except BaseException as e:
    logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
    # general handling
```

#### Logging Before Re-raising

```python
try:
    # operation
except CriticalException as e:
    logger.error("Caught critical exception: type=%s, message=%s", type(e).__name__, str(e))
    raise  # Re-raise after logging
```

#### Conditional Logging

```python
try:
    # operation
except Exception as e:
    if settings.DEBUG:
        logger.debug("Detailed error info: type=%s, message=%s", type(e).__name__, str(e))
    logger.warning("Caught exception: type=%s, message=%s", type(e).__name__, str(e))
    # handle exception
```

### Integration with Configuration

Logging behavior is controlled by the logging configuration in `cms/settings.py`. See [Administrator Documentation - Logging Configuration](admins_docs.md#29-logging-configuration-and-management) for details on:

- Configuring log levels
- Setting up log handlers
- Customizing log formats
- Enabling debug logging

### Testing Logging

When writing tests, you can verify logging behavior:

```python
import logging
from unittest.mock import patch

def test_exception_logging():
    with patch('files.helpers.logger') as mock_logger:
        # trigger code that should log
        result = function_that_logs()
        
        # verify logging was called
        mock_logger.warning.assert_called_once()
        call_args = mock_logger.warning.call_args
        assert "Caught exception" in str(call_args)
```

### Related Documentation

- For logging configuration options, see [Administrator Documentation - Logging Configuration](admins_docs.md#29-logging-configuration-and-management)
- For Python logging module documentation, see [Python Logging Documentation](https://docs.python.org/3/library/logging.html)
