from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings


class PopulateFakeMediaGuardTest(SimpleTestCase):
    @override_settings(ALLOW_POPULATE_FAKE_MEDIA=False)
    def test_handle_refuses_when_disabled(self):
        with self.assertRaisesMessage(CommandError, 'ALLOW_POPULATE_FAKE_MEDIA is disabled'):
            call_command('populate_fake_media', verbosity=0)
