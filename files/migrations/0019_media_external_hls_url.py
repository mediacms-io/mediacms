from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("files", "0018_embedmediacourse"),
    ]

    operations = [
        migrations.AddField(
            model_name="media",
            name="external_hls_url",
            field=models.URLField(blank=True, help_text="External HLS master playlist URL", max_length=1000),
        ),
    ]
