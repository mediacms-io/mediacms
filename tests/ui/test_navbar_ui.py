from django.test import TestCase
from selenium import webdriver


class SeleniumTest(TestCase):
    def setUp(self):
        options = webdriver.ChromeOptions()
        options.add_argument('--headless')
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-gpu")
        options.add_argument("--remote-debugin-port=9222")
        options.add_argument("--screen-size=1200x800")
        self.chrome = webdriver.Remote(command_executor='http://selenium_hub:4444/wd/hub', desired_capabilities=options.to_capabilities())
        self.chrome.implicitly_wait(10)
        self.chrome.get('http://web/')

    def test_home_nav(self):
        home_nav = self.chrome.find_element_by_xpath("/html/body/div[2]/div/div/div[1]/nav/ul/li[1]/a")
        self.assertIn(home_nav.text, "Home")
        self.assertIn(home_nav.get_attribute("href"), 'http://web/')
        home_nav.click()
        self.assertIn(self.chrome.current_url, "http://web/")
        self.chrome.close()

    # def test_featured_nav(self):
    #     featured_nav = self.chrome.find_element_by_xpath("/html/body/div[2]/div/div/div[1]/nav/ul/li[2]/a")
    #     self.assertIn(featured_nav.text, "Featued")
    #     self.assertIn(featured_nav.get_attribute("href"), 'http://web/featured')
    #     featured_nav.click()
    #     self.assertIn(self.chrome.current_url, "http://web/featured")

    # def test_recommended_nav(self):
    #     recommended_nav = self.chrome.find_element_by_xpath("/html/body/div[2]/div/div/div[1]/nav/ul/li[3]/a")
    #     self.assertIn(recommended_nav.text, "Recommended")
    #     self.assertIn(recommended_nav.get_attribute("href"), 'http://web/recommended')
    #     recommended_nav.click()
    #     self.assertIn(self.chrome.current_url, "http://web/recommended")

    # def test_recent_nav(self):
    #     featured_nav = self.chrome.find_element_by_xpath("/html/body/div[2]/div/div/div[1]/nav/ul/li[4]/a")
    #     self.assertIn(featured_nav.text, "Latest")
    #     self.assertIn(featured_nav.get_attribute("href"), 'http://web/latest')
    #     featured_nav.click()
    #     self.assertIn(self.chrome.current_url, "http://web/latest")

    # def test_tags_nav(self):
    #     tags_nav = self.chrome.find_element_by_xpath("/html/body/div[2]/div/div/div[1]/nav/ul/li[5]/a")
    #     self.assertIn(tags_nav.text, "Tags")
    #     self.assertIn(tags_nav.get_attribute("href"), 'http://web/tags')
    #     tags_nav.click()
    #     self.assertIn(self.chrome.current_url, "http://web/tags")

    # def test_categories_nav(self):
    #     categories_nav = self.chrome.find_element_by_xpath("/html/body/div[2]/div/div/div[1]/nav/ul/li[6]/a")
    #     self.assertIn(categories_nav.text, "Categories")
    #     self.assertIn(categories_nav.get_attribute("href"), 'http://web/categories')
    #     categories_nav.click()
    #     self.assertIn(self.chrome.current_url, "http://web/categories")

    # def test_members_nav(self):
    #     members_nav = self.chrome.find_element_by_xpath("/html/body/div[2]/div/div/div[1]/nav/ul/li[7]/a")
    #     self.assertIn(members_nav.text, "Members")
    #     self.assertIn(members_nav.get_attribute("href"), 'http://web/members')
    #     members_nav.click()
    #     self.assertIn(self.chrome.current_url, "http://web/members")

    # def test_history_nav(self):
    #     history_nav = self.chrome.find_element_by_xpath("/html/body/div[2]/div/div/div[1]/nav/ul/li[8]/a")
    #     self.assertIn(history_nav.text, "History")
    #     self.assertIn(history_nav.get_attribute("href"), 'http://web/history')
    #     history_nav.click()
    #     self.assertIn(self.chrome.current_url, "http://web/history")

    # def test_liked_nav(self):
    #     liked_nav = self.chrome.find_element_by_xpath("/html/body/div[2]/div/div/div[1]/nav/ul/li[9]/a")
    #     self.assertIn(liked_nav.text, "Liked media")
    #     self.assertIn(liked_nav.get_attribute("href"), 'http://web/liked')
    #     liked_nav.click()
    #     self.assertIn(self.chrome.current_url, "http://web/liked")

    # def test_about_nav(self):
    #     about_nav = self.chrome.find_element_by_xpath("/html/body/div[2]/div/div/div[1]/nav/ul/li[10]/a")
    #     self.assertIn(about_nav.text, "About")
    #     self.assertIn(about_nav.get_attribute("href"), 'http://web/about')
    #     about_nav.click()
    #     self.assertIn(self.chrome.current_url, "http://web/about")

    # def test_terms_nav(self):
    #     terms_nav = self.chrome.find_element_by_xpath("/html/body/div[2]/div/div/div[1]/nav/ul/li[11]/a")
    #     self.assertIn(terms_nav.text, "Terms")
    #     self.assertIn(terms_nav.get_attribute("href"), 'http://web/tos')
    #     terms_nav.click()
    #     self.assertIn(self.chrome.current_url, "http://web/tos")

    # def test_contact_nav(self):
    #     contact_nav = self.chrome.find_element_by_xpath("/html/body/div[2]/div/div/div[1]/nav/ul/li[12]/a")
    #     self.assertIn(contact_nav.text, "Contact")
    #     self.assertIn(contact_nav.get_attribute("href"), 'http://web/contact')
    #     contact_nav.click()
    #     self.assertIn(self.chrome.current_url, "http://web/contact")
