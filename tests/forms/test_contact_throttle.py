from django.conf import settings
from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings

from files.tests import create_account

LOCMEM_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "contact-throttle-tests"}}


@override_settings(CACHES=LOCMEM_CACHE, CONTACT_FORM_RATE="2/hour", CONTACT_FORM_GLOBAL_RATE="100/hour")
class TestContactFormThrottle(TestCase):
    """The anonymous contact form cannot be used to send unlimited mail"""

    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        cache.clear()

    def post(self, address="198.51.100.7"):
        data = {"from_email": "sender@example.org", "name": "Sender", "message": "Hello"}
        return self.client.post("/contact", data, REMOTE_ADDR=address)

    def test_limit_per_client(self):
        responses = [self.post() for _ in range(3)]
        self.assertEqual([r.status_code for r in responses[:2]], [200, 200])
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(responses[2].status_code, 429)
        self.assertNotContains(responses[2], "Message was sent", status_code=429)

    def test_other_client_is_not_limited(self):
        for _ in range(3):
            self.post()
        self.assertEqual(self.post(address="198.51.100.8").status_code, 200)
        self.assertEqual(len(mail.outbox), 3)

    @override_settings(CONTACT_FORM_RATE="100/hour", CONTACT_FORM_GLOBAL_RATE="2/hour")
    def test_global_limit(self):
        responses = [self.post(address=f"198.51.100.{i}") for i in range(1, 4)]
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(responses[2].status_code, 429)


@override_settings(CACHES=LOCMEM_CACHE)
class TestContactUserThrottle(TestCase):
    """The user contact endpoint is rate limited per sender"""

    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        cache.clear()
        self.recipient = create_account()
        self.recipient.allow_contact = True
        self.recipient.save()
        self.sender = create_account()
        self.client.force_login(self.sender)
        # account creation can notify the administrators by mail
        mail.outbox = []

    def test_limit_per_sender(self):
        rest_framework = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": {"contact_user": "2/hour"}}
        url = f"/api/v1/users/{self.recipient.username}/contact"
        with override_settings(REST_FRAMEWORK=rest_framework):
            responses = [self.client.post(url, {"body": "Hello"}, content_type="application/json") for _ in range(3)]
        self.assertEqual([r.status_code for r in responses], [204, 204, 429])
        self.assertEqual(len(mail.outbox), 2)
