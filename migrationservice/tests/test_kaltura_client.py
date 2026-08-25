import hashlib
from unittest import mock

from django.test import TestCase

from migrationservice.providers.kaltura import KalturaAPIError, KalturaClient


def make_client():
    return KalturaClient(
        service_url="https://kaltura.example.edu/",
        partner_id="342",
        app_token_id="atok",
        app_token="the-secret",
    )


WIDGET_SESSION = {"objectType": "KalturaStartWidgetSessionResponse", "ks": "widget-ks", "partnerId": 342}
APP_TOKEN_SESSION = {"objectType": "KalturaSessionInfo", "ks": "the-ks"}


def session_responses():
    """What a successful app token exchange looks like: a widget session, then a real one"""
    return [WIDGET_SESSION, APP_TOKEN_SESSION]


class TestKalturaClient(TestCase):
    def test_flatten_nests_with_colons(self):
        client = make_client()
        flat = client._flatten({"filter": {"orderBy": "+createdAt"}, "pager": {"pageSize": 10}})
        self.assertEqual(flat, {"filter:orderBy": "+createdAt", "pager:pageSize": 10})

    def test_flatten_drops_none_values(self):
        client = make_client()
        flat = client._flatten({"filter": {"orderBy": "+createdAt", "idEqual": None}})
        self.assertEqual(flat, {"filter:orderBy": "+createdAt"})

    def test_url_is_built_from_service_and_action(self):
        client = make_client()
        self.assertEqual(
            client._url("media", "list"),
            "https://kaltura.example.edu/api_v3/service/media/action/list",
        )

    def test_session_is_started_once_and_reused(self):
        client = make_client()
        with mock.patch.object(client, "_post", side_effect=session_responses()) as post:
            self.assertEqual(client.get_ks(), "the-ks")
            self.assertEqual(client.get_ks(), "the-ks")
        # the widget session and the exchange, once between them, not per call
        self.assertEqual(post.call_count, 2)

    def test_call_sends_format_and_ks(self):
        client = make_client()
        client.ks = "the-ks"
        client.ks_issued_at = 9999999999
        with mock.patch.object(client, "_post", return_value={"totalCount": 3}) as post:
            client.call("media", "list", pager={"pageSize": 1})
        url, data = post.call_args[0]
        self.assertEqual(url, "https://kaltura.example.edu/api_v3/service/media/action/list")
        self.assertEqual(data["format"], 1)
        self.assertEqual(data["ks"], "the-ks")
        self.assertEqual(data["pager:pageSize"], 1)

    def test_api_exception_is_raised(self):
        client = make_client()
        client.ks = "the-ks"
        client.ks_issued_at = 9999999999
        error = {"objectType": "KalturaAPIException", "code": "ENTRY_ID_NOT_FOUND", "message": "Entry not found"}
        with mock.patch.object(client, "_post", return_value=error):
            with self.assertRaises(KalturaAPIError) as raised:
                client.call("media", "get", entryId="1_nope")
        self.assertEqual(raised.exception.code, "ENTRY_ID_NOT_FOUND")

    def test_invalid_ks_triggers_one_reissue_then_succeeds(self):
        client = make_client()
        client.ks = "stale-ks"
        client.ks_issued_at = 9999999999
        responses = [
            {"objectType": "KalturaAPIException", "code": "INVALID_KS", "message": "Invalid KS"},
            "fresh-ks",
            {"totalCount": 7},
        ]
        with mock.patch.object(client, "_post", side_effect=responses):
            result = client.call("media", "list", pager={"pageSize": 1})
        self.assertEqual(result, {"totalCount": 7})
        self.assertEqual(client.ks, "fresh-ks")

    def test_invalid_ks_twice_raises(self):
        client = make_client()
        client.ks = "stale-ks"
        client.ks_issued_at = 9999999999
        error = {"objectType": "KalturaAPIException", "code": "INVALID_KS", "message": "Invalid KS"}
        with mock.patch.object(client, "_post", side_effect=[error, "fresh-ks", error]):
            with self.assertRaises(KalturaAPIError):
                client.call("media", "list", pager={"pageSize": 1})

    def test_network_errors_are_retried_then_raised(self):
        import requests

        client = make_client()
        client.ks = "the-ks"
        client.ks_issued_at = 9999999999
        with mock.patch("migrationservice.providers.kaltura.time.sleep"):
            with mock.patch.object(client, "_post", side_effect=requests.ConnectionError("boom")) as post:
                with self.assertRaises(requests.ConnectionError):
                    client.call("media", "list")
        self.assertEqual(post.call_count, 3)

    def test_network_error_then_success_returns_the_result(self):
        import requests

        client = make_client()
        client.ks = "the-ks"
        client.ks_issued_at = 9999999999
        with mock.patch("migrationservice.providers.kaltura.time.sleep"):
            with mock.patch.object(client, "_post", side_effect=[requests.Timeout("slow"), {"totalCount": 1}]):
                result = client.call("media", "list")
        self.assertEqual(result, {"totalCount": 1})

    def test_the_app_token_is_exchanged_for_a_session(self):
        """A widget session first, then the token presented against it as a hash.

        The token itself is never sent, only a hash of it together with the widget
        session, which is the whole point of the app token flow.
        """
        client = make_client()
        with mock.patch.object(client, "_post", side_effect=session_responses()) as post:
            self.assertEqual(client.get_ks(), "the-ks")

        widget_url, widget_data = post.call_args_list[0][0]
        self.assertEqual(widget_url, "https://kaltura.example.edu/api_v3/service/session/action/startWidgetSession")
        self.assertEqual(widget_data["widgetId"], "_342")
        self.assertNotIn("ks", widget_data)

        token_url, token_data = post.call_args_list[1][0]
        self.assertEqual(token_url, "https://kaltura.example.edu/api_v3/service/appToken/action/startSession")
        self.assertEqual(token_data["id"], "atok")
        self.assertEqual(token_data["ks"], "widget-ks")
        expected = hashlib.sha256(b"widget-ksthe-secret").hexdigest()
        self.assertEqual(token_data["tokenHash"], expected)
        self.assertNotIn("the-secret", str(token_data.values()))

    def test_another_hash_algorithm_is_tried_when_the_first_is_refused(self):
        """Kaltura will not say which algorithm a token uses until a session exists, so a
        refusal is treated as "wrong algorithm" and the next one is tried.
        """
        client = make_client()
        refused = {"objectType": "KalturaAPIException", "code": "APP_TOKEN_HASH_MISMATCH", "message": "no"}
        responses = [WIDGET_SESSION, refused, APP_TOKEN_SESSION]
        with mock.patch.object(client, "_post", side_effect=responses) as post:
            self.assertEqual(client.get_ks(), "the-ks")

        self.assertEqual(post.call_count, 3)
        first_hash = post.call_args_list[1][0][1]["tokenHash"]
        second_hash = post.call_args_list[2][0][1]["tokenHash"]
        self.assertEqual(first_hash, hashlib.sha256(b"widget-ksthe-secret").hexdigest())
        self.assertEqual(second_hash, hashlib.sha1(b"widget-ksthe-secret").hexdigest())
        # and the one that worked is remembered, so the next session goes straight to it
        self.assertEqual(client.hash_type, "sha1")

    def test_a_pinned_hash_type_is_tried_first(self):
        client = make_client()
        client.hash_type = "md5"
        with mock.patch.object(client, "_post", side_effect=session_responses()) as post:
            client.get_ks()
        self.assertEqual(post.call_args_list[1][0][1]["tokenHash"], hashlib.md5(b"widget-ksthe-secret").hexdigest())

    def test_a_widget_session_without_a_ks_is_an_error(self):
        client = make_client()
        with mock.patch.object(client, "_post", return_value={"objectType": "KalturaStartWidgetSessionResponse"}):
            with self.assertRaises(KalturaAPIError):
                client.get_ks()


