import os
import shutil
import tempfile
from unittest import mock
from xml.etree import ElementTree

import requests
from django.core.cache import cache
from django.test import SimpleTestCase

from migrationservice.providers import panopto
from migrationservice.providers.panopto import (
    LEGACY_LOGIN_PATH,
    PODCAST_PARAMS,
    RATE_LIMIT_WAIT,
    TOKEN_PATH,
    USER_SOAP_PATH,
    PanoptoAPIError,
    PanoptoClient,
    PanoptoProvider,
)

SERVICE = "https://yourorg.cloud.panopto.eu"

CONNECTION = {
    "service_url": f"{SERVICE}/",
    "client_id": "client",
    "client_secret": "secret",
    "username": "service@example.edu",
    "password": "p<w>&d",
}


def answer(status=200, body=None, text=None, headers=None, reason="", content=None):
    response = mock.MagicMock()
    response.status_code = status
    response.headers = headers or {}
    response.reason = reason
    if body is not None:
        response.json.return_value = body
        response.content = content if content is not None else b"{...}"
        response.text = text or str(body)
    else:
        response.json.side_effect = ValueError("not json")
        response.text = text or ""
        response.content = content if content is not None else (text or "").encode()
    response.__enter__.return_value = response
    response.__exit__.return_value = False
    return response


def make_client():
    client = PanoptoClient(CONNECTION["service_url"], "client", "secret", "service@example.edu", "p<w>&d", timeout=7)
    client.session = mock.Mock()
    return client


def with_token(client):
    client._token = "tok"
    client._token_expires_at = float("inf")
    return client


class NoSleepTestCase(SimpleTestCase):
    def setUp(self):
        patcher = mock.patch.object(panopto.time, "sleep")
        self.sleep = patcher.start()
        self.addCleanup(patcher.stop)
        cache.clear()


class TestToken(NoSleepTestCase):
    def test_the_password_grant_is_asked_for_with_the_client_credentials(self):
        client = make_client()
        client.session.post.return_value = answer(body={"access_token": "abc", "refresh_token": "ref", "expires_in": 3600})

        self.assertEqual(client.token(), "abc")
        url = client.session.post.call_args.args[0]
        kwargs = client.session.post.call_args.kwargs
        self.assertEqual(url, f"{SERVICE}{TOKEN_PATH}")
        self.assertEqual(kwargs["auth"], ("client", "secret"))
        self.assertEqual(kwargs["timeout"], 7)
        self.assertEqual(kwargs["data"]["grant_type"], "password")
        self.assertEqual(kwargs["data"]["username"], "service@example.edu")
        self.assertEqual(kwargs["data"]["scope"], "api offline_access")

    def test_a_live_token_is_not_asked_for_again(self):
        client = make_client()
        client.session.post.return_value = answer(body={"access_token": "abc", "expires_in": 3600})
        client.token()
        client.token()
        self.assertEqual(client.session.post.call_count, 1)

    def test_an_expired_token_is_renewed_with_the_refresh_token(self):
        client = make_client()
        client.session.post.side_effect = [
            answer(body={"access_token": "first", "refresh_token": "ref", "expires_in": 3600}),
            answer(body={"access_token": "second", "expires_in": 3600}),
        ]
        client.token()
        client._token_expires_at = 0

        self.assertEqual(client.token(), "second")
        self.assertEqual(client.session.post.call_args.kwargs["data"], {"grant_type": "refresh_token", "refresh_token": "ref"})
        self.assertEqual(client._refresh_token, "ref")

    def test_a_refused_refresh_falls_back_to_the_password(self):
        client = make_client()
        client._refresh_token = "stale"
        client.session.post.side_effect = [
            answer(status=400, body={"error": "invalid_grant"}),
            answer(body={"access_token": "fresh", "expires_in": 3600}),
        ]

        self.assertEqual(client.token(), "fresh")
        grants = [call.kwargs["data"]["grant_type"] for call in client.session.post.call_args_list]
        self.assertEqual(grants, ["refresh_token", "password"])

    def test_a_refused_password_reports_panoptos_reason(self):
        client = make_client()
        client.session.post.return_value = answer(status=400, body={"error": "invalid_client", "error_description": "Unknown client"})
        with self.assertRaisesMessage(PanoptoAPIError, "invalid_client: Unknown client"):
            client.token()

    def test_any_other_refusal_blames_the_service_account(self):
        client = make_client()
        client.session.post.return_value = answer(status=500, text="<html>oops</html>")
        with self.assertRaisesMessage(PanoptoAPIError, "Panopto refused the service account"):
            client.token()

    def test_an_unreachable_instance(self):
        client = make_client()
        client.session.post.side_effect = requests.ConnectionError("no route")
        with self.assertRaisesMessage(PanoptoAPIError, f"Could not reach {SERVICE}: no route"):
            client.token()

    def test_a_token_lives_at_least_a_minute(self):
        client = make_client()
        client.session.post.return_value = answer(body={"access_token": "abc", "expires_in": 30})
        with mock.patch.object(panopto.time, "time", return_value=1000.0):
            client.token()
        self.assertEqual(client._token_expires_at, 1060.0)


