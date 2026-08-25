from django.core.cache import cache
from django.core.files import File
from django.core.files.base import ContentFile
from django.test import Client, TestCase

from files.models import Language, Media, Subtitle
from files.tests import create_account

MEDIA_AUTH_URL = '/api/v1/media-auth'


class MediaAuthTest(TestCase):
    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        cache.clear()
        self.password = 'this_is_a_fake_password'
        self.owner = create_account(username='owner', password=self.password)
        self.other = create_account(username='other', password=self.password)

        with open('fixtures/test_image.png', 'rb') as fp:
            self.public_media = Media.objects.create(title='public image', user=self.other, media_file=File(fp))
        self.public_media.state = 'public'
        self.public_media.save()

        with open('fixtures/test_image.png', 'rb') as fp:
            self.private_media = Media.objects.create(title='private image', user=self.owner, media_file=File(fp))
        self.private_media.state = 'private'
        self.private_media.save()

        cache.clear()

    def _auth(self, uri, client=None):
        client = client or Client()
        return client.get(MEDIA_AUTH_URL, HTTP_X_ORIGINAL_URI=uri)

    @property
    def public_uid(self):
        return self.public_media.uid.hex

    @property
    def private_uid(self):
        return self.private_media.uid.hex

    def test_public_media_allowed_for_anonymous(self):
        uri = f'/media/encoded/{self.public_uid}/{self.public_uid}.mp4'
        self.assertEqual(self._auth(uri).status_code, 204)

    def test_private_media_denied_for_anonymous(self):
        uri = f'/media/encoded/23/owner/{self.private_uid}.mp4'
        self.assertEqual(self._auth(uri).status_code, 403)

    def test_private_media_allowed_for_owner(self):
        client = Client()
        client.login(username=self.owner.username, password=self.password)
        uri = f'/media/encoded/23/owner/{self.private_uid}.mp4'
        self.assertEqual(self._auth(uri, client).status_code, 204)

    def test_traversal_with_public_uid_is_denied(self):
        uri = f'/media/encoded/{self.public_uid}/..%2F23%2Fowner%2F{self.private_uid}.mp4'
        self.assertEqual(self._auth(uri).status_code, 403)

    def test_unencoded_traversal_is_denied(self):
        uri = f'/media/encoded/{self.public_uid}/../23/owner/{self.private_uid}.mp4'
        self.assertEqual(self._auth(uri).status_code, 403)

    def test_traversal_denied_even_for_authenticated_owner(self):
        client = Client()
        client.login(username=self.owner.username, password=self.password)
        uri = f'/media/encoded/{self.public_uid}/..%2F23%2Fowner%2F{self.private_uid}.mp4'
        self.assertEqual(self._auth(uri, client).status_code, 403)


