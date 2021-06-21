from django.test import LiveServerTestCase
from selenium import webdriver


class TestBrowser1(LiveServerTestCase):
    def test_example(self):
        options = webdriver.ChromeOptions()
        options.add_argument("--headless")
        driver = webdriver.Chrome(executable_path=r"./chromedriver", options=options)
        driver.get(("%s%s" % (self.live_server_url, "/admin/")))
        assert "Log in | Django site admin" in driver.title
