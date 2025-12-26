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

### Signal Handler Logging

MediaCMS uses Django signals to automatically log important application events. Signal handlers provide a clean way to add logging without modifying core application code.

#### Django-Allauth Signal Handlers

MediaCMS includes signal handlers for django-allauth authentication events:

**User Login** (`user_logged_in`):
```python
from allauth.account.signals import user_logged_in
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)

@receiver(user_logged_in)
def log_user_login(sender, request, user, **kwargs):
    client_ip = request.META.get('REMOTE_ADDR', 'unknown')
    logger.info(
        "Login successful (django-allauth) - user_id=%s, username=%s, ip=%s",
        user.id,
        user.username,
        client_ip,
    )
```

**User Logout** (`user_logged_out`):
```python
from allauth.account.signals import user_logged_out

@receiver(user_logged_out)
def log_user_logout(sender, request, user, **kwargs):
    if user:
        logger.info(
            "Logout (django-allauth) - user_id=%s, username=%s",
            user.id,
            user.username,
        )
```

**Password Reset** (`password_reset`):
```python
from allauth.account.signals import password_reset

@receiver(password_reset)
def log_password_reset(sender, request, user, **kwargs):
    client_ip = request.META.get('REMOTE_ADDR', 'unknown')
    logger.info(
        "Password reset requested - user_id=%s, username=%s, email=%s, ip=%s",
        user.id if user else None,
        user.username if user else None,
        user.email if user else None,
        client_ip,
    )
```

**Email Confirmation** (`email_confirmed`):
```python
from allauth.account.signals import email_confirmed

@receiver(email_confirmed)
def log_email_confirmed(sender, request, email_address, **kwargs):
    user = email_address.user if email_address else None
    logger.info(
        "Email confirmed - user_id=%s, username=%s, email=%s",
        user.id if user else None,
        user.username if user else None,
        email_address.email if email_address else None,
    )
```

**Password Change** (`password_changed`):
```python
from allauth.account.signals import password_changed

@receiver(password_changed)
def log_password_changed(sender, request, user, **kwargs):
    client_ip = request.META.get('REMOTE_ADDR', 'unknown')
    logger.info(
        "Password changed - user_id=%s, username=%s, ip=%s",
        user.id if user else None,
        user.username if user else None,
        client_ip,
    )
```

**Account Signup** (`account_signup`):
```python
from allauth.account.signals import account_signup

@receiver(account_signup)
def log_account_signup(sender, request, user, **kwargs):
    client_ip = request.META.get('REMOTE_ADDR', 'unknown')
    logger.info(
        "Account signup (django-allauth) - user_id=%s, username=%s, email=%s, ip=%s",
        user.id if user else None,
        user.username if user else None,
        user.email if user else None,
        client_ip,
    )
```

#### Django Model Signal Handlers

MediaCMS includes signal handlers for Django model events:

**User Creation** (`post_save` for User):
```python
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def post_user_create(sender, instance, created, **kwargs):
    if created:
        logger.info(
            "User registered - user_id=%s, username=%s, email=%s",
            instance.id,
            instance.username,
            instance.email,
        )
```

**User Deletion** (`post_delete` for User):
```python
from django.db.models.signals import post_delete

@receiver(post_delete, sender=User)
def delete_content(sender, instance, **kwargs):
    # Count content before deletion
    media_count = Media.objects.filter(user=instance).count()
    tag_count = Tag.objects.filter(user=instance).count()
    category_count = Category.objects.filter(user=instance).count()
    
    logger.info(
        "User deletion - user_id=%s, username=%s, email=%s, media_count=%s, tag_count=%s, category_count=%s",
        instance.id,
        instance.username,
        instance.email,
        media_count,
        tag_count,
        category_count,
    )
```

**Media Creation/Updates** (`post_save` for Media):
```python
@receiver(post_save, sender=Media)
def media_save(sender, instance, created, **kwargs):
    if not instance.friendly_token:
        return False

    if created:
        logger.info(
            "Media created - friendly_token=%s, user_id=%s, username=%s, media_type=%s, title=%s",
            instance.friendly_token,
            instance.user.id if instance.user else None,
            instance.user.username if instance.user else None,
            instance.media_type,
            instance.title[:50] if instance.title else None,
        )
    else:
        logger.debug(
            "Media updated - friendly_token=%s, user_id=%s",
            instance.friendly_token,
            instance.user.id if instance.user else None,
        )
```

