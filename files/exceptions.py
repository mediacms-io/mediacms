class VideoEncodingError(Exception):
    def __init__(self, *args, **kwargs):
        self.message = args[0]
        super(VideoEncodingError, self).__init__(*args, **kwargs)
