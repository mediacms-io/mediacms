from datetime import timedelta

from django.core.management import load_command_class
from django.test import TestCase
from django.utils import timezone

from files.management.commands.populate_fake_media import GENERATOR_PAGE_MARKER
from files.models import Page, TinyMCEMedia
from files.tests import create_account


class PopulateFakeMediaPagesTest(TestCase):
    def setUp(self):
        self.command = load_command_class("files", "populate_fake_media")
        self.command._now = timezone.now()
        self.command._horizon_start = self.command._now - timedelta(days=365)
        self.admin = create_account(username="page_admin", is_superuser=True)

    def test_demo_pages_warn_about_samples_and_embed_an_attachment(self):
        pages = self.command.create_pages()
        by_slug = {page.slug: page for page in pages}

        self.assertEqual(set(by_slug), {"about", "faq", "tos"})
        self.assertEqual(TinyMCEMedia.objects.count(), 3)

        about = by_slug["about"]
        self.assertIn(GENERATOR_PAGE_MARKER, about.description)
        self.assertIn("sample content", about.description)
        self.assertIn("populate_fake_media", about.description)
        self.assertIn("testpass123", about.description)
        self.assertIn("fixtures/", about.description)
        about_image = TinyMCEMedia.objects.get(original_filename="sample-portal-still.png")
        self.assertEqual((about_image.file_type, about_image.user), ("image", self.admin))
        self.assertIn(about_image.url, about.description)
        self.assertContains(self.client.get("/about"), "sample content")
        self.assertContains(self.client.get("/about"), about_image.url)

        faq = by_slug["faq"]
        self.assertIn("What does the generator create?", faq.description)
        self.assertIn("--clear", faq.description)
        self.assertIn("Who can view private media?", faq.description)
        faq_image = TinyMCEMedia.objects.get(original_filename="sample-portal-still.jpg")
        self.assertEqual(faq_image.file_type, "image")
        self.assertIn(faq_image.url, faq.description)
        self.assertContains(self.client.get("/faq"), "What does the generator create?")

        terms = by_slug["tos"]
        self.assertEqual(terms.title, "Terms")
        self.assertIn("not a legal agreement", terms.description)
        self.assertIn("testpass123", terms.description)
        document = TinyMCEMedia.objects.get(original_filename="sample-document.pdf")
        self.assertEqual(document.file_type, "media")
        self.assertIn(document.url, terms.description)
        response = self.client.get("/tos")
        self.assertTemplateUsed(response, "cms/page.html")
        self.assertContains(response, "not a legal agreement")
        self.assertContains(response, document.url)

    def test_a_second_run_refreshes_generated_pages_without_new_attachments(self):
        self.command.create_pages()
        Page.objects.filter(slug="about").update(description=f"<!-- {GENERATOR_PAGE_MARKER} -->\n<p>stale warning</p>")

        self.command.create_pages()

        about = Page.objects.get(slug="about")
        self.assertIn("sample content", about.description)
        self.assertNotIn("stale warning", about.description)
        self.assertEqual(TinyMCEMedia.objects.count(), 3)
        self.assertEqual(Page.objects.count(), 3)

    def test_an_older_generator_page_is_upgraded(self):
        Page.objects.create(
            slug="about",
            title="About",
            description=("<p>Welcome to this MediaCMS demo portal.</p>" "<p>This About page was created by the fake media generator for dashboard testing.</p>"),
        )

        self.command.create_pages()

        about = Page.objects.get(slug="about")
        self.assertIn(GENERATOR_PAGE_MARKER, about.description)
        self.assertIn("sample content", about.description)

    def test_a_customized_page_is_left_in_place(self):
        Page.objects.create(slug="about", title="Our library", description="<p>Hand-written about text</p>")

        pages = self.command.create_pages()

        about = Page.objects.get(slug="about")
        self.assertEqual(about.title, "Our library")
        self.assertEqual(about.description, "<p>Hand-written about text</p>")
        self.assertNotIn("sample-portal-still.png", [item.original_filename for item in TinyMCEMedia.objects.all()])
        self.assertEqual({page.slug for page in pages}, {"about", "faq", "tos"})
        self.assertEqual(TinyMCEMedia.objects.count(), 2)
