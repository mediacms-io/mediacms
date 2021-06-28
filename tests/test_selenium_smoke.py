from django.test import TestCase
from selenium import webdriver
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities


class SeleniumTest(TestCase):
    def test_example(self):
        options = webdriver.ChromeOptions()
        options.add_argument("--headless")
        driver = webdriver.Chrome(executable_path=r"./chromedriver", options=options)
        driver.get(("%s%s" % (self.live_server_url, "/admin/")))
        assert "Log in | Django site admin" in driver.title

    def setUp(self):
        self.chrome = webdriver.Remote(command_executor='http://selenium_hub:4444/wd/hub', desired_capabilities=DesiredCapabilities.CHROME)

        self.chrome.implicitly_wait(10)

        self.firefox = webdriver.Remote(command_executor='http://selenium_hub:4444/wd/hub', desired_capabilities=DesiredCapabilities.FIREFOX)

        self.firefox.implicitly_wait(10)

    def test_visit_site_with_chrome(self):
        self.chrome.get('http://web:80/admin')
        self.assertIn(self.chrome.title, "Log in | Django site admin")

    def test_visit_site_with_firefox(self):
        self.firefox.get('http://web:80/admin')
        self.assertIn(self.firefox.title, "Log in | Django site admin")
