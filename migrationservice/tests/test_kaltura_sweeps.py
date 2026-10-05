import os
import shutil
import tempfile
from unittest import mock

import requests
from django.test import SimpleTestCase, override_settings

from migrationservice.providers import kaltura
from migrationservice.providers.kaltura import (
    CATEGORY_USER_ACTIVE,
    PLAYLIST_TYPE_STATIC,
    USER_TYPE_GROUP,
    USER_TYPE_USER,
    KalturaAPIError,
    KalturaProvider,
)

CONNECTION = {"service_url": "https://kaltura.example.edu", "partner_id": "342", "app_token_id": "atok", "app_token": "the-secret"}


def make_provider(answer=None, **options):
    provider = KalturaProvider(dict(CONNECTION), options)
    provider._client = mock.MagicMock()
    if answer is not None:
        provider._client.call.side_effect = answer
    return provider


def paged(rows, size=500):

    def page(pager):
        start = (pager["pageIndex"] - 1) * size
        return {"objects": rows[start : start + size]}

    return page


def static_playlist(playlist_id, user_id="jdoe", content="1_a,1_b"):
    return {"id": playlist_id, "playlistType": PLAYLIST_TYPE_STATIC, "userId": user_id, "playlistContent": content}


class TestPlaylists(SimpleTestCase):
    def test_only_a_static_playlist_of_a_person_with_entries_is_migratable(self):
        provider = make_provider()
        self.assertTrue(provider.playlist_is_migratable(static_playlist("p1")))
        self.assertFalse(provider.playlist_is_migratable(dict(static_playlist("p2"), playlistType=10)))
        self.assertFalse(provider.playlist_is_migratable(static_playlist("p3", user_id="kmsInternal_channels")))
        self.assertFalse(provider.playlist_is_migratable(static_playlist("p4", content="")))
        self.assertFalse(provider.playlist_is_migratable(static_playlist("p5", content="<xml/>")))

    def test_migratable_playlists_are_counted_across_pages(self):
        rows = [static_playlist(f"p{index}") for index in range(500)] + [static_playlist("dyn", content="<xml/>"), {"playlistType": PLAYLIST_TYPE_STATIC}]
        page = paged(rows)
        provider = make_provider(lambda service, action, filter, pager: page(pager))
        self.assertEqual(len(provider._migratable_playlists()), 500)
        self.assertEqual(provider._client.call.call_count, 2)

    def test_the_playlist_phase_drops_what_cannot_be_migrated(self):
        provider = make_provider()
        provider._client.list_page_by_index.return_value = ([static_playlist("p1"), static_playlist("dyn", content="<x/>"), {"playlistType": 3}], {"page": 2})
        self.assertEqual(provider.list_page("playlists", {}, 50), (["p1"], {"page": 2}))

    def test_a_playlist_keeps_its_order(self):
        provider = make_provider(lambda service, action, id: {"id": "p1", "name": "Week 1", "creatorId": "asmith", "playlistContent": " 1_c, 1_a ,,1_b"})
        self.assertEqual(provider.fetch_playlist("p1"), {"id": "p1", "name": "Week 1", "description": "", "owner": "asmith", "entry_ids": ["1_c", "1_a", "1_b"]})

    def test_a_playlist_that_says_nothing(self):
        provider = make_provider(lambda service, action, id: {})
        self.assertEqual(provider.fetch_playlist("p9"), {"id": "p9", "name": "p9", "description": "", "owner": "", "entry_ids": []})


