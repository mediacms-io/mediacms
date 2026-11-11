import os
import random
import string
from datetime import timedelta

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import models
from django.utils import timezone

from actions.models import MediaAction
from files.management.commands.fake_media_locales import FAKE_MEDIA_LOCALES, RTL_LANGUAGE_CODES
from files.models import (
    Category,
    Comment,
    Language,
    License,
    Media,
    MediaPermission,
    Page,
    Playlist,
    PlaylistMedia,
    Subtitle,
    Tag,
    TinyMCEMedia,
    TranscriptionRequest,
    VideoChapterData,
    VideoTrimRequest,
)
from users.models import Channel, User

# HTML comment kept on pages this command owns. A later run refreshes those
# pages. An admin who replaces the body and deletes the comment keeps their copy.
GENERATOR_PAGE_MARKER = 'generated-by-populate-fake-media'

# Bodies written by earlier versions of this command, so an existing demo can be upgraded.
_LEGACY_GENERATOR_PAGE_DESCRIPTIONS = {
    'about': ('<p>Welcome to this MediaCMS demo portal.</p>' '<p>This About page was created by the fake media generator for dashboard testing.</p>'),
    'faq': (
        '<h2>Frequently Asked Questions</h2>'
        '<p><strong>How do I upload media?</strong> Use the upload page after signing in.</p>'
        '<p><strong>Who can view private media?</strong> Owners and users with explicit share permissions.</p>'
    ),
}


