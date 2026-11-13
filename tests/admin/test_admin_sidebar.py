from django.test import TestCase, override_settings

from admin_customizations.sidebar import build_workflow_app_list


def _model(app_label, object_name, name=None, admin_url="/admin/"):
    return {
        "name": name or object_name,
        "object_name": object_name,
        "admin_url": admin_url,
        "view_only": False,
        "perms": {"add": True, "change": True, "delete": True, "view": True},
        "_app_label": app_label,
    }


def _raw_app_list(models):
    apps = {}
    for model in models:
        app_label = model.pop("_app_label")
        apps.setdefault(app_label, {"name": app_label, "app_label": app_label, "app_url": "#", "has_module_perms": True, "models": []})
        apps[app_label]["models"].append(model)
    return list(apps.values())


class BuildWorkflowAppListTest(TestCase):
    def test_groups_models_by_workflow(self):
        raw = _raw_app_list(
            [
                _model("files", "Media", admin_url="/admin/files/media/"),
                _model("files", "Comment"),
                _model("actions", "MediaAction"),
                _model("files", "Category"),
                _model("files", "Encoding"),
                _model("users", "User"),
                _model("users", "Channel"),
                _model("account", "EmailAddress"),
                _model("files", "Page"),
                _model("migrationservice", "MigrationService"),
                _model("lti", "LTIPlatform"),
                _model("files", "TinyMCEMedia"),
            ]
        )
        apps = {app["app_label"]: [m["object_name"] for m in app["models"]] for app in build_workflow_app_list(raw)}

        self.assertEqual(
            list(apps),
            ["moderation", "library", "processing", "people", "integrations", "site"],
        )
        self.assertEqual(apps["moderation"][0], "ModerationOverview")
        self.assertIn("ReportedMedia", apps["moderation"])
        self.assertIn("MediaAction", apps["moderation"])
        self.assertIn("Comment", apps["moderation"])
        self.assertEqual(apps["library"][:3], ["LibraryOverview", "EngagementOverview", "Media"])
        self.assertIn("Category", apps["library"])
        self.assertIn("Channel", apps["library"])
        self.assertEqual(apps["processing"][0], "ProcessingOverview")
        self.assertIn("EncodingQueue", apps["processing"])
        self.assertIn("Encoding", apps["processing"])
        self.assertEqual(apps["people"][0], "PeopleOverview")
        self.assertEqual(apps["people"][1:], ["User", "EmailAddress"])
        self.assertEqual(
            apps["site"][:5],
            ["SiteOverview", "SiteHealth", "SiteConfiguration", "SiteSystem", "Page"],
        )
        self.assertEqual(apps["integrations"][0], "IntegrationsOverview")
        self.assertEqual(apps["integrations"][1:], ["MigrationService"])
        self.assertNotIn("TinyMCEMedia", apps["site"])
        self.assertNotIn("LTIPlatform", apps["integrations"])

    @override_settings(MEDIA_IS_REVIEWED=True, USERS_NEEDS_TO_BE_APPROVED=True, USE_LTI=True, USE_RBAC=True, USE_SAML=True, USE_IDENTITY_PROVIDERS=True)
    def test_feature_flags_control_queue_links_and_integrations(self):
        raw = _raw_app_list(
            [
                _model("files", "Media"),
                _model("users", "User"),
                _model("rbac", "RBACGroup"),
                _model("socialaccount", "SocialApp"),
                _model("identity_providers", "LoginOption"),
                _model("saml_auth", "SAMLConfiguration"),
                _model("lti", "LTIPlatform"),
            ]
        )
        apps = {app["app_label"]: [m["object_name"] for m in app["models"]] for app in build_workflow_app_list(raw)}

        self.assertNotIn("NeedsReview", apps["moderation"])
        self.assertIn("WaitingForApproval", apps["people"])
        self.assertIn("RBACGroup", apps["people"])
        self.assertEqual(apps["integrations"][0], "IntegrationsOverview")
        self.assertIn("SocialApp", apps["integrations"])
        self.assertIn("LoginOption", apps["integrations"])
        self.assertIn("SAMLConfiguration", apps["integrations"])
        self.assertIn("LTIPlatform", apps["integrations"])
