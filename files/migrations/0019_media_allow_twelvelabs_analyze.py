from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('files', '0018_embedmediacourse'),
    ]

    operations = [
        migrations.AddField(
            model_name='media',
            name='allow_twelvelabs_analyze',
            field=models.BooleanField(default=False, verbose_name='Analyze with TwelveLabs (transcript, description, tags)'),
        ),
    ]
