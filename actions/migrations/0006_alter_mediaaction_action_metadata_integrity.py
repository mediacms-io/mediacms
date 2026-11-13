# Generated manually for metadata_refresh / integrity_warning audit actions

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("actions", "0005_mediaaction_action_date_index"),
    ]

    operations = [
        migrations.AlterField(
            model_name="mediaaction",
            name="action",
            field=models.CharField(
                choices=[
                    ("like", "Like"),
                    ("dislike", "Dislike"),
                    ("watch", "Watch"),
                    ("report", "Report"),
                    ("rate", "Rate"),
                    ("report_cleared", "Report cleared"),
                    ("report_confirmed", "Report confirmed"),
                    ("media_reviewed", "Media reviewed"),
                    ("media_unreviewed", "Media unreviewed"),
                    ("original_deleted", "Original deleted"),
                    ("metadata_refresh", "Metadata refreshed"),
                    ("integrity_warning", "Integrity warning"),
                ],
                default="watch",
                max_length=20,
            ),
        ),
    ]
