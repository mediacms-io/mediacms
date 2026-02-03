from django.apps import AppConfig


class UsersConfig(AppConfig):
    name = "users"

    def ready(self):
        import users.models  # noqa: F401 - Import to register signal handlers