class TestCall(NoSleepTestCase):
    def test_a_get_carries_the_token_and_the_params(self):
        client = with_token(make_client())
        client.session.get.return_value = answer(body={"Id": "f1"})

        self.assertEqual(client.call("/folders/f1", pageNumber=2), {"Id": "f1"})
        self.assertEqual(client.session.get.call_args.args[0], f"{SERVICE}/Panopto/api/v1/folders/f1")
        self.assertEqual(client.session.get.call_args.kwargs["params"], {"pageNumber": 2})
        self.assertEqual(client.session.get.call_args.kwargs["headers"], {"Authorization": "Bearer tok"})

    def test_no_params_sends_none(self):
        client = with_token(make_client())
        client.session.get.return_value = answer(body={})
        client.call("/folders/f1")
        self.assertIsNone(client.session.get.call_args.kwargs["params"])

    def test_a_rate_limit_is_waited_out_as_long_as_asked(self):
        client = with_token(make_client())
        client.session.get.side_effect = [answer(status=429, body={}, headers={"Retry-After": "2"}), answer(body={"Id": "f1"})]

        self.assertEqual(client.call("/folders/f1"), {"Id": "f1"})
        self.sleep.assert_called_once_with(2)

    def test_a_rate_limit_that_does_not_lift_is_an_error(self):
        client = with_token(make_client())
        client.session.get.return_value = answer(status=429, body={"Message": "slow down"})
        with self.assertRaisesMessage(PanoptoAPIError, "/folders/f1 answered 429: slow down"):
            client.call("/folders/f1")
        self.assertEqual(client.session.get.call_count, 3)
        self.assertEqual([call.args[0] for call in self.sleep.call_args_list], [RATE_LIMIT_WAIT, RATE_LIMIT_WAIT * 2])

    def test_a_missing_path(self):
        client = with_token(make_client())
        client.session.get.return_value = answer(status=404, body={})
        with self.assertRaisesMessage(PanoptoAPIError, "/sessions/s1 does not exist on this Panopto"):
            client.call("/sessions/s1")

    def test_panoptos_own_error_text_is_reported(self):
        client = with_token(make_client())
        cases = [
            (answer(status=403, body={"Error": {"Message": "Forbidden here"}}), "Forbidden here"),
            (answer(status=403, body={"Error": {"Code": "E42"}}), "E42"),
            (answer(status=403, body={"Error": {"Detail": "x"}}), "{'Detail': 'x'}"),
            (answer(status=500, body={"Message": "boom"}), "boom"),
            (answer(status=500, body={"Other": 1}), "{'Other': 1}"),
            (answer(status=500, body=["a", "b"]), "['a', 'b']"),
            (answer(status=502, text="Bad gateway page"), "Bad gateway page"),
        ]
        for response, expected in cases:
            client.session.get.return_value = response
            with self.assertRaises(PanoptoAPIError) as caught:
                client.call("/x")
            self.assertTrue(str(caught.exception).endswith(expected), str(caught.exception))

    def test_an_empty_answer_is_none(self):
        client = with_token(make_client())
        client.session.get.return_value = answer(status=204, body={}, content=b"")
        self.assertIsNone(client.call("/x"))

    def test_an_answer_that_is_not_json(self):
        client = with_token(make_client())
        client.session.get.return_value = answer(text="<html/>")
        with self.assertRaisesMessage(PanoptoAPIError, "/x answered with something that is not JSON"):
            client.call("/x")

    def test_an_unreachable_endpoint(self):
        client = with_token(make_client())
        client.session.get.side_effect = requests.Timeout("timed out")
        with self.assertRaisesMessage(PanoptoAPIError, "Could not reach"):
            client.call("/x")


class TestRateLimitWait(NoSleepTestCase):
    def wait(self, header, attempt=1):
        make_client()._wait_out_rate_limit(answer(status=429, headers={"Retry-After": header} if header is not None else {}), "x", attempt)
        return self.sleep.call_args.args[0]

    def test_the_header_is_obeyed_within_bounds(self):
        self.assertEqual(self.wait("7"), 7)
        self.assertEqual(self.wait("600"), 60)
        self.assertEqual(self.wait("0.2"), 1)

    def test_without_a_usable_header_the_wait_grows_per_attempt(self):
        self.assertEqual(self.wait(None, attempt=1), RATE_LIMIT_WAIT)
        self.assertEqual(self.wait("Wed, 21 Oct 2026 07:28:00 GMT", attempt=2), RATE_LIMIT_WAIT * 2)


