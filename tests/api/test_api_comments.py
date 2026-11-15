import uuid

from allauth.account.models import EmailAddress
from django.core import mail
from django.test import Client, TestCase, override_settings

from files.models import Comment, MediaPermission
from files.tests import create_account, create_media

COMMENTS_URL = '/api/v1/comments'


def make_user(**kwargs):
    name = uuid.uuid4().hex[:12]
    return create_account(username=f'u{name}', email=f'{name}@example.com', **kwargs)


def logged_in(user):
    client = Client()
    client.force_login(user)
    return client


def media_comments_url(media, uid=None):
    url = f'/api/v1/media/{media.friendly_token}/comments'
    if uid:
        url = f'{url}/{uid}'
    return url


class CommentListTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.author = make_user()
        cls.other = make_user()
        public_media = create_media(cls.author, state='public')
        private_media = create_media(cls.author, state='private')
        unlisted_media = create_media(cls.author, state='unlisted')
        Comment.objects.create(media=public_media, user=cls.author, text='public by author')
        Comment.objects.create(media=public_media, user=cls.other, text='public by other')
        Comment.objects.create(media=private_media, user=cls.author, text='private by author')
        Comment.objects.create(media=unlisted_media, user=cls.author, text='unlisted by author')

    def test_listing_contains_only_comments_on_public_media(self):
        response = Client().get(COMMENTS_URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual({c['text'] for c in response.data['results']}, {'public by author', 'public by other'})

    def test_listing_can_be_filtered_by_author(self):
        response = Client().get(COMMENTS_URL, {'author': self.other.username})
        self.assertEqual([c['text'] for c in response.data['results']], ['public by other'])
        self.assertEqual(response.data['results'][0]['author_name'], self.other.name)

    def test_filtering_by_unknown_author_returns_404(self):
        response = Client().get(COMMENTS_URL, {'author': 'nobody-by-this-name'})
        self.assertEqual(response.status_code, 404)

    def test_comments_cannot_be_created_through_the_listing(self):
        self.assertEqual(Client().post(COMMENTS_URL, {'text': 'x'}).status_code, 403)
        self.assertEqual(logged_in(self.other).post(COMMENTS_URL, {'text': 'x'}).status_code, 405)


class MediaCommentsReadTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user()
        cls.other = make_user()
        cls.shared_with = make_user()
        cls.editor = make_user(is_editor=True)
        cls.public_media = create_media(cls.owner, state='public')
        cls.unlisted_media = create_media(cls.owner, state='unlisted')
        cls.private_media = create_media(cls.owner, state='private')
        MediaPermission.objects.create(owner_user=cls.owner, user=cls.shared_with, media=cls.private_media, permission='viewer')
        Comment.objects.create(media=cls.public_media, user=cls.other, text='on public')
        Comment.objects.create(media=cls.unlisted_media, user=cls.other, text='on unlisted')
        Comment.objects.create(media=cls.private_media, user=cls.owner, text='on private')

    def texts(self, response):
        self.assertEqual(response.status_code, 200)
        return [c['text'] for c in response.data['results']]

    def test_anonymous_users_read_comments_of_public_and_unlisted_media(self):
        self.assertEqual(self.texts(Client().get(media_comments_url(self.public_media))), ['on public'])
        self.assertEqual(self.texts(Client().get(media_comments_url(self.unlisted_media))), ['on unlisted'])

    def test_comments_of_private_media_are_hidden_from_anonymous_and_other_users(self):
        for client in (Client(), logged_in(self.other)):
            response = client.get(media_comments_url(self.private_media))
            self.assertEqual(response.status_code, 400)
            self.assertEqual(response.data['detail'], 'media is private')

    def test_owner_shared_users_and_editors_read_comments_of_private_media(self):
        for user in (self.owner, self.shared_with, self.editor):
            with self.subTest(user=user.username):
                self.assertEqual(self.texts(logged_in(user).get(media_comments_url(self.private_media))), ['on private'])

    def test_unknown_media_returns_error(self):
        response = Client().get('/api/v1/media/doesnotexist/comments')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'media file does not exist')


class MediaCommentCreateTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.owner = make_user()
        cls.commenter = make_user()
        cls.media = create_media(cls.owner, state='public', title='commented media')
        cls.private_media = create_media(cls.owner, state='private')
        cls.closed_media = create_media(cls.owner, state='public', enable_comments=False)

    def test_anonymous_users_cannot_comment(self):
        response = Client().post(media_comments_url(self.media), {'text': 'hello'})
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Comment.objects.exists())

    def test_user_comments_and_media_owner_is_notified(self):
        response = logged_in(self.commenter).post(media_comments_url(self.media), {'text': '<script>x</script>nice video'})
        self.assertEqual(response.status_code, 201)
        comment = Comment.objects.get(media=self.media)
        self.assertEqual(comment.user, self.commenter)
        self.assertEqual(comment.text, 'xnice video')
        self.assertEqual(response.data['uid'], str(comment.uid))
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.owner.email])
        self.assertIn('commented media', mail.outbox[0].body)

    def test_owner_commenting_on_own_media_is_not_notified(self):
        response = logged_in(self.owner).post(media_comments_url(self.media), {'text': 'my own'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(mail.outbox, [])

    def test_owner_who_disabled_notifications_is_not_notified(self):
        owner = make_user()
        owner.notification_on_comments = False
        owner.save()
        media = create_media(owner, state='public')
        mail.outbox.clear()
        response = logged_in(self.commenter).post(media_comments_url(media), {'text': 'quiet please'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(mail.outbox, [])

    def test_reply_is_attached_to_its_parent(self):
        parent = Comment.objects.create(media=self.media, user=self.owner, text='parent')
        response = logged_in(self.commenter).post(media_comments_url(self.media), {'text': 'reply', 'parent': parent.pk})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Comment.objects.get(text='reply').parent, parent)

    def test_empty_comment_is_rejected(self):
        response = logged_in(self.commenter).post(media_comments_url(self.media), {'text': ''})
        self.assertEqual(response.status_code, 400)
        self.assertIn('text', response.data)

    def test_commenting_is_refused_where_comments_are_disabled(self):
        response = logged_in(self.commenter).post(media_comments_url(self.closed_media), {'text': 'hello'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'comments not allowed here')
        self.assertFalse(Comment.objects.exists())

    def test_commenting_on_private_media_without_access_is_refused(self):
        response = logged_in(self.commenter).post(media_comments_url(self.private_media), {'text': 'hello'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'media is private')
        self.assertFalse(Comment.objects.exists())

    def test_commenting_on_private_media_with_access_is_allowed(self):
        MediaPermission.objects.create(owner_user=self.owner, user=self.commenter, media=self.private_media, permission='viewer')
        response = logged_in(self.commenter).post(media_comments_url(self.private_media), {'text': 'shared'})
        self.assertEqual(response.status_code, 201)

    @override_settings(CAN_COMMENT='email_verified')
    def test_only_verified_emails_may_comment_when_required(self):
        response = logged_in(self.commenter).post(media_comments_url(self.media), {'text': 'unverified'})
        self.assertEqual(response.status_code, 403)

        EmailAddress.objects.create(user=self.commenter, email=self.commenter.email, verified=True, primary=True)
        response = logged_in(self.commenter).post(media_comments_url(self.media), {'text': 'verified'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(list(Comment.objects.values_list('text', flat=True)), ['verified'])

    @override_settings(CAN_COMMENT='advancedUser')
    def test_only_advanced_users_may_comment_when_required(self):
        response = logged_in(self.commenter).post(media_comments_url(self.media), {'text': 'basic'})
        self.assertEqual(response.status_code, 403)

        self.commenter.advancedUser = True
        self.commenter.save()
        response = logged_in(self.commenter).post(media_comments_url(self.media), {'text': 'advanced'})
        self.assertEqual(response.status_code, 201)

    @override_settings(CAN_COMMENT='advancedUser')
    def test_superusers_may_always_comment(self):
        response = logged_in(make_user(is_superuser=True)).post(media_comments_url(self.media), {'text': 'admin says'})
        self.assertEqual(response.status_code, 201)

    @override_settings(ALLOW_MENTION_IN_COMMENTS=True)
    def test_mentioned_users_are_notified_once_with_cleaned_text(self):
        mentioned = make_user()
        mail.outbox.clear()
        text = f'hey @(_{mentioned.username}_)[_{mentioned.name}_] and again @(_{mentioned.username}_)'
        response = logged_in(self.owner).post(media_comments_url(self.media), {'text': text})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [mentioned.email])
        self.assertIn(f'hey {mentioned.name} and again', mail.outbox[0].body)
        self.assertNotIn('@(_', mail.outbox[0].body)

    @override_settings(ALLOW_MENTION_IN_COMMENTS=True)
    def test_mentioning_a_username_that_does_not_exist_still_posts_the_comment(self):
        mentioned = make_user()
        mail.outbox.clear()
        text = f'hey @(_ghost_user_that_is_not_here_) and @(_{mentioned.username}_)'
        response = logged_in(self.owner).post(media_comments_url(self.media), {'text': text})
        self.assertEqual(response.status_code, 201)
        self.assertTrue(Comment.objects.filter(media=self.media, user=self.owner).exists())
        self.assertEqual([message.to for message in mail.outbox], [[mentioned.email]])

    def test_mentions_are_ignored_when_disabled(self):
        mentioned = make_user()
        mail.outbox.clear()
        response = logged_in(self.owner).post(media_comments_url(self.media), {'text': f'hey @(_{mentioned.username}_)'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(mail.outbox, [])


class MediaCommentDeleteTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.media_owner = make_user()
        cls.author = make_user()
        cls.stranger = make_user()
        cls.media = create_media(cls.media_owner, state='public')

    def setUp(self):
        self.comment = Comment.objects.create(media=self.media, user=self.author, text='to delete')

    def delete_as(self, user):
        client = logged_in(user) if user else Client()
        return client.delete(media_comments_url(self.media, self.comment.uid))

    def test_comment_author_deletes_comment(self):
        self.assertEqual(self.delete_as(self.author).status_code, 204)
        self.assertFalse(Comment.objects.filter(pk=self.comment.pk).exists())

    def test_media_owner_deletes_comment(self):
        self.assertEqual(self.delete_as(self.media_owner).status_code, 204)
        self.assertFalse(Comment.objects.filter(pk=self.comment.pk).exists())

    def test_editors_managers_and_admins_delete_any_comment(self):
        for kwargs in ({'is_editor': True}, {'is_manager': True}, {'is_superuser': True}):
            with self.subTest(**kwargs):
                comment = Comment.objects.create(media=self.media, user=self.author, text='moderated')
                response = logged_in(make_user(**kwargs)).delete(media_comments_url(self.media, comment.uid))
                self.assertEqual(response.status_code, 204)
                self.assertFalse(Comment.objects.filter(pk=comment.pk).exists())

    def test_other_users_cannot_delete_comment(self):
        response = self.delete_as(self.stranger)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'bad permissions')
        self.assertTrue(Comment.objects.filter(pk=self.comment.pk).exists())

    def test_anonymous_users_cannot_delete_comment(self):
        self.assertEqual(self.delete_as(None).status_code, 403)
        self.assertTrue(Comment.objects.filter(pk=self.comment.pk).exists())

    def test_deleting_unknown_comment_returns_error(self):
        response = logged_in(self.author).delete(media_comments_url(self.media, uuid.uuid4()))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['detail'], 'comment does not exist')

    def test_delete_without_comment_uid_does_nothing(self):
        response = logged_in(self.author).delete(media_comments_url(self.media))
        self.assertEqual(response.status_code, 204)
        self.assertTrue(Comment.objects.filter(pk=self.comment.pk).exists())
