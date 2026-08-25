from django.apps import AppConfig


class MigrationServiceConfig(AppConfig):
    default_auto_field = "django.db.models.AutoField"
    name = "migrationservice"
    verbose_name = "Migration Service"
