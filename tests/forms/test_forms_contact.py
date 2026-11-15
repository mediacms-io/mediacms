from django.contrib.auth.models import AnonymousUser
from django.core import mail
from django.test import TestCase, override_settings

from files.forms import ContactForm
from files.tests import create_account


class ContactFormFieldsTest(TestCase):
    def test_anonymous_visitor_must_give_an_email_and_a_message(self):
        form = ContactForm(AnonymousUser(), {"name": "Visitor"})
        self.assertEqual(list(form.fields), ["from_email", "name", "message"])
        self.assertFalse(form.is_valid())
        self.assertEqual(set(form.errors), {"from_email", "message"})

    def test_anonymous_visitor_email_must_be_valid(self):
        form = ContactForm(AnonymousUser(), {"from_email": "not-an-email", "message": "hi"})
        self.assertFalse(form.is_valid())
        self.assertIn("from_email", form.errors)

    def test_name_is_optional(self):
        self.assertTrue(ContactForm(AnonymousUser(), {"from_email": "visitor@example.com", "message": "hi"}).is_valid())

    def test_logged_in_user_only_writes_the_message(self):
        user = create_account()
        form = ContactForm(user, {"message": "hello"})
        self.assertEqual(list(form.fields), ["message"])
        self.assertTrue(form.is_valid())


@override_settings(ADMIN_EMAIL_LIST=["admins@example.com"], DEFAULT_FROM_EMAIL="portal@example.com", PORTAL_NAME="Contact Portal")
class ContactPageTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def test_get_shows_an_empty_form(self):
        response = self.client.get("/contact")
        self.assertTemplateUsed(response, "cms/contact.html")
        self.assertIsInstance(response.context["form"], ContactForm)
        self.assertNotIn("success_msg", response.context)

    def test_anonymous_message_reaches_the_admins_with_reply_to_the_sender(self):
        response = self.client.post("/contact", {"from_email": "visitor@example.com", "name": "Vera Visitor", "message": "Is there a mobile app?"})
        self.assertEqual(response.context["success_msg"], "Message was sent! Thanks for contacting")
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.subject, "[Contact Portal] - Contact form message received")
        self.assertEqual(message.to, ["admins@example.com"])
        self.assertEqual(message.from_email, "portal@example.com")
        self.assertEqual(message.reply_to, ["visitor@example.com"])
        self.assertIn("Sender name: Vera Visitor", message.body)
        self.assertIn("Sender email: visitor@example.com", message.body)
        self.assertIn("Is there a mobile app?", message.body)

    def test_logged_in_user_is_identified_from_the_account_not_the_post(self):
        user = create_account(name="Lou Logged")
        mail.outbox.clear()
        self.client.force_login(user)
        self.client.post("/contact", {"from_email": "spoofed@example.com", "name": "Spoofed", "message": "account question"})
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.reply_to, [user.email])
        self.assertIn("Sender name: Lou Logged", message.body)
        self.assertNotIn("spoofed@example.com", message.body)

    def test_invalid_submission_sends_nothing(self):
        response = self.client.post("/contact", {"from_email": "visitor@example.com", "message": ""})
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("success_msg", response.context)
        self.assertEqual(mail.outbox, [])
