from django.core.management.base import BaseCommand
from django.db.models import Q

from users.models import DEFAULT_LOGO, User


class Command(BaseCommand):
    help = "Create a letter cloud logo for users that have no logo set"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="List the users that would get a logo and exit")
        parser.add_argument("--limit", type=int, default=0, help="Stop after this many users")
        parser.add_argument("--username", default="", help="One user's username, to try a single user first")

    def handle(self, *args, **options):
        users = User.objects.filter(Q(logo="") | Q(logo__isnull=True) | Q(logo=DEFAULT_LOGO)).order_by("id")
        if options["username"]:
            users = users.filter(username=options["username"])

        total = users.count()
        self.stdout.write(f"{total} users have no logo")
        if options["limit"]:
            users = users[: options["limit"]]

        if options["dry_run"]:
            for user in users:
                self.stdout.write(f"  would create a logo for {user.username} ({user.name})")
            return

        done, skipped = 0, 0
        for user in users.iterator():
            if user.set_letter_cloud_logo():
                user.save(update_fields=["logo"])
                done += 1
                self.stdout.write(f"  done {user.username}")
            else:
                skipped += 1
                self.stderr.write(self.style.WARNING(f"  skipped {user.username}, no font has the letters of {user.name or user.username!r}"))

        self.stdout.write(self.style.SUCCESS(f"{done} logos created, {skipped} skipped"))
