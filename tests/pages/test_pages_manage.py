import json

from django.test import TestCase

from files.models import Category
from files.tests import create_account

MANAGE_PAGES = {
    "/manage/media": "cms/manage_media.html",
    "/manage/users": "cms/manage_users.html",
    "/manage/comments": "cms/manage_comments.html",
}


class ManagePagesAccessTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        cls.editor = create_account(is_editor=True)
        cls.manager = create_account(is_manager=True)
        cls.admin = create_account(is_superuser=True)

    def test_anonymous_user_is_sent_to_login(self):
        for url in MANAGE_PAGES:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertRedirects(response, f"/accounts/login/?next={url}", fetch_redirect_response=False)

    def test_regular_user_is_redirected_home(self):
        self.client.force_login(self.user)
        for url in MANAGE_PAGES:
            with self.subTest(url=url):
                self.assertRedirects(self.client.get(url), "/", fetch_redirect_response=False)

    def test_editors_managers_and_admins_can_open_every_manage_page(self):
        for user in [self.editor, self.manager, self.admin]:
            self.client.force_login(user)
            for url, template in MANAGE_PAGES.items():
                with self.subTest(user=user.username, url=url):
                    response = self.client.get(url)
                    self.assertEqual(response.status_code, 200)
                    self.assertTemplateUsed(response, template)

    def test_manage_media_lists_categories_sorted_by_title_for_the_bulk_actions(self):
        Category.objects.create(title="Aardvarks")
        self.client.force_login(self.editor)
        categories = json.loads(self.client.get("/manage/media").context["categories"])
        titles = [category["title"] for category in categories]
        self.assertEqual(titles, sorted(Category.objects.values_list("title", flat=True)))
        self.assertEqual(titles[0], "Aardvarks")
        self.assertEqual(set(categories[0]), {"uid", "title"})

    def test_category_titles_cannot_break_out_of_the_categories_script_block(self):
        closing = Category.objects.create(title="</script x")
        injected = Category.objects.create(title="><img src=x onerror=document.title='XSS'//")
        self.assertEqual(closing.title, "</script x")
        self.client.force_login(self.manager)
        response = self.client.get("/manage/media")
        content = response.content.decode()

        script_line = next(line for line in content.splitlines() if "window.CATEGORIES" in line)
        payload = script_line.split("window.CATEGORIES = ", 1)[1]
        self.assertNotIn("<", payload)
        self.assertNotIn(">", payload)
        self.assertNotIn("</script x", content)
        self.assertNotIn("<img src=x onerror", content)

        titles = {category["title"] for category in json.loads(response.context["categories"])}
        self.assertTrue({closing.title, injected.title} <= titles)

    def test_manage_links_on_the_index_lead_to_pages_that_load(self):
        self.client.force_login(self.admin)
        content = self.client.get("/").content.decode()
        for url in MANAGE_PAGES:
            with self.subTest(url=url):
                self.assertIn(f'"{url}"', content)
                self.assertEqual(self.client.get(url).status_code, 200)

    def test_regular_user_index_has_no_manage_links(self):
        self.client.force_login(self.user)
        content = self.client.get("/").content.decode()
        for url in MANAGE_PAGES:
            self.assertNotIn(f'"{url}"', content)
