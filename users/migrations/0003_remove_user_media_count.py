from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0002_user_is_approved"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="user",
            name="media_count",
        ),
    ]
