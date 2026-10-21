from unittest import mock

from django.core.files import File
from django.db import connection
from django.test import Client, TestCase
from django.test.utils import CaptureQueriesContext

from files.models import Media
from files.tests import create_account


class TestMediaListings(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.client = Client()
        self.password = 'this_is_a_fake_password'
        self.user = create_account(password=self.password)

        # Create a test media item
        with open('fixtures/test_image2.jpg', "rb") as f:
            myfile = File(f)
            self.media = Media.objects.create(
                title="Test Media", description="Test Description", user=self.user, state="public", encoding_status="success", is_reviewed=True, listable=True, media_file=myfile
            )

    def test_media_list_endpoint(self):
        """Test the media list API endpoint"""
        url = '/api/v1/media'
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200, "Media list endpoint should return 200")
        self.assertIn('results', response.data, "Response should contain results")
        self.assertIn('count', response.data, "Response should contain count")

        # Check if our test media is in the results
        media_titles = [item['title'] for item in response.data['results']]
        self.assertIn(self.media.title, media_titles, "Test media should be in the results")

    def test_featured_media_listing(self):
        """Test the featured media listing"""
        # Mark our test media as featured
        self.media.featured = True
        self.media.save()

        url = '/api/v1/media?show=featured'
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200, "Featured media endpoint should return 200")

        # Check if our featured media is in the results
        media_titles = [item['title'] for item in response.data['results']]
        self.assertIn(self.media.title, media_titles, "Featured media should be in the results")

    def test_user_media_listing(self):
        """Test listing media for a specific user"""
        url = f'/api/v1/media?author={self.user.username}'
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200, "User media endpoint should return 200")

        # Check if our user's media is in the results
        media_titles = [item['title'] for item in response.data['results']]
        self.assertIn(self.media.title, media_titles, "User's media should be in the results")

    def test_recommended_media_listing(self):
        """Test the recommended media listing"""
        url = '/api/v1/media?show=recommended'
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200, "Recommended media endpoint should return 200")


class TestListableFollowsTheStoredState(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.user = create_account(password='this_is_a_fake_password')
        with open('fixtures/test_image2.jpg', "rb") as f:
            self.media = Media.objects.create(title="Racing", user=self.user, state="public", encoding_status="success", is_reviewed=True, media_file=File(f))
        self.media.refresh_from_db()

    def test_a_stale_copy_saving_listable_does_not_relist_a_media_made_private(self):
        stale = Media.objects.get(pk=self.media.pk)
        self.media.state = "private"
        self.media.save(update_fields=["state", "listable"])

        stale.encoding_status = "success"
        stale.save(update_fields=["encoding_status", "listable"])

        self.media.refresh_from_db()
        self.assertEqual((self.media.state, self.media.listable), ("private", False))
        self.assertNotIn("Racing", [item['title'] for item in Client().get('/api/v1/media').data['results']])

    def test_a_stale_copy_saving_listable_lists_a_media_made_public(self):
        Media.objects.filter(pk=self.media.pk).update(state="private", listable=False)
        stale = Media.objects.get(pk=self.media.pk)
        Media.objects.filter(pk=self.media.pk).update(state="public")

        stale.save(update_fields=["encoding_status", "listable"])

        self.media.refresh_from_db()
        self.assertTrue(self.media.listable)

    def test_a_field_being_written_is_not_replaced_by_the_stored_one(self):
        self.media.encoding_status = "fail"
        self.media.save(update_fields=["encoding_status", "listable"])
        self.media.refresh_from_db()
        self.assertEqual((self.media.encoding_status, self.media.listable), ("fail", False))

    def test_finishing_an_encode_does_not_relist_a_media_made_private(self):
        encoding_task_copy = Media.objects.get(pk=self.media.pk)
        Media.objects.filter(pk=self.media.pk).update(state="private")

        with mock.patch.object(Media, "set_encoding_status"):
            encoding_task_copy.post_encode_actions()

        self.media.refresh_from_db()
        self.assertEqual((self.media.state, self.media.listable), ("private", False))

    def test_a_listable_only_save_decides_from_the_stored_fields(self):
        stale = Media.objects.get(pk=self.media.pk)
        stale.state, stale.encoding_status, stale.is_reviewed = "private", "fail", False

        stale.save(update_fields=["listable"])

        self.media.refresh_from_db()
        self.assertTrue(self.media.listable)

    def test_a_partial_save_decides_listable_in_its_update_without_reading_the_media(self):
        stale = Media.objects.get(pk=self.media.pk)
        with mock.patch.object(Media, "from_db", wraps=Media.from_db) as built, CaptureQueriesContext(connection) as queries:
            stale.save(update_fields=["encoding_status", "listable"])

        built.assert_not_called()
        self.assertEqual(media_row_reads(queries), [])
        self.assertIn('"files_media"."state"', media_update(queries))
        self.assertTrue(stale.listable is True)

    def test_a_full_save_writes_listable_from_the_object(self):
        self.media.state = "private"
        with CaptureQueriesContext(connection) as queries:
            self.media.save()

        self.assertEqual(media_row_reads(queries), [])
        self.assertNotIn('"files_media"."state" =', media_update(queries).split(" WHERE ")[0])
        self.media.refresh_from_db()
        self.assertEqual((self.media.state, self.media.listable), ("private", False))


def media_row_reads(queries):
    return [query["sql"] for query in queries.captured_queries if query["sql"].startswith('SELECT "files_media".')]


def media_update(queries):
    return next(query["sql"] for query in queries.captured_queries if query["sql"].startswith('UPDATE "files_media" SET'))
