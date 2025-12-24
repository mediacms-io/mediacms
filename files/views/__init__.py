# Import all views for backward compatibility

from .auth import custom_login_view, saml_metadata  # noqa: F401
from .categories import CategoryList, TagList  # noqa: F401
from .comments import CommentDetail, CommentList  # noqa: F401
from .encoding import EncodeProfileList, EncodingDetail  # noqa: F401
from .media import MediaActions  # noqa: F401
from .media import MediaBulkUserActions  # noqa: F401
from .media import MediaDetail  # noqa: F401
from .media import MediaList  # noqa: F401
from .media import MediaSearch  # noqa: F401
from .pages import about  # noqa: F401
from .pages import add_subtitle  # noqa: F401
from .pages import approval_required  # noqa: F401
from .pages import categories  # noqa: F401
from .pages import contact  # noqa: F401
from .pages import edit_chapters  # noqa: F401
from .pages import edit_media  # noqa: F401
from .pages import edit_subtitle  # noqa: F401
from .pages import edit_video  # noqa: F401
from .pages import embed_media  # noqa: F401
from .pages import featured_media  # noqa: F401
from .pages import get_page  # noqa: F401
from .pages import history  # noqa: F401
from .pages import index  # noqa: F401
from .pages import latest_media  # noqa: F401
from .pages import liked_media  # noqa: F401
from .pages import manage_comments  # noqa: F401
from .pages import manage_media  # noqa: F401
from .pages import manage_users  # noqa: F401
from .pages import members  # noqa: F401
from .pages import publish_media  # noqa: F401
from .pages import recommended_media  # noqa: F401
from .pages import record_screen  # noqa: F401
from .pages import replace_media  # noqa: F401
from .pages import search  # noqa: F401
from .pages import setlanguage  # noqa: F401
from .pages import sitemap  # noqa: F401
from .pages import tags  # noqa: F401
from .pages import tos  # noqa: F401
from .pages import trim_video  # noqa: F401
from .pages import upload_media  # noqa: F401
from .pages import video_chapters  # noqa: F401
from .pages import view_media  # noqa: F401
from .pages import view_playlist  # noqa: F401
from .playlists import PlaylistDetail, PlaylistList  # noqa: F401
from .tasks import TaskDetail, TasksList  # noqa: F401
from .user import UserActions  # noqa: F401
