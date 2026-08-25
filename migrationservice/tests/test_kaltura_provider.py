from unittest import mock

from django.test import TestCase

from migrationservice.providers import get_provider_class
from migrationservice.providers.kaltura import is_internal_role

CONNECTION = {
    "service_url": "https://kaltura.example.edu",
    "partner_id": "342",
    "app_token_id": "atok",
    "app_token": "the-secret",
    "kms_root_category": "MediaSpace",
}


def make_provider(options=None):
    klass = get_provider_class("kaltura")
    provider = klass(dict(CONNECTION), options or {})
    provider._client = mock.MagicMock()
    return provider


class TestKalturaProviderListing(TestCase):
    def test_media_phase_returns_entry_ids_and_cursor(self):
        provider = make_provider()
        provider._client.list_entries_page.return_value = (
            [{"id": "1_a"}, {"id": "1_b"}],
            {"created_at": 200, "seen_ids": ["1_b"]},
        )
        ids, cursor = provider.list_page("media", {}, 10)
        self.assertEqual(ids, ["1_a", "1_b"])
        self.assertEqual(cursor["created_at"], 200)

    def test_media_phase_passes_the_created_at_filters(self):
        provider = make_provider({"created_after": 1000, "created_before": 2000})
        provider._client.list_entries_page.return_value = ([], {})
        provider.list_page("media", {}, 10)
        kfilter = provider._client.list_entries_page.call_args[0][2]
        self.assertEqual(kfilter["createdAtGreaterThanOrEqual"], 1000)
        self.assertEqual(kfilter["createdAtLessThanOrEqual"], 2000)

    def test_the_user_restriction_is_off_by_default(self):
        provider = make_provider()
        provider._client.list_entries_page.return_value = ([], {})
        provider.list_page("media", {}, 10)
        kfilter = provider._client.list_entries_page.call_args[0][2]
        self.assertNotIn("userIdIn", kfilter)

    def test_listed_users_become_a_userIdIn_filter(self):
        provider = make_provider({"restrict_to_users": True, "source_user_ids": "jdoe@example.edu,5f2c1b9a"})
        provider._client.list_entries_page.return_value = ([], {})
        provider.list_page("media", {}, 10)
        kfilter = provider._client.list_entries_page.call_args[0][2]
        self.assertEqual(kfilter["userIdIn"], "jdoe@example.edu,5f2c1b9a")

    def test_a_list_is_cleaned_before_it_reaches_kaltura(self):
        provider = make_provider({"restrict_to_users": True, "source_user_ids": " jdoe , , jdoe ,asmith,"})
        provider._client.list_entries_page.return_value = ([], {})
        provider.list_page("media", {}, 10)
        self.assertEqual(provider._client.list_entries_page.call_args[0][2]["userIdIn"], "jdoe,asmith")

    def test_an_empty_list_never_sends_an_empty_filter(self):
        """Kaltura ignores a filter field it cannot use instead of rejecting it, so
        an empty userIdIn would widen a restricted run to the entire portal.
        """
        for raw in ["", "   ", ",", " , , "]:
            provider = make_provider({"restrict_to_users": True, "source_user_ids": raw})
            provider._client.list_entries_page.return_value = ([], {})
            provider.list_page("media", {}, 10)
            kfilter = provider._client.list_entries_page.call_args[0][2]
            self.assertNotIn("userIdIn", kfilter, f"an empty list ({raw!r}) produced a filter key")

    def test_the_list_is_ignored_while_the_option_is_off(self):
        provider = make_provider({"restrict_to_users": False, "source_user_ids": "jdoe"})
        provider._client.list_entries_page.return_value = ([], {})
        provider.list_page("media", {}, 10)
        self.assertNotIn("userIdIn", provider._client.list_entries_page.call_args[0][2])

    def test_unknown_phase_raises(self):
        provider = make_provider()
        with self.assertRaises(ValueError):
            provider.list_page("playlists", {}, 10)