class TestPeopleAndGroups(SimpleTestCase):
    def test_every_person_is_read_across_pages(self):
        rows = [{"id": f"u{index}"} for index in range(501)]
        page = paged(rows)
        provider = make_provider(lambda service, action, filter, pager: page(pager))
        self.assertEqual(len(provider._all_people()), 501)
        self.assertEqual(provider._client.call.call_args.kwargs["filter"], {"typeIn": str(USER_TYPE_USER)})

    def test_an_answer_that_is_not_a_listing_ends_it(self):
        provider = make_provider(lambda service, action, filter, pager: "not a dict")
        self.assertEqual(provider._all_people(), [])
        self.assertEqual(provider._migratable_playlists(), [])

    def test_the_users_phase_leaves_out_system_accounts(self):
        provider = make_provider()
        provider._client.list_page_by_index.return_value = ([{"id": "jdoe"}, {"id": "__ADMIN__"}, {"id": "kmssaasadmin1"}, {"id": 0}, {}], {"page": 2})
        self.assertEqual(provider.list_page("users", {}, 50), (["jdoe"], {"page": 2}))
        self.assertEqual(provider._client.list_page_by_index.call_args.args[3], {"typeIn": str(USER_TYPE_USER)})

    def test_the_groups_phase(self):
        provider = make_provider()
        provider._client.list_page_by_index.return_value = ([{"id": "Staff"}, {}], {"page": 2})
        self.assertEqual(provider.list_page("groups", {}, 50), (["Staff"], {"page": 2}))
        self.assertEqual(provider._client.list_page_by_index.call_args.args[3], {"typeIn": str(USER_TYPE_GROUP)})

    def test_a_group_with_its_active_members(self):
        def answer(service, action, **params):
            if service == "user":
                return {"id": "Retired_Employees", "screenName": "Retired employees", "description": "gone fishing"}
            return {
                "objects": [
                    {"userId": "jdoe", "userRole": 1, "status": 0},
                    {"userId": "asmith", "userRole": 2, "status": 0},
                    {"userId": "pending", "userRole": 1, "status": 1},
                    {"userId": "odd", "userRole": 9, "status": 0},
                    {"userId": "", "userRole": 1, "status": 0},
                ]
            }

        group = make_provider(answer).fetch_group("Retired_Employees")
        self.assertEqual(group["name"], "Retired employees")
        self.assertEqual(group["description"], "gone fishing")
        self.assertEqual(group["members"], [{"userId": "jdoe", "role": "member"}, {"userId": "asmith", "role": "manager"}])

    def test_a_group_with_no_readable_name_is_named_after_its_id(self):
        provider = make_provider(lambda service, action, **params: {} if service == "user" else {"objects": []})
        self.assertEqual(provider.fetch_group("Staff")["name"], "Staff")

    def test_group_members_are_read_across_pages(self):
        rows = [{"userId": f"u{index}", "userRole": 1, "status": 0} for index in range(600)]
        page = paged(rows)
        provider = make_provider(lambda service, action, filter, pager: page(pager))
        self.assertEqual(len(provider.fetch_group_members("Staff")), 600)

    def test_the_group_ids_are_read_once(self):
        rows = [{"id": f"g{index}"} for index in range(500)] + [{"id": "last"}, {}]
        page = paged(rows)
        provider = make_provider(lambda service, action, filter, pager: page(pager))
        self.assertEqual(len(provider.group_ids()), 501)
        calls = provider._client.call.call_count
        provider.group_ids()
        self.assertEqual(provider._client.call.call_count, calls)


class TestCategoryMembers(SimpleTestCase):
    def test_a_group_member_brings_its_people_at_the_groups_level(self):
        def answer(service, action, filter, pager):
            if service == "categoryUser":
                return {
                    "objects": [
                        {"userId": "jdoe", "permissionLevel": 0, "status": CATEGORY_USER_ACTIVE},
                        {"userId": "Staff", "permissionLevel": 3, "status": CATEGORY_USER_ACTIVE},
                        {"userId": "left", "permissionLevel": 3, "status": 2},
                        {"userId": "nobody", "permissionLevel": 99, "status": CATEGORY_USER_ACTIVE},
                    ]
                }
            if service == "user":
                return {"objects": [{"id": "Staff"}]}
            return {"objects": [{"userId": "asmith", "userRole": 1, "status": 0}]}

        members = make_provider(answer).fetch_category_members("8812")
        self.assertEqual(members, [{"userId": "jdoe", "role": "manager"}, {"userId": "asmith", "role": "member"}])


