from django.db import models

from files.models import Media
from users.models import User

PUBLIC_USER_MEDIA_ACTIONS = (
    ("like", "Like"),
    ("dislike", "Dislike"),
    ("watch", "Watch"),
    ("report", "Report"),
    ("rate", "Rate"),
)

# Moderator/server-emitted audit events — not creatable via public save_user_action.
MODERATION_MEDIA_ACTIONS = (
    ("report_cleared", "Report cleared"),
    ("report_confirmed", "Report confirmed"),
    ("media_reviewed", "Media reviewed"),
    ("media_unreviewed", "Media unreviewed"),
    ("original_deleted", "Original deleted"),
)

USER_MEDIA_ACTIONS = PUBLIC_USER_MEDIA_ACTIONS + MODERATION_MEDIA_ACTIONS


class MediaAction(models.Model):
    """Stores different user actions"""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_index=True,
        blank=True,
        null=True,
        related_name="useractions",
    )
    session_key = models.CharField(
        max_length=33,
        db_index=True,
        blank=True,
        null=True,
        help_text="for not logged in users",
    )

    action = models.CharField(max_length=20, choices=USER_MEDIA_ACTIONS, default="watch")
    # keeps extra info, eg on report action, why it is reported
    extra_info = models.TextField(blank=True, null=True)

    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="mediaactions")
    action_date = models.DateTimeField(auto_now_add=True)
    remote_ip = models.CharField(max_length=40, blank=True, null=True)

    def save(self, *args, **kwargs):
        super(MediaAction, self).save(*args, **kwargs)

    def __str__(self):
        return self.action

    class Meta:
        verbose_name = "Media action"
        verbose_name_plural = "Media actions"
        indexes = [
            models.Index(fields=["user", "action", "-action_date"]),
            models.Index(fields=["session_key", "action"]),
        ]