class Command(BaseCommand):
    help = 'Populate database with fake media records for testing and demo purposes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--count',
            type=int,
            default=150,
            help='Number of media records to create (default: 150)',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing fake media before creating new ones',
        )
        parser.add_argument(
            '--rtl-language',
            choices=list(RTL_LANGUAGE_CODES) + ['random'],
            default='random',
            help='RTL language mixed with Greek for titles/names/comments (default: random among ar, he, ur)',
        )

    def handle(self, *args, **options):
        count = options['count']
        clear_existing = options['clear']

        self.stdout.write(self.style.SUCCESS(f'Starting to populate {count} fake media records...'))
        self._init_content_locales(options['rtl_language'])
        self._init_time_horizon()
        self.stdout.write(self.style.SUCCESS(f'Dating content from {self._horizon_start.date()} to {self._now.date()} (12 months)'))

        # Clear existing media if requested
        if clear_existing:
            self.stdout.write('Clearing existing media...')
            Media.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('Cleared existing media'))

        # Step 1: Create users
        users = self.create_users()
        self.stdout.write(self.style.SUCCESS(f'Created {len(users)} users'))

        # Step 2: Enrich default channels and create additional ones
        channels = self.setup_channels(users)
        self.stdout.write(self.style.SUCCESS(f'Set up {len(channels)} channels'))

        # Step 3: Setup tags, categories, and licenses
        tags = self.setup_tags(users)
        categories = self.setup_categories()
        licenses = self.setup_licenses()
        self.stdout.write(self.style.SUCCESS(f'Created {len(tags)} tags, {len(categories)} categories, and {len(licenses)} licenses'))

        # Step 4: Get fixture files
        fixture_files = self.get_fixture_files()
        if not fixture_files:
            self.stdout.write(self.style.ERROR('No fixture files found. Please ensure fixture files exist.'))
            return

        # Step 5: Generate media records
        created_media = []
        reported_media = []

        for i in range(count):
            if (i + 1) % 50 == 0:
                self.stdout.write(f'Created {i + 1}/{count} media records...')

            media = self.create_media_record(users, fixture_files, i, licenses=licenses)
            created_media.append(media)

            # Determine if this media should be reported
            if random.random() < 0.18:  # 18% chance of being reported
                reported_media.append(media)

            # Add tags and categories
            num_tags = random.randint(1, 5)
            selected_tags = random.sample(tags, min(num_tags, len(tags)))
            media.tags.set(selected_tags)

            num_categories = random.randint(0, 3)
            if num_categories > 0 and categories:
                selected_categories = random.sample(categories, min(num_categories, len(categories)))
                media.category.set(selected_categories)

        self.stdout.write(self.style.SUCCESS(f'Created {len(created_media)} media records'))

        # Step 6: Create playlists and assign media
        playlists = self.create_playlists(users)
        self.stdout.write(self.style.SUCCESS(f'Created {len(playlists)} playlists'))

        self.assign_media_to_playlists(created_media, playlists)
        self.stdout.write(self.style.SUCCESS('Assigned media to playlists'))

        # Step 7: Create MediaAction records (reports, likes, dislikes, watches)
        self.create_media_actions(created_media, reported_media, users)
        self.stdout.write(self.style.SUCCESS('Created MediaAction records'))

        # Step 8: Create comments
        comments = self.create_comments(created_media, users)
        self.stdout.write(self.style.SUCCESS(f'Created {len(comments)} comments'))

        # Step 9: Update reported_times for reported media
        for media in reported_media:
            report_count = MediaAction.objects.filter(media=media, action='report').count()
            media.reported_times = report_count
            media.save(update_fields=['reported_times'])

        # Step 10: Create subtitles and chapters for eligible videos
        subtitle_count, chapter_count = self.create_subtitles_and_chapters(created_media)
        self.stdout.write(self.style.SUCCESS(f'Created {subtitle_count} subtitles and {chapter_count} chapter sets'))

        # Step 11: Create caption (transcription) requests with statuses matching captions
        transcription_request_count = self.create_transcription_requests(created_media)
        self.stdout.write(self.style.SUCCESS(f'Created {transcription_request_count} caption requests'))

        # Step 12: Create media permissions with common share patterns
        permission_count = self.create_media_permissions(created_media, users)
        self.stdout.write(self.style.SUCCESS(f'Created {permission_count} media permissions'))

        # Step 13: Create video trim requests
        trim_request_count = self.create_trim_requests(created_media)
        self.stdout.write(self.style.SUCCESS(f'Created {trim_request_count} video trim requests'))

        # Step 14: Create CMS pages
        pages = self.create_pages()
        self.stdout.write(self.style.SUCCESS(f'Ensured {len(pages)} CMS pages'))

        # Step 15: Post-processing
        self.post_process(created_media, tags, categories)

        # Step 16: Display summary
        self.display_summary(
            created_media,
            users,
            tags,
            categories,
            reported_media,
            playlists,
            comments,
            channels=channels,
            licenses=licenses,
            subtitle_count=subtitle_count,
            chapter_count=chapter_count,
            transcription_request_count=transcription_request_count,
            permission_count=permission_count,
            trim_request_count=trim_request_count,
            pages=pages,
        )

        self.stdout.write(self.style.SUCCESS(f'\nSuccessfully populated {count} fake media records!'))

    def _init_content_locales(self, rtl_language='random'):
        """Mix Greek with exactly one RTL language for generated text."""
        if rtl_language == 'random':
            rtl_code = random.choice(RTL_LANGUAGE_CODES)
        elif rtl_language in RTL_LANGUAGE_CODES:
            rtl_code = rtl_language
        else:
            raise CommandError(f'Unsupported RTL language: {rtl_language}. Choose from {", ".join(RTL_LANGUAGE_CODES)} or random.')

        greek = FAKE_MEDIA_LOCALES['el']
        rtl = FAKE_MEDIA_LOCALES[rtl_code]
        self.content_locales = [greek, rtl]
        self.rtl_language_code = rtl_code
        self.stdout.write(self.style.SUCCESS(f'Content languages: Greek (el) + {rtl["name"]} ({rtl_code}, RTL)'))

    def _locale(self):
        """Pick Greek or the run's RTL language at random."""
        if not getattr(self, 'content_locales', None):
            self._init_content_locales('random')
        return random.choice(self.content_locales)

    def _init_time_horizon(self):
        """Use a rolling 12-month window for all generated timestamps."""
        self._now = timezone.now()
        self._horizon_start = self._now - timedelta(days=365)

    def _clamp_dt(self, value, start=None, end=None):
        start = start if start is not None else self._horizon_start
        end = end if end is not None else self._now
        if value < start:
            return start
        if value > end:
            return end
        return value

    def _random_datetime_between(self, start, end, *, recent_bias=False):
        """Pick a datetime in [start, end]. recent_bias skews toward end."""
        start = self._clamp_dt(start)
        end = self._clamp_dt(end)
        if start >= end:
            return start
        span = (end - start).total_seconds()
        if recent_bias:
            # Square-complement biases toward more recent times.
            t = 1.0 - (random.random() ** 2)
        else:
            t = random.random()
        return start + timedelta(seconds=int(span * t))

    def _backdate(self, model, pk, field, when):
        """Set auto_now / auto_now_add fields that ignore values on Model.save()."""
        model.objects.filter(pk=pk).update(**{field: when})

    def generate_random_string(self, length=8):
        """Generate a random alphanumeric string"""
        return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

    def generate_name(self, locale=None):
        """Generate a random name in Greek or the run's RTL language."""
        locale = locale or self._locale()
        return f"{random.choice(locale['first_names'])} {random.choice(locale['last_names'])}"

    def generate_email(self, username=None):
        """Generate a random email"""
        if username is None:
            username = self.generate_random_string(8)
        domains = ['example.com', 'test.com', 'demo.org', 'sample.net', 'fake.io']
        return f"{username}@{random.choice(domains)}"

    def create_users(self):
        """Create 10-15 fake users with join dates spread over the last 12 months."""
        num_users = random.randint(10, 15)
        users = []

        for i in range(num_users):
            # Some users can be editors/managers
            is_editor = random.random() < 0.2  # 20% chance
            is_manager = random.random() < 0.1  # 10% chance

            locale = self._locale()
            name = self.generate_name(locale=locale)
            username = f"user_{self.generate_random_string(6)}"
            email = self.generate_email(username)

            # Ensure unique username
            counter = 1
            original_username = username
            while User.objects.filter(username=username).exists():
                username = f"{original_username}{counter}"
                counter += 1

            # Keep enough early joiners so media can fill the full 12-month window.
            if i < max(3, num_users // 3):
                join_end = self._horizon_start + timedelta(days=120)
                date_joined = self._random_datetime_between(self._horizon_start, join_end)
            else:
                date_joined = self._random_datetime_between(self._horizon_start, self._now - timedelta(days=7))

            user = User.objects.create(
                username=username,
                email=email,
                name=name,
                description=locale['user_description'].format(n=i + 1),
                is_editor=is_editor,
                is_manager=is_manager,
                date_joined=date_joined,
            )
            user.set_password('testpass123')  # Simple password for all fake users
            user.save()
            # set_password/save can refresh timestamps; force the intended join date.
            self._backdate(User, user.pk, 'date_joined', date_joined)
            user.date_joined = date_joined
            users.append(user)

        return users

    def setup_channels(self, users):
        """Enrich auto-created default channels, add extras, and wire subscribers."""
        channels = []
        for user in users:
            user_channels = list(user.channels.order_by('add_date'))
            default = user_channels[0] if user_channels else None
            locale = self._locale()

            if default:
                # Give the auto-created "default" channel a real title/description
                display_name = user.name or user.username
                first_name = display_name.split()[0]
                default.title = locale['channel_suffix'].format(name=first_name)
                default.description = locale['channel_description'].format(name=display_name)
                default.save(update_fields=['title', 'description'])
                # Channel is created by the user post_save signal; place it just after join.
                channel_date = self._random_datetime_between(
                    user.date_joined,
                    min(user.date_joined + timedelta(days=3), self._now),
                )
                self._backdate(Channel, default.pk, 'add_date', channel_date)
                default.add_date = channel_date
                channels.append(default)

            # ~35% of users get 1–2 additional themed channels
            if random.random() < 0.35:
                extra_count = random.randint(1, 2)
                channel_themes = locale['channel_themes']
                themes = random.sample(channel_themes, min(extra_count, len(channel_themes)))
                for title, description in themes:
                    channel = Channel.objects.create(
                        user=user,
                        title=title,
                        description=description,
                    )
                    channel_date = self._random_datetime_between(user.date_joined, self._now)
                    self._backdate(Channel, channel.pk, 'add_date', channel_date)
                    channel.add_date = channel_date
                    channels.append(channel)

        # Add overlapping subscriber relationships so channels look active
        if len(users) >= 2:
            for channel in channels:
                # Deterministic-ish pool so the same users subscribe in common combinations
                others = [u for u in users if u.pk != channel.user_id]
                if not others:
                    continue
                rng = random.Random(channel.pk)
                shuffled = others[:]
                rng.shuffle(shuffled)
                num_subscribers = random.randint(1, min(5, len(shuffled)))
                channel.subscribers.add(*shuffled[:num_subscribers])

        return channels

    def setup_tags(self, users):
        """Create 20-30 fake tags"""
        num_tags = random.randint(20, 30)
        tags = []

        # Pool tag words from Greek and the selected RTL language
        tag_words = []
        for locale in self.content_locales:
            tag_words.extend(locale['tag_words'])

        # Get existing tags to avoid duplicates
        existing_tag_titles = set(Tag.objects.values_list('title', flat=True))

        for i in range(num_tags):
            # Generate tag title from common words or random string
            if random.random() < 0.7:
                tag_title = random.choice(tag_words)
                if random.random() < 0.3:
                    tag_title = f"{tag_title}{random.randint(1, 99)}"
            else:
                tag_title = self.generate_random_string(random.randint(5, 10))

            # Keep letters/digits from any script; strip spaces and punctuation
            tag_title = ''.join(c for c in tag_title if c.isalnum())
            tag_title = tag_title[:100]  # Max length

            # Ensure uniqueness
            counter = 1
            original_title = tag_title
            while tag_title in existing_tag_titles:
                tag_title = f"{original_title}{counter}"
                counter += 1

            existing_tag_titles.add(tag_title)

            # Randomly assign user or None
            user = random.choice(users) if random.random() < 0.3 else None

            tag = Tag.objects.create(
                title=tag_title,
                user=user,
            )
            tags.append(tag)

        return tags

    def setup_categories(self):
        """Setup categories - use existing or create new ones"""
        categories = list(Category.objects.all())

        # If no categories exist, create some from Greek + the selected RTL language
        if not categories:
            seen = set()
            for locale in self.content_locales:
                for name in locale['category_names']:
                    if name in seen:
                        continue
                    seen.add(name)
                    category = Category.objects.create(
                        title=name,
                        description=locale['category_description'].format(name=name),
                        is_global=True,
                    )
                    categories.append(category)

        return categories

    def setup_licenses(self):
        """Ensure common public-style licenses exist for demo media."""
        license_specs = [
            (
                'CC0 1.0 Universal',
                'Public domain dedication. You can copy, modify, and distribute the work without asking permission.',
            ),
            (
                'Public Domain Mark',
                'Work identified as free of known copyright restrictions.',
            ),
            (
                'CC BY 4.0',
                'Creative Commons Attribution 4.0. Credit must be given to the creator.',
            ),
            (
                'CC BY-SA 4.0',
                'Creative Commons Attribution-ShareAlike 4.0. Credit required; adaptations must use the same license.',
            ),
            (
                'CC BY-NC 4.0',
                'Creative Commons Attribution-NonCommercial 4.0. Credit required; non-commercial use only.',
            ),
            (
                'CC BY-NC-SA 4.0',
                'Creative Commons Attribution-NonCommercial-ShareAlike 4.0. Credit required; non-commercial; share-alike.',
            ),
            (
                'CC BY-ND 4.0',
                'Creative Commons Attribution-NoDerivatives 4.0. Credit required; no adaptations allowed.',
            ),
            (
                'CC BY-NC-ND 4.0',
                'Creative Commons Attribution-NonCommercial-NoDerivatives 4.0. Credit required; non-commercial; no adaptations.',
            ),
        ]

        licenses = []
        for title, description in license_specs:
            license_obj, _created = License.objects.get_or_create(
                title=title,
                defaults={'description': description},
            )
            licenses.append(license_obj)
        return licenses

    def get_fixture_files(self):
        """Get available fixture files"""
        fixture_dir = os.path.join(settings.BASE_DIR, 'fixtures')
        fixture_files = []

        # List of fixture files to look for (images/videos shipped with the repo;
        # sample_audio.wav and sample_document.pdf are original unrestricted samples)
        files_to_check = [
            'test_image.png',
            'test_image2.jpg',
            'small_video.mp4',
            'medium_video.mp4',
            'sample_audio.wav',
            'sample_audio.mp3',
            'sample_document.pdf',
        ]

        for filename in files_to_check:
            filepath = os.path.join(fixture_dir, filename)
            if os.path.exists(filepath):
                fixture_files.append(filepath)

        return fixture_files

    def generate_title(self, locale=None):
        """Generate a random media title in Greek or the run's RTL language."""
        locale = locale or self._locale()
        template = random.choice(locale['title_templates'])
        topic = random.choice(locale['topics'])

        # Check if template has both placeholders
        if '{action}' in template and '{topic}' in template:
            action = random.choice(locale['actions'])
            title = template.format(action=action, topic=topic)
        elif '{topic}' in template:
            title = template.format(topic=topic)
        elif '{action}' in template:
            action = random.choice(locale['actions'])
            title = template.format(action=action)
        else:
            title = template

        # Sometimes add a number or extra text
        if random.random() < 0.3:
            title = title + locale['title_part_suffix'].format(n=random.randint(1, 5))

        return title[:100]  # Max 100 chars

    def generate_description(self, locale=None):
        """Generate a random media description in Greek or the run's RTL language."""
        locale = locale or self._locale()
        description_parts = locale['description_parts']

        # Combine 2-4 random parts
        num_parts = random.randint(2, 4)
        selected_parts = random.sample(description_parts, min(num_parts, len(description_parts)))
        description = " ".join(selected_parts)

        return description

    def generate_comment_text(self, media_title=None, locale=None):
        """Generate a random comment in Greek or the run's RTL language."""
        locale = locale or self._locale()

        # Choose comment length
        rand = random.random()
        if rand < 0.4:  # 40% short
            text = random.choice(locale['short_comments'])
        elif rand < 0.8:  # 40% medium
            text = random.choice(locale['medium_comments'])
        else:  # 20% long
            text = random.choice(locale['long_comments'])
            # Replace {topic} placeholder if present
            if '{topic}' in text:
                if media_title:
                    words = media_title.split()
                    topic = words[0] if words else random.choice(locale['topics'])
                else:
                    topic = random.choice(locale['topics'])
                text = text.replace('{topic}', topic)

        # Ensure text doesn't exceed MAX_CHARS_FOR_COMMENT
        max_chars = getattr(settings, 'MAX_CHARS_FOR_COMMENT', 5000)
        if len(text) > max_chars:
            text = text[:max_chars]

        return text

    def generate_playlist_title(self, locale=None):
        """Generate a random playlist title in Greek or the run's RTL language."""
        locale = locale or self._locale()
        template = random.choice(locale['playlist_templates'])
        topic = random.choice(locale['topics'])
        title = template.format(topic=topic)

        # Sometimes add a number or extra text
        if random.random() < 0.2:
            title = f"{title} {random.randint(1, 5)}"

        return title[:100]  # Max 100 chars

    def create_media_record(self, users, fixture_files, index, licenses=None):
        """Create a single media record with randomized fields"""
        # Select random user
        user = random.choice(users)

        # Select random fixture file
        fixture_file_path = random.choice(fixture_files)
        filename = os.path.basename(fixture_file_path)

        # Determine media type from file extension
        ext = os.path.splitext(filename)[1].lower()
        if ext in ['.png', '.jpg', '.jpeg']:
            media_type = 'image'
        elif ext in ['.mp4', '.webm', '.avi']:
            media_type = 'video'
        elif ext in ['.mp3', '.wav', '.ogg', '.m4a', '.flac']:
            media_type = 'audio'
        elif ext == '.pdf':
            media_type = 'pdf'
        else:
            media_type = 'video'  # default

        # Generate basic fields (same locale for title + description on one media item)
        locale = self._locale()
        title = self.generate_title(locale=locale)
        description = self.generate_description(locale=locale)

        # Media date must be after the owner joined; slight recent bias for dashboards.
        add_date = self._random_datetime_between(user.date_joined, self._now, recent_bias=True)

        # Generate metrics
        views = random.randint(0, 50000)
        likes = random.randint(0, 10000) if random.random() > 0.1 else 1  # 10% have default 1
        dislikes = random.randint(0, 500)

        # Generate states and status
        state_rand = random.random()
        if state_rand < 0.6:
            state = 'public'
        elif state_rand < 0.85:
            state = 'unlisted'
        else:
            state = 'private'

        encoding_rand = random.random()
        if encoding_rand < 0.70:
            encoding_status = 'success'
        elif encoding_rand < 0.85:
            encoding_status = 'pending'
        elif encoding_rand < 0.95:
            encoding_status = 'running'
        else:
            encoding_status = 'fail'

        is_reviewed = random.random() < 0.8  # 80% True
        featured = random.random() < 0.1  # 10% True

        # Other fields
        enable_comments = random.random() < 0.9  # 90% True
        allow_download = random.random() < 0.85  # 85% True

        # Duration and video_height for videos
        duration = 0
        video_height = 1
        if media_type == 'video':
            duration = random.randint(30, 3600)  # 30 seconds to 1 hour
            video_height = random.choice([360, 480, 720, 1080])

        # Assign most media to one of the owner's channels
        channel = None
        owner_channels = list(user.channels.all())
        if owner_channels and random.random() < 0.85:
            channel = random.choice(owner_channels)

        # ~80% of media get a random public-style license
        license_obj = None
        if licenses and random.random() < 0.80:
            license_obj = random.choice(licenses)

        # Open fixture file and create media
        with open(fixture_file_path, 'rb') as f:
            media_file = File(f, name=filename)

            # Create media - media_init() will be called by post_save signal
            # which may change encoding_status, so we'll update it after
            media = Media.objects.create(
                user=user,
                title=title,
                description=description,
                media_file=media_file,
                media_type=media_type,
                channel=channel,
                license=license_obj,
                add_date=add_date,
                views=views,
                likes=likes,
                dislikes=dislikes,
                state=state,
                is_reviewed=is_reviewed,
                featured=featured,
                enable_comments=enable_comments,
                allow_download=allow_download,
                duration=duration,
                video_height=video_height,
            )

            # After media_init() runs, update state, encoding_status and listable
            # The Media.save() method overrides state on creation, so we need to set it here
            media.state = state
            media.encoding_status = encoding_status
            media.add_date = add_date
            # Recalculate listable based on our desired encoding_status
            media.listable = state == 'public' and encoding_status == 'success' and is_reviewed
            media.save(update_fields=['state', 'encoding_status', 'listable', 'add_date'])

        return media

    def create_playlists(self, users):
        """Create 10-20 playlists distributed across users"""
        num_playlists = random.randint(10, 20)
        playlists = []

        for i in range(num_playlists):
            # Select a random user (some users may get multiple playlists)
            user = random.choice(users)

            locale = self._locale()
            title = self.generate_playlist_title(locale=locale)
            description = random.choice(locale['playlist_descriptions'])

            playlist = Playlist.objects.create(
                user=user,
                title=title,
                description=description,
            )
            playlist_date = self._random_datetime_between(user.date_joined, self._now)
            self._backdate(Playlist, playlist.pk, 'add_date', playlist_date)
            playlist.add_date = playlist_date
            playlists.append(playlist)

        return playlists

    def _playlist_media_action_date(self, playlist, media):
        """Playlist membership cannot precede the playlist or the media."""
        earliest = max(playlist.add_date, media.add_date or self._horizon_start)
        return self._random_datetime_between(earliest, self._now)

    def assign_media_to_playlists(self, created_media, playlists):
        """Randomly assign media to playlists with proper ordering"""
        if not playlists:
            return

        for playlist in playlists:
            # Each playlist gets 3-15 media items
            num_media = random.randint(3, min(15, len(created_media)))
            selected_media = random.sample(created_media, num_media)

            # Add media to playlist with ordering
            for order, media in enumerate(selected_media, start=1):
                pm = PlaylistMedia.objects.create(
                    playlist=playlist,
                    media=media,
                    ordering=order,
                )
                self._backdate(PlaylistMedia, pm.pk, 'action_date', self._playlist_media_action_date(playlist, media))

        # Also randomly assign some media to additional playlists
        # Each media can be in 0-3 playlists total
        for media in created_media:
            # Randomly decide if this media should be in additional playlists
            if random.random() < 0.3:  # 30% chance
                num_additional_playlists = random.randint(1, 2)
                available_playlists = [p for p in playlists if media not in p.media.all()]
                if available_playlists:
                    selected_playlists = random.sample(available_playlists, min(num_additional_playlists, len(available_playlists)))
                    for playlist in selected_playlists:
                        # Get the current max ordering for this playlist
                        max_ordering = PlaylistMedia.objects.filter(playlist=playlist).aggregate(max_order=models.Max('ordering'))['max_order'] or 0

                        pm = PlaylistMedia.objects.create(
                            playlist=playlist,
                            media=media,
                            ordering=max_ordering + 1,
                        )
                        self._backdate(PlaylistMedia, pm.pk, 'action_date', self._playlist_media_action_date(playlist, media))

    def _create_dated_media_action(self, media, users, action, extra_info=None, user_chance=0.7):
        """Create a MediaAction dated after the media upload."""
        user = random.choice(users) if random.random() < user_chance else None
        media_action = MediaAction.objects.create(
            media=media,
            user=user,
            action=action,
            extra_info=extra_info or '',
        )
        action_date = self._random_datetime_between(media.add_date or self._horizon_start, self._now, recent_bias=True)
        self._backdate(MediaAction, media_action.pk, 'action_date', action_date)
        return media_action

    def create_media_actions(self, created_media, reported_media, users):
        """Create MediaAction records for likes, dislikes, watches, and reports"""
        report_reasons = [
            'Inappropriate content',
            'Copyright violation',
            'Spam or misleading',
            'Harassment or bullying',
            'Violence or graphic content',
            'Other',
        ]

        for media in created_media:
            # Create watch/view actions (some percentage of views)
            # Not all views need actions, but create some for realism
            num_watches = min(media.views // 10, 100)  # Create up to 100 watch actions
            for _ in range(num_watches):
                self._create_dated_media_action(media, users, 'watch', user_chance=0.7)

            # Create like actions
            num_likes = min(media.likes, 50)  # Create up to 50 like actions
            for _ in range(num_likes):
                self._create_dated_media_action(media, users, 'like', user_chance=0.8)

            # Create dislike actions
            num_dislikes = min(media.dislikes, 20)  # Create up to 20 dislike actions
            for _ in range(num_dislikes):
                self._create_dated_media_action(media, users, 'dislike', user_chance=0.7)

        # Create report actions for reported media
        for media in reported_media:
            # 1-10 reports per media
            num_reports = random.randint(1, 10)
            for _ in range(num_reports):
                self._create_dated_media_action(
                    media,
                    users,
                    'report',
                    extra_info=random.choice(report_reasons),
                    user_chance=0.6,
                )

    def create_comments(self, created_media, users):
        """Create comments with realistic distribution"""
        # Filter media where comments are enabled
        media_with_comments = [m for m in created_media if m.enable_comments]

        if not media_with_comments:
            return []

        all_comments = []

        for media in media_with_comments:
            # Determine number of comments based on distribution
            rand = random.random()
            if rand < 0.65:  # 65% no comments
                num_comments = 0
            elif rand < 0.85:  # 20% have 1-2 comments
                num_comments = random.randint(1, 2)
            elif rand < 0.90:  # 5% have 3-9 comments
                num_comments = random.randint(3, 9)
            else:  # 10% have 10-50+ comments (very active)
                num_comments = random.randint(10, 50)

            if num_comments == 0:
                continue

            comments_for_media = []
            media_start = media.add_date or self._horizon_start

            # Create comments
            for i in range(num_comments):
                comment_user = random.choice(users)
                comment_text = self.generate_comment_text(media.title)

                # Active threads skew recent; quieter ones spread across the media lifetime.
                if num_comments > 10:
                    recent_start = max(media_start, self._now - timedelta(days=30))
                    comment_date = self._random_datetime_between(recent_start, self._now, recent_bias=True)
                else:
                    comment_date = self._random_datetime_between(media_start, self._now)

                comment = Comment(
                    media=media,
                    user=comment_user,
                    text=comment_text,
                )
                comment.save()
                self._backdate(Comment, comment.pk, 'add_date', comment_date)
                comment.add_date = comment_date
                comments_for_media.append(comment)
                all_comments.append(comment)

            # Create nested/reply comments for media with 5+ comments
            if num_comments >= 5:
                # 10-30% of comments are replies
                num_replies = int(num_comments * random.uniform(0.1, 0.3))
                if num_replies > 0:
                    top_level_comments = [c for c in comments_for_media if c.parent is None]
                    if top_level_comments:
                        parent_comments = random.sample(top_level_comments, min(num_replies, len(top_level_comments)))

                        for parent_comment in parent_comments:
                            reply_user = random.choice(users)
                            reply_text = self.generate_comment_text(media.title)
                            reply_date = self._random_datetime_between(parent_comment.add_date, self._now)

                            reply = Comment(
                                media=media,
                                user=reply_user,
                                text=reply_text,
                                parent=parent_comment,
                            )
                            reply.save()
                            self._backdate(Comment, reply.pk, 'add_date', reply_date)
                            reply.add_date = reply_date
                            all_comments.append(reply)

        return all_comments

    def _sample_vtt_path(self, filename):
        """Resolve a sample VTT path under frontend-tools/video-js/public."""
        return os.path.join(settings.BASE_DIR, 'frontend-tools', 'video-js', 'public', filename)

    def _parse_chapters_vtt(self, vtt_path):
        """Parse a WebVTT chapters file into VideoChapterData JSON entries."""
        chapters = []
        with open(vtt_path, 'r', encoding='utf-8') as f:
            lines = [line.strip() for line in f.readlines()]

        i = 0
        while i < len(lines):
            line = lines[i]
            if '-->' in line:
                parts = line.split('-->')
                if len(parts) == 2:
                    start_time = parts[0].strip()
                    end_time = parts[1].strip()
                    title_parts = []
                    i += 1
                    while i < len(lines) and lines[i] and '-->' not in lines[i] and not lines[i].startswith('NOTE'):
                        title_parts.append(lines[i])
                        i += 1
                    chapter_title = ' '.join(title_parts).strip()
                    if chapter_title:
                        chapters.append(
                            {
                                'startTime': start_time,
                                'endTime': end_time,
                                'chapterTitle': chapter_title,
                            }
                        )
                    continue
            i += 1
        return chapters

    def _attach_subtitle(self, media, language, vtt_path, filename):
        """Attach a VTT caption file to media for the given language."""
        subtitle = Subtitle(language=language, media=media, user=media.user)
        with open(vtt_path, 'rb') as f:
            subtitle.subtitle_file.save(filename, File(f), save=False)
        subtitle.save()
        return subtitle

    def create_subtitles_and_chapters(self, created_media):
        """Attach sample captions/chapters to a subset of successfully encoded videos."""
        english_vtt = self._sample_vtt_path('sample-subtitles.vtt')
        greek_vtt = self._sample_vtt_path('sample-subtitles-greek.vtt')
        chapters_vtt = self._sample_vtt_path('sample-chapters.vtt')

        if not os.path.exists(english_vtt):
            self.stdout.write(self.style.WARNING(f'Sample subtitles not found: {english_vtt}'))
            english_vtt = None
        if not os.path.exists(greek_vtt):
            self.stdout.write(self.style.WARNING(f'Sample Greek subtitles not found: {greek_vtt}'))
            greek_vtt = None
        if not os.path.exists(chapters_vtt):
            self.stdout.write(self.style.WARNING(f'Sample chapters not found: {chapters_vtt}'))
            chapters_vtt = None

        if not english_vtt and not greek_vtt and not chapters_vtt:
            return 0, 0

        english_lang, _ = Language.objects.get_or_create(code='en', defaults={'title': 'English'})
        greek_lang, _ = Language.objects.get_or_create(code='el', defaults={'title': 'Greek'})

        chapter_data = self._parse_chapters_vtt(chapters_vtt) if chapters_vtt else []
        if chapters_vtt and not chapter_data:
            self.stdout.write(self.style.WARNING('Sample chapters VTT parsed to empty chapter list'))

        eligible = [m for m in created_media if m.media_type == 'video' and m.encoding_status == 'success']
        if not eligible:
            return 0, 0

        # Attach captions to ~25–35% of eligible videos
        caption_ratio = random.uniform(0.25, 0.35)
        caption_count = max(1, int(len(eligible) * caption_ratio))
        captioned = random.sample(eligible, min(caption_count, len(eligible)))

        subtitle_count = 0
        for media in captioned:
            if english_vtt:
                self._attach_subtitle(media, english_lang, english_vtt, 'sample-subtitles.vtt')
                subtitle_count += 1
            # ~half of captioned videos also get Greek captions
            if greek_vtt and random.random() < 0.5:
                self._attach_subtitle(media, greek_lang, greek_vtt, 'sample-subtitles-greek.vtt')
                subtitle_count += 1

        # Chapters on ~40% of captioned videos (overlap for dashboard demos)
        chapter_count = 0
        if chapter_data and captioned:
            chapter_target = max(1, int(len(captioned) * 0.4))
            chaptered = random.sample(captioned, min(chapter_target, len(captioned)))
            for media in chaptered:
                VideoChapterData.objects.create(media=media, data=chapter_data)
                if media.duration < 45:
                    media.duration = 45
                    media.save(update_fields=['duration'])
                chapter_count += 1

        return subtitle_count, chapter_count

    def _create_transcription_request(self, media, status, translate_to_english, logs, previous_date):
        """Create and backdate one Caption Request. Returns (request, add_date)."""
        request = TranscriptionRequest.objects.create(
            media=media,
            status=status,
            translate_to_english=translate_to_english,
            logs=logs,
        )
        request_date = self._random_datetime_between(previous_date, self._now)
        self._backdate(TranscriptionRequest, request.pk, 'add_date', request_date)
        return request, request_date

    def create_transcription_requests(self, created_media):
        """Create Caption Requests with statuses that match caption state.

        - Media that already have captions → success (and translate success when multi-lang)
        - A subset of remaining video/audio → pending / running / fail for admin demos
        """
        eligible = [m for m in created_media if m.media_type in ('video', 'audio') and m.encoding_status == 'success']
        if not eligible:
            return 0

        captioned_ids = set(Subtitle.objects.filter(media_id__in=[m.pk for m in eligible]).values_list('media_id', flat=True))
        multi_caption_ids = set(Subtitle.objects.filter(media_id__in=captioned_ids).values('media_id').annotate(n=models.Count('id')).filter(n__gt=1).values_list('media_id', flat=True))

        created = 0
        whisper_flag_updates = []

        # Captioned media: completed transcription requests
        for media in eligible:
            if media.pk not in captioned_ids:
                continue
            previous_date = media.add_date or self._horizon_start
            _, previous_date = self._create_transcription_request(
                media,
                status='success',
                translate_to_english=False,
                logs='Transcription took 12.4 seconds (fake media generator).',
                previous_date=previous_date,
            )
            created += 1
            has_translate = media.pk in multi_caption_ids or random.random() < 0.25
            if has_translate:
                _, previous_date = self._create_transcription_request(
                    media,
                    status='success',
                    translate_to_english=True,
                    logs='Translation took 15.1 seconds (fake media generator).',
                    previous_date=previous_date,
                )
                created += 1
            # Set flags without Media.save() so we don't enqueue duplicate pending requests
            whisper_flag_updates.append((media.pk, True, has_translate))

        if whisper_flag_updates:
            for media_id, transcribe, translate in whisper_flag_updates:
                Media.objects.filter(pk=media_id).update(
                    allow_whisper_transcribe=transcribe,
                    allow_whisper_transcribe_and_translate=translate,
                )

        # Non-captioned media: in-flight / failed requests for dashboard variety
        uncaptioned = [m for m in eligible if m.pk not in captioned_ids]
        if uncaptioned:
            target = max(1, int(len(uncaptioned) * random.uniform(0.12, 0.20)))
            selected = random.sample(uncaptioned, min(target, len(uncaptioned)))
            open_statuses = ['pending', 'running', 'fail']
            open_weights = [0.45, 0.25, 0.30]
            fail_logs = (
                'model not found',
                'CUDA out of memory',
                'No speech detected in audio track',
                'Whisper timed out after 7200 seconds',
            )
            for media in selected:
                status = random.choices(open_statuses, weights=open_weights, k=1)[0]
                translate = random.random() < 0.35
                if status == 'fail':
                    logs = random.choice(fail_logs)
                elif status == 'running':
                    logs = 'Whisper transcription in progress (fake media generator).'
                else:
                    logs = None
                self._create_transcription_request(
                    media,
                    status=status,
                    translate_to_english=translate,
                    logs=logs,
                    previous_date=media.add_date or self._horizon_start,
                )
                created += 1
                Media.objects.filter(pk=media.pk).update(
                    allow_whisper_transcribe=not translate,
                    allow_whisper_transcribe_and_translate=translate,
                )

        return created

    def _owner_collaborator_pool(self, owner, users, pool_size=5):
        """Stable-ish collaborator pool for an owner so users share in common combinations."""
        others = [u for u in users if u.pk != owner.pk]
        if not others:
            return []
        # Deterministic shuffle per owner so the same owner reuses similar collaborators
        rng = random.Random(owner.pk)
        shuffled = others[:]
        rng.shuffle(shuffled)
        return shuffled[: min(pool_size, len(shuffled))]

    def _grant_permission(self, owner, user, media, permission, created_pairs):
        """Create a MediaPermission if (user, media) is new. Returns 1 if created, else 0."""
        key = (user.pk, media.pk)
        if key in created_pairs:
            return 0
        perm = MediaPermission.objects.create(
            owner_user=owner,
            user=user,
            media=media,
            permission=permission,
            source=MediaPermission.SOURCE_EXPLICIT,
        )
        created_at = self._random_datetime_between(media.add_date or self._horizon_start, self._now)
        self._backdate(MediaPermission, perm.pk, 'created_at', created_at)
        created_pairs.add(key)
        return 1

    def create_media_permissions(self, created_media, users):
        """Create MediaPermission rows with overlapping share patterns across users."""
        if len(users) < 2 or not created_media:
            return 0

        private_media = [m for m in created_media if m.state == 'private']
        unlisted_media = [m for m in created_media if m.state == 'unlisted']
        public_media = [m for m in created_media if m.state == 'public']
        private_unlisted = private_media + unlisted_media

        created_pairs = set()
        permission_count = 0
        assigned = set()  # media pks already assigned a primary pattern

        def pick(media_list, ratio):
            candidates = [m for m in media_list if m.pk not in assigned]
            if not candidates:
                return []
            count = max(1, int(len(media_list) * ratio)) if media_list else 0
            selected = random.sample(candidates, min(count, len(candidates)))
            for m in selected:
                assigned.add(m.pk)
            return selected

        # Shared private (viewers): ~20% of private
        for media in pick(private_media, 0.20):
            pool = self._owner_collaborator_pool(media.user, users)
            if not pool:
                continue
            permission_count += self._grant_permission(media.user, media.user, media, 'owner', created_pairs)
            num_viewers = min(random.randint(2, 4), len(pool))
            for user in pool[:num_viewers]:
                permission_count += self._grant_permission(media.user, user, media, 'viewer', created_pairs)

        # Editor collaboration: ~15% of private/unlisted
        for media in pick(private_unlisted, 0.15):
            pool = self._owner_collaborator_pool(media.user, users)
            if not pool:
                continue
            permission_count += self._grant_permission(media.user, media.user, media, 'owner', created_pairs)
            permission_count += self._grant_permission(media.user, pool[0], media, 'editor', created_pairs)
            viewer_pool = pool[1:]
            if viewer_pool:
                num_viewers = min(random.randint(1, 2), len(viewer_pool))
                for user in viewer_pool[:num_viewers]:
                    permission_count += self._grant_permission(media.user, user, media, 'viewer', created_pairs)

        # Co-owner: ~8% of any state
        for media in pick(created_media, 0.08):
            pool = self._owner_collaborator_pool(media.user, users)
            if not pool:
                continue
            permission_count += self._grant_permission(media.user, media.user, media, 'owner', created_pairs)
            permission_count += self._grant_permission(media.user, pool[0], media, 'owner', created_pairs)

        # Public collab: ~10% of public
        for media in pick(public_media, 0.10):
            pool = self._owner_collaborator_pool(media.user, users)
            if not pool:
                continue
            permission_count += self._grant_permission(media.user, media.user, media, 'owner', created_pairs)
            num_editors = min(random.randint(1, 2), len(pool))
            for user in pool[:num_editors]:
                permission_count += self._grant_permission(media.user, user, media, 'editor', created_pairs)

        # Owner-self only: ~5% of any
        for media in pick(created_media, 0.05):
            permission_count += self._grant_permission(media.user, media.user, media, 'owner', created_pairs)

        return permission_count

    def _format_trim_timestamp(self, seconds):
        """Format seconds as HH:MM:SS.mmm for trim request timestamps."""
        seconds = max(0, float(seconds))
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = seconds % 60
        whole = int(secs)
        millis = int(round((secs - whole) * 1000))
        if millis == 1000:
            whole += 1
            millis = 0
        return f'{hours:02d}:{minutes:02d}:{whole:02d}.{millis:03d}'

    def _random_trim_segments(self, duration):
        """Build 1–3 trim segments that fit within the media duration."""
        duration = max(int(duration or 0), 30)
        num_segments = random.randint(1, 3)
        segments = []
        cursor = 0.0
        remaining_slots = num_segments

        for i in range(num_segments):
            remaining_slots = num_segments - i
            # Leave room for remaining segments (at least ~2s each)
            max_start = max(0, duration - (remaining_slots * 2))
            start = random.uniform(cursor, max_start) if max_start > cursor else cursor
            max_end = duration if i == num_segments - 1 else duration - ((remaining_slots - 1) * 2)
            min_end = min(start + 2, max_end)
            end = random.uniform(min_end, max_end) if max_end > min_end else max_end
            if end <= start:
                end = min(start + 2, duration)
            segments.append(
                {
                    'startTime': self._format_trim_timestamp(start),
                    'endTime': self._format_trim_timestamp(end),
                }
            )
            cursor = end
            if cursor >= duration:
                break

        return segments

    def create_trim_requests(self, created_media):
        """Create VideoTrimRequest rows for a subset of successfully encoded videos."""
        eligible = [m for m in created_media if m.media_type == 'video' and m.encoding_status == 'success']
        if not eligible:
            return 0

        # ~12–20% of eligible videos get at least one trim request
        target = max(1, int(len(eligible) * random.uniform(0.12, 0.20)))
        selected = random.sample(eligible, min(target, len(eligible)))

        statuses = ['initial', 'running', 'success', 'fail']
        status_weights = [0.35, 0.15, 0.35, 0.15]
        actions = ['replace', 'save_new', 'create_segments']
        action_weights = [0.45, 0.35, 0.20]
        styles = ['no_encoding', 'precise']
        style_weights = [0.7, 0.3]

        created = 0
        for media in selected:
            # Most get one request; a few get two (e.g. retry after fail)
            num_requests = 2 if random.random() < 0.15 else 1
            previous_date = media.add_date or self._horizon_start
            for _ in range(num_requests):
                trim_request = VideoTrimRequest.objects.create(
                    media=media,
                    status=random.choices(statuses, weights=status_weights, k=1)[0],
                    video_action=random.choices(actions, weights=action_weights, k=1)[0],
                    media_trim_style=random.choices(styles, weights=style_weights, k=1)[0],
                    timestamps=self._random_trim_segments(media.duration),
                )
                trim_date = self._random_datetime_between(previous_date, self._now)
                self._backdate(VideoTrimRequest, trim_request.pk, 'add_date', trim_date)
                previous_date = trim_date
                created += 1

        return created

    def create_pages(self):
        """Create or refresh the demo About, FAQ, and Terms pages.

        Terms is a Page with slug ``tos``, which the ``/tos`` view serves in
        place of the placeholder template. Each page embeds one TinyMCE media
        file. Pages this command wrote carry a marker comment and are refreshed
        on later runs. A page whose body was replaced in admin is left alone.
        """
        author = User.objects.filter(is_superuser=True).order_by('pk').first()
        pages = []
        for spec in self._demo_page_specs():
            page = Page.objects.filter(slug=spec['slug']).first()
            if page is not None and not self._demo_page_is_generated(page):
                self.stdout.write(self.style.WARNING(f"Left customized page /{spec['slug']} unchanged"))
                pages.append(page)
                continue

            attachment = self._ensure_demo_page_attachment(spec, author)
            description = spec['body'](self, attachment)
            if page is None:
                page = Page.objects.create(slug=spec['slug'], title=spec['title'], description=description)
                page_date = self._random_datetime_between(self._horizon_start, self._now)
                self._backdate(Page, page.pk, 'add_date', page_date)
                page.add_date = page_date
                self.stdout.write(f"Created CMS page /{page.slug}")
            else:
                page.title = spec['title']
                page.description = description
                page.save()
                self.stdout.write(f"Updated CMS page /{page.slug}")
            pages.append(page)
        return pages

    def _demo_page_is_generated(self, page):
        description = page.description or ''
        if GENERATOR_PAGE_MARKER in description:
            return True
        legacy = _LEGACY_GENERATOR_PAGE_DESCRIPTIONS.get(page.slug)
        return bool(legacy) and description == legacy

    def _demo_page_specs(self):
        return [
            {
                'slug': 'about',
                'title': 'About',
                'fixture': 'test_image.png',
                'attachment_filename': 'sample-portal-still.png',
                'file_type': 'image',
                'body': Command._about_page_body,
            },
            {
                'slug': 'faq',
                'title': 'FAQ',
                'fixture': 'test_image2.jpg',
                'attachment_filename': 'sample-portal-still.jpg',
                'file_type': 'image',
                'body': Command._faq_page_body,
            },
            {
                'slug': 'tos',
                'title': 'Terms',
                'fixture': 'sample_document.pdf',
                'attachment_filename': 'sample-document.pdf',
                'file_type': 'media',
                'body': Command._terms_page_body,
            },
        ]

    def _ensure_demo_page_attachment(self, spec, user):
        """Store the fixture file once and reuse it when the command runs again."""
        filename = spec['attachment_filename']
        existing = TinyMCEMedia.objects.filter(original_filename=filename).order_by('pk').first()
        if existing:
            return existing

        fixture_path = os.path.join(settings.BASE_DIR, 'fixtures', spec['fixture'])
        if not os.path.exists(fixture_path):
            self.stdout.write(self.style.WARNING(f"Skipping attachment for /{spec['slug']}: fixtures/{spec['fixture']} is missing"))
            return None

        with open(fixture_path, 'rb') as handle:
            attachment = TinyMCEMedia(file_type=spec['file_type'], original_filename=filename, user=user)
            attachment.file.save(filename, File(handle), save=True)
        uploaded_at = self._random_datetime_between(self._horizon_start, self._now)
        self._backdate(TinyMCEMedia, attachment.pk, 'uploaded_at', uploaded_at)
        return attachment

    def _embed_attachment(self, attachment, *, alt, caption, link_label):
        if attachment is None:
            return '<p><em>The sample file for this page was not in fixtures/, so nothing was attached.</em></p>'
        if attachment.file_type == 'image':
            return f'<figure><img src="{attachment.url}" alt="{alt}"><figcaption>{caption}</figcaption></figure>'
        return f'<p><a href="{attachment.url}">{link_label}</a></p>'

    def _about_page_body(self, attachment):
        figure = self._embed_attachment(
            attachment,
            alt='Sample image shipped with MediaCMS and reused by the fake media generator',
            caption='Sample still stored as TinyMCE media. The generator copies fixtures/test_image.png and embeds it here. Many video and image listings reuse this same file under different titles.',
            link_label='',
        )
        return f'''<!-- {GENERATOR_PAGE_MARKER} -->
<h2 class="emphasis-large">This portal is filled with sample content</h2>
<p>The media, accounts, playlists, comments, captions, and pages on this site were created by the <code>populate_fake_media</code> management command. They are synthetic demo data built from the small files in the repository <code>fixtures/</code> directory. They are not recordings of real events, and they are not a production archive.</p>
<p>Read this page before treating anything else on the site as real. The <a href="/faq">FAQ</a> explains the generator. The <a href="/tos">Terms</a> page states how to treat the demo.</p>
{figure}
<h2 class="emphasis-large">What the generator added</h2>
<ul>
<li>Media copied from <code>fixtures/</code>: short videos, test images, sample audio, and a sample PDF. One file is saved many times under different titles, descriptions, and dates.</li>
<li>Users and channels, categories, tags, licenses, playlists, comments, likes, reports, subtitles, chapters, caption requests, share permissions, and trim requests.</li>
<li>Timestamps spread across the previous 12 months so listings and dashboards have history.</li>
<li>This About page, the FAQ, and a Terms page that replaces the placeholder at <code>/tos</code>. Each of those pages stores one file in TinyMCE media.</li>
</ul>
<h2 class="emphasis-large">Warnings</h2>
<ul>
<li>Do not treat titles, descriptions, comments, or profiles as factual, or as belonging to real people. Names and message text are random.</li>
<li>Every account the generator created uses the password <code>testpass123</code>. Remove those accounts before anyone else can reach this portal, and do not reuse that password anywhere else. The installation admin account is separate and is not reset by the command.</li>
<li>Playback, transcoding, and captions reflect those small fixtures. A long title does not mean there is a long recording behind it.</li>
<li>Running the command again adds more media, users, and comments. <code>--clear</code> deletes existing media records first. It does not delete users, playlists, comments, or these pages.</li>
<li>The contact form sends mail to the configured admin addresses when outbound email is enabled. A message sent from this demo is a real email.</li>
</ul>
<h2 class="emphasis-large">Guidance</h2>
<ul>
<li>Sign in as the portal admin and use the management pages, or Django admin, to review and delete generated records.</li>
<li>Upload your own media from the upload page when you are ready to replace the samples. New uploads follow the portal workflow and are processed by the transcoding workers.</li>
<li>These three pages are rewritten the next time the generator runs, as long as this marker comment is still in the HTML. Edit them under Admin, Pages. Delete the marker comment if a later run should leave your edits in place.</li>
<li>Keep the site private to the people evaluating MediaCMS until the sample data and these disclosures are gone.</li>
</ul>'''

    def _faq_page_body(self, attachment):
        figure = self._embed_attachment(
            attachment,
            alt='Second sample image shipped with MediaCMS',
            caption='Another fixture image, fixtures/test_image2.jpg, stored as TinyMCE media. Image listings that look distinct may still be this file or the other sample still.',
            link_label='',
        )
        return f'''<!-- {GENERATOR_PAGE_MARKER} -->
<h2 class="emphasis-large">Frequently asked questions</h2>
<h3>Is the media on this site real?</h3>
<p>No. <code>populate_fake_media</code> copied sample files from <code>fixtures/</code> and invented the titles, descriptions, and authors. The same bytes are reused for many listings.</p>
<h3>What does the generator create?</h3>
<p>Users and channels, categories, tags, licenses, media (video, audio, image, and PDF), playlists, comments, likes, reports, subtitles, chapters, caption requests, share permissions, trim requests, and the About, FAQ, and Terms pages. Dates are spread over the previous 12 months.</p>
<h3>Which sample files does it use?</h3>
<p>Whichever of these are present: <code>test_image.png</code>, <code>test_image2.jpg</code>, <code>small_video.mp4</code>, <code>medium_video.mp4</code>, <code>sample_audio.wav</code>, <code>sample_audio.mp3</code>, and <code>sample_document.pdf</code>.</p>
{figure}
<h3>How do I run it?</h3>
<p>With the dev stack up: <code>docker compose -f docker-compose-dev.yaml exec web python manage.py populate_fake_media</code>. <code>--count</code> sets how many media records to add (default 150). <code>--clear</code> deletes existing media before creating new ones. Titles, names, and comments randomly mix Greek with one RTL language (<code>--rtl-language</code>: <code>ar</code>, <code>he</code>, <code>ur</code>, or <code>random</code>).</p>
<h3>Will running it again duplicate these pages?</h3>
<p>No. About, FAQ, and Terms are updated in place while they still contain the generator marker comment. Media, users, and comments are added again, so those counts grow unless you pass <code>--clear</code>, and that flag only removes media.</p>
<h3>Why do some videos have captions, chapters, or trim requests?</h3>
<p>The command adds those records to a portion of the videos so the management and media pages have something to show, including pending, running, success, and failed states.</p>
<h3>Are the user accounts safe to keep?</h3>
<p>No. They are not real people, and every generated account uses the password <code>testpass123</code>. Delete them before exposing the portal. The admin account created at installation is not one of these users, and the command does not change its password.</p>
<h3>How do I upload my own media?</h3>
<p>Sign in and use the upload page. New uploads follow the portal workflow (public, private, or unlisted) and are processed by the transcoding workers. That is the point at which the library stops being only samples.</p>
<h3>Who can view private media?</h3>
<p>The owner, and users who were granted an explicit share permission. Unlisted media is omitted from listings and is available to anyone with the link.</p>'''

    def _terms_page_body(self, attachment):
        attachment_html = self._embed_attachment(
            attachment,
            alt='',
            caption='',
            link_label='Download the sample document attached to these terms (fixtures/sample_document.pdf)',
        )
        return f'''<!-- {GENERATOR_PAGE_MARKER} -->
<h2 class="emphasis-large">Terms for this demo portal</h2>
<p>These terms replace the placeholder Terms page because this installation was loaded with generated sample content. They describe the demo. They are not a legal agreement for a production MediaCMS service, and they are not legal advice. Publish your own terms before anyone outside your evaluation group uses the portal.</p>
{attachment_html}
<h2 class="emphasis-large">Sample content</h2>
<p>Media, accounts, comments, and the records around them were generated from repository fixtures for testing and demonstration. A title, a channel name, or a comment is not an official statement, a real lecture, or a work owned by the person named on the page. See the <a href="/about">About</a> page for what the generator wrote and the <a href="/faq">FAQ</a> for how to run or remove it.</p>
<h2 class="emphasis-large">No warranty</h2>
<p>The portal is a demo environment. Listings can be incomplete, duplicated, or inconsistent because titles, states, and dates were randomized. Do not rely on it for archival, teaching, compliance, or any decision that depends on the media being what the title says it is.</p>
<h2 class="emphasis-large">Accounts and privacy</h2>
<ul>
<li>Generated users are not real people. Their names, email addresses, and descriptions are invented.</li>
<li>Generated accounts share the password <code>testpass123</code>. Do not reuse that password, and delete the accounts before a deployment that other people can reach.</li>
<li>Likes, reports, and watch history on generated media are synthetic or local to this installation.</li>
<li>The contact form delivers messages to the site's configured admin addresses when email is enabled. Do not send sensitive information through it on a demo.</li>
</ul>
<h2 class="emphasis-large">Sample files</h2>
<p>Files under <code>fixtures/</code> are the bytes behind many media items, and the PDF linked above is one of those fixtures stored as TinyMCE media. Respect the terms that apply to those files in the MediaCMS repository. Do not present a generated listing as the original work, and do not redistribute a fixture as if this portal were its source.</p>
<h2 class="emphasis-large">Taking this portal out of demo mode</h2>
<p>Delete the generated media and users, replace this page, and remove the About and FAQ disclosures. Until you do, keep the site private to the people evaluating MediaCMS. Replace this body under Admin, Pages, and delete the generator marker comment, so a later run of the command leaves your terms in place.</p>'''

    def post_process(self, created_media, tags, categories):
        """Post-processing: update search vectors, tag/category counts"""
        self.stdout.write('Updating search vectors...')
        for media in created_media:
            media.update_search_vector()

        self.stdout.write('Updating tag and category counts...')
        for tag in tags:
            tag.update_tag_media()

        for category in categories:
            category.update_category_media()

    def display_summary(
        self,
        created_media,
        users,
        tags,
        categories,
        reported_media,
        playlists,
        comments,
        channels=None,
        licenses=None,
        subtitle_count=0,
        chapter_count=0,
        transcription_request_count=0,
        permission_count=0,
        trim_request_count=0,
        pages=None,
    ):
        """Display summary statistics"""
        if pages is None:
            pages = []
        if channels is None:
            channels = []
        if licenses is None:
            licenses = []

        self.stdout.write(self.style.SUCCESS('\n' + '=' * 60))
        self.stdout.write(self.style.SUCCESS('SUMMARY STATISTICS'))
        self.stdout.write(self.style.SUCCESS('=' * 60))

        # Basic counts
        if getattr(self, 'content_locales', None):
            locale_label = ' + '.join(f'{loc["name"]} ({loc["code"]})' for loc in self.content_locales)
            self.stdout.write(f'\nContent languages: {locale_label}')
        self.stdout.write(f'\nTotal media created: {len(created_media)}')
        self.stdout.write(f'Total users: {len(users)}')
        self.stdout.write(f'Total channels: {len(channels)}')
        self.stdout.write(f'Total tags: {len(tags)}')
        self.stdout.write(f'Total categories: {len(categories)}')
        self.stdout.write(f'Total licenses: {len(licenses)}')
        self.stdout.write(f'Total playlists: {len(playlists)}')
        self.stdout.write(f'Total comments: {len(comments)}')
        self.stdout.write(f'Reported media: {len(reported_media)}')
        self.stdout.write(f'Subtitles created: {subtitle_count}')
        self.stdout.write(f'Chapter sets created: {chapter_count}')
        self.stdout.write(f'Caption requests created: {transcription_request_count}')
        self.stdout.write(f'Media permissions created: {permission_count}')
        self.stdout.write(f'Video trim requests created: {trim_request_count}')
        self.stdout.write(f'CMS pages: {len(pages)}')
        if pages:
            for page in pages:
                self.stdout.write(f'  /{page.slug} — {page.title}')
        if licenses and created_media:
            licensed = sum(1 for m in created_media if m.license_id)
            self.stdout.write(f'  Media with a license: {licensed}/{len(created_media)}')

        if created_media:
            media_dates = [m.add_date for m in created_media if m.add_date]
            if media_dates:
                self.stdout.write('\nDate distribution:')
                self.stdout.write(f'  Media range: {min(media_dates).date()} → {max(media_dates).date()}')
                user_joins = [u.date_joined for u in users]
                self.stdout.write(f'  User joins: {min(user_joins).date()} → {max(user_joins).date()}')
                if comments:
                    comment_dates = [c.add_date for c in comments if c.add_date]
                    if comment_dates:
                        self.stdout.write(f'  Comments: {min(comment_dates).date()} → {max(comment_dates).date()}')

        if channels:
            media_with_channel = sum(1 for m in created_media if m.channel_id)
            users_with_extra = sum(1 for u in users if u.channels.count() > 1)
            self.stdout.write('\nChannel statistics:')
            self.stdout.write(f'  Media assigned to a channel: {media_with_channel}')
            self.stdout.write(f'  Users with extra channels: {users_with_extra}')
            subscriber_total = sum(c.subscribers.count() for c in channels)
            self.stdout.write(f'  Total channel subscriptions: {subscriber_total}')

        # Breakdown by state
        self.stdout.write('\nBreakdown by state:')
        for state in ['public', 'unlisted', 'private']:
            count = sum(1 for m in created_media if m.state == state)
            percentage = (count / len(created_media) * 100) if created_media else 0
            self.stdout.write(f'  {state.capitalize()}: {count} ({percentage:.1f}%)')

        # Breakdown by encoding_status
        self.stdout.write('\nBreakdown by encoding status:')
        for status in ['success', 'pending', 'running', 'fail']:
            count = sum(1 for m in created_media if m.encoding_status == status)
            percentage = (count / len(created_media) * 100) if created_media else 0
            self.stdout.write(f'  {status.capitalize()}: {count} ({percentage:.1f}%)')

        # Breakdown by media_type
        self.stdout.write('\nBreakdown by media type:')
        media_types = {}
        for media in created_media:
            media_types[media.media_type] = media_types.get(media.media_type, 0) + 1
        for media_type, count in sorted(media_types.items()):
            percentage = (count / len(created_media) * 100) if created_media else 0
            self.stdout.write(f'  {media_type.capitalize()}: {count} ({percentage:.1f}%)')

        # Other statistics
        reviewed_count = sum(1 for m in created_media if m.is_reviewed)
        featured_count = sum(1 for m in created_media if m.featured)
        total_views = sum(m.views for m in created_media)
        total_likes = sum(m.likes for m in created_media)

        self.stdout.write('\nOther statistics:')
        self.stdout.write(f'  Reviewed: {reviewed_count} ({reviewed_count / len(created_media) * 100:.1f}%)')
        self.stdout.write(f'  Featured: {featured_count} ({featured_count / len(created_media) * 100:.1f}%)')
        self.stdout.write(f'  Total views: {total_views:,}')
        self.stdout.write(f'  Total likes: {total_likes:,}')

        # Playlist statistics
        if playlists:
            self.stdout.write('\nPlaylist statistics:')
            media_per_playlist = []
            for playlist in playlists:
                count = playlist.media.count()
                media_per_playlist.append(count)

            if media_per_playlist:
                avg_media = sum(media_per_playlist) / len(media_per_playlist)
                min_media = min(media_per_playlist)
                max_media = max(media_per_playlist)
                self.stdout.write(f'  Average media per playlist: {avg_media:.1f}')
                self.stdout.write(f'  Min media per playlist: {min_media}')
                self.stdout.write(f'  Max media per playlist: {max_media}')

            # User distribution
            user_playlist_count = {}
            for playlist in playlists:
                username = playlist.user.username
                user_playlist_count[username] = user_playlist_count.get(username, 0) + 1

            users_with_playlists = len(user_playlist_count)
            self.stdout.write(f'  Users with playlists: {users_with_playlists} out of {len(users)}')
            if user_playlist_count:
                max_playlists = max(user_playlist_count.values())
                self.stdout.write(f'  Max playlists per user: {max_playlists}')

        # Comment statistics
        if comments:
            self.stdout.write('\nComment statistics:')
            media_with_comments = [m for m in created_media if m.enable_comments]
            media_comment_counts = {}
            for media in media_with_comments:
                count = media.comments.count()
                if count > 0:
                    media_comment_counts[media] = count

            if media_comment_counts:
                total_media_with_comments = len(media_comment_counts)
                total_comments = sum(media_comment_counts.values())
                avg_comments = total_comments / total_media_with_comments if total_media_with_comments > 0 else 0
                max_comments = max(media_comment_counts.values())
                min_comments = min(media_comment_counts.values())

                self.stdout.write(f'  Media with comments: {total_media_with_comments} out of {len(media_with_comments)} (comments enabled)')
                self.stdout.write(f'  Average comments per media (with comments): {avg_comments:.1f}')
                self.stdout.write(f'  Min comments per media: {min_comments}')
                self.stdout.write(f'  Max comments per media: {max_comments}')

                # Count nested/reply comments
                reply_count = sum(1 for c in comments if c.parent is not None)
                if reply_count > 0:
                    self.stdout.write(f'  Reply comments: {reply_count} ({reply_count / len(comments) * 100:.1f}%)')

                # Find most active media
                most_active = max(media_comment_counts.items(), key=lambda x: x[1])
                self.stdout.write(f'  Most active media: "{most_active[0].title}" with {most_active[1]} comments')
            else:
                self.stdout.write('  No comments created (all media have comments disabled or distribution resulted in 0 comments)')

        self.stdout.write(self.style.SUCCESS('\n' + '=' * 60))
