import json

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.mail import EmailMessage
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

from cms.permissions import user_allowed_to_upload
from cms.version import VERSION
from users.models import User

from .. import helpers
from ..forms import (
    ContactForm,
    EditSubtitleForm,
    MediaMetadataForm,
    MediaPublishForm,
    SubtitleForm,
)
from ..frontend_translations import translate_string
from ..helpers import get_alphanumeric_only
from ..methods import (
    create_video_trim_request,
    get_user_or_session,
    handle_video_chapters,
    is_mediacms_editor,
)
from ..models import Category, Media, Playlist, Subtitle, Tag, VideoTrimRequest
from ..tasks import save_user_action, video_trim_task


def about(request):
    """About view"""

    context = {"VERSION": VERSION}
    return render(request, "cms/about.html", context)


def setlanguage(request):
    """Set Language view"""

    context = {}
    return render(request, "cms/set_language.html", context)


@login_required
def add_subtitle(request):
    """Add subtitle view"""

    friendly_token = request.GET.get("m", "").strip()
    if not friendly_token:
        return HttpResponseRedirect("/")
    media = Media.objects.filter(friendly_token=friendly_token).first()
    if not media:
        return HttpResponseRedirect("/")

    if not (request.user == media.user or is_mediacms_editor(request.user)):
        return HttpResponseRedirect("/")

    if request.method == "POST":
        form = SubtitleForm(media, request.POST, request.FILES)
        if form.is_valid():
            subtitle = form.save()
            new_subtitle = Subtitle.objects.filter(id=subtitle.id).first()
            try:
                new_subtitle.convert_to_srt()
                messages.add_message(request, messages.INFO, "Subtitle was added!")
                return HttpResponseRedirect(subtitle.media.get_absolute_url())
            except:  # noqa: E722
                new_subtitle.delete()
                error_msg = "Invalid subtitle format. Use SubRip (.srt) or WebVTT (.vtt) files."
                form.add_error("subtitle_file", error_msg)

    else:
        form = SubtitleForm(media_item=media)
    subtitles = media.subtitles.all()
    context = {"media": media, "form": form, "subtitles": subtitles}
    return render(request, "cms/add_subtitle.html", context)


@login_required
def edit_subtitle(request):
    subtitle_id = request.GET.get("id", "").strip()
    action = request.GET.get("action", "").strip()
    if not subtitle_id:
        return HttpResponseRedirect("/")
    subtitle = Subtitle.objects.filter(id=subtitle_id).first()

    if not subtitle:
        return HttpResponseRedirect("/")

    if not (request.user == subtitle.user or is_mediacms_editor(request.user)):
        return HttpResponseRedirect("/")

    context = {"subtitle": subtitle, "action": action}

    if action == "download":
        response = HttpResponse(subtitle.subtitle_file.read(), content_type="text/vtt")
        filename = subtitle.subtitle_file.name.split("/")[-1]

        if not filename.endswith(".vtt"):
            filename = f"{filename}.vtt"

        response["Content-Disposition"] = f"attachment; filename={filename}"  # noqa

        return response

    if request.method == "GET":
        form = EditSubtitleForm(subtitle)
        context["form"] = form
    elif request.method == "POST":
        confirm = request.GET.get("confirm", "").strip()
        if confirm == "true":
            messages.add_message(request, messages.INFO, "Subtitle was deleted")
            redirect_url = subtitle.media.get_absolute_url()
            subtitle.delete()
            return HttpResponseRedirect(redirect_url)
        form = EditSubtitleForm(subtitle, request.POST)
        subtitle_text = form.data["subtitle"]
        with open(subtitle.subtitle_file.path, "w") as ff:
            ff.write(subtitle_text)

        messages.add_message(request, messages.INFO, "Subtitle was edited")
        return HttpResponseRedirect(subtitle.media.get_absolute_url())
    return render(request, "cms/edit_subtitle.html", context)


def categories(request):
    """List categories view"""

    context = {}
    return render(request, "cms/categories.html", context)


