# Generated by Django 5.1.6 on 2025-03-08 18:04

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('saml_auth', '0006_alter_samlconfigurationglobalrole_map_to'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='samlconfiguration',
            name='create_groups',
        ),
    ]
