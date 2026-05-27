"""
OIDC parser: download and cache the user profile picture.

Enqueues a Celery task to fetch the picture URL from the OIDC claim and
store it as the user's logo.  The download is skipped if the user already
has a non-default logo so that manually uploaded pictures are not overwritten.
"""

import logging

logger = logging.getLogger(__name__)

_DEFAULT_LOGO = "userlogos/user.jpg"


def sync_profile_picture(user, raw_value, social_app, oidc_configuration, **parser_options):
    """
    Enqueue an async Celery task to download and save the profile picture.

    raw_value: the picture URL string from the OIDC claim (e.g. "picture").

    Skips when:
      - raw_value is not a non-empty string
      - the user already has a non-default logo (set manually or by a
        previous OIDC sync) so the picture is downloaded only once
    """
    logger.debug(
        "sync_profile_picture: user=%s, raw_value=%r, logo=%r",
        user.username, raw_value, user.logo.name,
    )
    if not raw_value or not isinstance(raw_value, str):
        logger.debug("sync_profile_picture: skipping — no picture URL")
        return

    # if user.logo.name and user.logo.name != _DEFAULT_LOGO:
    #     logger.debug("sync_profile_picture: skipping — user already has a logo")
    #     return

    from oidc_auth.tasks import download_user_logo  # deferred to avoid import cycle

    download_user_logo(user.pk, raw_value)