class TestKalturaProviderFetching(TestCase):
    def test_fetch_media_bundles_entry_flavors_captions_and_categories(self):
        provider = make_provider()

        def fake_call(service, action, **params):
            if (service, action) == ("media", "get"):
                return {"id": "1_a", "name": "Lecture 4", "userId": "jdoe"}
            if (service, action) == ("flavorAsset", "getByEntryId"):
                return [{"id": "flav1", "height": 720, "fileExt": "mp4", "status": 2, "isOriginal": False}]
            if (service, action) == ("caption_captionasset", "list"):
                return {"objects": [{"id": "cap1", "languageCode": "da", "language": "Danish"}]}
            if (service, action) == ("categoryEntry", "list"):
                return {"objects": [{"categoryId": 8812}]}
            if (service, action) == ("category", "list"):
                return {"objects": [{"id": 8812, "name": "Electronics", "privacy": 1}]}
            raise AssertionError(f"unexpected call {service}.{action}")

        provider._client.call.side_effect = fake_call
        data = provider.fetch_media("1_a")
        self.assertEqual(data["entry"]["name"], "Lecture 4")
        self.assertEqual(len(data["flavors"]), 1)
        self.assertEqual(len(data["captions"]), 1)
        self.assertEqual(data["categories"][0]["privacy"], 1)

    def test_fetch_media_drops_flavors_that_are_not_ready(self):
        provider = make_provider()

        def fake_call(service, action, **params):
            if (service, action) == ("media", "get"):
                return {"id": "1_a"}
            if (service, action) == ("flavorAsset", "getByEntryId"):
                return [
                    {"id": "ok", "height": 720, "fileExt": "mp4", "status": 2},
                    {"id": "converting", "height": 360, "fileExt": "mp4", "status": 1},
                ]
            if (service, action) == ("caption_captionasset", "list"):
                return {"objects": []}
            if (service, action) == ("categoryEntry", "list"):
                return {"objects": []}
            raise AssertionError(f"unexpected call {service}.{action}")

        provider._client.call.side_effect = fake_call
        data = provider.fetch_media("1_a")
        self.assertEqual([flavor["id"] for flavor in data["flavors"]], ["ok"])

    def test_fetch_user_flattens_the_role_name(self):
        provider = make_provider()

        def fake_call(service, action, **params):
            if (service, action) == ("user", "get"):
                return {"id": "jdoe", "email": "jdoe@example.edu", "fullName": "J Doe", "roleIds": "17"}
            if (service, action) == ("userRole", "list"):
                return {"objects": [{"id": 17, "systemName": "adminRole"}]}
            raise AssertionError(f"unexpected call {service}.{action}")

        provider._client.call.side_effect = fake_call
        user = provider.fetch_user("jdoe")
        self.assertEqual(user["roleName"], "adminRole")

    def test_fetch_category_returns_the_path_and_privacy(self):
        provider = make_provider()

        def fake_call(service, action, **params):
            if (service, action) == ("category", "get"):
                return {"id": 8812, "name": "Electronics", "fullName": "MediaSpace>site>galleries>Eng>Electronics", "privacy": 3, "owner": "jdoe"}
            raise AssertionError(f"unexpected call {service}.{action}")

        provider._client.call.side_effect = fake_call
        category = provider.fetch_category("8812")
        self.assertEqual(category["parentName"], "Eng")
        self.assertEqual(category["privacy"], 3)

    def test_fetch_media_drops_flavors_that_are_not_ready_by_constant(self):
        from migrationservice.providers.kaltura import FLAVOR_STATUS_READY

        provider = make_provider()

        def fake_call(service, action, **params):
            if (service, action) == ("media", "get"):
                return {"id": "1_a"}
            if (service, action) == ("flavorAsset", "getByEntryId"):
                return [{"id": "ready", "height": 720, "fileExt": "mp4", "status": FLAVOR_STATUS_READY}]
            if (service, action) in (("caption_captionasset", "list"), ("categoryEntry", "list")):
                return {"objects": []}
            raise AssertionError(f"unexpected call {service}.{action}")

        provider._client.call.side_effect = fake_call
        data = provider.fetch_media("1_a")
        self.assertEqual([flavor["id"] for flavor in data["flavors"]], ["ready"])

    def test_fetch_user_stringifies_the_id(self):
        provider = make_provider()

        def fake_call(service, action, **params):
            if (service, action) == ("user", "get"):
                return {"id": 12345, "email": "n@example.edu", "fullName": "N", "roleIds": ""}
            raise AssertionError(f"unexpected call {service}.{action}")

        provider._client.call.side_effect = fake_call
        self.assertEqual(provider.fetch_user(12345)["id"], "12345")

    def test_download_flavor_resolves_the_url_then_streams_it(self):
        provider = make_provider()
        provider._client.call.return_value = "https://kaltura.example.edu/serve/flavor/1"
        with mock.patch.object(provider, "download", return_value=123) as download:
            written = provider.download_flavor({"id": "flav1"}, "/tmp/out.mp4")
        self.assertEqual(written, 123)
        download.assert_called_once_with("https://kaltura.example.edu/serve/flavor/1", "/tmp/out.mp4")

    def test_download_flavor_raises_when_no_url_comes_back(self):
        from migrationservice.providers.kaltura import KalturaAPIError

        provider = make_provider()
        provider._client.call.return_value = {"unexpected": "shape"}
        with self.assertRaises(KalturaAPIError):
            provider.download_flavor({"id": "flav1"}, "/tmp/out.mp4")


