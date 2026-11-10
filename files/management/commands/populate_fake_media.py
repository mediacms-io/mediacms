import os
import random
import string
from datetime import timedelta

from django.conf import settings
from django.core.files import File
from django.core.management.base import BaseCommand
from django.db import models
from django.utils import timezone

from actions.models import MediaAction
from files.models import (
    Category,
    Comment,
    Language,
    Media,
    MediaPermission,
    Page,
    Playlist,
    PlaylistMedia,
    Subtitle,
    Tag,
    VideoChapterData,
    VideoTrimRequest,
)
from users.models import Channel, User


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

    def handle(self, *args, **options):
        count = options['count']
        clear_existing = options['clear']

        self.stdout.write(self.style.SUCCESS(f'Starting to populate {count} fake media records...'))
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

        # Step 3: Setup tags and categories
        tags = self.setup_tags(users)
        categories = self.setup_categories()
        self.stdout.write(self.style.SUCCESS(f'Created {len(tags)} tags and {len(categories)} categories'))

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

            media = self.create_media_record(users, fixture_files, i)
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

        # Step 11: Create media permissions with common share patterns
        permission_count = self.create_media_permissions(created_media, users)
        self.stdout.write(self.style.SUCCESS(f'Created {permission_count} media permissions'))

        # Step 12: Create video trim requests
        trim_request_count = self.create_trim_requests(created_media)
        self.stdout.write(self.style.SUCCESS(f'Created {trim_request_count} video trim requests'))

        # Step 13: Create CMS pages
        pages = self.create_pages()
        self.stdout.write(self.style.SUCCESS(f'Ensured {len(pages)} CMS pages'))

        # Step 14: Post-processing
        self.post_process(created_media, tags, categories)

        # Step 15: Display summary
        self.display_summary(
            created_media,
            users,
            tags,
            categories,
            reported_media,
            playlists,
            comments,
            channels=channels,
            subtitle_count=subtitle_count,
            chapter_count=chapter_count,
            permission_count=permission_count,
            trim_request_count=trim_request_count,
            pages=pages,
        )

        self.stdout.write(self.style.SUCCESS(f'\nSuccessfully populated {count} fake media records!'))

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

    def generate_name(self):
        """Generate a random name"""
        first_names = ['John', 'Jane', 'Mike', 'Sarah', 'David', 'Emily', 'Chris', 'Lisa', 'Tom', 'Anna', 'Alex', 'Maria', 'James', 'Emma', 'Robert', 'Olivia']
        last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson']
        return f"{random.choice(first_names)} {random.choice(last_names)}"

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

            name = self.generate_name()
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
                description=f"Fake user account for testing purposes. User #{i + 1}",
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
        channel_themes = [
            ('Tech Talks', 'Talks and demos about technology and software.'),
            ('Campus Lectures', 'Recorded lectures and course sessions.'),
            ('Creative Studio', 'Original creative media and experiments.'),
            ('Sports Highlights', 'Game clips, highlights, and analysis.'),
            ('Music Lab', 'Performances, mixes, and audio projects.'),
            ('Science Hour', 'Science explainers and lab demos.'),
            ('Travel Diaries', 'Trips, places, and field recordings.'),
            ('News Desk', 'Updates, briefings, and announcements.'),
            ('Workshop Series', 'Hands-on workshops and how-to sessions.'),
            ('Archive', 'Older media kept for reference.'),
        ]

        channels = []
        for user in users:
            user_channels = list(user.channels.order_by('add_date'))
            default = user_channels[0] if user_channels else None

            if default:
                # Give the auto-created "default" channel a real title/description
                first_name = (user.name or user.username).split()[0]
                default.title = f"{first_name}'s Channel"
                default.description = f"Primary channel for {user.name or user.username}. " "Demo content generated for dashboard testing."
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

        # Common tag words
        tag_words = [
            'tutorial',
            'demo',
            'example',
            'test',
            'sample',
            'video',
            'audio',
            'image',
            'document',
            'presentation',
            'guide',
            'howto',
            'review',
            'unboxing',
            'music',
            'tech',
            'gaming',
            'sports',
            'news',
            'entertainment',
            'education',
            'science',
            'art',
            'photography',
            'travel',
            'food',
            'cooking',
            'fitness',
            'health',
            'business',
            'finance',
            'programming',
            'coding',
        ]

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

            # Make it alphanumeric and ensure uniqueness
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

        # If no categories exist, create some basic ones
        if not categories:
            category_names = ['Technology', 'Entertainment', 'Education', 'Sports', 'News', 'Music', 'Gaming', 'Travel', 'Food', 'Science']
            for name in category_names:
                category = Category.objects.create(
                    title=name,
                    description=f'Category for {name}',
                    is_global=True,
                )
                categories.append(category)

        return categories

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

    def generate_title(self):
        """Generate a random media title"""
        title_templates = [
            "Amazing {topic} Tutorial",
            "Introduction to {topic}",
            "How to {action} {topic}",
            "Best Practices for {topic}",
            "Complete Guide to {topic}",
            "{topic} Explained Simply",
            "Advanced {topic} Techniques",
            "Getting Started with {topic}",
            "{topic} Tips and Tricks",
            "Understanding {topic}",
        ]

        topics = [
            'Video Editing',
            'Photography',
            'Music Production',
            'Coding',
            'Design',
            'Cooking',
            'Fitness',
            'Travel',
            'Gaming',
            'Technology',
            'Business',
            'Education',
            'Science',
            'Art',
            'Sports',
            'Entertainment',
        ]
        actions = ['Master', 'Learn', 'Understand', 'Create', 'Build', 'Design', 'Develop']

        template = random.choice(title_templates)
        topic = random.choice(topics)

        # Check if template has both placeholders
        if '{action}' in template and '{topic}' in template:
            action = random.choice(actions)
            title = template.format(action=action, topic=topic)
        elif '{topic}' in template:
            title = template.format(topic=topic)
        elif '{action}' in template:
            action = random.choice(actions)
            title = template.format(action=action)
        else:
            title = template

        # Sometimes add a number or extra text
        if random.random() < 0.3:
            title = f"{title} - Part {random.randint(1, 5)}"

        return title[:100]  # Max 100 chars

    def generate_description(self):
        """Generate a random media description"""
        description_parts = [
            "This is a sample media file created for testing purposes.",
            "Learn about various topics and improve your skills.",
            "Watch this comprehensive guide to understand the concepts better.",
            "Perfect for beginners and advanced users alike.",
            "Discover new techniques and best practices.",
            "This content covers important aspects you should know.",
            "Follow along and practice the examples shown here.",
            "Great resource for anyone interested in this topic.",
        ]

        # Combine 2-4 random parts
        num_parts = random.randint(2, 4)
        selected_parts = random.sample(description_parts, min(num_parts, len(description_parts)))
        description = " ".join(selected_parts)

        return description

    def generate_comment_text(self, media_title=None):
        """Generate a random comment text"""
        short_comments = [
            "Great!",
            "Thanks!",
            "Awesome video",
            "Love this",
            "Nice work",
            "Well done",
            "Excellent",
            "Perfect",
            "Amazing!",
            "So helpful",
        ]

        medium_comments = [
            "This is really helpful, thanks for sharing",
            "I learned a lot from this",
            "Great explanation, very clear",
            "Thanks for making this available",
            "This is exactly what I needed",
            "Really enjoyed watching this",
            "Great content, keep it up",
            "Very informative, thank you",
            "This helped me understand the topic better",
            "Clear and concise explanation",
        ]

        long_comments = [
            "This is exactly what I was looking for. The explanation is clear and the examples are helpful. Keep up the great work!",
            "Really appreciate you taking the time to create this. It's been very useful for my project. Thank you!",
            "Excellent video with great detail. I especially liked the part about {topic}. Looking forward to more content like this.",
            "This is one of the best explanations I've seen on this topic. The step-by-step approach makes it easy to follow along.",
            "Thank you for sharing your knowledge. This has been incredibly helpful and I've learned a lot from it.",
        ]

        # Choose comment length
        rand = random.random()
        if rand < 0.4:  # 40% short
            text = random.choice(short_comments)
        elif rand < 0.8:  # 40% medium
            text = random.choice(medium_comments)
        else:  # 20% long
            text = random.choice(long_comments)
            # Replace {topic} placeholder if present
            if '{topic}' in text and media_title:
                # Extract a word from media title as topic
                words = media_title.split()
                topic = words[0] if words else "this topic"
                text = text.replace('{topic}', topic)

        # Ensure text doesn't exceed MAX_CHARS_FOR_COMMENT
        max_chars = getattr(settings, 'MAX_CHARS_FOR_COMMENT', 5000)
        if len(text) > max_chars:
            text = text[:max_chars]

        return text

    def generate_playlist_title(self):
        """Generate a random playlist title"""
        playlist_templates = [
            "My {topic} Collection",
            "{topic} Playlist",
            "Best of {topic}",
            "Favorite {topic} Videos",
            "Complete {topic} Series",
            "Top {topic} Content",
            "{topic} Essentials",
            "Amazing {topic} Selection",
            "{topic} Highlights",
            "Curated {topic} Playlist",
        ]

        topics = [
            'Video Editing',
            'Photography',
            'Music Production',
            'Coding',
            'Design',
            'Cooking',
            'Fitness',
            'Travel',
            'Gaming',
            'Technology',
            'Business',
            'Education',
            'Science',
            'Art',
            'Sports',
            'Entertainment',
        ]

        template = random.choice(playlist_templates)
        topic = random.choice(topics)
        title = template.format(topic=topic)

        # Sometimes add a number or extra text
        if random.random() < 0.2:
            title = f"{title} {random.randint(1, 5)}"

        return title[:100]  # Max 100 chars

    def create_media_record(self, users, fixture_files, index):
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

        # Generate basic fields
        title = self.generate_title()
        description = self.generate_description()

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

        description_parts = [
            "A curated collection of great content.",
            "Handpicked selection of the best media.",
            "My personal favorites in this category.",
            "Essential viewing for anyone interested in this topic.",
            "A comprehensive collection covering various aspects.",
        ]

        for i in range(num_playlists):
            # Select a random user (some users may get multiple playlists)
            user = random.choice(users)

            title = self.generate_playlist_title()
            description = random.choice(description_parts)

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
        """Ensure a couple of CMS pages exist for the enhanced dashboard."""
        pages_spec = [
            {
                'slug': 'about',
                'title': 'About',
                'description': ('<p>Welcome to this MediaCMS demo portal.</p>' '<p>This About page was created by the fake media generator for dashboard testing.</p>'),
            },
            {
                'slug': 'faq',
                'title': 'FAQ',
                'description': (
                    '<h2>Frequently Asked Questions</h2>'
                    '<p><strong>How do I upload media?</strong> Use the upload page after signing in.</p>'
                    '<p><strong>Who can view private media?</strong> Owners and users with explicit share permissions.</p>'
                ),
            },
        ]

        pages = []
        for spec in pages_spec:
            page, created = Page.objects.get_or_create(
                slug=spec['slug'],
                defaults={
                    'title': spec['title'],
                    'description': spec['description'],
                },
            )
            if created:
                page_date = self._random_datetime_between(self._horizon_start, self._now)
                self._backdate(Page, page.pk, 'add_date', page_date)
                page.add_date = page_date
            pages.append(page)
        return pages

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
        subtitle_count=0,
        chapter_count=0,
        permission_count=0,
        trim_request_count=0,
        pages=None,
    ):
        """Display summary statistics"""
        if pages is None:
            pages = []
        if channels is None:
            channels = []

        self.stdout.write(self.style.SUCCESS('\n' + '=' * 60))
        self.stdout.write(self.style.SUCCESS('SUMMARY STATISTICS'))
        self.stdout.write(self.style.SUCCESS('=' * 60))

        # Basic counts
        self.stdout.write(f'\nTotal media created: {len(created_media)}')
        self.stdout.write(f'Total users: {len(users)}')
        self.stdout.write(f'Total channels: {len(channels)}')
        self.stdout.write(f'Total tags: {len(tags)}')
        self.stdout.write(f'Total categories: {len(categories)}')
        self.stdout.write(f'Total playlists: {len(playlists)}')
        self.stdout.write(f'Total comments: {len(comments)}')
        self.stdout.write(f'Reported media: {len(reported_media)}')
        self.stdout.write(f'Subtitles created: {subtitle_count}')
        self.stdout.write(f'Chapter sets created: {chapter_count}')
        self.stdout.write(f'Media permissions created: {permission_count}')
        self.stdout.write(f'Video trim requests created: {trim_request_count}')
        self.stdout.write(f'CMS pages: {len(pages)}')
        if pages:
            for page in pages:
                self.stdout.write(f'  /{page.slug} — {page.title}')

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
