from unittest.mock import patch

from tests.saml.test_saml_views import ORG, SAMLViewsTestCase, fake_auth


class SAMLLoginLoggingTest(SAMLViewsTestCase):
    def test_cancelled_saml_login_logs_organization_and_ip(self):
        self.client.post(f"/saml/{ORG}/acs/", {"SAMLResponse": "ignored-by-mock", "RelayState": ""}, REMOTE_ADDR="198.51.100.4")
        with self.assertLogs("saml_auth.custom.views", level="WARNING") as logs:
            with patch("saml_auth.custom.views.build_auth", return_value=fake_auth(authenticated=False)):
                self.client.get(f"/saml/{ORG}/acs/finish/", REMOTE_ADDR="198.51.100.4")
        self.assertIn(f"Login failed (SAML) - authentication_cancelled, organization_slug={ORG}, ip=198.51.100.4", logs.output[0])
