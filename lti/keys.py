"""
LTI Key Management for MediaCMS

Manages RSA keys for signing Deep Linking responses (stored in database)
"""


def load_public_key():
    """Load public key from database"""
    from .models import LTIToolKeys

    key_obj = LTIToolKeys.get_or_create_keys()
    return key_obj.public_key_jwk


def get_jwks():
    """
    Get JWKS (JSON Web Key Set) for public keys

    Returns public keys in JWKS format for the /lti/jwks/ endpoint
    """
    public_key = load_public_key()
    return {'keys': [public_key]}


def ensure_keys_exist():
    """Ensure key pair exists in database, generate if not"""
    from .models import LTIToolKeys

    LTIToolKeys.get_or_create_keys()
