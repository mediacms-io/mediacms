from django.test import TestCase


class TestImports(TestCase):
    """Test that all models and views can be imported correctly"""

    def test_model_imports(self):
        """Test that all models can be imported"""
        # Import all models
        from files.models import Category  # noqa: F401
        from files.models import Comment  # noqa: F401
        from files.models import EncodeProfile  # noqa: F401
        from files.models import Encoding  # noqa: F401
        from files.models import Language  # noqa: F401
        from files.models import License  # noqa: F401
        from files.models import Media  # noqa: F401
        from files.models import MediaPermission  # noqa: F401
        from files.models import Playlist  # noqa: F401
        from files.models import PlaylistMedia  # noqa: F401
        from files.models import Rating  # noqa: F401
        from files.models import RatingCategory  # noqa: F401
        from files.models import Subtitle  # noqa: F401
        from files.models import Tag  # noqa: F401
        from files.models import VideoChapterData  # noqa: F401
        from files.models import VideoTrimRequest  # noqa: F401

        # Simple assertion to verify imports worked
        self.assertTrue(True, "All model imports succeeded")

    def test_view_imports(self):
        """Test that all views can be imported"""
        # Import all views
        from files.views import CategoryList  # noqa: F401
        from files.views import CommentDetail  # noqa: F401
        from files.views import CommentList  # noqa: F401
        from files.views import EncodeProfileList  # noqa: F401
        from files.views import EncodingDetail  # noqa: F401
        from files.views import MediaActions  # noqa: F401
        from files.views import MediaBulkUserActions  # noqa: F401
        from files.views import MediaDetail  # noqa: F401
        from files.views import MediaList  # noqa: F401
        from files.views import MediaSearch  # noqa: F401
        from files.views import PlaylistDetail  # noqa: F401
        from files.views import PlaylistList  # noqa: F401
        from files.views import TagList  # noqa: F401
        from files.views import TaskDetail  # noqa: F401
        from files.views import TasksList  # noqa: F401
        from files.views import UserActions  # noqa: F401

        # Simple assertion to verify imports worked
        self.assertTrue(True, "All view imports succeeded")
