import factory
from faker import Faker

from django.conf import settings

fake = Faker()
User = settings.AUTH_USER_MODEL

class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    description = fake.paragraph(nb_sentences=4)
    name = fake.name()
    is_editor = 'True'