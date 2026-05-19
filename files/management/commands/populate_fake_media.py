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
from files.models import Category, Comment, Media, Playlist, PlaylistMedia, Tag
from users.models import User


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

        # Clear existing media if requested
        if clear_existing:
            self.stdout.write('Clearing existing media...')
            Media.objects.all().delete()
            self.stdout.write(self.style.SUCCESS('Cleared existing media'))

        # Step 1: Create users
        users = self.create_users()
        self.stdout.write(self.style.SUCCESS(f'Created {len(users)} users'))

        # Step 2: Setup tags and categories
        tags = self.setup_tags(users)
        categories = self.setup_categories()
        self.stdout.write(self.style.SUCCESS(f'Created {len(tags)} tags and {len(categories)} categories'))

        # Step 3: Get fixture files
        fixture_files = self.get_fixture_files()
        if not fixture_files:
            self.stdout.write(self.style.ERROR('No fixture files found. Please ensure fixture files exist.'))
            return

        # Step 4: Generate media records
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

        # Step 5: Create playlists and assign media
        playlists = self.create_playlists(users)
        self.stdout.write(self.style.SUCCESS(f'Created {len(playlists)} playlists'))

        self.assign_media_to_playlists(created_media, playlists)
        self.stdout.write(self.style.SUCCESS('Assigned media to playlists'))

        # Step 6: Create MediaAction records (reports, likes, dislikes, watches)
        self.create_media_actions(created_media, reported_media, users)
        self.stdout.write(self.style.SUCCESS('Created MediaAction records'))

        # Step 7: Create comments
        comments = self.create_comments(created_media, users)
        self.stdout.write(self.style.SUCCESS(f'Created {len(comments)} comments'))

        # Step 8: Update reported_times for reported media
        for media in reported_media:
            report_count = MediaAction.objects.filter(media=media, action='report').count()
            media.reported_times = report_count
            media.save(update_fields=['reported_times'])

        # Step 9: Post-processing
        self.post_process(created_media, tags, categories)

        # Step 10: Display summary
        self.display_summary(created_media, users, tags, categories, reported_media, playlists, comments)

        self.stdout.write(self.style.SUCCESS(f'\nSuccessfully populated {count} fake media records!'))

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
        """Create 10-15 fake users"""
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

            user = User.objects.create(
                username=username,
                email=email,
                name=name,
                description=f"Fake user account for testing purposes. User #{i + 1}",
                is_editor=is_editor,
                is_manager=is_manager,
            )
            user.set_password('testpass123')  # Simple password for all fake users
            user.save()
            users.append(user)

        return users

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

        # List of fixture files to look for
        files_to_check = [
            'test_image.png',
            'test_image2.jpg',
            'small_video.mp4',
            'medium_video.mp4',
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
        elif ext == '.pdf':
            media_type = 'pdf'
        else:
            media_type = 'video'  # default

        # Generate basic fields
        title = self.generate_title()
        description = self.generate_description()

        # Random add date (past 6 months)
        days_ago = random.randint(0, 180)
        add_date = timezone.now() - timedelta(days=days_ago)

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
            # Recalculate listable based on our desired encoding_status
            media.listable = state == 'public' and encoding_status == 'success' and is_reviewed
            media.save(update_fields=['state', 'encoding_status', 'listable'])

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
            playlists.append(playlist)

        return playlists

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
                PlaylistMedia.objects.create(
                    playlist=playlist,
                    media=media,
                    ordering=order,
                )

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

                        PlaylistMedia.objects.create(
                            playlist=playlist,
                            media=media,
                            ordering=max_ordering + 1,
                        )

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
                user = random.choice(users) if random.random() < 0.7 else None
                MediaAction.objects.create(
                    media=media,
                    user=user,
                    action='watch',
                )

            # Create like actions
            num_likes = min(media.likes, 50)  # Create up to 50 like actions
            for _ in range(num_likes):
                user = random.choice(users) if random.random() < 0.8 else None
                MediaAction.objects.create(
                    media=media,
                    user=user,
                    action='like',
                )

            # Create dislike actions
            num_dislikes = min(media.dislikes, 20)  # Create up to 20 dislike actions
            for _ in range(num_dislikes):
                user = random.choice(users) if random.random() < 0.7 else None
                MediaAction.objects.create(
                    media=media,
                    user=user,
                    action='dislike',
                )

        # Create report actions for reported media
        for media in reported_media:
            # 1-10 reports per media
            num_reports = random.randint(1, 10)
            for _ in range(num_reports):
                user = random.choice(users) if random.random() < 0.6 else None
                reason = random.choice(report_reasons)
                MediaAction.objects.create(
                    media=media,
                    user=user,
                    action='report',
                    extra_info=reason,
                )

    def create_comments(self, created_media, users):
        """Create comments with realistic distribution"""
        # Filter media where comments are enabled
        media_with_comments = [m for m in created_media if m.enable_comments]

        if not media_with_comments:
            return []

        all_comments = []
        media_comment_counts = {}

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

            media_comment_counts[media] = num_comments
            comments_for_media = []

            # Calculate time range for comments (spread over time since media creation)
            media_age_days = (timezone.now() - media.add_date).days
            if media_age_days < 1:
                media_age_days = 1

            # Create comments
            for i in range(num_comments):
                # Random user (can be media owner or other users)
                comment_user = random.choice(users)

                # Generate comment text
                comment_text = self.generate_comment_text(media.title)

                # Calculate comment date (spread over time since media creation)
                # More recent comments for active media
                if num_comments > 10:
                    # Very active media: more recent comments
                    days_ago = random.randint(0, min(media_age_days, 30))
                else:
                    # Less active: spread more evenly
                    days_ago = random.randint(0, media_age_days)

                comment_date = media.add_date + timedelta(days=days_ago)
                # Ensure comment date is not in the future
                if comment_date > timezone.now():
                    comment_date = timezone.now()

                # Create comment
                comment = Comment(
                    media=media,
                    user=comment_user,
                    text=comment_text,
                    add_date=comment_date,
                )
                comments_for_media.append(comment)

            # Save comments (MPTT models need individual saves)
            for comment in comments_for_media:
                comment.save()
                all_comments.append(comment)

            # Create nested/reply comments for media with 5+ comments
            if num_comments >= 5:
                # 10-30% of comments are replies
                num_replies = int(num_comments * random.uniform(0.1, 0.3))
                if num_replies > 0:
                    # Get top-level comments (no parent)
                    top_level_comments = [c for c in comments_for_media if c.parent is None]
                    if top_level_comments:
                        # Select random comments to reply to
                        parent_comments = random.sample(top_level_comments, min(num_replies, len(top_level_comments)))

                        for parent_comment in parent_comments:
                            # Create reply
                            reply_user = random.choice(users)
                            reply_text = self.generate_comment_text(media.title)

                            # Reply date should be after parent comment
                            days_after_parent = random.randint(0, min(7, media_age_days))
                            reply_date = parent_comment.add_date + timedelta(days=days_after_parent)
                            if reply_date > timezone.now():
                                reply_date = timezone.now()

                            reply = Comment(
                                media=media,
                                user=reply_user,
                                text=reply_text,
                                parent=parent_comment,
                                add_date=reply_date,
                            )
                            reply.save()
                            all_comments.append(reply)

        return all_comments

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

    def display_summary(self, created_media, users, tags, categories, reported_media, playlists, comments):
        """Display summary statistics"""
        self.stdout.write(self.style.SUCCESS('\n' + '=' * 60))
        self.stdout.write(self.style.SUCCESS('SUMMARY STATISTICS'))
        self.stdout.write(self.style.SUCCESS('=' * 60))

        # Basic counts
        self.stdout.write(f'\nTotal media created: {len(created_media)}')
        self.stdout.write(f'Total users: {len(users)}')
        self.stdout.write(f'Total tags: {len(tags)}')
        self.stdout.write(f'Total categories: {len(categories)}')
        self.stdout.write(f'Total playlists: {len(playlists)}')
        self.stdout.write(f'Total comments: {len(comments)}')
        self.stdout.write(f'Reported media: {len(reported_media)}')

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