class TestResults(NoSleepTestCase):
    def test_pages_are_read_until_one_comes_back_empty(self):
        client = make_client()
        pages = {0: {"Results": [{"Id": "a"}, {"Id": "b"}]}, 1: {"Results": [{"Id": "c"}]}, 2: {"Results": []}}
        with mock.patch.object(client, "call", side_effect=lambda path, pageNumber, **params: pages[pageNumber]) as called:
            self.assertEqual([row["Id"] for row in client.results("/folders/f1/sessions", sortField="Name")], ["a", "b", "c"])
        self.assertEqual(called.call_args_list[0].kwargs, {"pageNumber": 0, "sortField": "Name"})

    def test_a_none_answer_ends_the_listing(self):
        client = make_client()
        with mock.patch.object(client, "call", return_value=None):
            self.assertEqual(list(client.results("/x")), [])

    def test_a_listing_that_never_ends_is_cut_off(self):
        client = make_client()
        with mock.patch.object(panopto, "MAX_PAGES", 2), mock.patch.object(client, "call", return_value={"Results": [{"Id": "same"}]}) as called:
            self.assertEqual(len(list(client.results("/x"))), 3)
        self.assertEqual(called.call_count, 3)


SOAP_ANSWER = b"""<?xml version="1.0"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>
<ListUsersResponse xmlns="http://tempuri.org/"><ListUsersResult xmlns:a="http://schemas.datacontract.org/2004/07/Panopto.Server.Services.PublicAPI.V40">
<a:PagedResults><a:User><a:UserId>u-1</a:UserId></a:User><a:User><a:UserId>u-2</a:UserId></a:User><a:User><a:UserId></a:UserId></a:User></a:PagedResults>
<a:TotalResultCount>7</a:TotalResultCount>
</ListUsersResult></ListUsersResponse></s:Body></s:Envelope>"""


class TestSoap(NoSleepTestCase):
    def test_the_envelope_carries_the_escaped_password_and_the_action(self):
        client = make_client()
        client.session.post.return_value = answer(content=SOAP_ANSWER, text=SOAP_ANSWER.decode())

        parsed = client.soap("ListUsers", "<parameters/>")
        self.assertTrue(parsed.tag.endswith("Envelope"))
        url = client.session.post.call_args.args[0]
        kwargs = client.session.post.call_args.kwargs
        self.assertEqual(url, f"{SERVICE}{USER_SOAP_PATH}")
        self.assertEqual(kwargs["headers"]["SOAPAction"], '"http://tempuri.org/IUserManagement/ListUsers"')
        envelope = kwargs["data"].decode()
        self.assertIn("<d:Password>p&lt;w&gt;&amp;d</d:Password>", envelope)
        self.assertIn("<d:UserKey>service@example.edu</d:UserKey>", envelope)
        self.assertIn("<parameters/></ListUsers>", envelope)
        ElementTree.fromstring(kwargs["data"])

    def test_a_fault_reports_its_faultstring(self):
        client = make_client()
        client.session.post.return_value = answer(status=500, text="<s:Fault><faultstring xml:lang='en'>\n Invalid credentials </faultstring></s:Fault>")
        with self.assertRaisesMessage(PanoptoAPIError, "ListUsers answered 500: Invalid credentials"):
            client.soap("ListUsers", "")

    def test_a_failure_without_a_fault_reports_the_reason(self):
        client = make_client()
        client.session.post.return_value = answer(status=503, text="", reason="Service Unavailable")
        with self.assertRaisesMessage(PanoptoAPIError, "ListUsers answered 503: Service Unavailable"):
            client.soap("ListUsers", "")

    def test_an_unreachable_soap_service(self):
        client = make_client()
        client.session.post.side_effect = requests.ConnectionError("refused")
        with self.assertRaisesMessage(PanoptoAPIError, "Could not reach"):
            client.soap("ListUsers", "")


def legacy_with(*responses, cookie=True):
    legacy = requests.Session()
    legacy.get = mock.Mock(side_effect=list(responses))
    if cookie:
        legacy.cookies.set(".ASPXAUTH", "cookie-value")
    return legacy