def contact(request):
    """Contact view"""

    context = {}
    if request.method == "GET":
        form = ContactForm(request.user)
        context["form"] = form

    else:
        form = ContactForm(request.user, request.POST)
        if form.is_valid():
            if request.user.is_authenticated:
                from_email = request.user.email
                name = request.user.name
            else:
                from_email = request.POST.get("from_email")
                name = request.POST.get("name")
            message = request.POST.get("message")

            title = f"[{settings.PORTAL_NAME}] - Contact form message received"

            msg = """
You have received a message through the contact form\n
Sender name: %s
Sender email: %s\n
\n %s
""" % (
                name,
                from_email,
                message,
            )
            email = EmailMessage(
                title,
                msg,
                settings.DEFAULT_FROM_EMAIL,
                settings.ADMIN_EMAIL_LIST,
                reply_to=[from_email],
            )
            email.send(fail_silently=True)
            success_msg = "Message was sent! Thanks for contacting"
            context["success_msg"] = success_msg

    return render(request, "cms/contact.html", context)


def history(request):
    """Show personal history view"""

    context = {}
    return render(request, "cms/history.html", context)


@csrf_exempt
@login_required
def video_chapters(request, friendly_token):
    # this is not ready...
    return False
    if not request.method == "POST":
        return HttpResponseRedirect("/")

    media = Media.objects.filter(friendly_token=friendly_token).first()

    if not media:
        return HttpResponseRedirect("/")

    if not (request.user == media.user or is_mediacms_editor(request.user)):
        return HttpResponseRedirect("/")

    try:
        data = json.loads(request.body)["chapters"]
        chapters = []
        for _, chapter_data in enumerate(data):
            start_time = chapter_data.get('start')
            title = chapter_data.get('title')
            if start_time and title:
                chapters.append(
                    {
                        'start': start_time,
                        'title': title,
                    }
                )
    except Exception as e:  # noqa
        return JsonResponse({'success': False, 'error': 'Request data must be a list of video chapters with start and title'}, status=400)

    ret = handle_video_chapters(media, chapters)

    return JsonResponse(ret, safe=False)


@login_required
def edit_media(request):
    """Edit a media view"""

    friendly_token = request.GET.get("m", "").strip()
    if not friendly_token:
        return HttpResponseRedirect("/")
    media = Media.objects.filter(friendly_token=friendly_token).first()

    if not media:
        return HttpResponseRedirect("/")

    if not (request.user.has_contributor_access_to_media(media) or is_mediacms_editor(request.user)):
        return HttpResponseRedirect("/")
    if request.method == "POST":
        form = MediaMetadataForm(request.user, request.POST, request.FILES, instance=media)
        if form.is_valid():
            media = form.save()
            for tag in media.tags.all():
                media.tags.remove(tag)
            if form.cleaned_data.get("new_tags"):
                for tag in form.cleaned_data.get("new_tags").split(","):
                    tag = get_alphanumeric_only(tag)
                    tag = tag[:99]
                    if tag:
                        try:
                            tag = Tag.objects.get(title=tag)
                        except Tag.DoesNotExist:
                            tag = Tag.objects.create(title=tag, user=request.user)
                        if tag not in media.tags.all():
                            media.tags.add(tag)
            messages.add_message(request, messages.INFO, translate_string(request.LANGUAGE_CODE, "Media was edited"))
            return HttpResponseRedirect(media.get_absolute_url())
    else:
        form = MediaMetadataForm(request.user, instance=media)
    return render(
        request,
        "cms/edit_media.html",
        {"form": form, "media_object": media, "add_subtitle_url": media.add_subtitle_url},
    )


@login_required
def publish_media(request):
    """Publish media"""

    friendly_token = request.GET.get("m", "").strip()
    if not friendly_token:
        return HttpResponseRedirect("/")
    media = Media.objects.filter(friendly_token=friendly_token).first()

    if not media:
        return HttpResponseRedirect("/")

    if not (request.user.has_contributor_access_to_media(media) or is_mediacms_editor(request.user)):
        return HttpResponseRedirect("/")

    if request.method == "POST":
        form = MediaPublishForm(request.user, request.POST, request.FILES, instance=media)
        if form.is_valid():
            media = form.save()
            messages.add_message(request, messages.INFO, translate_string(request.LANGUAGE_CODE, "Media was edited"))
            return HttpResponseRedirect(media.get_absolute_url())
    else:
        form = MediaPublishForm(request.user, instance=media)

    return render(
        request,
        "cms/publish_media.html",
        {"form": form, "media_object": media, "add_subtitle_url": media.add_subtitle_url},
    )


