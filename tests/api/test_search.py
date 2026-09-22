from django.core.files import File
from django.test import Client, TestCase

from files.models import Category, Media, Tag
from files.tests import create_account


class TestSearch(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.client = Client()
        self.password = 'this_is_a_fake_password'
        self.user = create_account(password=self.password)

        # Create test media items with different attributes for search testing
        with open('fixtures/test_image2.jpg', "rb") as f:
            myfile = File(f)
            self.media1 = Media.objects.create(title="Python Tutorial", description="Learn Python programming", user=self.user, media_file=myfile)

        with open('fixtures/test_image2.jpg', "rb") as f:
            myfile = File(f)
            self.media2 = Media.objects.create(
                title="Django Framework",
                description="Web development with Django",
                user=self.user,
                media_file=myfile,
            )

        with open('fixtures/test_image2.jpg', "rb") as f:
            myfile = File(f)
            self.media3 = Media.objects.create(
                title="JavaScript Basics",
                description="Introduction to JavaScript",
                user=self.user,
                media_file=myfile,
            )
        # Add categories and tags
        self.category = Category.objects.first()
        self.tag = Tag.objects.create(title="programming", user=self.user)

        self.media1.category.add(self.category)
        self.media2.category.add(self.category)
        self.media1.tags.add(self.tag)
        self.media2.tags.add(self.tag)

        # Update search vectors
        self.media1.update_search_vector()
        self.media2.update_search_vector()
        self.media3.update_search_vector()

    def test_search_by_title(self):
        """Test searching media by title"""
        url = '/api/v1/search?q=python'
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200, "Search endpoint should return 200")

        # Check if our media with "Python" in the title is in the results

        media_titles = [item['title'] for item in response.data['results']]
        self.assertIn(self.media1.title, media_titles, "Media with 'Python' in title should be in results")
        self.assertNotIn(self.media3.title, media_titles, "Media without 'Python' should not be in results")

    def test_search_by_category(self):
        """Test searching media by category uid"""
        url = f'/api/v1/search?c={self.category.uid}'
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200, "Category search endpoint should return 200")

        # Check if media in the category are in the results
        media_titles = [item['title'] for item in response.data['results']]
        self.assertIn(self.media1.title, media_titles, "Media in category should be in results")
        self.assertIn(self.media2.title, media_titles, "Media in category should be in results")
        self.assertNotIn(self.media3.title, media_titles, "Media not in category should not be in results")

    def test_search_by_category_legacy_title_link(self):
        """Old ?c=<title> links keep working"""
        url = f'/api/v1/search?c={self.category.title}'
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200, "Legacy category search should return 200")

        media_titles = [item['title'] for item in response.data['results']]
        self.assertIn(self.media1.title, media_titles, "Media in category should be in results")
        self.assertNotIn(self.media3.title, media_titles, "Media not in category should not be in results")

    def test_search_by_category_uid_disambiguates_same_title(self):
        """Two categories with the same title are told apart by uid"""
        duplicate = Category.objects.create(title=self.category.title, user=self.user)
        self.media3.category.add(duplicate)

        response = self.client.get(f'/api/v1/search?c={duplicate.uid}')
        media_titles = [item['title'] for item in response.data['results']]

        self.assertIn(self.media3.title, media_titles, "Media of the requested category should be in results")
        self.assertNotIn(self.media1.title, media_titles, "Media of the same titled category should not leak in")

    def test_search_by_tag(self):
        """Test searching media by tag"""
        url = f'/api/v1/search?t={self.tag.title}'
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200, "Tag search endpoint should return 200")

        # Check if media with the tag are in the results
        media_titles = [item['title'] for item in response.data['results']]
        self.assertIn(self.media1.title, media_titles, "Media with tag should be in results")
        self.assertIn(self.media2.title, media_titles, "Media with tag should be in results")
        self.assertNotIn(self.media3.title, media_titles, "Media without tag should not be in results")

    def test_search_by_category_title(self):
        """A media is findable by the title of a category it belongs to"""
        url = f'/api/v1/search?q={self.category.title}'
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        media_titles = [item['title'] for item in response.data['results']]
        self.assertIn(self.media1.title, media_titles, "Media in the category should be in results")
        self.assertIn(self.media2.title, media_titles, "Media in the category should be in results")
        self.assertNotIn(self.media3.title, media_titles, "Media outside the category should not be in results")

    def test_search_by_category_description(self):
        """The category description is searchable too.

        The migration service writes the source tree path there, so this is how an
        imported media is found by where it sat in the source portal.
        """
        self.category.description = "Engineering 1st Term Electronics"
        self.category.save()
        self.media1.update_search_vector()

        response = self.client.get('/api/v1/search?q=electronics')

        self.assertEqual(response.status_code, 200)
        media_titles = [item['title'] for item in response.data['results']]
        self.assertIn(self.media1.title, media_titles)
        self.assertNotIn(self.media3.title, media_titles)

    def test_adding_a_category_refreshes_the_search_vector(self):
        """The vector is written on save, but m2m is written after it, so attaching a
        category has to refresh it or the category text is always a save behind.
        """
        category = Category.objects.create(title="Astrophysics", user=self.user)
        self.media3.category.add(category)

        response = self.client.get('/api/v1/search?q=astrophysics')

        self.assertEqual(response.status_code, 200)
        media_titles = [item['title'] for item in response.data['results']]
        self.assertIn(self.media3.title, media_titles, "the vector was not refreshed when the category was added")

    def test_removing_a_category_refreshes_the_search_vector(self):
        url = f'/api/v1/search?q={self.category.title}'
        before = [item['title'] for item in self.client.get(url).data['results']]
        self.assertIn(self.media1.title, before, "the category was not searchable to begin with")

        self.media1.category.remove(self.category)

        after = [item['title'] for item in self.client.get(url).data['results']]
        self.assertNotIn(self.media1.title, after, "the media still matches a category it left")

    def test_search_with_media_type_filter(self):
        """Test searching with media type filter"""
        url = '/api/v1/search?q=tutorial&media_type=video'
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200, "Media type filtered search should return 200")

        # Create an image media with the same search term
        with open('fixtures/test_image2.jpg', "rb") as f:
            myfile = File(f)
            image_media = Media.objects.create(
                title="Tutorial Image",
                description="Tutorial image description",
                user=self.user,
                media_file=myfile,
            )
        image_media.update_search_vector()

        # Search with media_type=video
        url = '/api/v1/search?q=tutorial&media_type=video'
        response = self.client.get(url)

        media_titles = [item['title'] for item in response.data['results']]
        self.assertNotIn(image_media.title, media_titles, "Image media should not be in results")