**Media Deletion** (`pre_delete` and `post_delete` for Media):
```python
from django.db.models.signals import pre_delete, post_delete

@receiver(pre_delete, sender=Media)
def media_file_pre_delete(sender, instance, **kwargs):
    logger.info(
        "Media deletion initiated - friendly_token=%s, user_id=%s, media_type=%s",
        instance.friendly_token,
        instance.user.id if instance.user else None,
        instance.media_type,
    )

@receiver(post_delete, sender=Media)
def media_file_delete(sender, instance, **kwargs):
    logger.info(
        "Media deletion completed - friendly_token=%s, user_id=%s, media_type=%s, title=%s",
        instance.friendly_token,
        instance.user.id if instance.user else None,
        instance.media_type,
        instance.title[:50] if instance.title else None,
    )
```

**Media Category Changes** (`m2m_changed` for Media.category):
```python
from django.db.models.signals import m2m_changed

@receiver(m2m_changed, sender=Media.category.through)
def media_m2m(sender, instance, action, pk_set, **kwargs):
    # Only log post_add and post_remove actions
    if action in ['post_add', 'post_remove']:
        from .category import Category
        categories = Category.objects.filter(pk__in=pk_set) if pk_set else []
        category_names = [cat.title for cat in categories]
        
        logger.info(
            "Media category %s - friendly_token=%s, user_id=%s, action=%s, category_count=%s, category_names=%s",
            "added" if action == 'post_add' else "removed",
            instance.friendly_token if instance.friendly_token else None,
            instance.user.id if instance.user else None,
            action,
            len(categories),
            category_names,
        )
```

**Subtitle Creation/Updates** (`post_save` for Subtitle):
```python
@receiver(post_save, sender=Subtitle)
def subtitle_save(sender, instance, created, **kwargs):
    if created:
        logger.info(
            "Subtitle created - friendly_token=%s, language=%s, user_id=%s",
            instance.media.friendly_token if instance.media else None,
            instance.language.code if instance.language else None,
            instance.media.user.id if instance.media and instance.media.user else None,
        )
    else:
        logger.debug(
            "Subtitle updated - friendly_token=%s, language=%s, user_id=%s",
            instance.media.friendly_token if instance.media else None,
            instance.language.code if instance.language else None,
            instance.media.user.id if instance.media and instance.media.user else None,
        )
```

**Encoding Creation/Updates** (`post_save` for Encoding):
```python
@receiver(post_save, sender=Encoding)
def encoding_file_save(sender, instance, created, **kwargs):
    if created:
        logger.info(
            "Encoding created - friendly_token=%s, profile_id=%s, profile_name=%s, status=%s, chunk=%s",
            instance.media.friendly_token if instance.media else None,
            instance.profile.id if instance.profile else None,
            instance.profile.name if instance.profile else None,
            instance.status,
            instance.chunk,
        )
    else:
        logger.debug(
            "Encoding updated - friendly_token=%s, profile_id=%s, status=%s, chunk=%s",
            instance.media.friendly_token if instance.media else None,
            instance.profile.id if instance.profile else None,
            instance.status,
            instance.chunk,
        )
```

**Encoding Deletion** (`post_delete` for Encoding):
```python
@receiver(post_delete, sender=Encoding)
def encoding_file_delete(sender, instance, **kwargs):
    logger.info(
        "Encoding deleted - friendly_token=%s, profile_id=%s, profile_name=%s, status=%s, chunk=%s, has_media_file=%s",
        instance.media.friendly_token if instance.media else None,
        instance.profile.id if instance.profile else None,
        instance.profile.name if instance.profile else None,
        instance.status,
        instance.chunk,
        bool(instance.media_file),
    )
```

