# Generated manually — renames `related_name='saml_logs'` to `idp_logs`
# on both FK fields of IdentityProviderUserLog.
#
# This is a state-only migration: related_name is a Python-level accessor and
# has no representation in the database schema.  No SQL is executed.

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('identity_providers', '0004_alter_identityprovidercategorymapping_map_to'),
        ('socialaccount', '0006_alter_socialaccount_extra_data'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='identityprovideruserlog',
            name='identity_provider',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='idp_logs',
                to='socialaccount.socialapp',
            ),
        ),
        migrations.AlterField(
            model_name='identityprovideruserlog',
            name='user',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='idp_logs',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
