from django.apps import AppConfig


class SecurityConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "security"
    def ready(self):
        # Import signal handlers
        try:
            import security.signals  # noqa: F401
        except Exception:
            pass
