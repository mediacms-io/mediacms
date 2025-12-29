"""
LTI Key Management for MediaCMS

Manages RSA keys for signing Deep Linking responses (stored in database)
"""

from jwcrypto import jwk


def load_private_key():
    """Load private key from database and convert to PEM format for PyJWT"""
    from .models import LTIToolKeys

    key_obj = LTIToolKeys.get_or_create_keys()

    # Convert JWK dict to PEM string (PyJWT needs PEM format)
    jwk_obj = jwk.JWK(**key_obj.private_key_jwk)
    pem_bytes = jwk_obj.export_to_pem(private_key=True, password=None)

    return pem_bytes.decode('utf-8')


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
