# Festivalinfo.nl Scraping Guide (Revised for 403 Error)

## Addressing 403 Forbidden Errors

When encountering `HTTP error! Status: 403` while scraping Festivalinfo.nl, this indicates the website is actively blocking scraping attempts. This is a common protection mechanism that detects and blocks automated requests. Here's a revised approach to overcome this challenge:

## Solution Strategy

### 1. Browser Emulation Approach

Instead of using simple HTTP requests, use a browser automation tool that can fully emulate a real browser:

```python
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import random
import os

def download_festivalinfo_pages(num_weeks=10):
    # Setup WebDriver with stealth configuration
    options = Options()
    
    # Complete browser profile
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--no-sandbox")
    
    # Add realistic user agent
    user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    options.add_argument(f'user-agent={user_agent}')
    
    # Create download directory if it doesn't exist
    os.makedirs("festivalinfo_html", exist_ok=True)
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    try:
        # First visit the main site to get cookies
        driver.get("https://www.festivalinfo.nl/")
        time.sleep(random.uniform(3, 5))
        
        # Accept cookies if present
        try:
            cookie_buttons = driver.find_elements_by_xpath("//*[contains(text(), 'accepteer') or contains(text(), 'Accepteer') or contains(text(), 'cookies') or contains(text(), 'Cookies')]")
            if cookie_buttons:
                cookie_buttons[0].click()
                time.sleep(random.uniform(1, 2))
        except Exception as e:
            print(f"Cookie notice handling error: {e}")
        
        # Random browsing behavior before going to festivals page
        general_pages = [
            "https://www.festivalinfo.nl/news/overzicht/",
            "https://www.festivalinfo.nl/artists/",
            "https://www.festivalinfo.nl/reviews/"
        ]
        
        # Visit 1-2 random pages first
        for _ in range(random.randint(1, 2)):
            random_page = random.choice(general_pages)
            driver.get(random_page)
            time.sleep(random.uniform(2, 4))
            
            # Scroll a bit on the page
            for _ in range(random.randint(2, 5)):
                scroll_amount = random.randint(100, 500)
                driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
                time.sleep(random.uniform(0.5, 1.5))
        
        # Now fetch festival pages with more human-like behavior
        for week in range(num_weeks):
            if week == 0:
                url = "https://www.festivalinfo.nl/festivals/"
            else:
                url = f"https://www.festivalinfo.nl/festivals/?page={week}"
            
            # Random delay between page visits
            time.sleep(random.uniform(4, 8))
            
            print(f"Navigating to week {week}...")
            driver.get(url)
            
            # Check for 403 or error page
            if "403" in driver.title or "Forbidden" in driver.page_source or "Access Denied" in driver.page_source:
                print(f"Detected blocking for week {week}! Waiting longer...")
                time.sleep(random.uniform(20, 30))  # Wait longer before retry
                
                # Try refreshing with different approach
                driver.execute_script("location.reload(true);")
                time.sleep(random.uniform(3, 5))
                
                # If still blocked, skip this page
                if "403" in driver.title or "Forbidden" in driver.page_source:
                    print(f"Still blocked for week {week}, skipping...")
                    continue
            
            # Successful page load - mimic human reading behavior
            print(f"Successfully loaded week {week}")
            
            # Random scrolling pattern
            scroll_count = random.randint(4, 8)
            for i in range(scroll_count):
                # Scroll down with random amount
                scroll_amount = random.randint(200, 600)
                driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
                
                # Random pause (longer pauses to simulate reading)
                time.sleep(random.uniform(1, 3))
                
                # Occasionally scroll back up a bit
                if random.random() < 0.3:  # 30% chance
                    driver.execute_script(f"window.scrollBy(0, {-random.randint(50, 200)});")
                    time.sleep(random.uniform(0.5, 1.5))
            
            # Save the HTML content
            with open(f"festivalinfo_html/week_{week}.html", "w", encoding="utf-8") as f:
                f.write(driver.page_source)
            
            print(f"Saved HTML for week {week}")
            
            # Extract festival detail links
            detail_links = []
            links = driver.find_elements_by_css_selector("a[href*='/festival/']")
            for link in links:
                href = link.get_attribute("href")
                if href and "/festival/" in href and href not in detail_links:
                    detail_links.append(href)
            
            # Visit some (not all) detail pages to appear more human-like
            sample_size = min(len(detail_links), random.randint(3, 6))
            selected_details = random.sample(detail_links, sample_size)
            
            for i, detail_url in enumerate(selected_details):
                try:
                    festival_id = detail_url.split("/")[-2] if detail_url.endswith("/") else detail_url.split("/")[-1]
                    
                    # Random delay before visiting detail page
                    time.sleep(random.uniform(3, 7))
                    
                    print(f"Visiting detail page {i+1}/{sample_size}: {festival_id}")
                    driver.get(detail_url)
                    
                    # Check for blocking
                    if "403" in driver.title or "Forbidden" in driver.page_source:
                        print("Detail page blocked, waiting...")
                        time.sleep(random.uniform(15, 25))
                        continue
                    
                    # Random scrolling pattern on detail page
                    for _ in range(random.randint(3, 7)):
                        driver.execute_script(f"window.scrollBy(0, {random.randint(100, 400)});")
                        time.sleep(random.uniform(0.7, 2))
                    
                    # Save the detail page
                    with open(f"festivalinfo_html/detail_{festival_id}.html", "w", encoding="utf-8") as f:
                        f.write(driver.page_source)
                    
                    print(f"Saved detail page for {festival_id}")
                    
                    # Go back to festivals page after viewing some detail pages
                    if i == sample_size - 1 and random.random() < 0.7:  # 70% chance
                        driver.back()
                        time.sleep(random.uniform(2, 4))
                        
                except Exception as e:
                    print(f"Error processing detail page {detail_url}: {e}")
                    
            # After each week page, take a longer break
            wait_time = random.uniform(10, 20)
            print(f"Taking a break for {wait_time:.1f} seconds...")
            time.sleep(wait_time)
            
    except Exception as e:
        print(f"Error during scraping: {e}")
    finally:
        driver.quit()

    print("Finished downloading festival pages")
```

