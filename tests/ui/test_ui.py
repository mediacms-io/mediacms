from django.test import TestCase
from selenium import webdriver
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities


class SeleniumTest(TestCase):
    def setUp(self):
        self.chrome = webdriver.Remote(command_executor='http://selenium_hub:4444/wd/hub', desired_capabilities=DesiredCapabilities.CHROME)
        self.chrome.implicitly_wait(10)

    def test_visit_site_with_chrome(self):
        self.chrome.get('http://web')
        home_nav = self.chrome.find_element_by_xpath("//*[@id="app-sidebar"]/div/div/div[1]/nav/ul/li[1]/a")
        self.assertIn(home_nav.text , "Home")
        self.assertIn(home_nav.get_attribute("href"), '/')