class TestCaptionServiceName(TestCase):
    """A real run against api.kltr.nordu.net failed every entry with
    SERVICE_DOES_NOT_EXISTS because "captionAsset" is not the service id: Kaltura
    namespaces plugin services, so it is "caption_captionasset".
    """

    def _provider(self):
        provider = make_provider()
        return provider

    def test_the_namespaced_caption_service_is_used(self):
        provider = self._provider()

        def fake_call(service, action, **params):
            if (service, action) == ("media", "get"):
                return {"id": "1_a"}
            if (service, action) == ("flavorAsset", "getByEntryId"):
                return []
            if (service, action) == ("caption_captionasset", "list"):
                return {"objects": [{"id": "cap1"}]}
            if (service, action) == ("categoryEntry", "list"):
                return {"objects": []}
            raise AssertionError(f"unexpected call {service}.{action}")

        provider._client.call.side_effect = fake_call
        data = provider.fetch_media("1_a")
        self.assertEqual([caption["id"] for caption in data["captions"]], ["cap1"])

    def test_a_partner_without_the_caption_plugin_still_imports_the_media(self):
        from migrationservice.providers.kaltura import KalturaAPIError

        provider = self._provider()

        def fake_call(service, action, **params):
            if (service, action) == ("media", "get"):
                return {"id": "1_a", "name": "Lecture"}
            if (service, action) == ("flavorAsset", "getByEntryId"):
                return [{"id": "f1", "height": 720, "fileExt": "mp4", "status": 2}]
            if service == "caption_captionasset":
                raise KalturaAPIError("SERVICE_DOES_NOT_EXISTS", 'Service "caption_captionasset" does not exists')
            if (service, action) == ("categoryEntry", "list"):
                return {"objects": []}
            raise AssertionError(f"unexpected call {service}.{action}")

        provider._client.call.side_effect = fake_call
        data = provider.fetch_media("1_a")
        self.assertEqual(data["captions"], [])
        self.assertEqual(data["entry"]["name"], "Lecture")
        self.assertEqual(len(data["flavors"]), 1)

    def test_any_other_caption_error_still_propagates(self):
        from migrationservice.providers.kaltura import KalturaAPIError

        provider = self._provider()

        def fake_call(service, action, **params):
            if (service, action) == ("media", "get"):
                return {"id": "1_a"}
            if (service, action) == ("flavorAsset", "getByEntryId"):
                return []
            if service == "caption_captionasset":
                raise KalturaAPIError("INTERNAL_SERVERL_ERROR", "boom")
            raise AssertionError(f"unexpected call {service}.{action}")

        provider._client.call.side_effect = fake_call
        with self.assertRaises(KalturaAPIError):
            provider.fetch_media("1_a")


class TestRestrictedConnectionCheck(TestCase):
    def test_a_restriction_with_no_usable_id_refuses_instead_of_counting_the_portal(self):
        """An empty list produces no filter, so a count taken with one would be the
        whole portal. Reporting that under a switched-on restriction reads as success.
        """
        for raw in ["", "   ", ","]:
            provider = make_provider({"restrict_to_users": True, "source_user_ids": raw})
            result = provider.check_connection()
            self.assertFalse(result["ok"], f"{raw!r} was answered with numbers")
            self.assertIn("at least one", result["error"])
            provider._client.check_connection.assert_not_called()

    def test_a_usable_restriction_asks_the_source(self):
        provider = make_provider({"restrict_to_users": True, "source_user_ids": "jdoe"})
        provider.check_connection()
        kwargs = provider._client.check_connection.call_args.kwargs
        self.assertEqual(kwargs["entry_filter"]["userIdIn"], "jdoe")
        self.assertEqual(kwargs["user_ids"], ["jdoe"])

    def test_an_unrestricted_check_asks_for_everything(self):
        provider = make_provider()
        provider.check_connection()
        kwargs = provider._client.check_connection.call_args.kwargs
        self.assertNotIn("userIdIn", kwargs["entry_filter"])
        self.assertEqual(kwargs["user_ids"], [])


