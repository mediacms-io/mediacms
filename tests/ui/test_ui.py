import time

from django.test import LiveServerTestCase
from selenium import webdriver


class TestUI(LiveServerTestCase):
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    driver = webdriver.Chrome(executable_path=r"./chromedriver", options=options)

    def test_featured_url(self, driver):
        driver.get(("%s%s" % (self.live_server_url, "/")))
        featured_button = driver.find_elements_by_xpath("//*[@id='app-sidebar']/div/div/div[1]/nav/ul/li[2]/a")
        featured_button.click()
        time.wait(10)
        assert driver.getCurrentUrl() == 'localhost/featured'