@login_required
def edit_chapters(request):
    """Edit chapters"""
    # not implemented yet
    return False
    friendly_token = request.GET.get("m", "").strip()
    if not friendly_token:
        return HttpResponseRedirect("/")
    media = Media.objects.filter(friendly_token=friendly_token).first()

    if not media:
        return HttpResponseRedirect("/")

    if not (request.user == media.user or is_mediacms_editor(request.user)):
        return HttpResponseRedirect("/")

    return render(
        request,
        "cms/edit_chapters.html",
        {"media_object": media, "add_subtitle_url": media.add_subtitle_url, "media_file_path": helpers.url_from_path(media.media_file.path), "media_id": media.friendly_token},
    )


@csrf_exempt
@login_required
def trim_video(request, friendly_token):
    if not settings.ALLOW_VIDEO_TRIMMER:
        return JsonResponse({"success": False, "error": "Video trimming is not allowed"}, status=400)

    if not request.method == "POST":
        return HttpResponseRedirect("/")

    media = Media.objects.filter(friendly_token=friendly_token).first()

    if not media:
        return HttpResponseRedirect("/")

    if not (request.user == media.user or is_mediacms_editor(request.user)):
        return HttpResponseRedirect("/")

    existing_requests = VideoTrimRequest.objects.filter(media=media, status__in=["initial", "running"]).exists()

    if existing_requests:
        return JsonResponse({"success": False, "error": "A trim request is already in progress for this video"}, status=400)

    try:
        data = json.loads(request.body)
        video_trim_request = create_video_trim_request(media, data)
        video_trim_task.delay(video_trim_request.id)
        ret = {"success": True, "request_id": video_trim_request.id}
        return JsonResponse(ret, safe=False, status=200)
    except Exception as e:  # noqa
        ret = {"success": False, "error": "Incorrect request data"}
        return JsonResponse(ret, safe=False, status=400)


@login_required
def edit_video(request):
    """Edit video"""

    friendly_token = request.GET.get("m", "").strip()
    if not friendly_token:
        return HttpResponseRedirect("/")
    media = Media.objects.filter(friendly_token=friendly_token).first()

    if not media:
        return HttpResponseRedirect("/")

    if not (request.user == media.user or is_mediacms_editor(request.user)):
        return HttpResponseRedirect("/")

    if not media.media_type == "video":
        messages.add_message(request, messages.INFO, "Media is not video")
        return HttpResponseRedirect(media.get_absolute_url())

    if not settings.ALLOW_VIDEO_TRIMMER:
        messages.add_message(request, messages.INFO, "Video Trimmer is not enabled")
        return HttpResponseRedirect(media.get_absolute_url())

    # Check if there's a running trim request
    running_trim_request = VideoTrimRequest.objects.filter(media=media, status__in=["initial", "running"]).exists()

    if running_trim_request:
        messages.add_message(request, messages.INFO, "Video trim request is already running")
        return HttpResponseRedirect(media.get_absolute_url())

    media_file_path = media.trim_video_url

    if not media_file_path:
        messages.add_message(request, messages.INFO, "Media processing has not finished yet")
        return HttpResponseRedirect(media.get_absolute_url())

    if media.encoding_status in ["pending", "running"]:
        video_msg = "Media encoding hasn't finished yet. Attempting to show the original video file"
        messages.add_message(request, messages.INFO, video_msg)

    return render(
        request,
        "cms/edit_video.html",
        {"media_object": media, "add_subtitle_url": media.add_subtitle_url, "media_file_path": media_file_path},
    )


def embed_media(request):
    """Embed media view"""

    friendly_token = request.GET.get("m", "").strip()
    if not friendly_token:
        return HttpResponseRedirect("/")

    media = Media.objects.values("title").filter(friendly_token=friendly_token).first()

    if not media:
        return HttpResponseRedirect("/")

    context = {}
    context["media"] = friendly_token
    return render(request, "cms/embed.html", context)


def featured_media(request):
    """List featured media view"""

    context = {}
    return render(request, "cms/featured-media.html", context)