class TestLegacySession(NoSleepTestCase):
    def test_the_cookie_is_fetched_with_the_token_and_shared_through_the_cache(self):
        client = with_token(make_client())
        legacy = legacy_with(answer(body={}))
        with mock.patch.object(panopto.requests, "Session", return_value=legacy):
            self.assertIs(client.legacy_session(), legacy)
            self.assertIs(client.legacy_session(), legacy)

        legacy.get.assert_called_once()
        self.assertEqual(legacy.get.call_args.args[0], f"{SERVICE}{LEGACY_LOGIN_PATH}")
        self.assertEqual(legacy.get.call_args.kwargs["headers"], {"Authorization": "Bearer tok"})
        self.assertEqual(cache.get(client._cookie_cache_key()), {".ASPXAUTH": "cookie-value"})

    def test_another_worker_reuses_the_cached_cookie_without_logging_in(self):
        first = with_token(make_client())
        cache.set(first._cookie_cache_key(), {".ASPXAUTH": "shared"})
        second = with_token(make_client())

        legacy = second.legacy_session()
        self.assertEqual(legacy.cookies.get(".ASPXAUTH"), "shared")

    def test_two_accounts_never_share_a_cookie(self):
        one = PanoptoClient(SERVICE, "c", "s", "a@example.edu", "pw")
        other = PanoptoClient(SERVICE, "c", "s", "b@example.edu", "pw")
        self.assertNotEqual(one._cookie_cache_key(), other._cookie_cache_key())

    def test_a_rate_limited_login_is_retried(self):
        client = with_token(make_client())
        limited = legacy_with(answer(status=429, headers={"Retry-After": "3"}), cookie=False)
        granted = legacy_with(answer(body={}))
        with mock.patch.object(panopto.requests, "Session", side_effect=[limited, granted]):
            self.assertIs(client.legacy_session(), granted)
        self.sleep.assert_called_once_with(3)

    def test_a_login_rate_limited_every_time_gives_up(self):
        client = with_token(make_client())
        sessions = [legacy_with(answer(status=429), cookie=False) for _ in range(3)]
        with mock.patch.object(panopto.requests, "Session", side_effect=sessions):
            with self.assertRaisesMessage(PanoptoAPIError, "rate limiting the download login"):
                client.legacy_session()
        self.assertEqual(self.sleep.call_count, 2)

    def test_a_refused_login(self):
        client = with_token(make_client())
        with mock.patch.object(panopto.requests, "Session", return_value=legacy_with(answer(status=401))):
            with self.assertRaisesMessage(PanoptoAPIError, "legacyLogin answered 401"):
                client.legacy_session()

    def test_a_login_that_sets_no_cookie(self):
        client = with_token(make_client())
        with mock.patch.object(panopto.requests, "Session", return_value=legacy_with(answer(body={}), cookie=False)):
            with self.assertRaisesMessage(PanoptoAPIError, "legacyLogin set no cookie"):
                client.legacy_session()
        self.assertIsNone(cache.get(client._cookie_cache_key()))

    def test_an_unreachable_login(self):
        client = with_token(make_client())
        legacy = requests.Session()
        legacy.get = mock.Mock(side_effect=requests.ConnectionError("down"))
        with mock.patch.object(panopto.requests, "Session", return_value=legacy):
            with self.assertRaisesMessage(PanoptoAPIError, "Could not reach"):
                client.legacy_session()

    def test_forgetting_drops_the_cookie_for_every_worker(self):
        client = with_token(make_client())
        cache.set(client._cookie_cache_key(), {".ASPXAUTH": "old"})
        client.legacy_session()
        client.forget_legacy_session()
        self.assertIsNone(client._legacy)
        self.assertIsNone(cache.get(client._cookie_cache_key()))


class TestMediaIsReachable(NoSleepTestCase):
    def reach(self, response):
        client = make_client()
        legacy = mock.Mock()
        if isinstance(response, Exception):
            legacy.head.side_effect = response
        else:
            legacy.head.return_value = response
        client._legacy = legacy
        return client.media_is_reachable("s1"), legacy

    def test_a_video_answer_is_reachable(self):
        (reachable, detail), legacy = self.reach(answer(headers={"Content-Type": "video/mp4", "Content-Length": "1024"}))
        self.assertEqual((reachable, detail), (True, "1024"))
        self.assertEqual(legacy.head.call_args.args[0], f"{SERVICE}/Panopto/Podcast/Download/s1.mp4")
        self.assertEqual(legacy.head.call_args.kwargs["params"], PODCAST_PARAMS)

    def test_a_refusal_means_downloads_are_off(self):
        (reachable, detail), _ = self.reach(answer(status=403))
        self.assertFalse(reachable)
        self.assertIn("Downloads are probably switched off", detail)

    def test_a_page_instead_of_a_video(self):
        (reachable, detail), _ = self.reach(answer(headers={"Content-Type": "text/html"}))
        self.assertEqual((reachable, detail), (False, "the download URL answered 200 as text/html"))
        (reachable, detail), _ = self.reach(answer(status=404))
        self.assertEqual(detail, "the download URL answered 404 as nothing")

    def test_a_network_failure(self):
        (reachable, detail), _ = self.reach(requests.ConnectionError("reset"))
        self.assertEqual((reachable, detail), (False, "reset"))