class TestCategorySweep(SimpleTestCase):
    def provider(self, categories, selected="", **options):
        def answer(service, action, **params):
            if action == "list" and "idIn" in params.get("filter", {}):
                wanted = params["filter"]["idIn"].split(",")
                return {"objects": [category for category in categories if category.get("id") in wanted]}
            return {"objects": []}

        provider = make_provider(answer, source_category_ids=selected, **options)
        provider._all_categories = mock.Mock(return_value=categories)
        return provider

    CATEGORIES = [
        {"id": "1", "fullName": "MediaSpace"},
        {"id": "2", "fullName": "MediaSpace>site>galleries>Engineering", "privacyContexts": "MediaSpace"},
        {"id": "3", "fullName": "MediaSpace>site>private", "privacyContexts": "MediaSpace"},
        {"id": "4", "fullName": "Archive"},
        {"id": "5", "fullName": "Archive>Old", "privacyContexts": "x"},
        {"id": "6", "fullName": "Canvas>InContext", "name": "InContext", "privacyContexts": ""},
        {"fullName": "No id"},
    ]

    def test_the_instance_root_and_housekeeping_are_not_worth_importing(self):
        provider = self.provider(self.CATEGORIES, selected="1,4")
        verdicts = {category.get("id"): provider.worth_importing(category) for category in self.CATEGORIES}
        self.assertEqual(verdicts, {"1": False, "2": True, "3": False, "4": True, "5": True, "6": False, None: False})

    def test_nothing_outside_the_selection_is_worth_importing(self):
        provider = self.provider(self.CATEGORIES, selected="4")
        self.assertFalse(provider.worth_importing(self.CATEGORIES[1]))
        self.assertTrue(provider.worth_importing(self.CATEGORIES[4]))
        self.assertTrue(provider.within_selection("Archive>Old>Deeper"))
        self.assertFalse(provider.within_selection("Archived"))

    def test_without_a_selection_nothing_is_within_it(self):
        provider = self.provider(self.CATEGORIES)
        self.assertFalse(provider.within_selection("Archive"))
        provider._client.call.assert_not_called()

    def test_the_selected_paths_are_resolved_once(self):
        provider = self.provider(self.CATEGORIES, selected="4")
        provider.within_selection("Archive")
        provider.within_selection("Archive>Old")
        self.assertEqual(provider._client.call.call_count, 1)

    def test_a_page_the_filter_empties_is_not_the_end_of_the_phase(self):
        provider = self.provider(self.CATEGORIES, selected="4")
        provider._client.list_page_by_index.side_effect = [
            ([self.CATEGORIES[0], self.CATEGORIES[2]], {"page": 2}),
            ([self.CATEGORIES[3], self.CATEGORIES[4]], {"page": 3}),
        ]
        self.assertEqual(provider.list_page("categories", {"page": 1}, 2), (["4", "5"], {"page": 3}))

    def test_running_out_of_categories_ends_the_phase_where_it_stood(self):
        provider = self.provider(self.CATEGORIES, selected="4")
        provider._client.list_page_by_index.side_effect = [([self.CATEGORIES[0]], {"page": 2}), ([], {"page": 2})]
        self.assertEqual(provider.list_page("categories", {"page": 1}, 2), ([], {"page": 2}))

    def test_a_root_category_option_narrows_the_media_sweep(self):
        provider = make_provider(root_category="MediaSpace>site>galleries")
        provider._client.list_entries_page.return_value = ([], {})
        provider.list_page("media", {}, 10)
        self.assertEqual(provider._client.list_entries_page.call_args.args[2]["categoriesFullNameIn"], "MediaSpace>site>galleries")


class TestChildEntriesAndCourses(SimpleTestCase):
    def test_the_other_stream_of_a_recording(self):
        provider = make_provider(lambda service, action, filter, pager: {"objects": [{"id": "1_cam"}, {"name": "no id"}]})
        self.assertEqual(provider.child_entries("1_screen"), [{"id": "1_cam"}])
        self.assertEqual(provider._client.call.call_args.kwargs["filter"], {"parentEntryIdEqual": "1_screen"})

    def test_a_failed_lookup_means_a_single_stream(self):
        def refuse(service, action, **params):
            raise KalturaAPIError("SERVICE_FORBIDDEN", "no")

        self.assertEqual(make_provider(refuse).child_entries("1_screen"), [])

    def test_course_names_from_category_metadata(self):
        xml = "<metadata><Detail><Key>CourseName</Key><Value>BIO 101</Value></Detail></metadata>"
        provider = make_provider(lambda service, action, filter: {"objects": [{"objectId": 11, "xml": xml}, {"objectId": 12, "xml": "<metadata/>"}]})
        self.assertEqual(provider.course_names([11, 12, "", None]), {"11": "BIO 101"})
        self.assertEqual(provider._client.call.call_args.kwargs["filter"]["objectIdIn"], "11,12")

    def test_no_ids_no_call(self):
        provider = make_provider()
        self.assertEqual(provider.course_names(["", " "]), {})
        provider._client.call.assert_not_called()

    def test_metadata_that_cannot_be_read(self):
        def refuse(service, action, **params):
            raise KalturaAPIError("SERVICE_FORBIDDEN", "metadata plugin off")

        self.assertEqual(make_provider(refuse).course_names(["11"]), {})

    def test_only_an_lms_category_has_a_course_name(self):
        xml = "<metadata><Detail><Key>coursename</Key><Value>BIO 101</Value></Detail></metadata>"
        provider = make_provider(lambda service, action, filter: {"objects": [{"objectId": "11", "xml": xml}]})
        self.assertEqual(provider.course_name({"id": "11", "privacyContexts": ""}), "BIO 101")
        self.assertEqual(provider.course_name({"id": "11", "privacyContexts": "MediaSpace"}), "")


