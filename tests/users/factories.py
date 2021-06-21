import factory
from django.conf import settings
from faker import Faker

fake = Faker()
User = settings.AUTH_USER_MODEL


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User

    description = fake.paragraph(nb_sentences=4)
    name = fake.name()
    is_editor = True