**Video Chapter Deletion** (`post_delete` for VideoChapterData):
```python
@receiver(post_delete, sender=VideoChapterData)
def videochapterdata_delete(sender, instance, **kwargs):
    logger.info(
        "Video chapter data deleted - friendly_token=%s, user_id=%s, chapters_folder=%s",
        instance.media.friendly_token if instance.media else None,
        instance.media.user.id if instance.media and instance.media.user else None,
        instance.media.video_chapters_folder if instance.media else None,
    )
```

**RBAC Group Category Changes** (`m2m_changed` for RBACGroup.categories):
```python
@receiver(m2m_changed, sender=RBACGroup.categories.through)
def handle_rbac_group_categories_change(sender, instance, action, pk_set, **kwargs):
    if action in ['post_add', 'post_remove']:
        categories = Category.objects.filter(pk__in=pk_set) if pk_set else []
        category_names = [cat.title for cat in categories]
        
        logger.info(
            "RBAC group category %s - group_id=%s, group_name=%s, group_uid=%s, action=%s, category_count=%s, category_names=%s, identity_provider=%s",
            "added" if action == 'post_add' else "removed",
            instance.id,
            instance.name,
            instance.uid,
            action,
            len(categories),
            category_names,
            instance.identity_provider.provider if instance.identity_provider else None,
        )
```

### Event Logging Patterns

MediaCMS uses consistent logging patterns for different types of events:

#### Authentication Event Logging

Authentication events are logged at INFO level for successful operations and WARNING level for failures:

```python
# Successful login
logger.info(
    "Login successful - user_id=%s, username=%s, ip=%s",
    user.id,
    user.username,
    request.META.get('REMOTE_ADDR'),
)

# Failed login attempt
logger.warning(
    "Login failed: user not found - username_or_email=%s, ip=%s",
    username_or_email,
    request.META.get('REMOTE_ADDR'),
)
```

#### User Management Event Logging

User management events include creation, deletion, password changes, and role changes:

```python
# User creation
logger.info(
    "User registered - user_id=%s, username=%s, email=%s",
    instance.id,
    instance.username,
    instance.email,
)

# User deletion with content counts
logger.info(
    "User deletion - user_id=%s, username=%s, email=%s, media_count=%s, tag_count=%s, category_count=%s",
    instance.id,
    instance.username,
    instance.email,
    media_count,
    tag_count,
    category_count,
)

# Role changes
logger.info(
    "User role(s) changed - user_id=%s, username=%s, changed_roles=%s, source=role_mapping",
    self.id,
    self.username,
    changed_roles,
)
```

#### Media Operation Event Logging

Media operations include creation, updates, deletion, and bulk actions:

```python
# Media creation
logger.info(
    "Media created - friendly_token=%s, user_id=%s, username=%s, media_type=%s, title=%s",
    instance.friendly_token,
    instance.user.id if instance.user else None,
    instance.user.username if instance.user else None,
    instance.media_type,
    instance.title[:50] if instance.title else None,
)

# Media updates
logger.info(
    "Media updated via API - friendly_token=%s, user_id=%s, changed_fields=%s",
    friendly_token,
    request.user.id if request.user.is_authenticated else None,
    changed_fields,
)

# Bulk operations
logger.info(
    "Bulk action: download enabled - count=%s, user_id=%s, media_ids=%s",
    count,
    request.user.id,
    list(media.values_list('friendly_token', flat=True)),
)
```

#### Subtitle Operation Event Logging

Subtitle operations use INFO for creation and DEBUG for updates:

```python
# Subtitle creation
logger.info(
    "Subtitle created - friendly_token=%s, language=%s, user_id=%s",
    instance.media.friendly_token if instance.media else None,
    instance.language.code if instance.language else None,
    instance.media.user.id if instance.media and instance.media.user else None,
)

# Subtitle updates
logger.debug(
    "Subtitle updated - friendly_token=%s, language=%s, user_id=%s",
    instance.media.friendly_token if instance.media else None,
    instance.language.code if instance.language else None,
    instance.media.user.id if instance.media and instance.media.user else None,
)
```

#### Encoding Operation Event Logging

Encoding operations track creation, updates, and deletion:

