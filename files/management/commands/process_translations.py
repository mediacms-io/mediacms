import importlib
import os
from collections import OrderedDict

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Process translation files to add missing keys and sort them'

    def handle(self, *args, **options):
        translations_dir = os.path.join(settings.BASE_DIR, 'files', 'frontend_translations')
        self.process_translation_files(translations_dir)
        self.stdout.write(self.style.SUCCESS('Successfully processed translation files'))

    def process_translation_files(self, translations_dir):
        files = os.listdir(translations_dir)
        files = [f for f in files if f.endswith('.py') and f not in ('__init__.py', 'en.py')]
        # Import the original English translations
        from files.frontend_translations.en import replacement_strings, translation_strings

        for file in files:
            file_path = os.path.join(translations_dir, file)
            module_name = f"files.frontend_translations.{file[:-3]}"

            module = importlib.import_module(module_name)

            translation_strings_wip = getattr(module, 'translation_strings', {})
            replacement_strings_wip = getattr(module, 'replacement_strings', {})

            for key in translation_strings:
                if key not in translation_strings_wip:
                    translation_strings_wip[key] = translation_strings[key]

            translation_strings_wip = OrderedDict(sorted(translation_strings_wip.items()))

            for key in replacement_strings:
                if key not in replacement_strings_wip:
                    replacement_strings_wip[key] = replacement_strings[key]

            replacement_strings_wip = OrderedDict(sorted(replacement_strings_wip.items()))

            with open(file_path, 'w') as f:
                f.write("translation_strings = {\n")
                for key, value in translation_strings_wip.items():
                    f.write(f'    "{key}": "{value}",\n')
                f.write("}\n\n")

                f.write("replacement_strings = {\n")
                for key, value in replacement_strings_wip.items():
                    f.write(f'    "{key}": "{value}",\n')
                f.write("}\n")

            self.stdout.write(self.style.SUCCESS(f'Processed {file}'))
