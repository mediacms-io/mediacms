from unittest import mock

from django.core.files import File
from django.test import Client, TestCase

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


class TestFinishedEncodingUsesTheStoredState(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.user = create_account(password='this_is_a_fake_password')
        with open('fixtures/test_image2.jpg', "rb") as f:
            self.media = Media.objects.create(title="Encoded", user=self.user, state="public", encoding_status="success", is_reviewed=True, media_file=File(f))
        Media.objects.filter(pk=self.media.pk).update(state="public", encoding_status="success", is_reviewed=True, listable=True)

    def finish_encoding(self, media):
        with mock.patch.object(Media, "set_encoding_status"):
            media.post_encode_actions()

    def test_an_encode_finishing_on_an_old_copy_does_not_relist_a_media_made_private(self):
        encoding_task_copy = Media.objects.get(pk=self.media.pk)
        Media.objects.filter(pk=self.media.pk).update(state="private", listable=False)

        self.finish_encoding(encoding_task_copy)

        self.media.refresh_from_db()
        self.assertEqual((self.media.state, self.media.listable), ("private", False))
        self.assertNotIn("Encoded", [item['title'] for item in Client().get('/api/v1/media').data['results']])

    def test_an_encode_finishing_on_an_old_copy_lists_a_media_made_public(self):
        Media.objects.filter(pk=self.media.pk).update(state="private", listable=False)
        encoding_task_copy = Media.objects.get(pk=self.media.pk)
        Media.objects.filter(pk=self.media.pk).update(state="public")

        self.finish_encoding(encoding_task_copy)

        self.media.refresh_from_db()
        self.assertEqual((self.media.state, self.media.listable), ("public", True))

    def test_the_stored_state_is_read_without_building_a_media(self):
        encoding_task_copy = Media.objects.get(pk=self.media.pk)
        with mock.patch.object(Media, "from_db", wraps=Media.from_db) as built:
            encoding_task_copy.load_stored_listing_fields()
        built.assert_not_called()