class TestRoleListing(TestCase):
    """userRole.list returns Kaltura's own module roles mixed in with the ones an
    administrator assigns, and on a real portal the module roles outnumber them five to
    one. Only the assignable ones reach the mapping form.
    """

    ROLES = {
        "objects": [
            {"id": 1, "name": "Basic User Session Role", "systemName": "Basic User Session Role"},
            {"id": 2, "name": "Publisher Administrator", "systemName": "Publisher Administrator"},
            {"id": 13, "name": "Widget Session Role", "systemName": "WIDGET_SESSION_ROLE"},
            {"id": 783, "name": "No Session", "systemName": "No Session"},
            {"id": 863, "name": "KMS User role", "systemName": "KMS_USER_ROLE"},
            {"id": 1691, "name": "Manager", "systemName": "Manager"},
            {"id": 1695, "name": "kalturacapture Uploader 401kms1", "systemName": ""},
        ]
    }

    def test_only_assignable_roles_are_returned(self):
        provider = make_provider()
        provider._client.call.return_value = self.ROLES

        roles = provider.list_roles()

        self.assertEqual([role["id"] for role in roles], ["2", "1691"])
        self.assertEqual([role["name"] for role in roles], ["Publisher Administrator", "Manager"])

    def test_a_role_with_no_system_name_is_a_service_role(self):
        # an integration creates one of these per instance, they are never held by people
        self.assertTrue(is_internal_role(""))
        self.assertTrue(is_internal_role("   "))

    def test_a_screaming_snake_system_name_is_a_module_role(self):
        for system_name in ["WIDGET_SESSION_ROLE", "KMS_USER_ROLE", "EP_USER_ANALYTICS", "PLAYBACK_BASE_ROLE"]:
            self.assertTrue(is_internal_role(system_name), system_name)

    def test_roles_named_like_people_roles_are_kept(self):
        for system_name in ["Publisher Administrator", "Manager", "Content Uploader", "Player Designer"]:
            self.assertFalse(is_internal_role(system_name), system_name)

    def test_the_two_built_ins_named_like_people_roles_are_still_hidden(self):
        self.assertTrue(is_internal_role("Basic User Session Role"))
        self.assertTrue(is_internal_role("No Session"))


class TestCategorySelection(TestCase):
    """A chosen category brings its subtree, which is why the entry filter is
    categoryAncestorIdIn and not a membership filter. Verified against a live portal:
    a root reported 53 entries while holding none directly.
    """

    PORTAL = [
        {"id": 771961, "name": "MediaSpace", "fullName": "MediaSpace"},
        {"id": 771963, "name": "site", "fullName": "MediaSpace>site"},
        {"id": 771967, "name": "galleries", "fullName": "MediaSpace>site>galleries"},
        {"id": 839867, "name": "Academic Subjects", "fullName": "MediaSpace>site>galleries>Academic Subjects"},
        {"id": 900001, "name": "Physics", "fullName": "MediaSpace>site>galleries>Academic Subjects>Physics"},
        {"id": 839921, "name": "Math Lectures", "fullName": "MediaSpace>site>channels>Math Lectures"},
        {"id": 771964, "name": "private", "fullName": "MediaSpace>private"},
    ]

    def test_only_the_galleries_and_channels_are_offered(self):
        provider = make_provider()
        provider._client.call.return_value = {"objects": self.PORTAL}
        provider._client.count.return_value = 7

        offered = provider.list_categories()

        # not the instance root, not >site, not the galleries folder, not a subcategory,
        # and not KMS housekeeping
        self.assertEqual(
            [category["fullName"] for category in offered],
            ["MediaSpace>site>channels>Math Lectures", "MediaSpace>site>galleries>Academic Subjects"],
        )

    def test_the_count_offered_is_the_whole_subtree(self):
        provider = make_provider()
        provider._client.call.return_value = {"objects": self.PORTAL}
        provider._client.count.return_value = 21

        offered = provider.list_categories()

        self.assertEqual(offered[0]["entries"], 21)
        # counted by ancestor, so a subcategory's media are included
        kfilter = provider._client.count.call_args[0][1]
        self.assertIn("categoryAncestorIdIn", kfilter)

    def test_a_selection_filters_the_media_walk_by_ancestor(self):
        provider = make_provider({"source_category_ids": "839867, 839921"})
        provider._client.list_entries_page.return_value = ([], {})
        provider.list_page("media", {}, 10)

        kfilter = provider._client.list_entries_page.call_args[0][2]
        self.assertEqual(kfilter["categoryAncestorIdIn"], "839867,839921")

    def test_no_selection_sends_no_category_filter(self):
        for raw in ["", "   ", ","]:
            provider = make_provider({"source_category_ids": raw})
            provider._client.list_entries_page.return_value = ([], {})
            provider.list_page("media", {}, 10)
            kfilter = provider._client.list_entries_page.call_args[0][2]
            self.assertNotIn("categoryAncestorIdIn", kfilter, f"{raw!r} produced a filter")

    def test_a_top_level_category_on_a_portal_without_kms(self):
        provider = make_provider()
        provider._client.call.return_value = {
            "objects": [
                {"id": 1, "name": "Art", "fullName": "Art"},
                {"id": 2, "name": "Modern", "fullName": "Art>Modern"},
            ]
        }
        provider._client.count.return_value = 3

        offered = provider.list_categories()

        self.assertEqual([category["fullName"] for category in offered], ["Art"])
