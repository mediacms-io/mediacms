import os

from django.conf import settings
from django.core.files import File

from files.models import Media

FIXTURES_DIR = os.path.join(settings.BASE_DIR, "fixtures")
SMALL_VIDEO = "small_video.mp4"
MEDIUM_VIDEO = "medium_video.mp4"
IMAGE = "test_image.png"
IMAGE_JPG = "test_image2.jpg"

POST_CREATE_FIELDS = ("state", "is_reviewed", "encoding_status", "featured", "reported_times")


def fixture_path(name):
    return os.path.join(FIXTURES_DIR, name)


def create_media(user, filename=IMAGE, transcode=False, **fields):
    post_create = {key: fields.pop(key) for key in POST_CREATE_FIELDS if key in fields}
    categories = fields.pop("category", None)
    tags = fields.pop("tags", None)

    media = Media(user=user, **fields)
    media._do_not_transcode = not transcode
    with open(fixture_path(filename), "rb") as fp:
        media.media_file.save(os.path.basename(filename), File(fp), save=False)
    media.save()
    media.refresh_from_db()

    if categories:
        media.category.add(*categories)
    if tags:
        media.tags.add(*tags)

    if post_create:
        for key, value in post_create.items():
            setattr(media, key, value)
        media.save()
        media.refresh_from_db()
    return media
