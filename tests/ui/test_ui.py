from django.test import LiveServerTestCase
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


class TestUI(LiveServerTestCase):
    options = webdriver.ChromeOptions()
    options.add_argument("--headless")
    driver = webdriver.Chrome(executable_path=r"./chromedriver", options=options)

    def test_featured_url(self, driver):
        driver.get(("%s%s" % (self.live_server_url, "/")))
        WebDriverWait(driver, 20).until(EC.element_to_be_clickable((By.XPATH, "//*[@id='app-sidebar']/div/div/div[1]/nav/ul/li[2]/a"))).click()
        assert driver.getCurrentUrl() == 'localhost/featured'
