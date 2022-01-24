from storages.backends.s3boto3 import S3Boto3Storage
from django.conf import settings
import os
class MediaStorage(S3Boto3Storage):
    location = settings.MEDIA_LOCATION
    file_overwrite = False

    default_acl = 'public-read'

    def __init__(self, *args, **kwargs):
        super(MediaStorage, self).__init__(*args,**kwargs)


    def join_path(self, path='/'):
        if path.startswith(self.location):
            return path
        else:
            return os.path.join(self.location, path)

    def path(self, p='/'):
        return self.join_path(p)

    def exact_in(self, p='/'):
        print("Running exact_in - Looking for '" + str(self.location) + "' in '" + str(p) +"'")
        if p.startswith(self.location):
            return p[p.index(self.location)+len(self.location):]
        else:
            return p
    
    def _open(self, *args, **kwargs):
        while len(args) >= 1 and str(args[0]).startswith(self.location):
            args[0] = self.exact_in(args[0])

        while len(args) >= 2 and str(args[1]).startswith(self.location):
            args[1] = self.exact_in(args[1])
        return super(MediaStorage, self)._open(*args, **kwargs)

class StaticMediaStorage(S3Boto3Storage):
    location = settings.AWS_LOCATION
    default_acl = 'public-read'

    def join_path(self, path='/'):
        if path.startswith(self.location):
            return path
        else:
            return os.path.join(self.location, path)

    def path(self, p='/'):
        return self.join_path(p)

class PrivateMediaStorage(S3Boto3Storage):
    location = settings.AWS_PRIVATE_MEDIA_LOCATION
    default_acl = 'private'
    file_overwrite = False
    custom_domain = False

