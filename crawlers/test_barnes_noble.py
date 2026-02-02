"""
Test script to inspect Barnes & Noble events page structure.
"""

from playwright.sync_api import sync_playwright

def test_bn_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        # Try Buckhead store
        url = "https://stores.barnesandnoble.com/store/2094"
        print(f"Loading {url}")
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        # Try to find events link
        print("\n=== Looking for events link ===")
        events_link = page.query_selector("a[href*='event']")
        if events_link:
            print(f"Found events link: {events_link.get_attribute('href')}")
        else:
            print("No events link found")

        # Get page text
        text = page.inner_text("body")
        print(f"\n=== Page text (first 1000 chars) ===")
        print(text[:1000])

        # Look for event-related keywords
        print("\n=== Searching for event keywords ===")
        keywords = ["storytime", "event", "author", "book club"]
        for keyword in keywords:
            if keyword.lower() in text.lower():
                print(f"Found '{keyword}' in page text")

        # Check for calendar/events section
        print("\n=== Looking for calendar elements ===")
        calendar_elements = page.query_selector_all("[class*='calendar'], [class*='event'], [id*='event']")
        print(f"Found {len(calendar_elements)} calendar/event elements")

        # Try events URL
        events_url = f"{url}/events"
        print(f"\n=== Trying events URL: {events_url} ===")
        page.goto(events_url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        events_text = page.inner_text("body")
        print(f"Events page text (first 1000 chars):")
        print(events_text[:1000])

        # Keep browser open for inspection
        input("\nPress Enter to close browser...")
        browser.close()

if __name__ == "__main__":
    test_bn_page()
