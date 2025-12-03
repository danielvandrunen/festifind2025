# Partyflock.nl Scraping Guide

## Site Overview

Partyflock.nl is a comprehensive Dutch festival and event database that uses a continuous scrolling format to display festival data. The site features a clean table-based layout with festivals grouped by date headers. This guide outlines how to effectively scrape the website with proper strategies to avoid triggering anti-scraping measures.

## Page Structure

### Base URL
- `https://partyflock.nl/agenda/festivals` is the main page for festival listings

### Pagination / Scrolling
- The site uses infinite scrolling rather than traditional pagination
- As you scroll down, more festivals are loaded dynamically
- There are no explicit "next page" buttons to click

## Data Structure

### Date Headers

Date headers separate festivals into groups by date:

```html
<tr>
  <td colspan="3">
    <h3>
      <a href="/agenda/day/2025/4/25">
        morgen uitgaan op <time datetime="20250425">vrijdag 25 april 2025</time>
      </a>
      , Koningsnacht
    </h3>
  </td>
</tr>
```

### Festival Rows

Each festival is presented in a table row with the following structure:

```html
<tr>
  <td style="max-width:60%">
    <meta itemprop="eventStatus" content="https://schema.org/EventScheduled">
    <meta itemprop="eventAttendanceMode" content="https://schema.org/OfflineEventAttendanceMode">
    <meta itemprop="startDate" content="2025-04-25T20:00:00+02:00">
    <meta itemprop="duration" content="PT7H30M">
    <meta itemprop="endDate" content="2025-04-26T03:29:59+02:00">
    <a href="/party/477813:Brick-Lane-Jazz-Festival">
      <meta itemprop="url" content="https://partyflock.nl/party/477813:Brick-Lane-Jazz-Festival">
      <span itemprop="name">Brick Lane Jazz Festival</span>
    </a>
  </td>
  <td class="right rpad nowrap">
    <!-- Attendance count (if available) -->
  </td>
  <td>
    <span class="hidden" itemprop="location" itemscope="" itemtype="https://schema.org/EventVenue">
      <meta itemprop="name" content="onbekende locatie">
      <span itemprop="geo" itemscope="" itemtype="https://schema.org/GeoCoordinates">
        <meta itemprop="latitude" content="51.5002">
        <meta itemprop="longitude" content="-0.126236">
      </span>
      <span itemprop="address" itemscope="" itemtype="https://schema.org/PostalAddress">
        <meta itemprop="addressLocality" content="London">
        <span itemprop="addressCountry" itemscope="" itemtype="https://schema.org/Country">
          <meta itemprop="name" content="Verenigd Koninkrijk">
          <meta itemprop="alternateName" content="GB">
        </span>
      </span>
    </span>
    <span class="nowrap light7">
      <a href="/city/77:London">London</a>
    </span>
  </td>
</tr>
```

### Multi-Day Events

Multi-day events are presented with a distinct structure:

```html
<table class="hla dens nomargin vtop">
  <tbody>
    <tr class="">
      <td><a href="/event/rebirth-festival-nl">REBiRTH Festival</a>,&nbsp;</td>
      <td class="right">vr 11 apr 2025, 14:00</td>
      <td></td><td></td>
    </tr>
    <tr class="win ">
      <td><a href="/party/467863:REBiRTH-Festival">REBiRTH Festival</a>,&nbsp;</td>
      <td class="right">za 12 apr 2025, 12:00</td>
      <td>&nbsp;←</td><td></td>
    </tr>
    <tr class="">
      <td><a href="/party/475522:REBiRTH-Festival">REBiRTH Festival</a>,&nbsp;</td>
      <td class="right">zo 13 apr 2025, 13:00</td>
      <td></td><td></td>
    </tr>
  </tbody>
</table>
```

### Detail Pages

Detail pages contain comprehensive festival information:

```html
<div class="party-desc">
  <div class="ib info">
    <b><a rel="nofollow" href="/..."><h2>Festival Name</h2></a></b>
    <br>
    <span class="date"><a href="/agenda/day/2025/4/25">vrijdag 25 april 2025</a></span>
    <br>
    16:00 – 00:00
    <br>
    <a href="/location/...">Location Name</a>, <a href="/city/...">City Name</a>
  </div>
</div>
```