class MediaAuthPathBindingTest(TestCase):
    """The decision must be bound to the file nginx will actually serve.

    nginx resolves the file from the request path and hands the whole request URI,
    query string included, to this view. So anything the view reads outside that
    path - a query parameter, a username that happens to look like a uid - must
    not be able to influence which media is authorized.
    """

    fixtures = ["fixtures/categories.json", "fixtures/encoding_profiles.json"]

    def setUp(self):
        cache.clear()
        self.password = "this_is_a_fake_password"
        self.owner = create_account(username="owner", password=self.password)
        self.stranger = create_account(username="stranger", password=self.password)
        self.hex_owner = create_account(username="f777c82f755df2d4bc9688d340b69292", password=self.password)

        with open("fixtures/test_image.png", "rb") as fp:
            self.public_media = Media.objects.create(title="public", user=self.stranger, media_file=File(fp))
        self.public_media.state = "public"
        self.public_media.save()

        with open("fixtures/test_image.png", "rb") as fp:
            self.private_media = Media.objects.create(title="private", user=self.owner, media_file=File(fp))
        self.private_media.state = "private"
        self.private_media.save()

        with open("fixtures/test_image.png", "rb") as fp:
            self.hex_media = Media.objects.create(title="migrated", user=self.hex_owner, media_file=File(fp))
        self.hex_media.state = "unlisted"
        self.hex_media.save()

        self.language = Language.objects.create(code="da", title="Danish")
        cache.clear()

    def _auth(self, uri, client=None):
        return (client or Client()).get(MEDIA_AUTH_URL, HTTP_X_ORIGINAL_URI=uri)

    def _login(self, user):
        client = Client()
        client.login(username=user.username, password=self.password)
        return client

    def _subtitle_for(self, media):
        subtitle = Subtitle(media=media, user=media.user, language=self.language)
        content = ContentFile(b"1\n00:00:01,000 --> 00:00:02,000\nhello\n")
        subtitle.subtitle_file.save(f"{media.friendly_token}-da.srt", content, save=False)
        subtitle.save()
        return subtitle

    def test_a_uid_in_the_query_string_cannot_authorize_a_private_file(self):
        subtitle = self._subtitle_for(self.private_media)
        uri = f"/media/{subtitle.subtitle_file.name}?x={self.public_media.uid.hex}"
        self.assertEqual(self._auth(uri).status_code, 403)

    def test_a_uid_in_the_fragment_or_extra_segments_cannot_authorize(self):
        subtitle = self._subtitle_for(self.private_media)
        for suffix in [
            f"?{self.public_media.uid.hex}",
            f"?a=b&c={self.public_media.uid.hex}",
            f"?redirect=/media/encoded/23/stranger/{self.public_media.uid.hex}.mp4",
        ]:
            uri = f"/media/{subtitle.subtitle_file.name}{suffix}"
            self.assertEqual(self._auth(uri).status_code, 403, f"authorized via {suffix!r}")

    def test_a_query_string_does_not_change_an_honest_decision(self):
        uri = f"/media/encoded/23/stranger/{self.public_media.uid.hex}.mp4"
        self.assertEqual(self._auth(uri).status_code, 204)
        self.assertEqual(self._auth(f"{uri}?x={self.private_media.uid.hex}").status_code, 204)

    def test_a_private_path_stays_denied_however_the_url_is_dressed_up(self):
        base = f"/media/encoded/23/owner/{self.private_media.uid.hex}.mp4"
        for suffix in ["", f"?x={self.public_media.uid.hex}", f"#{self.public_media.uid.hex}"]:
            self.assertEqual(self._auth(base + suffix).status_code, 403, f"allowed via {suffix!r}")

    def test_a_username_that_looks_like_a_uid_is_not_read_as_one(self):
        """The reported 403: the owner's username is 32 hex characters and precedes
        the real uid in the path, so an unanchored search matched the username.
        """
        uri = f"/media/original/thumbnails/user/{self.hex_owner.username}/{self.hex_media.uid.hex}_Hp1Kdh8.jpg.jpg"
        self.assertEqual(self._auth(uri).status_code, 204)

    def test_a_hex_username_does_not_leak_a_private_media(self):
        private_hex = Media.objects.create(title="private migrated", user=self.hex_owner, media_file=self.hex_media.media_file)
        private_hex.state = "private"
        private_hex.save()
        cache.clear()
        uri = f"/media/original/thumbnails/user/{self.hex_owner.username}/{private_hex.uid.hex}_x.jpg.jpg"
        self.assertEqual(self._auth(uri).status_code, 403)
        self.assertEqual(self._auth(uri, self._login(self.hex_owner)).status_code, 204)

    def test_a_public_medias_subtitle_is_served(self):
        subtitle = self._subtitle_for(self.public_media)
        self.assertEqual(self._auth(f"/media/{subtitle.subtitle_file.name}").status_code, 204)

    def test_a_private_medias_subtitle_is_denied_for_anonymous(self):
        subtitle = self._subtitle_for(self.private_media)
        self.assertEqual(self._auth(f"/media/{subtitle.subtitle_file.name}").status_code, 403)

    def test_a_private_medias_subtitle_is_allowed_for_its_owner(self):
        subtitle = self._subtitle_for(self.private_media)
        uri = f"/media/{subtitle.subtitle_file.name}"
        self.assertEqual(self._auth(uri, self._login(self.owner)).status_code, 204)
        self.assertEqual(self._auth(uri, self._login(self.stranger)).status_code, 403)

    def test_an_invented_subtitle_path_is_denied(self):
        uri = "/media/original/subtitles/user/owner/does-not-exist-en.srt"
        self.assertEqual(self._auth(uri).status_code, 403)

    def test_a_subtitle_path_under_the_wrong_username_is_denied(self):
        subtitle = self._subtitle_for(self.public_media)
        forged = subtitle.subtitle_file.name.replace("/stranger/", "/owner/")
        self.assertEqual(self._auth(f"/media/{forged}").status_code, 403)

    def test_an_hls_path_is_resolved_from_its_directory(self):
        uri = f"/media/hls/{self.public_media.uid.hex}/media-3/stream.m3u8"
        self.assertEqual(self._auth(uri).status_code, 204)

    def test_an_hls_path_of_a_private_media_is_denied(self):
        uri = f"/media/hls/{self.private_media.uid.hex}/media-3/stream.m3u8"
        self.assertEqual(self._auth(uri).status_code, 403)

    def test_an_original_file_is_resolved_from_its_filename(self):
        uri = f"/media/{self.public_media.media_file.name}"
        self.assertEqual(self._auth(uri).status_code, 204)

    def test_an_unknown_uid_is_denied(self):
        self.assertEqual(self._auth(f"/media/encoded/23/owner/{'0' * 32}.mp4").status_code, 403)

    def test_a_path_with_no_resolvable_media_is_denied(self):
        for uri in [
            "/media/original/user/owner/not-a-uid.mp4",
            "/media/hls/not-a-uid/media-1/stream.m3u8",
            "/media/original/categories/abcdef1234567890.jpg",
            "/media/",
            "",
        ]:
            self.assertEqual(self._auth(uri).status_code, 403, f"allowed {uri!r}")
