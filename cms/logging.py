import logging

class RequestInfoFilter(logging.Filter):
    """
    Ensure that every log record has user/session attributes so that
    our formatter with %(user_id)s, %(username)s, %(session_key)s
    doesn't crash when they are missing.
    """

    def filter(self, record):
        if not hasattr(record, "user_id"):
            record.user_id = "-"
        if not hasattr(record, "username"):
            record.username = "-"
        if not hasattr(record, "session_key"):
            record.session_key = "-"
        return True