class TestKalturaPagination(TestCase):
    def setUp(self):
        self.client = make_client()
        self.client.ks = "the-ks"
        self.client.ks_issued_at = 9999999999

    def test_count_reads_total_count(self):
        with mock.patch.object(self.client, "_post", return_value={"totalCount": 11960, "objects": []}):
            self.assertEqual(self.client.count("media"), 11960)

    def test_index_paging_advances_and_terminates(self):
        pages = [
            {"totalCount": 3, "objects": [{"id": "a"}, {"id": "b"}]},
            {"totalCount": 3, "objects": [{"id": "c"}]},
            {"totalCount": 3, "objects": []},
        ]
        with mock.patch.object(self.client, "_post", side_effect=pages):
            first, cursor = self.client.list_page_by_index("user", {}, 2)
            self.assertEqual([o["id"] for o in first], ["a", "b"])
            second, cursor = self.client.list_page_by_index("user", cursor, 2)
            self.assertEqual([o["id"] for o in second], ["c"])
            third, cursor = self.client.list_page_by_index("user", cursor, 2)
            self.assertEqual(third, [])

    def test_entries_page_sets_order_and_status_filter(self):
        with mock.patch.object(self.client, "_post", return_value={"objects": []}) as post:
            self.client.list_entries_page({}, 10)
        data = post.call_args[0][1]
        self.assertEqual(data["filter:orderBy"], "+createdAt")
        self.assertEqual(data["filter:statusEqual"], 2)
        self.assertNotIn("filter:createdAtGreaterThanOrEqual", data)

    def test_entries_cursor_carries_created_at_and_seen_ids(self):
        page = {
            "objects": [
                {"id": "1_a", "createdAt": 100},
                {"id": "1_b", "createdAt": 200},
                {"id": "1_c", "createdAt": 200},
            ]
        }
        with mock.patch.object(self.client, "_post", return_value=page):
            entries, cursor = self.client.list_entries_page({}, 10)
        self.assertEqual([e["id"] for e in entries], ["1_a", "1_b", "1_c"])
        self.assertEqual(cursor["created_at"], 200)
        self.assertEqual(sorted(cursor["seen_ids"]), ["1_b", "1_c"])

    def test_entries_page_skips_ids_already_seen_at_the_boundary(self):
        cursor = {"created_at": 200, "seen_ids": ["1_b", "1_c"]}
        page = {
            "objects": [
                {"id": "1_b", "createdAt": 200},
                {"id": "1_c", "createdAt": 200},
                {"id": "1_d", "createdAt": 200},
                {"id": "1_e", "createdAt": 300},
            ]
        }
        with mock.patch.object(self.client, "_post", side_effect=[page]) as post:
            entries, next_cursor = self.client.list_entries_page(cursor, 10)
        data = post.call_args[0][1]
        self.assertEqual(data["filter:createdAtGreaterThanOrEqual"], 200)
        self.assertEqual([e["id"] for e in entries], ["1_d", "1_e"])
        self.assertEqual(next_cursor["created_at"], 300)
        self.assertEqual(next_cursor["seen_ids"], ["1_e"])

    def test_entries_page_accumulates_seen_ids_when_created_at_does_not_move(self):
        cursor = {"created_at": 200, "seen_ids": ["1_b"]}
        page = {"objects": [{"id": "1_b", "createdAt": 200}, {"id": "1_c", "createdAt": 200}]}
        with mock.patch.object(self.client, "_post", return_value=page):
            entries, next_cursor = self.client.list_entries_page(cursor, 10)
        self.assertEqual([e["id"] for e in entries], ["1_c"])
        self.assertEqual(sorted(next_cursor["seen_ids"]), ["1_b", "1_c"])

    def test_entries_page_returns_empty_and_keeps_cursor_when_exhausted(self):
        cursor = {"created_at": 300, "seen_ids": ["1_e"]}
        with mock.patch.object(self.client, "_post", return_value={"objects": [{"id": "1_e", "createdAt": 300}]}):
            entries, next_cursor = self.client.list_entries_page(cursor, 10)
        self.assertEqual(entries, [])
        self.assertEqual(next_cursor, cursor)

    def test_a_caller_filter_cannot_overwrite_the_cursor_boundary(self):
        # the orchestrator passes the user's static created_after on every page;
        # it must never reset an advanced cursor
        cursor = {"created_at": 300, "seen_ids": ["1_c"]}
        page = {"objects": [{"id": "1_d", "createdAt": 400}]}
        with mock.patch.object(self.client, "_post", return_value=page) as post:
            self.client.list_entries_page(cursor, 10, {"createdAtGreaterThanOrEqual": 100})
        data = post.call_args[0][1]
        self.assertEqual(data["filter:createdAtGreaterThanOrEqual"], 300)

    def test_a_caller_filter_floor_is_honoured_before_the_cursor_moves(self):
        page = {"objects": [{"id": "1_a", "createdAt": 150}]}
        with mock.patch.object(self.client, "_post", return_value=page) as post:
            self.client.list_entries_page({}, 10, {"createdAtGreaterThanOrEqual": 100})
        data = post.call_args[0][1]
        self.assertEqual(data["filter:createdAtGreaterThanOrEqual"], 100)

    def test_a_caller_filter_cannot_override_the_ordering_the_cursor_depends_on(self):
        with mock.patch.object(self.client, "_post", return_value={"objects": []}) as post:
            self.client.list_entries_page({}, 10, {"orderBy": "-createdAt", "statusEqual": 99})
        data = post.call_args[0][1]
        self.assertEqual(data["filter:orderBy"], "+createdAt")
        self.assertEqual(data["filter:statusEqual"], 2)

    def test_an_oversized_shared_timestamp_block_raises_something_actionable(self):
        cursor = {"created_at": 200, "seen_ids": [f"1_{n}" for n in range(10000)]}
        with mock.patch.object(self.client, "_post") as post:
            with self.assertRaises(KalturaAPIError) as raised:
                self.client.list_entries_page(cursor, 10)
        self.assertEqual(raised.exception.code, "PAGINATION_LIMIT")
        self.assertIn("created_after", raised.exception.message)
        post.assert_not_called()


