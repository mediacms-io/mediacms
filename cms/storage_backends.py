from storages.backends.s3boto3 import S3Boto3Storage
from django.conf import settings
import os
class MediaStorage(S3Boto3Storage):
    location = settings.MEDIA_LOCATION
    file_overwrite = False

    default_acl = 'public-read'

    def __init__(self, *args, **kwargs):
        super(MediaStorage, self).__init__(*args,**kwargs)

    def join_path(self, p='/'):
        return os.path.join(self.location, p)
    
    def path(self, p='/'):
        return self.join_path(p)

class StaticMediaStorage(S3Boto3Storage):
    location = settings.AWS_LOCATION
    default_acl = 'public-read'

    def join_path(self, path='/'):
        return os.path.join(self.location, path)

    def path(self, p='/'):
        return self.join_path(p)
        
class PrivateMediaStorage(S3Boto3Storage):
    location = settings.AWS_PRIVATE_MEDIA_LOCATION
    default_acl = 'private'
    file_overwrite = False
    custom_domain = False

