import pytest

from django.test import LiveServerTestCase
from selenium import webdriver
from webdriver_manager.chrome import ChromeDriverManager


class TestBrowser1(LiveServerTestCase):
    def test_example(self):
        driver = webdriver.Chrome(ChromeDriverManager().install())
        driver.get(("%s%s" % (self.live_server_url, "/admin/")))
        assert "Log in | Django site admin" in driver.title