FOLDERS = {
    "r1": {"Id": "r1", "Name": "Courses"},
    "c1": {"Id": "c1", "Name": "Biology", "ParentFolder": {"Id": "r1", "Name": "Courses"}},
    "g1": {"Id": "g1", "Name": "Week 1", "ParentFolder": {"Id": "c1", "Name": "Biology"}},
    "r2": {"Id": "r2", "Name": "archive"},
    "c2": {"Id": "c2", "Name": "Old", "ParentFolder": {"Id": "r2", "Name": "archive"}},
}

SEARCHED_SESSIONS = [
    {"Id": "s1", "Folder": "g1"},
    {"Id": "s2", "FolderDetails": {"Id": "c2"}},
    {"Id": "w1", "Folder": "c1", "IsWebcast": True},
    {"Name": "no id"},
]


class FakePanoptoClient:
    def __init__(self, calls=None, listings=None):
        self.calls = dict(calls or {})
        self.listings = dict(listings or {})
        self.asked = []
        self.timeout = 5
        self.reachable = (True, "1024")

    def call(self, path, **params):
        self.asked.append(path)
        if path not in self.calls:
            raise PanoptoAPIError(f"{path} does not exist on this Panopto")
        value = self.calls[path]
        if isinstance(value, Exception):
            raise value
        return value(**params) if callable(value) else value

    def results(self, path, **params):
        rows = self.listings.get(path, [])
        if isinstance(rows, Exception):
            raise rows
        yield from rows

    def token(self):
        return "tok"

    def media_is_reachable(self, session_id):
        self.asked.append(("reachable", session_id))
        return self.reachable

    def podcast_url(self, session_id):
        return f"{SERVICE}/Panopto/Podcast/Download/{session_id}.mp4"


def tree_client(**listings):
    calls = {f"/folders/{folder_id}": folder for folder_id, folder in FOLDERS.items()}
    rows = {
        "/sessions/search": SEARCHED_SESSIONS,
        "/folders/search": [{"Id": "c1"}, {"Id": "c2"}, {"Name": "no id"}],
        "/folders/r1/children": [{"Id": "c1"}],
        "/folders/c1/children": [{"Id": "g1"}, {"Name": "no id"}],
        "/folders/g1/sessions": [{"Id": "s3"}, {"Id": "w2", "IsWebcast": True}],
        "/folders/c1/sessions": [{"Id": "s4", "IsWebcast": True, "Duration": 30.0}],
    }
    rows.update(listings)
    return FakePanoptoClient(calls=calls, listings=rows)


def make_provider(client=None, **options):
    provider = PanoptoProvider(CONNECTION, options)
    provider._client = client or tree_client()
    return provider


class TestTheClientItBuilds(SimpleTestCase):
    def test_the_client_is_built_once_from_the_connection(self):
        provider = PanoptoProvider(CONNECTION, {})
        client = provider.client
        self.assertIs(provider.client, client)
        self.assertEqual(client.service_url, SERVICE)
        self.assertEqual((client.client_id, client.client_secret, client.username, client.password), ("client", "secret", "service@example.edu", "p<w>&d"))

    def test_an_empty_connection_still_builds_a_client(self):
        client = PanoptoClient(None, None, None, None, None)
        self.assertEqual((client.service_url, client.username), ("", ""))
        self.assertTrue(client.timeout)


class TestFolders(SimpleTestCase):
    def test_a_folder_is_fetched_once(self):
        provider = make_provider()
        provider.folder("c1")
        provider.folder("c1")
        self.assertEqual(provider._client.asked, ["/folders/c1"])

    def test_an_unreadable_folder_is_empty(self):
        provider = make_provider()
        self.assertEqual(provider.folder("gone"), {})

    def test_a_chain_climbs_to_the_root_innermost_first(self):
        self.assertEqual([node["Id"] for node in make_provider().chain("g1")], ["g1", "c1", "r1"])

    def test_a_chain_stops_at_a_parent_it_cannot_read(self):
        client = tree_client()
        del client.calls["/folders/r1"]
        self.assertEqual([node["Id"] for node in make_provider(client).chain("g1")], ["g1", "c1"])

    def test_within_folders(self):
        provider = make_provider()
        self.assertTrue(provider.within_folders("g1", ["r1"]))
        self.assertTrue(provider.within_folders("g1", ["g1"]))
        self.assertFalse(provider.within_folders("c2", ["r1"]))
        self.assertFalse(provider.within_folders("", ["r1"]))
        self.assertFalse(provider.within_folders(None, ["r1"]))

    def test_a_search_that_fails_finds_nothing_rather_than_failing(self):
        provider = make_provider(tree_client(**{"/folders/search": PanoptoAPIError("403")}))
        self.assertEqual(provider._search_folders(), [])

    def test_a_search_names_each_row_once(self):
        provider = make_provider(tree_client(**{"/folders/search": [{"Id": "c1"}, {"Id": "c1", "Name": "again"}, {"Name": "no id"}]}))
        self.assertEqual(provider._search_folders(), [{"Id": "c1", "Name": "again"}])

    def test_only_recordings_are_searched_sessions(self):
        self.assertEqual(sorted(make_provider()._search_sessions()), ["s1", "s2"])