## Scraping Strategy

### 1. Full Page Scrolling Approach

Partyflock uses infinite scrolling, so a complete scrape requires:

1. **Incremental Scrolling**:
   ```python
   def scroll_page_to_bottom(driver, scroll_pause=1.5):
       last_height = driver.execute_script("return document.body.scrollHeight")
       
       while True:
           # Scroll down
           driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
           
           # Wait for page to load
           time.sleep(scroll_pause)
           
           # Calculate new scroll height and compare with last scroll height
           new_height = driver.execute_script("return document.body.scrollHeight")
           if new_height == last_height:
               # If heights are the same, it might be the end of the page
               # Try scrolling one more time to be sure
               driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
               time.sleep(scroll_pause * 2)
               new_height = driver.execute_script("return document.body.scrollHeight")
               if new_height == last_height:
                   break
           last_height = new_height
   ```

2. **Check for "Load More" buttons**:
   - Sometimes there might be "Load More" or similar buttons that need to be clicked
   - Implement a check for these elements and click them if found

### 2. Structured Data Extraction

1. **Date Grouping**:
   - Identify date headers in the table structure
   - Associate festivals with their respective dates

2. **Festival Data Extraction**:
   ```python
   def extract_festivals(html_content):
       soup = BeautifulSoup(html_content, 'html.parser')
       festivals = []
       current_date = None
       
       for row in soup.select('table tr'):
           # Check if this is a date header
           date_header = row.select_one('td[colspan="3"] h3 a')
           if date_header:
               date_text = date_header.select_one('time')
               if date_text:
                   current_date = date_text.text.strip()
               continue
           
           # Check if this is a festival row
           festival_link = row.select_one('td[style*="max-width"] a')
           if not festival_link:
               continue
               
           # Extract festival data
           name = festival_link.select_one('span[itemprop="name"]')
           name = name.text.strip() if name else ""
           
           # Extract meta information (start date, end date)
           start_date = row.select_one('meta[itemprop="startDate"]')
           start_date = start_date['content'] if start_date else ""
           
           end_date = row.select_one('meta[itemprop="endDate"]')
           end_date = end_date['content'] if end_date else ""
           
           # Extract location
           location_meta = row.select_one('span[itemprop="location"]')
           venue_name = location_meta.select_one('meta[itemprop="name"]')
           venue_name = venue_name['content'] if venue_name else ""
           
           city = location_meta.select_one('meta[itemprop="addressLocality"]')
           city = city['content'] if city else ""
           
           country = location_meta.select_one('span[itemprop="addressCountry"] meta[itemprop="name"]')
           country = country['content'] if country else ""
           
           # Extract detail page URL
           detail_url = festival_link['href']
           
           festivals.append({
               'name': name,
               'date': current_date,
               'start_date': start_date,
               'end_date': end_date,
               'venue': venue_name,
               'city': city,
               'country': country,
               'detail_url': detail_url
           })
       
       return festivals
   ```

3. **Multi-Day Event Handling**:
   - Check for nested tables indicating multi-day events
   - Extract each day's information while maintaining the relationship

### 3. Detail Page Processing

After obtaining the list of festivals, visit each detail page for comprehensive information:

```python
def process_detail_page(driver, detail_url):
    driver.get(detail_url)
    time.sleep(random.uniform(2, 5))  # Random delay
    
    soup = BeautifulSoup(driver.page_source, 'html.parser')
    
    # Extract detailed information
    name = soup.select_one('h2')
    name = name.text.strip() if name else ""
    
    date_info = soup.select_one('.date a')
    date = date_info.text.strip() if date_info else ""
    
    time_info = date_info.find_next('br').next_sibling if date_info else None
    time = time_info.strip() if time_info else ""
    
    location_link = soup.select_one('a[href*="/location/"]')
    location = location_link.text.strip() if location_link else ""
    
    city_link = soup.select_one('a[href*="/city/"]')
    city = city_link.text.strip() if city_link else ""
    
    return {
        'name': name,
        'date': date,
        'time': time,
        'location': location,
        'city': city
    }
```

