"""
Celery tasks for the oidc_auth application.

Moves the profile-picture download off the login request so the browser
is not held waiting on an external HTTP call.
"""

import logging

import requests
from celery import shared_task as task
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)


@task(name="oidc_auth.download_user_logo", queue="short_tasks", ignore_result=True)
def download_user_logo(user_pk, picture_url):
    """
    Download the OIDC 'picture' claim URL and save it as the user's logo.

    Always overwrites the current logo so that changes made on the identity
    provider are reflected on the next login.  Skips only when the user no
    longer exists or on network/HTTP errors.

    Errors (network timeouts, HTTP errors, image-save failures) are logged
    and swallowed so a broken profile-picture URL never blocks a login.
    """
    from users.models import User  # deferred to avoid import cycles

    try:
        user = User.objects.get(pk=user_pk)
    except User.DoesNotExist:
        logger.warning("oidc_auth.download_user_logo: user pk=%s not found", user_pk)
        return

    try:
        response = requests.get(picture_url, timeout=10)
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "")
        ext = "jpg" if ("jpeg" in content_type or "jpg" in content_type) else "png"
        user.logo.save(f"user.{ext}", ContentFile(response.content), save=True)
        logger.debug("oidc_auth.download_user_logo: updated logo for user %s", user_pk)
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "oidc_auth.download_user_logo failed for user pk=%s url=%s: %s",
            user_pk,
            picture_url,
            exc,
        )