class TestWalk(SimpleTestCase):
    def test_the_walk_collects_folders_and_their_recordings(self):
        folders, sessions = make_provider().walk(["r1"])
        self.assertEqual(sorted(folders), ["c1", "g1", "r1"])
        self.assertEqual(sorted(sessions), ["s3", "s4"])

    def test_an_unreadable_or_empty_folder_is_skipped(self):
        client = tree_client()
        client.calls["/folders/empty"] = None
        folders, _ = make_provider(client).walk(["gone", "empty", "c2"])
        self.assertEqual(list(folders), ["c2"])

    def test_a_folder_named_twice_is_walked_once(self):
        client = tree_client()
        make_provider(client).walk(["c2", "c2"])
        self.assertEqual(client.asked, ["/folders/c2"])

    def test_the_walk_is_bounded(self):
        folders, _ = make_provider().walk(["r1"], limit=2)
        self.assertEqual(len(folders), 2)


class TestDiscoverAndCheck(SimpleTestCase):
    def test_everything_reachable_by_search_and_by_walk(self):
        roots, folders, sessions = make_provider().discover()
        self.assertEqual(sorted(root["Id"] for root in roots), ["r1", "r2"])
        self.assertEqual(sorted(folders), ["c1", "c2", "g1", "r1", "r2"])
        self.assertEqual(sorted(sessions), ["s1", "s2", "s3", "s4"])

    def test_a_selection_keeps_only_what_is_under_it(self):
        roots, folders, sessions = make_provider().discover(["c1"])
        self.assertEqual(sorted(sessions), ["s1", "s3", "s4"])
        self.assertNotIn("s2", sessions)
        self.assertIn("r1", [root["Id"] for root in roots])

    def test_a_working_connection_reports_what_it_sees_and_tries_one_download(self):
        provider = make_provider(source_category_ids="r2")
        result = provider.check_connection()
        self.assertEqual(result, {"ok": True, "error": "", "stats": {"folders": 4, "entries": 1, "roots": 2, "walk_limit_reached": False, "downloads": "yes"}})
        self.assertIn(("reachable", "s2"), provider._client.asked)

    def test_a_download_that_is_refused_is_reported_but_not_a_failure(self):
        provider = make_provider(source_category_ids="r2")
        provider._client.reachable = (False, "Panopto refused the download.")
        result = provider.check_connection()
        self.assertTrue(result["ok"])
        self.assertEqual(result["stats"]["downloads"], "no: Panopto refused the download.")

    def test_with_nothing_to_download_no_download_is_tried(self):
        client = tree_client(**{"/sessions/search": [], "/folders/search": []})
        result = make_provider(client, source_category_ids="r2").check_connection()
        self.assertEqual(result["stats"]["downloads"], "no recording to try")
        self.assertEqual(result["stats"]["entries"], 0)

    def test_refused_credentials(self):
        provider = make_provider()
        with mock.patch.object(provider._client, "token", side_effect=PanoptoAPIError("invalid_grant: bad password")):
            self.assertEqual(provider.check_connection(), {"ok": False, "error": "invalid_grant: bad password", "stats": {}})

    def test_a_listing_that_fails_mid_walk(self):
        client = tree_client(**{"/folders/r2/sessions": PanoptoAPIError("/folders/r2/sessions answered 500: boom")})
        result = make_provider(client, source_category_ids="r2").check_connection()
        self.assertEqual(result, {"ok": False, "error": "/folders/r2/sessions answered 500: boom", "stats": {}})

    def test_the_picker_lists_roots_with_what_they_hold_sorted_by_name(self):
        self.assertEqual(
            make_provider().list_categories(),
            [
                {"id": "r2", "name": "archive", "path": "archive", "entries": 1, "folders": 2, "kind": "panopto"},
                {"id": "r1", "name": "Courses", "path": "Courses", "entries": 1, "folders": 3, "kind": "panopto"},
            ],
        )


