from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.mail import EmailMessage
from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.urls import reverse
from django.utils import timezone
from django.utils.html import strip_tags
from imagekit.models import ProcessedImageField
from imagekit.processors import ResizeToFill

import files.helpers as helpers
from files.models import Category, Media, MediaPermission, Tag
from rbac.models import RBACGroup


class User(AbstractUser):
    logo = ProcessedImageField(
        upload_to="userlogos/%Y/%m/%d",
        processors=[ResizeToFill(200, 200)],
        default="userlogos/user.jpg",
        format="JPEG",
        options={"quality": 75},
        blank=True,
    )
    description = models.TextField("About me", blank=True)

    name = models.CharField("full name", max_length=250, db_index=True)
    date_added = models.DateTimeField("date added", default=timezone.now, db_index=True)
    is_featured = models.BooleanField("Is featured", default=False, db_index=True)
    is_approved = models.BooleanField("Is approved", default=False, null=True, blank=True, db_index=True)

    title = models.CharField("Title", max_length=250, blank=True)
    advancedUser = models.BooleanField("advanced user", default=False, db_index=True)
    media_count = models.IntegerField(default=0)  # save number of videos
    notification_on_comments = models.BooleanField(
        "Whether you will receive email notifications for comments added to your content",
        default=True,
    )
    location = models.CharField("Location", max_length=250, blank=True)
    is_editor = models.BooleanField("MediaCMS Editor", default=False, db_index=True)
    is_manager = models.BooleanField("MediaCMS Manager", default=False, db_index=True)
    allow_contact = models.BooleanField("Whether allow contact will be shown on profile page", default=False)

    class Meta:
        ordering = ["-date_added", "name"]
        indexes = [models.Index(fields=["-date_added", "name"])]

    def __str__(self):
        return f"{self.name} - {self.email}"

    def update_user_media(self):
        self.media_count = Media.objects.filter(listable=True, user=self).count()
        self.save(update_fields=["media_count"])
        return True

    def thumbnail_url(self):
        if self.logo:
            return helpers.url_from_path(self.logo.path)
        return None

    def banner_thumbnail_url(self):
        c = self.channels.filter().order_by("add_date").first()
        if c:
            return helpers.url_from_path(c.banner_logo.path)
        return None

    @property
    def email_is_verified(self):
        if self.emailaddress_set.first():
            if self.emailaddress_set.first().verified:
                return True
        return False

    def get_absolute_url(self, api=False):
        if api:
            return reverse("api_get_user", kwargs={"username": self.username})
        else:
            return reverse("get_user", kwargs={"username": self.username})

    def edit_url(self):
        return reverse("edit_user", kwargs={"username": self.username})

    def default_channel_edit_url(self):
        c = self.channels.filter().order_by("add_date").first()
        if c:
            return reverse("edit_channel", kwargs={"friendly_token": c.friendly_token})
        return None

    @property
    def playlists_info(self):
        ret = []
        for playlist in self.playlists.all():
            c = {}
            c["title"] = playlist.title
            c["description"] = playlist.description
            c["media_count"] = playlist.media_count
            c["add_date"] = playlist.add_date
            c["url"] = playlist.get_absolute_url()
            ret.append(c)
        return ret

    @property
    def media_info(self):
        ret = {}
        results = []
        ret["results"] = results
        ret["user_media"] = f"/api/v1/media?author={self.username}"
        return ret

    def save(self, *args, **kwargs):
        strip_text_items = ["name", "description", "title"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))
        super(User, self).save(*args, **kwargs)

    def get_user_rbac_groups(self):
        """Get all RBAC groups the user belongs to"""
        return RBACGroup.objects.filter(memberships__user=self)

    def get_rbac_categories_as_member(self):
        """
        Get all categories related to RBAC groups the user belongs to
        """
        rbac_groups = RBACGroup.objects.filter(memberships__user=self, memberships__role__in=["member", "contributor", "manager"])
        categories = Category.objects.prefetch_related("user").filter(rbac_groups__in=rbac_groups).distinct()
        return categories

    def has_member_access_to_category(self, category):
        rbac_groups = RBACGroup.objects.filter(memberships__user=self, memberships__role__in=["member", "contributor", "manager"], categories=category)
        return rbac_groups.exists()

    def has_member_access_to_media(self, media):
        # First check if user is the owner
        if media.user == self:
            return True

        # Then check RBAC permissions
        if getattr(settings, 'USE_RBAC', False):
            rbac_groups = RBACGroup.objects.filter(memberships__user=self, memberships__role__in=["member", "contributor", "manager"], categories__in=media.category.all()).distinct()
            if rbac_groups.exists():
                return True

        # Then check MediaShare permissions for any access
        media_permission_exists = MediaPermission.objects.filter(
            user=self,
            media=media,
        ).exists()

        return media_permission_exists

    def has_contributor_access_to_media(self, media):
        # First check if user is the owner
        if media.user == self:
            return True

        # Then check RBAC permissions
        if getattr(settings, 'USE_RBAC', False):
            rbac_groups = RBACGroup.objects.filter(memberships__user=self, memberships__role__in=["contributor", "manager"], categories__in=media.category.all()).distinct()
            if rbac_groups.exists():
                return True

        # Then check MediaShare permissions for editor or owner access
        media_permission_exists = MediaPermission.objects.filter(
            user=self,
            media=media,
            permission__in=["editor", "owner"],
        ).exists()

        return media_permission_exists

    def has_owner_access_to_media(self, media):
        # First check if user is the owner
        if media.user == self:
            return True

        # Then check RBAC permissions
        if getattr(settings, 'USE_RBAC', False):
            rbac_groups = RBACGroup.objects.filter(memberships__user=self, memberships__role__in=["manager"], categories__in=media.category.all()).distinct()
            if rbac_groups.exists():
                return True

        # Then check MediaShare permissions for owner access
        media_permission_exists = MediaPermission.objects.filter(
            user=self,
            media=media,
            permission="owner",
        ).exists()

        return media_permission_exists

    def get_rbac_categories_as_contributor(self):
        """
        Get all categories related to RBAC groups the user belongs to
        """
        rbac_groups = RBACGroup.objects.filter(memberships__user=self, memberships__role__in=["contributor", "manager"])
        categories = Category.objects.filter(rbac_groups__in=rbac_groups).distinct()
        return categories

    def set_role_from_mapping(self, role_mapping):
        """
        Sets user permissions based on a role mapping string.

        Args:
            role_mapping (str): The role identifier to map to internal permissions.

        Returns:
            bool: True if a valid role was applied, False otherwise.
        """
        update_fields = []

        if role_mapping == 'advancedUser':
            self.advancedUser = True
            update_fields.append('advancedUser')
        elif role_mapping == 'editor':
            self.is_editor = True
            update_fields.append('is_editor')
        elif role_mapping == 'manager':
            self.is_manager = True
            update_fields.append('is_manager')
        elif role_mapping == 'admin':
            self.is_superuser = True
            self.is_staff = True
            update_fields.extend(['is_superuser', 'is_staff'])
        else:
            self.is_superuser = False
            self.is_staff = False
            self.advancedUser = False
            self.is_editor = False
            self.is_manager = False
            update_fields.extend(['is_superuser', 'is_staff', 'advancedUser', 'is_editor', 'is_manager'])

        if update_fields:
            self.save(update_fields=update_fields)
        return True


