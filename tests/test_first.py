from django.test import TestCase

from users.models import User


class UserTests(TestCase):
    def setUp(self):
        user = User.objects.create(username='markos', email='sap@ios.gr')
        user = User.objects.create(username='nikos', email='sap@ios.agr')
    
    def test_users(self):
        self.assertEqual(User.objects.filter().count(), 2, 'prb')   
        self.assertEqual(User.objects.filter().count(), 22, 'problem') 
