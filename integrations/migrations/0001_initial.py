from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Integration',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('service', models.CharField(choices=[('twelvelabs', 'TwelveLabs')], help_text='Third-party service this integration configures (one row per service)', max_length=50, unique=True)),
                ('enabled', models.BooleanField(default=False, help_text='Whether MediaCMS should use this integration')),
                ('model_name', models.CharField(blank=True, help_text='Optional model the service should use (e.g. a TwelveLabs Pegasus model)', max_length=100)),
                ('api_key', models.CharField(blank=True, help_text='API key / token for the service. Stored on the server; keep admin access restricted.', max_length=512)),
                ('config', models.JSONField(blank=True, default=dict, help_text='Additional service-specific options as a JSON object')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Integration',
                'verbose_name_plural': 'Integrations',
            },
        ),
    ]
