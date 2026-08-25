from django.db import migrations

PREVIEW_NAME = "preview"


def add_mp4_preview_profile(apps, schema_editor):
    """Move the hover preview from an animated gif to a short mp4.

    Both profiles are kept. Every existing gif preview stays exactly where it is, still
    attached to the profile that produced it, and still served: a preview is recognised by
    profile name rather than by extension, so the two formats coexist and no media has to
    be re-encoded.

    Matched on name and extension rather than on a primary key, because a portal may have
    added profiles of its own and nothing here should depend on which ids are free.
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

    # get_or_create only applies its defaults when it creates. Activating separately is
    # what makes running this after a reverse leave a portal with a working preview,
    # rather than with a gif profile switched off and an mp4 one that never runs
    EncodeProfile.objects.filter(name=PREVIEW_NAME, extension="mp4").update(active=True)

    # stop producing new gifs without touching the ones already produced. Nothing deletes
    # encodings by profile.active, so deactivating is safe for existing media
    EncodeProfile.objects.filter(name=PREVIEW_NAME, extension="gif").update(active=False)


def restore_gif_preview_profile(apps, schema_editor):
    """Hand the preview role back to the gif profile.

    The mp4 profile is deactivated rather than deleted: by the time this runs it may own
    encodings, and deleting it would cascade to them and to the files on disk.
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