### 2. Enhanced Anti-Detection Measures

Here are additional techniques to help avoid detection:

#### Use Stealth Plugins

If available, use a stealth plugin for your browser automation:

```python
from selenium_stealth import stealth

# After creating the driver:
stealth(
    driver,
    languages=["nl-NL", "nl", "en-US", "en"],
    vendor="Google Inc.",
    platform="Win32",
    webgl_vendor="Intel Inc.",
    renderer="Intel Iris OpenGL Engine",
    fix_hairline=True,
)
```

#### Implement Browser Fingerprint Randomization

To further evade detection, randomize browser fingerprints:

```python
def get_random_viewport_size():
    common_sizes = [
        (1366, 768),
        (1440, 900),
        (1536, 864),
        (1920, 1080),
        (1280, 720)
    ]
    return random.choice(common_sizes)

# In the main function
viewport_size = get_random_viewport_size()
options.add_argument(f"--window-size={viewport_size[0]},{viewport_size[1]}")
```

#### Rotate User Agents Regularly

```python
def get_random_user_agent():
    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0'
    ]
    
    # Include mobile user agents occassionally
    if random.random() < 0.1:  # 10% chance of mobile UA
        mobile_uas = [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Android 14; Mobile; rv:123.0) Gecko/123.0 Firefox/123.0'
        ]
        user_agents.extend(mobile_uas)
    
    return random.choice(user_agents)
```

### 3. Use Proxy Rotation

If the site is blocking based on IP address, rotate proxies:

```python
def get_random_proxy():
    proxies = [
        # Add your proxy list here
        "http://proxy1:port",
        "http://proxy2:port",
        "http://proxy3:port"
    ]
    return random.choice(proxies)

# In ChromeOptions setup
proxy = get_random_proxy()
options.add_argument(f'--proxy-server={proxy}')
```

### 4. Implement Advanced Session Handling

Maintain and reuse session cookies to appear as a returning visitor:

```python
import pickle
import os

def save_cookies(driver, path):
    with open(path, 'wb') as file:
        pickle.dump(driver.get_cookies(), file)

def load_cookies(driver, path):
    if os.path.exists(path):
        with open(path, 'rb') as file:
            cookies = pickle.load(file)
            for cookie in cookies:
                driver.add_cookie(cookie)
        return True
    return False

# In main function:
cookie_path = "festivalinfo_cookies.pkl"

# First visit to get cookies
driver.get("https://www.festivalinfo.nl/")
time.sleep(3)

# Handle any cookie popups
# ...

# Save the cookies for future use
save_cookies(driver, cookie_path)

# For subsequent runs, you can load the cookies
# driver.get("https://www.festivalinfo.nl/")
# load_cookies(driver, cookie_path)
# driver.refresh()
```