class TestKalturaCheckConnection(TestCase):
    def test_reports_stats_on_success(self):
        client = make_client()
        responses = [
            "the-ks",
            {"totalCount": 11960, "objects": []},
            {"totalCount": 214, "objects": []},
            {"totalCount": 87, "objects": []},
        ]
        with mock.patch.object(client, "_post", side_effect=responses):
            result = client.check_connection()
        self.assertTrue(result["ok"])
        self.assertEqual(result["stats"], {"entries": 11960, "users": 214, "categories": 87})

    def test_the_entry_count_honours_the_entry_filter(self):
        client = make_client()
        responses = ["the-ks", {"totalCount": 25, "objects": []}, {"totalCount": 214, "objects": []}, {"totalCount": 87, "objects": []}]
        with mock.patch.object(client, "_post", side_effect=responses) as post:
            result = client.check_connection(entry_filter={"userIdIn": "jdoe"})

        self.assertEqual(result["stats"]["entries"], 25)
        # the dashboard denominator has to match what the run will actually fetch
        entry_call = post.call_args_list[1]
        self.assertEqual(entry_call[0][1]["filter:userIdIn"], "jdoe")

    def test_a_count_is_reported_per_listed_user(self):
        client = make_client()
        responses = [
            "the-ks",
            {"totalCount": 33, "objects": []},
            {"totalCount": 214, "objects": []},
            {"totalCount": 87, "objects": []},
            {"totalCount": 25, "objects": []},
            {"totalCount": 8, "objects": []},
        ]
        with mock.patch.object(client, "_post", side_effect=responses):
            result = client.check_connection(entry_filter={"userIdIn": "jdoe,asmith"}, user_ids=["jdoe", "asmith"])

        self.assertEqual(result["stats"]["entries_per_user"], {"jdoe": 25, "asmith": 8})

    def test_no_per_user_counts_without_a_restriction(self):
        client = make_client()
        responses = ["the-ks", {"totalCount": 1, "objects": []}, {"totalCount": 1, "objects": []}, {"totalCount": 1, "objects": []}]
        with mock.patch.object(client, "_post", side_effect=responses):
            result = client.check_connection()
        self.assertNotIn("entries_per_user", result["stats"])

    def test_reports_the_error_on_failure(self):
        client = make_client()
        error = {"objectType": "KalturaAPIException", "code": "INVALID_PARTNER_ID", "message": "Bad partner"}
        with mock.patch.object(client, "_post", return_value=error):
            result = client.check_connection()
        self.assertFalse(result["ok"])
        self.assertIn("INVALID_PARTNER_ID", result["error"])