## Anti-Scraping Considerations

Partyflock.nl may employ anti-scraping measures. Here's how to mitigate them:

### 1. Request Patterns

1. **Progressive Scrolling**:
   - Scroll in small increments (300-500px) rather than jumping to the bottom
   - Add random delays between scrolls to mimic human behavior
   ```python
   def human_like_scroll(driver, max_scrolls=None):
       scrolls = 0
       
       while max_scrolls is None or scrolls < max_scrolls:
           # Random scroll amount between 300-500px
           scroll_amount = random.randint(300, 500)
           driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
           
           # Random delay between 0.5-2 seconds
           time.sleep(random.uniform(0.5, 2))
           
           # Occasionally pause for a longer time (simulating reading)
           if random.random() < 0.1:  # 10% chance
               time.sleep(random.uniform(3, 7))
           
           scrolls += 1
           
           # Randomly check if we've scrolled enough
           if max_scrolls is None and random.random() < 0.05:
               # Check if we're near the bottom
               scroll_height = driver.execute_script("return document.body.scrollHeight")
               current_position = driver.execute_script("return window.pageYOffset + window.innerHeight")
               if current_position >= scroll_height * 0.95:
                   break
   ```

2. **Non-Linear Navigation**:
   - Don't process detail pages in a strictly sequential order
   - Shuffle the list of URLs before processing
   ```python
   import random
   
   detail_urls = [f1, f2, f3, ...]  # List of festival detail URLs
   random.shuffle(detail_urls)  # Randomize the order
   ```

### 2. Browser Fingerprinting

1. **User Agent Rotation**:
   ```python
   user_agents = [
       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
       'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
       'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
       'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
   ]
   
   def get_random_ua():
       return random.choice(user_agents)
   ```

2. **Manage Cookies and Storage**:
   - Accept cookies to appear as a regular user
   - Preserve session information between requests

3. **Vary Request Headers**:
   ```python
   headers = {
       'User-Agent': get_random_ua(),
       'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
       'Accept-Language': 'nl,en-US;q=0.7,en;q=0.3',
       'Referer': 'https://partyflock.nl/agenda/festivals',
       'Connection': 'keep-alive',
       'Upgrade-Insecure-Requests': '1',
       'Sec-Fetch-Dest': 'document',
       'Sec-Fetch-Mode': 'navigate',
       'Sec-Fetch-Site': 'same-origin',
       'Sec-Fetch-User': '?1',
       'DNT': '1',
   }
   ```

### 3. Scraping Protection Bypass

1. **Handle CAPTCHAs**:
   - Be prepared for potential CAPTCHA challenges
   - Implement detection and manual solving mechanism

2. **Request Throttling**:
   ```python
   import time
   from ratelimit import limits, sleep_and_retry
   
   @sleep_and_retry
   @limits(calls=10, period=60)  # 10 calls per minute
   def rate_limited_request(url, session):
       response = session.get(url)
       return response
   ```

3. **IP Rotation**:
   - Be prepared to use proxy rotation if needed
   - Example with proxy integration:
   ```python
   proxies = [
       {'http': 'http://proxy1:port', 'https': 'https://proxy1:port'},
       {'http': 'http://proxy2:port', 'https': 'https://proxy2:port'},
       # More proxies...
   ]
   
   def get_random_proxy():
       return random.choice(proxies)
   
   session = requests.Session()
   session.proxies = get_random_proxy()
   ```

## Complete Scraping Workflow

### 1. Local HTML Download Phase