### 5. Implement Browser Profiles

Use a persistent browser profile that maintains history, cookies, and cache:

```python
def setup_driver_with_profile():
    options = Options()
    
    # Set up a custom profile directory
    profile_dir = os.path.join(os.getcwd(), "festivalinfo_profile")
    os.makedirs(profile_dir, exist_ok=True)
    
    options.add_argument(f"user-data-dir={profile_dir}")
    options.add_argument(f"--profile-directory=FestivalInfo")
    
    # Other options
    options.add_argument(f"user-agent={get_random_user_agent()}")
    options.add_argument("--disable-blink-features=AutomationControlled")
    
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
```

### 6. Timing and Request Pattern Variations

Implement extreme randomization in timing patterns:

```python
def random_human_delay():
    # Base delay
    delay = random.uniform(3, 7)
    
    # Occasionally add a longer delay (simulate distraction)
    if random.random() < 0.15:  # 15% chance
        delay += random.uniform(5, 15)
    
    # Very rarely add a much longer delay (simulate break)
    if random.random() < 0.05:  # 5% chance
        delay += random.uniform(30, 120)
    
    return delay
```

### 7. Parse Local HTML as Fallback

If direct scraping continues to fail, you can try an alternative approach by using pre-downloaded HTML files or web archives:

```python
def scrape_from_archive(festival_name, year):
    """
    Attempt to find data from web archives like Wayback Machine
    as a last resort when direct scraping is consistently blocked
    """
    import requests
    
    # Format Wayback Machine API URL
    url = f"https://archive.org/wayback/available?url=https://www.festivalinfo.nl/festival/{festival_name}/{year}/"
    
    response = requests.get(url)
    data = response.json()
    
    if "archived_snapshots" in data and "closest" in data["archived_snapshots"]:
        snapshot_url = data["archived_snapshots"]["closest"]["url"]
        print(f"Found archive for {festival_name}: {snapshot_url}")
        
        # Fetch the archived page
        archived_page = requests.get(snapshot_url)
        
        # Return the archived HTML content
        return archived_page.text
    
    return None
```

## Complete Revised Scraping Strategy

Combine all these approaches into a robust scraping strategy:

1. Use full browser emulation with randomized behavior
2. Implement multiple anti-detection measures
3. Maintain persistent sessions and cookies
4. Add delays and variability in request patterns
5. Use proxies if IP blocking is detected
6. Have fallback methods for data acquisition

### Sample Implementation

Here's a complete revised approach:

```python
def scrape_festivalinfo():
    """Main entry point for the scraper with robust anti-blocking measures"""
    
    # Setup directories
    os.makedirs("festivalinfo_data", exist_ok=True)
    
    # Initialize counters for tracking
    success_count = 0
    failure_count = 0
    
    try:
        # Setup driver with anti-detection measures
        driver = setup_driver_with_profile()
        
        # Initial site visit with more natural browsing behavior
        visit_homepage_and_browse(driver)
        
        # Scrape festival listing pages
        festival_links = scrape_festival_listings(driver)
        
        # Process detail pages with natural behavior and fallbacks
        for festival_link in festival_links:
            try:
                # First attempt direct scraping
                success = scrape_festival_detail(driver, festival_link)
                
                if not success:
                    # Try fallback methods
                    print(f"Direct scraping failed for {festival_link}, trying alternative methods")
                    
                    # Try with different browser fingerprint
                    driver.quit()
                    driver = setup_driver_with_different_fingerprint()
                    success = scrape_festival_detail(driver, festival_link)
                    
                    if not success:
                        # Try archive as last resort
                        festival_name = extract_festival_name_from_url(festival_link)
                        year = extract_year_from_url(festival_link)
                        html_content = scrape_from_archive(festival_name, year)
                        
                        if html_content:
                            parse_detail_page_html(html_content, festival_name)
                            success = True
                
                if success:
                    success_count += 1
                else:
                    failure_count += 1
                
            except Exception as e:
                print(f"Error processing {festival_link}: {e}")
                failure_count += 1
                
            # Take a random human-like break between festivals
            time.sleep(random_human_delay())
    
    except Exception as e:
        print(f"Fatal error during scraping: {e}")
    finally:
        if 'driver' in locals():
            driver.quit()
    
    print(f"Scraping completed. Success: {success_count}, Failed: {failure_count}")
```

## Parsing the HTML

Once you have successfully downloaded the HTML files, parsing them locally doesn't trigger anti-scraping measures:

