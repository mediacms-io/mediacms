"""Workflow-oriented Django admin sidebar grouping for Jazzmin."""

from django.conf import settings


def _queue_link(name, object_name, admin_url, icon=None):
    """Build a side-menu entry that points at a filtered changelist."""
    item = {
        "name": name,
        "object_name": object_name,
        "admin_url": admin_url,
        "view_only": True,
        "perms": {"add": False, "change": False, "delete": False, "view": True},
    }
    if icon:
        item["icon"] = icon
    return item


def _take(index, app_label, object_name):
    return index.get((app_label, object_name))


def _extend(target, index, keys):
    for app_label, object_name in keys:
        model = _take(index, app_label, object_name)
        if model:
            target.append(model)


def _group(name, app_label, models, icon=None):
    if not models:
        return None
    group = {
        "name": name,
        "app_label": app_label,
        "app_url": "#",
        "has_module_perms": True,
        "models": models,
    }
    if icon:
        group["icon"] = icon
    return group


def build_workflow_app_list(raw_app_list):
    """Rebuild admin app_list into Moderation / Library / Processing / People / Integrations / Site."""
    index = {}
    for app in raw_app_list:
        for model in app.get("models", []):
            index[(app["app_label"], model["object_name"])] = model

    groups = []

    moderation_models = []
    if _take(index, "files", "Media"):
        moderation_models.append(
            _queue_link(
                "Reported media",
                "ReportedMedia",
                "/admin/files/media/?reported=yes",
            )
        )
        moderation_models.append(
            _queue_link(
                "Above report limit",
                "AboveReportLimit",
                "/admin/files/media/?reported=threshold",
            )
        )
        if not getattr(settings, "MEDIA_IS_REVIEWED", True):
            moderation_models.append(
                _queue_link(
                    "Needs review",
                    "NeedsReview",
                    "/admin/files/media/?is_reviewed__exact=0",
                )
            )
    _extend(moderation_models, index, [("actions", "MediaAction"), ("files", "Comment")])
    if moderation_models:
        moderation_models.insert(
            0,
            _queue_link("Overview", "ModerationOverview", "/admin/dashboard/moderation/"),
        )
    group = _group("Moderation", "moderation", moderation_models)
    if group:
        groups.append(group)

    library_models = []
    _extend(
        library_models,
        index,
        [
            ("files", "Media"),
            ("files", "Category"),
            ("files", "Tag"),
            ("files", "Playlist"),
            ("users", "Channel"),
        ],
    )
    if library_models:
        library_models.insert(0, _queue_link("Overview", "LibraryOverview", "/admin/dashboard/library/"))
        library_models.insert(1, _queue_link("Engagement", "EngagementOverview", "/admin/dashboard/engagement/"))
    group = _group("Library", "library", library_models)
    if group:
        groups.append(group)

    processing_models = []
    if _take(index, "files", "Media"):
        processing_models.append(
            _queue_link(
                "Encoding queue",
                "EncodingQueue",
                "/admin/files/media/?encoding_queue=yes",
            )
        )
        processing_models.append(
            _queue_link(
                "Failed encodings",
                "FailedEncodings",
                "/admin/files/media/?encoding_queue=fail",
            )
        )
    _extend(
        processing_models,
        index,
        [
            ("files", "Encoding"),
            ("files", "Subtitle"),
            ("files", "TranscriptionRequest"),
            ("files", "VideoTrimRequest"),
        ],
    )
    if processing_models:
        processing_models.insert(
            0,
            _queue_link("Overview", "ProcessingOverview", "/admin/dashboard/processing/"),
        )
    group = _group("Processing", "processing", processing_models)
    if group:
        groups.append(group)

    people_models = []
    _extend(people_models, index, [("users", "User")])
    if _take(index, "users", "User") and getattr(settings, "USERS_NEEDS_TO_BE_APPROVED", False):
        people_models.append(
            _queue_link(
                "Waiting for approval",
                "WaitingForApproval",
                "/admin/users/user/?is_approved__exact=0",
            )
        )
    _extend(people_models, index, [("account", "EmailAddress")])
    if getattr(settings, "USE_RBAC", False):
        _extend(people_models, index, [("rbac", "RBACGroup"), ("rbac", "RBACMembership")])
    if people_models:
        people_models.insert(0, _queue_link("Overview", "PeopleOverview", "/admin/dashboard/people/"))
    group = _group("People", "people", people_models)
    if group:
        groups.append(group)

    integrations_models = []
    if getattr(settings, "USE_IDENTITY_PROVIDERS", False):
        _extend(
            integrations_models,
            index,
            [
                ("socialaccount", "SocialApp"),
                ("socialaccount", "SocialAccount"),
                ("identity_providers", "LoginOption"),
                ("identity_providers", "IdentityProviderUserLog"),
            ],
        )
    if getattr(settings, "USE_SAML", False):
        _extend(integrations_models, index, [("saml_auth", "SAMLConfiguration")])
    if getattr(settings, "USE_LTI", False):
        _extend(
            integrations_models,
            index,
            [
                ("lti", "LTIPlatform"),
                ("lti", "LTIResourceLink"),
                ("lti", "LTIUserMapping"),
                ("lti", "LTIRoleMapping"),
                ("lti", "LTILaunchLog"),
                ("lti", "LTIToolKeys"),
            ],
        )
    _extend(
        integrations_models,
        index,
        [
            ("migrationservice", "MigrationService"),
            ("migrationservice", "MigrationRecord"),
        ],
    )
    if integrations_models:
        integrations_models.insert(
            0,
            _queue_link("Overview", "IntegrationsOverview", "/admin/dashboard/integrations/"),
        )
    group = _group("Integrations", "integrations", integrations_models)
    if group:
        groups.append(group)

    site_models = []
    _extend(
        site_models,
        index,
        [
            ("files", "Page"),
            ("files", "License"),
            ("files", "EncodeProfile"),
            ("files", "Language"),
            ("files", "MediaPermission"),
            ("sites", "Site"),
        ],
    )
    if site_models:
        site_models.insert(0, _queue_link("Overview", "SiteOverview", "/admin/dashboard/site/"))
        site_models.insert(1, _queue_link("Health", "SiteHealth", "/admin/dashboard/health/"))
        site_models.insert(2, _queue_link("Configuration", "SiteConfiguration", "/admin/dashboard/configuration/"))
        site_models.insert(3, _queue_link("System", "SiteSystem", "/admin/dashboard/system/"))
    group = _group("Site", "site", site_models)
    if group:
        groups.append(group)

    return groups