```python
import time
import random
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

def download_partyflock_festivals():
    # Setup WebDriver
    options = Options()
    options.add_argument(f"user-agent={get_random_ua()}")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--no-sandbox")
    
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    
    try:
        # Navigate to festivals page
        driver.get("https://partyflock.nl/agenda/festivals")
        time.sleep(random.uniform(3, 6))
        
        # Accept cookies if needed
        try:
            cookie_button = driver.find_element_by_css_selector("button[aria-label='Accept cookies']")
            cookie_button.click()
            time.sleep(random.uniform(1, 2))
        except:
            pass
        
        # Scroll to load all festivals (or as many as needed)
        human_like_scroll(driver)
        
        # Save the main page HTML
        with open("partyflock_festivals_main.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        
        # Extract festival detail URLs
        detail_urls = []
        for link in driver.find_elements_by_css_selector("td[style*='max-width'] a"):
            detail_urls.append(link.get_attribute("href"))
        
        # Randomize detail URLs for less predictable behavior
        random.shuffle(detail_urls)
        
        # Download detail pages
        for i, url in enumerate(detail_urls):
            try:
                # Extract ID for filename
                festival_id = url.split(":")[-1] if ":" in url else f"unknown_{i}"
                
                # Add random delay
                time.sleep(random.uniform(2, 5))
                
                # Visit page
                driver.get(url)
                
                # Save HTML
                with open(f"partyflock_detail_{festival_id}.html", "w", encoding="utf-8") as f:
                    f.write(driver.page_source)
                
                print(f"Downloaded {i+1}/{len(detail_urls)}: {festival_id}")
                
                # Longer delay every 10 requests
                if (i + 1) % 10 == 0:
                    time.sleep(random.uniform(10, 15))
                
            except Exception as e:
                print(f"Error downloading {url}: {str(e)}")
    
    finally:
        driver.quit()
```

### 2. Local HTML Parsing Phase

```python
from bs4 import BeautifulSoup
import json
import os
import re
from datetime import datetime

def parse_partyflock_festivals():
    # Parse main page
    with open("partyflock_festivals_main.html", "r", encoding="utf-8") as f:
        main_content = f.read()
    
    festivals = extract_festivals(main_content)
    
    # Parse detail pages
    for festival in festivals:
        detail_url = festival['detail_url']
        festival_id = detail_url.split(":")[-1] if ":" in detail_url else "unknown"
        detail_file = f"partyflock_detail_{festival_id}.html"
        
        if os.path.exists(detail_file):
            with open(detail_file, "r", encoding="utf-8") as f:
                detail_content = f.read()
            
            # Parse detail page
            detail_soup = BeautifulSoup(detail_content, 'html.parser')
            
            # Extract detailed info
            time_info = detail_soup.select_one('.party-desc .date').next_sibling.next_sibling
            if time_info:
                festival['time'] = time_info.strip()
            
            # Get any additional details
            # ...
    
    # Save the parsed data
    with open("partyflock_festivals.json", "w", encoding="utf-8") as f:
        json.dump(festivals, f, ensure_ascii=False, indent=2)
    
    return festivals
```

## Validation Strategy

To ensure accurate data extraction:

1. **Sample Checking**:
   - Verify a random selection of festivals against the website
   - Compare date formats, names, and locations

2. **Data Consistency Checks**:
   ```python
   def validate_festivals(festivals):
       valid_festivals = []
       issues = []
       
       for i, festival in enumerate(festivals):
           # Check required fields
           if not festival.get('name'):
               issues.append(f"Festival #{i}: Missing name")
           
           # Validate date format
           date_str = festival.get('start_date', '')
           try:
               datetime.fromisoformat(date_str.replace('Z', '+00:00'))
           except ValueError:
               issues.append(f"Festival #{i}: Invalid date format - {date_str}")
           
           # Only add valid festivals
           if festival.get('name') and festival.get('start_date'):
               valid_festivals.append(festival)
       
       return valid_festivals, issues
   ```

3. **Completeness Check**:
   - Confirm that multi-day events have all days properly linked
   - Verify all necessary information is included in the final output

## Potential Challenges

1. **Infinite Scrolling**:
   - The main challenge is determining when you've reached the bottom of the page
   - Solution: Implement scroll logic that detects when no new content is loaded

2. **Dynamic Content**:
   - Some content may be loaded via AJAX
   - Solution: Use browser automation (Selenium/Playwright) to render JavaScript

3. **Date Parsing**:
   - Dutch date formats may cause inconsistencies
   - Solution: Use the ISO date information in meta tags rather than visible text

4. **Multi-Day Events**:
   - Complex structure for multi-day events
   - Solution: Implement special handling for nested table structures

By following this guide, you should be able to effectively scrape Partyflock.nl while maintaining good scraping practices and avoiding triggering anti-scraping defenses.
