from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("files", "0014_alter_subtitle_options_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="media",
            name="external_hls_url",
            field=models.URLField(blank=True, help_text="External HLS master playlist URL", max_length=1000),
        ),
    ]