class TestFetch(SimpleTestCase):
    def test_a_folder_as_a_category(self):
        self.assertEqual(
            make_provider().fetch_category("g1"),
            {"id": "g1", "name": "Week 1", "fullName": "Biology>Week 1", "parentName": "Biology", "parentId": "c1", "description": ""},
        )

    def test_a_folder_that_answers_nothing(self):
        client = tree_client()
        client.calls["/folders/x"] = None
        self.assertEqual(make_provider(client).fetch_category("x"), {"id": "x", "name": "", "fullName": "", "parentName": "", "parentId": "", "description": ""})

    def test_a_recording_with_its_owner_folder_file_and_caption(self):
        client = tree_client()
        client.calls["/sessions/s1"] = {
            "Id": "s1",
            "Name": "Lecture 4",
            "Description": "the fourth",
            "Duration": 61.5,
            "StartTime": "2026-08-03T15:03:18Z",
            "CreatedBy": {"Id": "u1", "Username": "jdoe"},
            "Folder": "g1",
            "Urls": {"DownloadUrl": "https://dl.example/s1.mp4", "CaptionDownloadUrl": "https://dl.example/s1.srt"},
        }
        self.assertEqual(
            make_provider(client).fetch_media("s1"),
            {
                "id": "s1",
                "title": "Lecture 4",
                "description": "the fourth",
                "duration": 61.5,
                "created_at": "2026-08-03T15:03:18Z",
                "owner": {"id": "u1", "username": "jdoe"},
                "folder": {"id": "g1", "name": "Week 1", "fullName": "Biology>Week 1", "parentId": "c1", "parentName": "Biology"},
                "download_url": "https://dl.example/s1.mp4",
                "captions": [{"language": "en", "url": "https://dl.example/s1.srt"}],
            },
        )

    def test_a_recording_with_no_download_url_uses_the_podcast_url(self):
        client = tree_client()
        client.calls["/sessions/s9"] = {"Id": "s9", "FolderDetails": {"Id": "gone", "Name": "Hidden"}}
        media = make_provider(client).fetch_media("s9")
        self.assertEqual(media["download_url"], f"{SERVICE}/Panopto/Podcast/Download/s9.mp4")
        self.assertEqual(media["folder"], {"id": "gone", "name": "Hidden", "fullName": "", "parentId": "", "parentName": ""})
        self.assertEqual(media["captions"], [])
        self.assertEqual(media["owner"], {"id": "", "username": ""})

    def test_a_recording_in_no_folder(self):
        client = tree_client()
        client.calls["/sessions/s8"] = None
        media = make_provider(client).fetch_media("s8")
        self.assertEqual(media["id"], "s8")
        self.assertEqual(media["folder"]["id"], "")

    def test_a_user(self):
        client = tree_client()
        client.calls["/users/u1"] = {"Id": "u1", "Username": "jdoe", "Email": " jdoe@example.edu ", "FirstName": " Jane ", "LastName": ""}
        self.assertEqual(make_provider(client).fetch_user("u1"), {"id": "u1", "username": "jdoe", "email": "jdoe@example.edu", "fullName": "Jane"})

    def test_a_user_panopto_says_nothing_about(self):
        client = tree_client()
        client.calls["/users/u2"] = None
        self.assertEqual(make_provider(client).fetch_user("u2"), {"id": "u2", "username": "", "email": "", "fullName": ""})


class TestListUsers(SimpleTestCase):
    def test_a_page_of_users_from_soap(self):
        provider = make_provider()
        provider._client.soap = mock.Mock(return_value=ElementTree.fromstring(SOAP_ANSWER))

        self.assertEqual(provider.list_users(2, 50), (["u-1", "u-2"], 7))
        operation, body = provider._client.soap.call_args.args
        self.assertEqual(operation, "ListUsers")
        self.assertIn("<d:MaxNumberResults>50</d:MaxNumberResults><d:PageNumber>2</d:PageNumber>", body)

    def test_an_answer_without_a_total(self):
        provider = make_provider()
        provider._client.soap = mock.Mock(return_value=ElementTree.fromstring(b"<Envelope/>"))
        self.assertEqual(provider.list_users(0, 50), ([], 0))

    def test_the_users_phase_stops_on_an_empty_page(self):
        provider = make_provider()
        with mock.patch.object(provider, "list_users", return_value=([], 10)):
            self.assertEqual(provider.list_page("users", {"page": 4}, 2), ([], {"page": 4}))