def index(request):
    """Index view"""

    context = {}
    return render(request, "cms/index.html", context)


def latest_media(request):
    """List latest media view"""

    context = {}
    return render(request, "cms/latest-media.html", context)


def liked_media(request):
    """List user's liked media view"""

    context = {}
    return render(request, "cms/liked_media.html", context)


@login_required
def manage_users(request):
    """List users management view"""

    if not is_mediacms_editor(request.user):
        return HttpResponseRedirect("/")

    context = {}
    return render(request, "cms/manage_users.html", context)


@login_required
def manage_media(request):
    """List media management view"""
    if not is_mediacms_editor(request.user):
        return HttpResponseRedirect("/")

    categories = Category.objects.all().order_by('title').values_list('title', flat=True)
    context = {'categories': list(categories)}
    return render(request, "cms/manage_media.html", context)


@login_required
def manage_comments(request):
    """List comments management view"""
    if not is_mediacms_editor(request.user):
        return HttpResponseRedirect("/")

    context = {}
    return render(request, "cms/manage_comments.html", context)


def members(request):
    """List members view"""

    context = {}
    return render(request, "cms/members.html", context)


def recommended_media(request):
    """List recommended media view"""

    context = {}
    return render(request, "cms/recommended-media.html", context)


def search(request):
    """Search view"""

    context = {}
    RSS_URL = f"/rss{request.environ.get('REQUEST_URI')}"
    context["RSS_URL"] = RSS_URL
    return render(request, "cms/search.html", context)


def sitemap(request):
    """Sitemap"""

    context = {}
    context["media"] = list(Media.objects.filter(listable=True).order_by("-add_date"))
    context["playlists"] = list(Playlist.objects.filter().order_by("-add_date"))
    context["users"] = list(User.objects.filter())
    return render(request, "sitemap.xml", context, content_type="application/xml")


def tags(request):
    """List tags view"""

    context = {}
    return render(request, "cms/tags.html", context)


def tos(request):
    """Terms of service view"""

    context = {}
    return render(request, "cms/tos.html", context)


@login_required
def upload_media(request):
    """Upload media view"""

    from allauth.account.forms import LoginForm

    form = LoginForm()
    context = {}
    context["form"] = form
    context["can_add"] = user_allowed_to_upload(request)
    can_upload_exp = settings.CANNOT_ADD_MEDIA_MESSAGE
    context["can_upload_exp"] = can_upload_exp

    return render(request, "cms/add-media.html", context)


def view_media(request):
    """View media view"""

    friendly_token = request.GET.get("m", "").strip()
    context = {}
    media = Media.objects.filter(friendly_token=friendly_token).first()
    if not media:
        context["media"] = None
        return render(request, "cms/media.html", context)

    user_or_session = get_user_or_session(request)
    save_user_action.delay(user_or_session, friendly_token=friendly_token, action="watch")
    context = {}
    context["media"] = friendly_token
    context["media_object"] = media

    context["CAN_DELETE_MEDIA"] = False
    context["CAN_EDIT_MEDIA"] = False
    context["CAN_DELETE_COMMENTS"] = False

    if request.user.is_authenticated:
        if request.user.has_contributor_access_to_media(media) or is_mediacms_editor(request.user):
            context["CAN_DELETE_MEDIA"] = True
            context["CAN_EDIT_MEDIA"] = True
            context["CAN_DELETE_COMMENTS"] = True

    # in case media is video and is processing (eg the case a video was just uploaded)
    # attempt to show it (rather than showing a blank video player)
    if media.media_type == 'video':
        video_msg = None
        if media.encoding_status == "pending":
            video_msg = "Media encoding hasn't started yet. Attempting to show the original video file"
        if media.encoding_status == "running":
            video_msg = "Media encoding is under processing. Attempting to show the original video file"
        if video_msg and media.user == request.user:
            messages.add_message(request, messages.INFO, video_msg)

    return render(request, "cms/media.html", context)


def view_playlist(request, friendly_token):
    """View playlist view"""

    try:
        playlist = Playlist.objects.get(friendly_token=friendly_token)
    except BaseException:
        playlist = None

    context = {}
    context["playlist"] = playlist
    return render(request, "cms/playlist.html", context)
