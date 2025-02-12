from django.conf import settings

from .frontend_translations import get_translation, get_translation_strings
from .methods import is_mediacms_editor, is_mediacms_manager


def stuff(request):
    """Pass settings to the frontend"""
    ret = {}
    ret["FRONTEND_HOST"] = request.build_absolute_uri('/').rstrip('/')
    ret["DEFAULT_THEME"] = settings.DEFAULT_THEME
    ret["PORTAL_NAME"] = settings.PORTAL_NAME
    ret["PORTAL_DESCRIPTION"] = settings.PORTAL_DESCRIPTION
    ret["LOAD_FROM_CDN"] = settings.LOAD_FROM_CDN
    ret["CAN_LOGIN"] = settings.LOGIN_ALLOWED
    ret["CAN_REGISTER"] = settings.REGISTER_ALLOWED
    ret["CAN_UPLOAD_MEDIA"] = settings.UPLOAD_MEDIA_ALLOWED
    ret["TIMESTAMP_IN_TIMEBAR"] = settings.TIMESTAMP_IN_TIMEBAR
    ret["CAN_MENTION_IN_COMMENTS"] = settings.ALLOW_MENTION_IN_COMMENTS
    ret["CAN_LIKE_MEDIA"] = settings.CAN_LIKE_MEDIA
    ret["CAN_DISLIKE_MEDIA"] = settings.CAN_DISLIKE_MEDIA
    ret["CAN_REPORT_MEDIA"] = settings.CAN_REPORT_MEDIA
    ret["CAN_SHARE_MEDIA"] = settings.CAN_SHARE_MEDIA
    ret["UPLOAD_MAX_SIZE"] = settings.UPLOAD_MAX_SIZE
    ret["UPLOAD_MAX_FILES_NUMBER"] = settings.UPLOAD_MAX_FILES_NUMBER
    ret["PRE_UPLOAD_MEDIA_MESSAGE"] = settings.PRE_UPLOAD_MEDIA_MESSAGE
    ret["POST_UPLOAD_AUTHOR_MESSAGE_UNLISTED_NO_COMMENTARY"] = settings.POST_UPLOAD_AUTHOR_MESSAGE_UNLISTED_NO_COMMENTARY
    ret["IS_MEDIACMS_ADMIN"] = request.user.is_superuser
    ret["IS_MEDIACMS_EDITOR"] = is_mediacms_editor(request.user)
    ret["IS_MEDIACMS_MANAGER"] = is_mediacms_manager(request.user)
    ret["ALLOW_RATINGS"] = settings.ALLOW_RATINGS
    ret["ALLOW_RATINGS_CONFIRMED_EMAIL_ONLY"] = settings.ALLOW_RATINGS_CONFIRMED_EMAIL_ONLY
    ret["VIDEO_PLAYER_FEATURED_VIDEO_ON_INDEX_PAGE"] = settings.VIDEO_PLAYER_FEATURED_VIDEO_ON_INDEX_PAGE
    ret["RSS_URL"] = "/rss"
    ret["TRANSLATION"] = get_translation(request.LANGUAGE_CODE)
    ret["REPLACEMENTS"] = get_translation_strings(request.LANGUAGE_CODE)
    if request.user.is_superuser:
        ret["DJANGO_ADMIN_URL"] = settings.DJANGO_ADMIN_URL

    return ret