class Channel(models.Model):
    title = models.CharField(max_length=90, db_index=True)
    description = models.TextField(blank=True, help_text="description")
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_index=True, related_name="channels")
    add_date = models.DateTimeField(auto_now_add=True, db_index=True)
    subscribers = models.ManyToManyField(User, related_name="subscriptions", blank=True)
    friendly_token = models.CharField(blank=True, max_length=12)
    banner_logo = ProcessedImageField(
        upload_to="userlogos/%Y/%m/%d",
        processors=[ResizeToFill(900, 200)],
        default="userlogos/banner.jpg",
        format="JPEG",
        options={"quality": 85},
        blank=True,
    )

    def save(self, *args, **kwargs):
        strip_text_items = ["description", "title"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))

        if not self.friendly_token:
            while True:
                friendly_token = helpers.produce_friendly_token()
                if not Channel.objects.filter(friendly_token=friendly_token):
                    self.friendly_token = friendly_token
                    break
        super(Channel, self).save(*args, **kwargs)

    def __str__(self):
        return f"{self.user.username} -{self.title}"

    def get_absolute_url(self, edit=False):
        if edit:
            return reverse("edit_channel", kwargs={"friendly_token": self.friendly_token})
        else:
            return reverse("view_channel", kwargs={"friendly_token": self.friendly_token})

    @property
    def edit_url(self):
        return self.get_absolute_url(edit=True)


@receiver(post_save, sender=User)
def post_user_create(sender, instance, created, **kwargs):
    # create a Channel object upon user creation, name it default
    if created:
        new = Channel.objects.create(title="default", user=instance)
        new.save()
        if settings.ADMINS_NOTIFICATIONS.get("NEW_USER", False):
            title = f"[{settings.PORTAL_NAME}] - New user just registered"
            msg = """
User has just registered with email %s\n
Visit user profile page at %s
            """ % (
                instance.email,
                settings.SSL_FRONTEND_HOST + instance.get_absolute_url(),
            )
            email = EmailMessage(title, msg, settings.DEFAULT_FROM_EMAIL, settings.ADMIN_EMAIL_LIST)
            email.send(fail_silently=True)


NOTIFICATION_METHODS = (("email", "Email"),)


class Notification(models.Model):
    """User specific notifications
    To be exposed on user profile
    Needs work
    """

    user = models.ForeignKey(User, on_delete=models.CASCADE, db_index=True, related_name="notifications")
    action = models.CharField(max_length=30, blank=True)
    notify = models.BooleanField(default=False)
    method = models.CharField(max_length=20, choices=NOTIFICATION_METHODS, default="email")

    def save(self, *args, **kwargs):
        super(Notification, self).save(*args, **kwargs)

    def __str__(self):
        return self.user.username


@receiver(post_delete, sender=User)
def delete_content(sender, instance, **kwargs):
    """Delete user related content
    Upon user deletion
    """

    Media.objects.filter(user=instance).delete()
    Tag.objects.filter(user=instance).delete()
    Category.objects.filter(user=instance).delete()
