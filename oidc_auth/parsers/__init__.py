"""
Public API for OIDC scope parsers.

Each parser is a callable with the signature:

    parser_fn(user, raw_value, social_app, oidc_configuration, **parser_options)

Built-in parsers
----------------
  handle_role_mapping_pairs  — oidc_auth.parsers.role_mapping
  sync_profile_picture       — oidc_auth.parsers.profile_picture

Re-exports below keep backwards-compatible dotted-path references such as
``oidc_auth.parsers.handle_role_mapping_pairs`` working when stored in
OIDCScopeConfig.parser or OIDC_PROVIDERS settings.
"""

from oidc_auth.parsers.ietf_role_mapping import _parse_role_pairs, handle_ietf_role_mapping
from oidc_auth.parsers.profile_picture import sync_profile_picture

__all__ = [
    "handle_ietf_role_mapping",
    "sync_profile_picture",
    "_parse_role_pairs",
]
