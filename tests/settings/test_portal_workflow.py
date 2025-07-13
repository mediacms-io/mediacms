from django.conf import settings
from django.core.files import File
from django.test import TestCase, override_settings

from files.helpers import get_default_state, get_portal_workflow
from files.models import Media
from files.tests import create_account


class TestPortalWorkflow(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        self.user = create_account()
        self.advanced_user = create_account(username="advanced_user")
        self.advanced_user.advancedUser = True
        self.advanced_user.save()

    def test_default_portal_workflow(self):
        """Test the default portal workflow setting"""
        workflow = get_portal_workflow()
        self.assertEqual(workflow, settings.PORTAL_WORKFLOW, "get_portal_workflow should return the PORTAL_WORKFLOW setting")

    @override_settings(PORTAL_WORKFLOW='public')
    def test_public_workflow(self):
        """Test the public workflow setting"""
        # Check that get_portal_workflow returns the correct value
        self.assertEqual(get_portal_workflow(), 'public', "get_portal_workflow should return 'public'")

        # Check that get_default_state returns the correct value
        self.assertEqual(get_default_state(), 'public', "get_default_state should return 'public'")

        # Check that a new media gets the correct state
        # Mock the media_file requirement by patching the save method
        with open('fixtures/test_image2.jpg', "rb") as f:
            myfile = File(f)
            media = Media.objects.create(title="Test Media", description="Test Description", user=self.user, media_file=myfile)
        self.assertEqual(media.state, 'public', "Media state should be 'public' in public workflow")

    @override_settings(PORTAL_WORKFLOW='unlisted')
    def test_unlisted_workflow(self):
        """Test the unlisted workflow setting"""
        # Check that get_portal_workflow returns the correct value
        self.assertEqual(get_portal_workflow(), 'unlisted', "get_portal_workflow should return 'unlisted'")

        # Check that get_default_state returns the correct value
        self.assertEqual(get_default_state(), 'unlisted', "get_default_state should return 'unlisted'")

        # Check that a new media gets the correct state
        # Mock the media_file requirement by patching the save method
        with open('fixtures/test_image2.jpg', "rb") as f:
            myfile = File(f)
            media = Media.objects.create(title="Test Media", description="Test Description", user=self.user, media_file=myfile)
        self.assertEqual(media.state, 'unlisted', "Media state should be 'unlisted' in unlisted workflow")

    @override_settings(PORTAL_WORKFLOW='private')
    def test_private_workflow(self):
        """Test the private workflow setting"""
        # Check that get_portal_workflow returns the correct value
        self.assertEqual(get_portal_workflow(), 'private', "get_portal_workflow should return 'private'")

        # Check that get_default_state returns the correct value
        self.assertEqual(get_default_state(), 'private', "get_default_state should return 'private'")

        # Check that a new media gets the correct state
        # Mock the media_file requirement by patching the save method
        with open('fixtures/test_image2.jpg', "rb") as f:
            myfile = File(f)
            media = Media.objects.create(title="Test Media", description="Test Description", user=self.user, media_file=myfile)
        self.assertEqual(media.state, 'private', "Media state should be 'private' in private workflow")

    @override_settings(PORTAL_WORKFLOW='private_verified')
    def test_private_verified_workflow(self):
        """Test the private_verified workflow setting"""
        # Check that get_portal_workflow returns the correct value
        self.assertEqual(get_portal_workflow(), 'private_verified', "get_portal_workflow should return 'private_verified'")

        # Check that get_default_state returns the correct value for regular user
        self.assertEqual(get_default_state(user=self.user), 'private', "get_default_state should return 'private' for regular user")

        # Check that get_default_state returns the correct value for advanced user
        self.advanced_user.advancedUser = True
        self.advanced_user.save()
        self.assertEqual(get_default_state(user=self.advanced_user), 'unlisted', "get_default_state should return 'unlisted' for advanced user")

        # Check that a new media gets the correct state for regular user
        # Mock the media_file requirement by patching the save method
        with open('fixtures/test_image2.jpg', "rb") as f:
            myfile = File(f)
            media = Media.objects.create(title="Test Media", description="Test Description", user=self.user, media_file=myfile)
        self.assertEqual(media.state, 'private', "Media state should be 'private' for regular user in private_verified workflow")

        # Check that a new media gets the correct state for advanced user
        with open('fixtures/test_image2.jpg', "rb") as f:
            myfile = File(f)
            media = Media.objects.create(title="Advanced Test Media", description="Test Description", user=self.advanced_user, media_file=myfile)
        self.assertEqual(media.state, 'unlisted', "Media state should be 'unlisted' for advanced user in private_verified workflow")
