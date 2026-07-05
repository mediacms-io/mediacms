from django.db import models


class Integration(models.Model):
    """A configurable third-party service integration.

    An admin adds one row per external service they want MediaCMS to use
    (TwelveLabs for now, more can be added to ``Service`` later). The row holds
    the credentials and options for that service. The rest of MediaCMS reads an
    enabled row defensively, so with no enabled Integration the platform behaves
    exactly as before.
    """

    class Service(models.TextChoices):
        TWELVELABS = 'twelvelabs', 'TwelveLabs'

    service = models.CharField(
        max_length=50,
        choices=Service.choices,
        unique=True,
        help_text='Third-party service this integration configures (one row per service)',
    )
    enabled = models.BooleanField(
        default=False,
        help_text='Whether MediaCMS should use this integration',
    )
    model_name = models.CharField(
        max_length=100,
        blank=True,
        help_text='Optional model the service should use (e.g. a TwelveLabs Pegasus model)',
    )
    api_key = models.CharField(
        max_length=512,
        blank=True,
        help_text='API key / token for the service. Stored on the server; keep admin access restricted.',
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text='Additional service-specific options as a JSON object',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Integration'
        verbose_name_plural = 'Integrations'

    def __str__(self):
        state = 'enabled' if self.enabled else 'disabled'
        return f'{self.get_service_display()} ({state})'

    @classmethod
    def get_active(cls, service):
        """Return the first enabled Integration for ``service``, or ``None``.

        Callers use this to decide, defensively, whether an integration is set
        up before importing any service-specific (SDK-backed) code.
        """
        return cls.objects.filter(service=service, enabled=True).first()
