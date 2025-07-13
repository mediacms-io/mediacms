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