class TestCallLogging(TestCase):
    """Every call is logged in and out, and the secret never appears."""

    def setUp(self):
        self.client = make_client()
        self.client.ks = "the-ks"
        self.client.ks_issued_at = 9999999999

    def test_a_call_logs_out_and_back(self):
        with mock.patch.object(self.client, "_post", return_value={"objects": [], "totalCount": 7}):
            with self.assertLogs("migrationservice.providers.kaltura", level="INFO") as captured:
                self.client.call("media", "list", pager={"pageSize": 10})
        joined = "\n".join(captured.output)
        self.assertIn("kaltura -> media.list", joined)
        self.assertIn("kaltura <- media.list", joined)
        self.assertIn("0 objects of 7", joined)
        self.assertIn("pager:pageSize=10", joined)

    def test_the_app_token_is_never_logged(self):
        self.client.ks = None  # force a real exchange
        with mock.patch.object(self.client, "_post", side_effect=session_responses()):
            with self.assertLogs("migrationservice.providers.kaltura", level="INFO") as captured:
                self.client.get_ks()
        joined = "\n".join(captured.output)
        self.assertIn("kaltura -> session.startWidgetSession", joined)
        self.assertIn("kaltura -> appToken.startSession", joined)
        # neither the token nor the hash derived from it appears, only the names
        self.assertNotIn("the-secret", joined)
        self.assertNotIn(hashlib.sha256(b"widget-ksthe-secret").hexdigest(), joined)
        self.assertIn("tokenHash", joined)

    def test_the_session_string_is_never_logged(self):
        with mock.patch.object(self.client, "_post", return_value={"objects": []}):
            with self.assertLogs("migrationservice.providers.kaltura", level="INFO") as captured:
                self.client.call("media", "list")
        self.assertNotIn("the-ks", "\n".join(captured.output))

    def test_a_failed_call_logs_the_failure_and_its_duration(self):
        error = {"objectType": "KalturaAPIException", "code": "BOOM", "message": "nope"}
        with mock.patch.object(self.client, "_post", return_value=error):
            with self.assertLogs("migrationservice.providers.kaltura", level="INFO") as captured:
                with self.assertRaises(KalturaAPIError):
                    self.client.call("media", "get", entryId="1_a")
        joined = "\n".join(captured.output)
        self.assertIn("entryId=1_a", joined)
        self.assertIn("API ERROR", joined)
