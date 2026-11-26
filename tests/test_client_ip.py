from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.db import SessionStore
from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings

from cms.middleware import ProxyAwareMiddleware
from cms.utils import get_client_ip, get_client_ip_for_logging
from files.methods import get_user_or_session

PROXIES = ["10.0.0.0/8", "fd00::1"]


def make_request(remote_addr="10.0.0.1", **headers):
    return RequestFactory().get("/", REMOTE_ADDR=remote_addr, **headers)


@override_settings(TRUSTED_PROXIES=PROXIES)
class GetClientIpTest(SimpleTestCase):
    def assert_client_ip(self, expected, remote_addr="10.0.0.1", **headers):
        self.assertEqual(get_client_ip(make_request(remote_addr, **headers)), expected)

    def test_ipv4(self):
        self.assert_client_ip("203.0.113.7", HTTP_X_FORWARDED_FOR="203.0.113.7")

    def test_ipv4_with_port(self):
        self.assert_client_ip("203.0.113.7", HTTP_X_FORWARDED_FOR="203.0.113.7:51234")

    def test_ipv6(self):
        self.assert_client_ip("2001:db8::7", HTTP_X_FORWARDED_FOR="2001:db8::7")

    def test_ipv6_with_port(self):
        self.assert_client_ip("2001:db8::7", HTTP_X_FORWARDED_FOR="[2001:db8::7]:51234")

    def test_trusted_proxy_hops_are_skipped(self):
        self.assert_client_ip("203.0.113.7", HTTP_X_FORWARDED_FOR="198.51.100.1, 203.0.113.7, 10.1.2.3")

    def test_ipv6_proxy_peer(self):
        self.assert_client_ip("203.0.113.7", remote_addr="fd00::1", HTTP_X_FORWARDED_FOR="203.0.113.7")

    def test_untrusted_peer_cannot_spoof(self):
        self.assert_client_ip("198.51.100.9", remote_addr="198.51.100.9", HTTP_X_FORWARDED_FOR="203.0.113.7")

    def test_every_hop_trusted_returns_first_hop(self):
        self.assert_client_ip("10.9.9.9", HTTP_X_FORWARDED_FOR="10.9.9.9, 10.1.2.3")

    def test_invalid_entries_are_skipped(self):
        self.assert_client_ip("203.0.113.7", HTTP_X_FORWARDED_FOR="203.0.113.7, not-an-ip, 10.1.2.3")

    def test_only_invalid_entries_fall_back_to_remote_addr(self):
        self.assert_client_ip("10.0.0.1", HTTP_X_FORWARDED_FOR="garbage, unknown")

    def test_x_real_ip(self):
        self.assert_client_ip("2001:db8::7", HTTP_X_REAL_IP="[2001:db8::7]:443")

    def test_invalid_x_real_ip_is_ignored(self):
        self.assert_client_ip("10.0.0.1", HTTP_X_REAL_IP="evil")

    def test_no_remote_addr(self):
        request = make_request()
        del request.META["REMOTE_ADDR"]
        self.assertIsNone(get_client_ip(request))

    @override_settings(TRUSTED_PROXIES=[])
    def test_headers_ignored_without_trusted_proxies(self):
        self.assert_client_ip("10.0.0.1", HTTP_X_FORWARDED_FOR="203.0.113.7")

    @override_settings(TRUSTED_PROXIES=["not-a-network", "10.0.0.0/8"])
    def test_invalid_trusted_proxy_entry_is_ignored(self):
        with self.assertLogs("cms.utils", "WARNING"):
            self.assert_client_ip("203.0.113.7", HTTP_X_FORWARDED_FOR="203.0.113.7")

    def test_for_logging_prefers_middleware_value(self):
        request = make_request(HTTP_X_FORWARDED_FOR="203.0.113.7")
        self.assertEqual(get_client_ip_for_logging(request), "203.0.113.7")
        request.client_ip = "198.51.100.1"
        self.assertEqual(get_client_ip_for_logging(request), "198.51.100.1")
        del request.META["REMOTE_ADDR"]
        del request.client_ip
        self.assertEqual(get_client_ip_for_logging(request), "unknown")


@override_settings(TRUSTED_PROXIES=PROXIES, PROXY_AWARE_MIDDLEWARE_ENABLED=True)
class ProxyAwareMiddlewareTest(SimpleTestCase):
    def run_middleware(self, request):
        return ProxyAwareMiddleware(lambda r: HttpResponse())(request)

    def test_sets_client_ip_and_keeps_remote_addr(self):
        request = make_request(HTTP_X_FORWARDED_FOR="203.0.113.7")
        self.run_middleware(request)
        self.assertEqual(request.client_ip, "203.0.113.7")
        self.assertEqual(request.META["REMOTE_ADDR"], "10.0.0.1")

    @override_settings(SET_REAL_IP_IN_META=True)
    def test_rewrites_remote_addr_when_enabled(self):
        request = make_request(HTTP_X_FORWARDED_FOR="203.0.113.7")
        self.run_middleware(request)
        self.assertEqual(request.META["REMOTE_ADDR"], "203.0.113.7")
        self.assertEqual(request.META["ORIGINAL_REMOTE_ADDR"], "10.0.0.1")

    @override_settings(PROXY_AWARE_MIDDLEWARE_ENABLED=False, SET_REAL_IP_IN_META=True)
    def test_disabled_uses_remote_addr(self):
        request = make_request(HTTP_X_FORWARDED_FOR="203.0.113.7")
        self.run_middleware(request)
        self.assertEqual(request.client_ip, "10.0.0.1")
        self.assertEqual(request.META["REMOTE_ADDR"], "10.0.0.1")


@override_settings(TRUSTED_PROXIES=PROXIES, MASK_IPS_FOR_ACTIONS=False)
class GetUserOrSessionTest(TestCase):
    def test_anonymous_actions_use_client_ip(self):
        request = make_request(HTTP_X_FORWARDED_FOR="203.0.113.7")
        request.user = AnonymousUser()
        request.session = SessionStore()
        self.assertEqual(get_user_or_session(request)["remote_ip_addr"], "203.0.113.7")