class TestMediaSweep(SimpleTestCase):
    def sweep(self, pages, **options):
        client = tree_client()
        client.calls["/sessions/search"] = lambda searchQuery, pageNumber: {"Results": pages[pageNumber]} if pageNumber < len(pages) else {}
        return make_provider(client, **options)

    def test_every_recording_without_a_selection(self):
        provider = self.sweep([SEARCHED_SESSIONS])
        self.assertEqual(provider.list_page("media", {}, 50), (["s1", "s2"], {"page": 1}))
        self.assertEqual(provider.list_page("media", {"page": 1}, 50), ([], {"page": 1}))

    def test_only_recordings_under_the_chosen_folders(self):
        provider = self.sweep([SEARCHED_SESSIONS], source_category_ids="r1")
        self.assertEqual(provider.list_page("media", None, 50), (["s1"], {"page": 1}))

    def test_a_page_the_selection_empties_is_not_the_end(self):
        provider = self.sweep([[{"Id": "s2", "FolderDetails": {"Id": "c2"}}], [{"Id": "s1", "Folder": "g1"}]], source_category_ids="r1")
        self.assertEqual(provider.list_page("media", {}, 50), (["s1"], {"page": 2}))

    def test_a_sweep_that_never_ends_is_cut_off(self):
        client = tree_client()
        client.calls["/sessions/search"] = {"Results": [{"Id": "s2", "FolderDetails": {"Id": "c2"}}]}
        provider = make_provider(client, source_category_ids="r1")
        with mock.patch.object(panopto, "MAX_PAGES", 3):
            self.assertEqual(provider.list_page("media", {}, 50), ([], {"page": 4}))


class TestDownload(NoSleepTestCase):
    def setUp(self):
        super().setUp()
        self.dest_dir = tempfile.mkdtemp(prefix="panopto-test-")
        self.addCleanup(shutil.rmtree, self.dest_dir, True)
        self.dest = os.path.join(self.dest_dir, "s1.mp4")
        self.provider = PanoptoProvider(CONNECTION, {})
        self.provider._client = with_token(make_client())

    def legacy(self, response):
        session = mock.Mock()
        if isinstance(response, Exception):
            session.get.side_effect = response
        else:
            response.iter_content.return_value = [b"abc", b"", b"defg"]
            session.get.return_value = response
        return session

    def test_the_recording_is_streamed_to_disk(self):
        legacy = self.legacy(answer(body={}))
        self.provider._client._legacy = legacy

        self.assertEqual(self.provider.download("https://dl.example/s1.mp4", self.dest), 7)
        with open(self.dest, "rb") as written:
            self.assertEqual(written.read(), b"abcdefg")
        self.assertEqual(legacy.get.call_args.kwargs["params"], PODCAST_PARAMS)
        self.assertTrue(legacy.get.call_args.kwargs["stream"])

    def test_a_stale_cookie_is_replaced_once(self):
        stale, fresh = self.legacy(answer(status=403)), self.legacy(answer(body={}))
        with mock.patch.object(self.provider._client, "legacy_session", side_effect=[stale, fresh]), mock.patch.object(self.provider._client, "forget_legacy_session") as forget:
            self.assertEqual(self.provider.download("https://dl.example/s1.mp4", self.dest), 7)
        forget.assert_called_once_with()

    def test_a_refusal_with_a_fresh_cookie_too_is_an_error(self):
        sessions = [self.legacy(answer(status=401)), self.legacy(answer(status=403))]
        with mock.patch.object(self.provider._client, "legacy_session", side_effect=sessions):
            with self.assertRaisesMessage(PanoptoAPIError, "even with a fresh session"):
                self.provider.download("https://dl.example/s1.mp4", self.dest)

    def test_a_rate_limited_download_waits_and_tries_again(self):
        sessions = [self.legacy(answer(status=429, headers={"Retry-After": "4"})), self.legacy(answer(body={}))]
        with mock.patch.object(self.provider._client, "legacy_session", side_effect=sessions):
            self.assertEqual(self.provider.download("https://dl.example/s1.mp4", self.dest), 7)
        self.sleep.assert_called_once_with(4)

    def test_a_server_error_is_not_retried(self):
        self.provider._client._legacy = self.legacy(answer(status=500))
        with self.assertRaisesMessage(PanoptoAPIError, "https://dl.example/s1.mp4 answered 500"):
            self.provider.download("https://dl.example/s1.mp4", self.dest)

    def test_a_dropped_connection(self):
        self.provider._client._legacy = self.legacy(requests.ConnectionError("reset by peer"))
        with self.assertRaisesMessage(PanoptoAPIError, "Could not fetch https://dl.example/s1.mp4: reset by peer"):
            self.provider.download("https://dl.example/s1.mp4", self.dest)