def streamed(status=200, chunks=(b"abc",), error=None):
    response = mock.MagicMock()
    response.status_code = status
    response.__enter__.return_value = response
    response.__exit__.return_value = False
    if error is not None:
        response.iter_content.side_effect = error
    else:
        response.iter_content.return_value = list(chunks)
    return response


class TestDownload(SimpleTestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp(prefix="kaltura-dl-")
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.dest = os.path.join(self.dir, "file.mp4")
        sleep = mock.patch.object(kaltura.time, "sleep")
        self.sleep = sleep.start()
        self.addCleanup(sleep.stop)

    def read(self):
        with open(self.dest, "rb") as handle:
            return handle.read()

    def test_a_file_is_streamed_to_disk(self):
        with mock.patch.object(kaltura.requests, "get", return_value=streamed(chunks=[b"abc", b"", b"de"])) as get:
            self.assertEqual(make_provider().download("https://cdn.example/f", self.dest), 5)
        self.assertEqual(self.read(), b"abcde")
        self.assertEqual(get.call_args.kwargs["headers"], {})

    def test_a_reset_connection_resumes_where_it_stopped(self):
        def broken():
            yield b"abc"
            raise requests.ConnectionError("reset")

        first = streamed()
        first.iter_content.side_effect = lambda chunk_size: broken()
        with mock.patch.object(kaltura.requests, "get", side_effect=[first, streamed(status=206, chunks=[b"def"])]) as get:
            self.assertEqual(make_provider().download("https://cdn.example/f", self.dest), 6)
        self.assertEqual(self.read(), b"abcdef")
        self.assertEqual(get.call_args.kwargs["headers"], {"Range": "bytes=3-"})
        self.sleep.assert_called_once_with(2)

    def test_a_server_that_ignores_range_starts_over(self):
        def broken():
            yield b"abc"
            raise requests.ConnectionError("reset")

        first = streamed()
        first.iter_content.side_effect = lambda chunk_size: broken()
        with mock.patch.object(kaltura.requests, "get", side_effect=[first, streamed(status=200, chunks=[b"abcdef"])]):
            self.assertEqual(make_provider().download("https://cdn.example/f", self.dest), 6)
        self.assertEqual(self.read(), b"abcdef")

    @override_settings(MIGRATION_MAX_RETRIES=3)
    def test_a_download_that_keeps_failing_raises_after_the_last_attempt(self):
        with mock.patch.object(kaltura.requests, "get", side_effect=requests.Timeout("slow")) as get:
            with self.assertRaises(requests.Timeout):
                make_provider().download("https://cdn.example/f", self.dest)
        self.assertEqual(get.call_count, 3)
        self.assertEqual([call.args[0] for call in self.sleep.call_args_list], [2, 4])

    def test_an_entry_without_a_download_url(self):
        with self.assertRaises(KalturaAPIError):
            make_provider().download_entry({"id": "1_img"}, self.dest)

    def test_an_entry_file_is_downloaded_from_its_own_url(self):
        provider = make_provider()
        with mock.patch.object(provider, "download", return_value=9) as download:
            self.assertEqual(provider.download_entry({"id": "1_img", "downloadUrl": "https://cdn.example/img"}, self.dest), 9)
        download.assert_called_once_with("https://cdn.example/img", self.dest)

    def test_a_caption_url_is_resolved_then_downloaded(self):
        provider = make_provider(lambda service, action, id: "https://cdn.example/cap.srt")
        with mock.patch.object(provider, "download", return_value=4) as download:
            self.assertEqual(provider.download_caption({"id": "0_cap"}, self.dest), 4)
        download.assert_called_once_with("https://cdn.example/cap.srt", self.dest)
        self.assertEqual(provider._client.call.call_args.args, ("caption_captionasset", "getUrl"))

    def test_a_caption_with_no_url(self):
        provider = make_provider(lambda service, action, id: {"objectType": "KalturaAPIException"})
        with self.assertRaises(KalturaAPIError):
            provider.download_caption({"id": "0_cap"}, self.dest)
