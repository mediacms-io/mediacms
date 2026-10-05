import base64
import json
import time
import uuid
from unittest import mock

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from jwcrypto import jwk

from lti.models import LTIPlatform, LTIToolKeys

ISSUER = "https://lms.example.com"
CLIENT_ID = "mediacms-client"
DEPLOYMENT_ID = "deployment-1"
PLATFORM_KID = "platform-key-1"
KEY_SET_URL = ISSUER + "/mod/lti/certs.php"
AUTH_LOGIN_URL = ISSUER + "/mod/lti/auth.php"
AUTH_TOKEN_URL = ISSUER + "/mod/lti/token.php"
TARGET_LINK_URI = "http://testserver/lti/launch/"

CLAIM = "https://purl.imsglobal.org/spec/lti/claim/"
DL_CLAIM = "https://purl.imsglobal.org/spec/lti-dl/claim/"
LIS_MEMBERSHIP = "http://purl.imsglobal.org/vocab/lis/v2/membership#"

PLATFORM_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
FORGED_PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def public_jwks(private_key=PLATFORM_PRIVATE_KEY, kid=PLATFORM_KID):
    pem = private_key.public_key().public_bytes(encoding=serialization.Encoding.PEM, format=serialization.PublicFormat.SubjectPublicKeyInfo)
    key = json.loads(jwk.JWK.from_pem(pem).export_public())
    key.update(kid=kid, alg="RS256", use="sig")
    return {"keys": [key]}


def mock_platform_jwks(jwks=None):
    response = mock.Mock(**{"json.return_value": jwks or public_jwks()})
    return mock.patch("requests.Session.get", return_value=response)


def create_platform(name=None, platform_id=ISSUER, client_id=CLIENT_ID, **fields):
    defaults = {
        "auth_login_url": AUTH_LOGIN_URL,
        "auth_token_url": AUTH_TOKEN_URL,
        "key_set_url": KEY_SET_URL,
        "deployment_ids": [DEPLOYMENT_ID],
    }
    defaults.update(fields)
    return LTIPlatform.objects.create(name=name or f"Moodle {uuid.uuid4().hex[:8]}", platform_id=platform_id, client_id=client_id, **defaults)


def launch_claims(nonce=None, sub="lti-user-1", message_type="LtiResourceLinkRequest", roles=None, context=None, custom=None, **extra):
    now = int(time.time())
    claims = {
        "iss": ISSUER,
        "aud": CLIENT_ID,
        "sub": sub,
        "iat": now,
        "exp": now + 600,
        "nonce": nonce or uuid.uuid4().hex,
        "email": "jane.doe@school.example.com",
        "given_name": "Jane",
        "family_name": "Doe",
        "name": "Jane Doe",
        CLAIM + "message_type": message_type,
        CLAIM + "version": "1.3.0",
        CLAIM + "deployment_id": DEPLOYMENT_ID,
        CLAIM + "target_link_uri": TARGET_LINK_URI,
        CLAIM + "resource_link": {"id": "resource-link-1", "title": "Week 1 video"},
        CLAIM + "roles": [LIS_MEMBERSHIP + "Learner"] if roles is None else roles,
        CLAIM + "context": context or {"id": "course-42", "title": "Biology 101", "label": "BIO101"},
    }
    if custom is not None:
        claims[CLAIM + "custom"] = custom
    claims.update(extra)
    return claims


def deep_linking_settings(**overrides):
    settings = {
        "deep_link_return_url": ISSUER + "/mod/lti/contentitem_return.php",
        "accept_types": ["ltiResourceLink"],
        "accept_presentation_document_targets": ["iframe", "window"],
        "data": "opaque-platform-data",
    }
    settings.update(overrides)
    return settings


def mint_id_token(claims, private_key=PLATFORM_PRIVATE_KEY, kid=PLATFORM_KID):
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": kid})


def encode_state(data):
    return base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")


def decode_state(state):
    return json.loads(base64.urlsafe_b64decode(state + "=" * (-len(state) % 4)).decode())


def encode_publishdata(courses):
    return base64.b64encode(json.dumps(courses).encode()).decode().rstrip("=")


def tool_public_key():
    public_jwk = LTIToolKeys.get_or_create_keys().public_key_jwk
    return serialization.load_pem_public_key(jwk.JWK(**public_jwk).export_to_pem())