```python
def parse_festivalinfo_data():
    """Parse downloaded HTML files to extract festival information"""
    import glob
    from bs4 import BeautifulSoup
    import json
    
    festivals = []
    
    # Process week pages
    week_files = glob.glob("festivalinfo_html/week_*.html")
    for week_file in sorted(week_files):
        print(f"Parsing {week_file}...")
        
        with open(week_file, "r", encoding="utf-8") as f:
            content = f.read()
        
        soup = BeautifulSoup(content, "html.parser")
        
        # Extract festival links and basic info from this week's page
        festival_elements = soup.select("a[href*='/festival/']")
        
        for element in festival_elements:
            # Only process unique elements that actually link to festival pages
            if element.has_attr('href') and '/festival/' in element['href']:
                link = element['href']
                
                # Check if it's a main festival link (not just a link in navigation)
                if element.find("section", class_="festival_rows_info"):
                    # Extract basic info
                    festival_info = element.find("section", class_="festival_rows_info")
                    
                    name_elem = festival_info.find("div", class_="td_1")
                    name = name_elem.find("strong").text.strip() if name_elem else ""
                    
                    location_elem = festival_info.find("div", class_="td_2")
                    location = location_elem.text.strip().replace('\n', ' ') if location_elem else ""
                    
                    # Look for date which is in a separate section
                    date_section = soup.find("section", class_="festival_agenda_date")
                    date = ""
                    if date_section:
                        day = date_section.find("span", class_="festival_dag").text.strip() if date_section.find("span", class_="festival_dag") else ""
                        month = date_section.find_all("span")[-1].text.strip() if date_section.find_all("span") else ""
                        date = f"{day} {month} 2025" if day and month else ""
                    
                    # Get festival ID for connecting to detail page
                    festival_id = extract_festival_id_from_url(link)
                    
                    festivals.append({
                        "name": name,
                        "location": location,
                        "date": date,
                        "link": link,
                        "festival_id": festival_id
                    })
    
    # Process detail pages to add more information
    for festival in festivals:
        festival_id = festival.get("festival_id")
        detail_file = f"festivalinfo_html/detail_{festival_id}.html"
        
        if os.path.exists(detail_file):
            with open(detail_file, "r", encoding="utf-8") as f:
                detail_content = f.read()
            
            detail_soup = BeautifulSoup(detail_content, "html.parser")
            
            # Extract more detailed info
            event_section = detail_soup.find("section", class_="event")
            if event_section:
                # Extract date and time
                date_elements = event_section.find_all("div", class_="event_date")
                if date_elements:
                    # For multi-day events, handle multiple date elements
                    dates = []
                    for date_elem in date_elements:
                        day_of_week = date_elem.find("span", class_="small_item").text.strip() if date_elem.find("span", class_="small_item") else ""
                        day = date_elem.find("strong").text.strip() if date_elem.find("strong") else ""
                        month = date_elem.find_all("span", class_="small_item")[-1].text.strip() if date_elem.find_all("span", class_="small_item") else ""
                        dates.append(f"{day_of_week} {day} {month}")
                    
                    festival["detailed_dates"] = dates
                
                # Extract full location info
                location_elem = event_section.find("p", style=lambda s: s and "festival_location_icon" in s)
                if location_elem:
                    festival["detailed_location"] = location_elem.text.strip()
    
    # Save complete dataset
    with open("festivalinfo_data/festivals.json", "w", encoding="utf-8") as f:
        json.dump(festivals, f, ensure_ascii=False, indent=2)
    
    print(f"Parsed {len(festivals)} festivals")
    return festivals

def extract_festival_id_from_url(url):
    """Extract festival ID from URL"""
    import re
    match = re.search(r'/festival/(\d+)/', url)
    return match.group(1) if match else "unknown"
```

## Conclusion

When dealing with 403 Forbidden errors on Festivalinfo.nl:

1. **Switch to browser automation** instead of basic HTTP requests
2. **Emulate human browsing behavior** with random scrolling, timing, and page interactions
3. **Rotate user agents and browser fingerprints** to avoid detection patterns
4. **Use proxy rotation** if IP blocking is suspected
5. **Implement session management** with cookies and persistent profiles
6. **Add fallback mechanisms** like web archives for persistent failures
7. **Consider collaborative data sources** or API-based alternatives if scraping remains blocked

By combining these techniques, you should be able to overcome the 403 errors and successfully scrape Festivalinfo.nl while maintaining ethical scraping practices that don't overload the server.
