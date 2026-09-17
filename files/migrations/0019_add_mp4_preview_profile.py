from django.db import migrations

PREVIEW_NAME = "preview"


def add_mp4_preview_profile(apps, schema_editor):
    """Move the hover preview from an animated gif to a short mp4.

    Both profiles are kept, so every existing gif preview stays attached to the profile
    that produced it and is still served: a preview is recognised by profile name rather
    than extension. Matched on name and extension rather than a primary key, since a
    portal may have added profiles of its own.
    """
    EncodeProfile = apps.get_model("files", "EncodeProfile")

    EncodeProfile.objects.get_or_create(
        name=PREVIEW_NAME,
        extension="mp4",
        defaults={
            # a preview is not a rendition: a resolution or a codec here would make it
            # eligible for encoding as one, and offer it as a download
            "resolution": None,
            "codec": None,
            "description": "",
            "active": True,
        },
    )

    # get_or_create only applies its defaults when it creates, so activating separately is
    # what makes a re-run after a reverse leave a working preview behind
    EncodeProfile.objects.filter(name=PREVIEW_NAME, extension="mp4").update(active=True)

    # stop producing new gifs without touching the ones already produced: nothing deletes
    # encodings by profile.active
    EncodeProfile.objects.filter(name=PREVIEW_NAME, extension="gif").update(active=False)


def restore_gif_preview_profile(apps, schema_editor):
    """Hand the preview role back to the gif profile.

    The mp4 profile is deactivated rather than deleted: it may own encodings by now, and
    deleting it would cascade to them and to the files on disk.
    """
    EncodeProfile = apps.get_model("files", "EncodeProfile")

    EncodeProfile.objects.filter(name=PREVIEW_NAME, extension="mp4").update(active=False)
    EncodeProfile.objects.filter(name=PREVIEW_NAME, extension="gif").update(active=True)


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0018_embedmediacourse"),
    ]

    operations = [
        migrations.RunPython(add_mp4_preview_profile, restore_gif_preview_profile),
    ]
