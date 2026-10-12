# Upgrade checklist for a Docker migration

When moving an existing MediaCMS installation to Docker, treat the database
and uploaded media as separate data sets. The default Docker layout stores the
PostgreSQL data in `../postgres_data/` and uploaded files in `media_files/`.

Before changing the application image:

1. Stop the old services and make a restorable PostgreSQL backup. Keep the
   original database version available until the backup has been tested.
2. Back up the complete `media_files/` directory, including encoded files,
   thumbnails, subtitles, and HLS output.
3. Preserve the old `deploy/docker/local_settings.py`, domain settings, and
   any reverse-proxy configuration.
4. Test the upgrade on copies of the database and media directory first.

After restoring the copies into the Docker layout, start the database and
Redis, run the migrations service, and only then start the web and Celery
services. Verify existing users, media entries, permissions, thumbnails,
subtitles, and the encoding queue before switching production traffic.

Do not run fixture loading against an existing database, and do not delete the
old PostgreSQL data or media backup until the upgraded instance has been
verified. A PostgreSQL major-version change may require a separate database
migration rather than simply changing the image tag.