```python
# Encoding creation
logger.info(
    "Encoding created - friendly_token=%s, profile_id=%s, profile_name=%s, status=%s, chunk=%s",
    instance.media.friendly_token if instance.media else None,
    instance.profile.id if instance.profile else None,
    instance.profile.name if instance.profile else None,
    instance.status,
    instance.chunk,
)

# Encoding deletion
logger.info(
    "Encoding deleted - friendly_token=%s, profile_id=%s, profile_name=%s, status=%s, chunk=%s, has_media_file=%s",
    instance.media.friendly_token if instance.media else None,
    instance.profile.id if instance.profile else None,
    instance.profile.name if instance.profile else None,
    instance.status,
    instance.chunk,
    bool(instance.media_file),
)
```

#### RBAC Operation Event Logging

RBAC operations track group category changes:

```python
logger.info(
    "RBAC group category %s - group_id=%s, group_name=%s, group_uid=%s, action=%s, category_count=%s, category_names=%s, identity_provider=%s",
    "added" if action == 'post_add' else "removed",
    instance.id,
    instance.name,
    instance.uid,
    action,
    len(categories),
    category_names,
    instance.identity_provider.provider if instance.identity_provider else None,
)
```

### Best Practices for Signal Handler Logging

1. **Use Appropriate Log Levels**:
   - **INFO**: For important events that should always be logged (creation, deletion, authentication)
   - **DEBUG**: For frequent updates that are only needed during development
   - **WARNING**: For failed operations or permission denials

2. **Structured Logging Format**:
   - Always use key-value pairs: `key=value`
   - Include relevant identifiers (user_id, friendly_token, etc.)
   - Use conditional checks to avoid AttributeError: `instance.user.id if instance.user else None`

3. **Include Context**:
   - Always include user information when available
   - Include IP addresses for authentication events
   - Include counts for bulk operations
   - Include changed fields for update operations

4. **Handle Edge Cases**:
   - Check for None values before accessing attributes
   - Use conditional expressions: `value if condition else None`
   - Truncate long strings (e.g., `title[:50]`)

5. **Signal Handler Placement**:
   - Place signal handlers in the same module as the model when possible
   - Use `@receiver` decorator for clarity
   - Import signals at the top of the file

### Adding Logging to New Signal Handlers

When adding logging to a new signal handler:

1. **Import logging and get logger**:
```python
import logging
logger = logging.getLogger(__name__)
```

2. **Add logging at appropriate points**:
```python
@receiver(post_save, sender=YourModel)
def your_signal_handler(sender, instance, created, **kwargs):
    if created:
        logger.info(
            "YourModel created - id=%s, field1=%s, field2=%s",
            instance.id,
            instance.field1,
            instance.field2,
        )
    else:
        logger.debug(
            "YourModel updated - id=%s, field1=%s",
            instance.id,
            instance.field1,
        )
```

3. **Follow structured logging format**:
   - Use key-value pairs
   - Include relevant identifiers
   - Handle None values safely

### Integration with Configuration

Logging behavior is controlled by the logging configuration in `cms/settings.py`. See [Administrator Documentation - Logging Configuration](admins_docs.md#29-logging-configuration-and-management) for details on:

- Configuring log levels
- Setting up log handlers
- Customizing log formats
- Enabling debug logging

#### SQL Debug Logging

By default, SQL query logging is **disabled** even when `DEBUG=True` to prevent excessive log noise. To enable detailed SQL query logging for debugging database operations, set `ENABLE_SQL_DEBUG_LOGGING=True` in your `local_settings.py` or via environment variable:

```python
# In local_settings.py
DEBUG = True
ENABLE_SQL_DEBUG_LOGGING = True
```

**Note**: SQL debug logging requires both `DEBUG=True` and `ENABLE_SQL_DEBUG_LOGGING=True` to be enabled.

#### Celery Logging Behavior

MediaCMS includes optimized Celery logging configuration:

- **`celery.task` logger**: Set to DEBUG level when `DEBUG=True` to capture useful task execution details
- **`celery` logger**: Set to INFO level to reduce noise while preserving important messages
- **`celery.utils.functional` logger**: Suppressed at WARNING level to avoid useless debug messages from Celery's internal function introspection

This configuration ensures you get useful task execution logs without being overwhelmed by internal Celery debug messages.

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
