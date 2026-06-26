import logging

from rbac.models import RBACGroup, RBACMembership

logger = logging.getLogger(__name__)

_SEPARATOR = ":"

def handle_ietf_role_mapping(user, raw_value, social_app, oidc_configuration, **parser_options):
    """
    Map [role, group] claim pairs to a global role and RBAC group memberships.

    raw_value: list of [role, group] pairs as nested lists/tuples or
               pre-joined strings (e.g. ["chair:secretariat"]).

    parser_options:
      role_matcher (dict): maps combined pair strings to
          {"map_to": <role>, "groups": [<group names>]}.
          The first matching entry wins.
    """
    if not raw_value:
        return

    raw_roles = raw_value if isinstance(raw_value, list) else [raw_value]
    role_matcher = parser_options.get("role_matcher", {})
    pairs = _parse_role_pairs(raw_roles, _SEPARATOR)
    if not pairs:
        return

    # First matching combined role wins.
    extra_group_names = []
    matched_mapping = None
    combined_values = [p["combined"] for p in pairs]
    for combined_role in combined_values:
        mapping = role_matcher.get(combined_role)
        if mapping is None:
            continue
        matched_mapping = mapping
        extra_group_names = mapping.get("groups") or []
        try:
            user.set_role_from_mapping(mapping["map_to"])
        except Exception as exc:
            logger.error(
                "handle_ietf_role_mapping: set_role_from_mapping failed for user %s: %s",
                user.username, exc,
            )
        break  # first match wins

    if matched_mapping is None and role_matcher:
        is_privileged = any([user.is_superuser, user.is_staff, user.advancedUser, user.is_editor, user.is_manager])
        if is_privileged:
            logger.debug(
                "handle_ietf_role_mapping: no role match for user %s - resetting to base role",
                user.username,
            )
            try:
                user.set_role_from_mapping("user")
            except Exception as exc:
                logger.error(
                    "handle_ietf_role_mapping: set_role_from_mapping (base) failed for user %s: %s",
                    user.username, exc,
                )

    seen_groups = []
    if extra_group_names:
        found_groups = list(RBACGroup.objects.filter(
            identity_provider=social_app, name__in=extra_group_names
        ))
        found_names = {g.name for g in found_groups}
        missing = set(extra_group_names) - found_names
        if missing:
            logger.warning(
                "handle_ietf_role_mapping: groups %s not found in DB for social_app=%s"
                " - check that RBACGroup records exist with identity_provider set to this app",
                missing, social_app,
            )
        for rbac_group in found_groups:
            seen_groups.append(rbac_group)
            if not RBACMembership.objects.filter(user=user, rbac_group=rbac_group).exists():
                try:
                    RBACMembership.objects.create(user=user, rbac_group=rbac_group, role="member")
                    logger.debug(
                        "handle_ietf_role_mapping: subscribed user=%s to group=%s",
                        user.username, rbac_group.name,
                    )
                except Exception as exc:
                    logger.error(
                        "handle_ietf_role_mapping extra_group for user %s / group %s: %s",
                        user.username, rbac_group, exc,
                    )

    if oidc_configuration.remove_from_groups:
        for group in user.rbac_groups.filter(identity_provider=social_app):
            if group not in seen_groups:
                group.members.remove(user)


def _parse_role_pairs(raw_roles, separator=":"):
    """
    Parse [role, group] pairs into a list of dicts.

    Accepts:
      - nested lists/tuples: [["chair", "secretariat"], ...]
      - already-joined strings: ["chair:secretariat", ...]

    Returns list of {"role": str, "group": str, "combined": str}.
    Malformed entries are skipped with a debug log.
    """
    result = []
    for entry in raw_roles:
        try:
            if isinstance(entry, (list, tuple)):
                if len(entry) < 2:
                    logger.debug("_parse_role_pairs: skipping short entry %r", entry)
                    continue
                role, group = str(entry[0]).strip(), str(entry[1]).strip()
            elif isinstance(entry, str) and separator in entry:
                role, group = entry.split(separator, 1)
                role, group = role.strip(), group.strip()
            else:
                logger.debug("_parse_role_pairs: skipping unrecognised entry %r", entry)
                continue
            if role and group:
                result.append({"role": role, "group": group, "combined": f"{role}{separator}{group}"})
        except Exception as exc:
            logger.debug("_parse_role_pairs: error parsing entry %r: %s", entry, exc)
    return result
