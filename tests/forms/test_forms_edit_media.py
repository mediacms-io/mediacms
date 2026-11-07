import hashlib
import io
import uuid

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

from files.forms import MediaMetadataForm
from files.models import Media, MediaPermission, Tag
from files.tests import create_account, create_media, fixture_path
from files.tests.media_utils import IMAGE_JPG, SMALL_VIDEO


def file_digest(field):
    with open(field.path, "rb") as fp:
        return hashlib.md5(fp.read()).hexdigest()


def poster_upload(name="poster.jpg"):
    with open(fixture_path(IMAGE_JPG), "rb") as fp:
        return SimpleUploadedFile(name, fp.read(), content_type="image/jpeg")


def edit_data(media, **overrides):
    data = {
        "title": media.title,
        "description": media.description,
        "new_tags": "",
        "add_date": media.add_date.strftime("%Y-%m-%dT%H:%M:%S"),
        "enable_comments": "on" if media.enable_comments else "",
    }
    data.update(overrides)
    return {key: value for key, value in data.items() if value is not None}


class MediaMetadataFormFieldsTest(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    @classmethod
    def setUpTestData(cls):
        cls.user = create_account()
        cls.image = create_media(cls.user, title="metadata image", tags=[Tag.objects.create(title="alpha"), Tag.objects.create(title="beta")])
        cls.video = create_media(cls.user, filename=SMALL_VIDEO, title="metadata video")

    def test_image_has_no_poster_or_thumbnail_time(self):
        form = MediaMetadataForm(self.user, instance=self.image)
        self.assertEqual(set(form.fields), {"title", "new_tags", "add_date", "description", "enable_comments"})

    def test_video_offers_poster_and_thumbnail_time(self):
        form = MediaMetadataForm(self.user, instance=self.video)
        self.assertIn("uploaded_poster", form.fields)
        self.assertIn("thumbnail_time", form.fields)
        self.assertNotIn("friendly_token", form.fields)

    def test_current_tags_are_prefilled(self):
        form = MediaMetadataForm(self.user, instance=self.image)
        self.assertEqual(sorted(form.fields["new_tags"].initial.split(", ")), ["alpha", "beta"])

    @override_settings(ALLOW_CUSTOM_MEDIA_URLS=True)
    def test_slug_field_appears_when_custom_urls_are_allowed(self):
        self.assertIn("friendly_token", MediaMetadataForm(self.user, instance=self.image).fields)

    @override_settings(ALLOW_CUSTOM_MEDIA_URLS=True)
    def test_slug_must_be_url_safe_and_unique(self):
        cases = {
            "has spaces": "Slug can only contain alphanumeric characters, underscores, or hyphens.",
            "semi;colon": "Slug can only contain alphanumeric characters, underscores, or hyphens.",
            self.video.friendly_token: "This slug is already in use. Please choose a different one.",
        }
        for slug, error in cases.items():
            with self.subTest(slug=slug):
                form = MediaMetadataForm(self.user, edit_data(self.image, friendly_token=slug), instance=self.image)
                self.assertFalse(form.is_valid())
                self.assertEqual(form.errors["friendly_token"], [error])

    @override_settings(ALLOW_CUSTOM_MEDIA_URLS=True)
    def test_keeping_its_own_slug_is_valid(self):
        form = MediaMetadataForm(self.user, edit_data(self.image, friendly_token=self.image.friendly_token), instance=self.image)
        self.assertTrue(form.is_valid(), form.errors)

    def test_poster_larger_than_five_megabytes_is_rejected(self):
        buffer = io.BytesIO()
        Image.new("RGB", (1400, 1300)).save(buffer, format="BMP")
        self.assertGreater(buffer.tell(), 5 * 1024 * 1024)
        upload = SimpleUploadedFile("huge.bmp", buffer.getvalue(), content_type="image/bmp")
        form = MediaMetadataForm(self.user, edit_data(self.video), {"uploaded_poster": upload}, instance=self.video)
        self.assertFalse(form.is_valid())
        self.assertEqual(form.errors["uploaded_poster"], ["Image file too large ( > 5mb )"])

    def test_invalid_date_is_rejected(self):
        form = MediaMetadataForm(self.user, edit_data(self.image, add_date="yesterday-ish"), instance=self.image)
        self.assertFalse(form.is_valid())
        self.assertIn("add_date", form.errors)


class EditMediaSubmitTest(TestCase):
    def setUp(self):
        self.owner = create_account()
        self.other = create_account()
        self.media = create_media(self.owner, title="before edit", description="old text", tags=[Tag.objects.create(title=f"old{uuid.uuid4().hex[:6]}")])

    def post(self, user, **overrides):
        self.client.force_login(user)
        return self.client.post(f"/edit?m={self.media.friendly_token}", edit_data(self.media, **overrides))

    def api(self):
        response = self.client.get(f"/api/v1/media/{self.media.friendly_token}")
        self.assertEqual(response.status_code, 200)
        return response.json()

    def test_owner_edits_are_visible_through_the_api(self):
        response = self.post(self.owner, title="after edit", description="new text", enable_comments="", add_date="2020-01-02T03:04:05", new_tags="Cats, dogs!,  big   birds ,,")
        self.assertRedirects(response, self.media.get_absolute_url(), fetch_redirect_response=False)
        data = self.api()
        self.assertEqual(data["title"], "after edit")
        self.assertEqual(data["description"], "new text")
        self.assertFalse(data["enable_comments"])
        self.assertTrue(data["add_date"].startswith("2020-01-02T03:04:05"))
        self.assertEqual(sorted(tag["title"] for tag in data["tags_info"]), ["Cats", "big birds", "dogs"])

    def test_html_is_stripped_from_title_and_description(self):
        self.post(self.owner, title="<script>x</script>Clean", description="<b>bold</b> words")
        media = Media.objects.get(pk=self.media.pk)
        self.assertEqual((media.title, media.description), ("xClean", "bold words"))

    def test_clearing_tags_removes_them_and_existing_tags_are_reused(self):
        existing = Tag.objects.create(title="reusedtag", user=self.other)
        self.post(self.owner, new_tags="reusedtag")
        media = Media.objects.get(pk=self.media.pk)
        self.assertEqual(list(media.tags.all()), [existing])
        self.post(self.owner, new_tags="")
        self.assertFalse(Media.objects.get(pk=self.media.pk).tags.exists())

    def test_new_tags_are_owned_by_the_editing_user(self):
        self.post(self.owner, new_tags="brandnewtag")
        self.assertEqual(Tag.objects.get(title="brandnewtag").user, self.owner)

    def test_long_tags_are_truncated(self):
        self.post(self.owner, new_tags="x" * 150)
        self.assertEqual([tag.title for tag in Media.objects.get(pk=self.media.pk).tags.all()], ["x" * 100])

    def test_shared_editor_can_save_changes(self):
        collaborator = create_account()
        MediaPermission.objects.create(owner_user=self.owner, user=collaborator, media=self.media, permission="editor")
        self.post(collaborator, title="edited by collaborator")
        self.assertEqual(Media.objects.get(pk=self.media.pk).title, "edited by collaborator")

    def test_other_user_post_changes_nothing(self):
        response = self.post(self.other, title="hijacked")
        self.assertRedirects(response, "/", fetch_redirect_response=False)
        self.assertEqual(Media.objects.get(pk=self.media.pk).title, "before edit")

    def test_invalid_post_rerenders_the_form_without_saving(self):
        response = self.post(self.owner, title="never saved", add_date="not a date")
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "cms/edit_media.html")
        self.assertIn("add_date", response.context["form"].errors)
        self.assertEqual(Media.objects.get(pk=self.media.pk).title, "before edit")

    @override_settings(ALLOW_CUSTOM_MEDIA_URLS=True)
    def test_custom_slug_moves_the_media_url(self):
        slug = f"my-custom_{uuid.uuid4().hex[:8]}"
        response = self.post(self.owner, friendly_token=slug)
        self.assertRedirects(response, f"/view?m={slug}", fetch_redirect_response=False)
        self.assertEqual(Media.objects.get(pk=self.media.pk).friendly_token, slug)

    def test_edit_page_prefills_the_form(self):
        self.client.force_login(self.owner)
        response = self.client.get(f"/edit?m={self.media.friendly_token}")
        self.assertEqual(response.context["form"].instance, self.media)
        self.assertEqual(response.context["add_subtitle_url"], f"/add_subtitle?m={self.media.friendly_token}")
        self.assertContains(response, 'value="before edit"')


class EditVideoThumbnailTest(TestCase):
    fixtures = ["fixtures/encoding_profiles.json"]

    def setUp(self):
        self.owner = create_account()
        self.video = create_media(self.owner, filename=SMALL_VIDEO, title="thumbnail video", thumbnail_time=1)
        self.client.force_login(self.owner)

    def post(self, files=None, **overrides):
        overrides.setdefault("thumbnail_time", str(self.video.thumbnail_time))
        data = edit_data(self.video, **overrides)
        data.update(files or {})
        return self.client.post(f"/edit?m={self.video.friendly_token}", data)

    def api(self):
        return self.client.get(f"/api/v1/media/{self.video.friendly_token}").json()

    def test_changing_thumbnail_time_produces_a_different_thumbnail(self):
        self.assertEqual(self.video.thumbnail_time, 1.0)
        before_digest = file_digest(self.video.thumbnail)
        before_url = self.api()["thumbnail_url"]

        self.post(thumbnail_time="20.04")

        video = Media.objects.get(pk=self.video.pk)
        self.assertEqual(video.thumbnail_time, 20.0)
        self.assertNotEqual(file_digest(video.thumbnail), before_digest)
        data = self.api()
        self.assertEqual(data["thumbnail_time"], 20.0)
        self.assertNotEqual(data["thumbnail_url"], before_url)

    def test_saving_without_changing_the_time_keeps_the_thumbnail(self):
        before = Media.objects.get(pk=self.video.pk).thumbnail.name
        self.post(title="renamed only")
        self.assertEqual(Media.objects.get(pk=self.video.pk).thumbnail.name, before)

    def test_uploaded_poster_replaces_the_generated_images(self):
        generated = self.api()
        self.post(files={"uploaded_poster": poster_upload()})

        video = Media.objects.get(pk=self.video.pk)
        self.assertTrue(video.uploaded_poster)
        self.assertTrue(video.uploaded_thumbnail)
        data = self.api()
        self.assertNotEqual(data["poster_url"], generated["poster_url"])
        self.assertNotEqual(data["thumbnail_url"], generated["thumbnail_url"])
        self.assertTrue(data["poster_url"].endswith(video.uploaded_poster.name.split("/")[-1]))
        self.assertTrue(data["thumbnail_url"].endswith(video.uploaded_thumbnail.name.split("/")[-1]))
        self.assertTrue(video.thumbnail, "the generated thumbnail stays as a fallback")

    def test_thumbnail_time_beyond_the_video_falls_back_to_a_time_inside_it(self):
        self.post(thumbnail_time="500")
        video = Media.objects.get(pk=self.video.pk)
        self.assertLess(video.thumbnail_time, video.duration)
        self.assertGreaterEqual(video.thumbnail_time, 0)
