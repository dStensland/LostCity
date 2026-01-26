#!/usr/bin/env python3
"""Find PATH Foundation events page."""

from playwright.sync_api import sync_playwright

BASE_URL = "https://pathfoundation.org"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        viewport={"width": 1920, "height": 1080},
    )
    page = context.new_page()

    print(f"Loading {BASE_URL}...")
    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(3000)

    # Look for all links
    print("\n=== Looking for event/calendar/news links ===")
    links = page.query_selector_all("a")
    event_links = []

    for link in links:
        href = link.get_attribute("href")
        text = link.inner_text().strip()
        if href and any(word in href.lower() for word in ["event", "calendar", "news", "program"]):
            event_links.append((text, href))
        elif text and any(word in text.lower() for word in ["event", "calendar", "news", "program"]):
            if href:
                event_links.append((text, href))

    for text, href in set(event_links):
        print(f"  {text}: {href}")

    # Check the News page
    print("\n=== Checking News page ===")
    try:
        page.goto(f"{BASE_URL}/news", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        # Get page text
        body_text = page.inner_text("body")
        print(body_text[:1000])

        # Look for event patterns
        import re
        dates = re.findall(r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}', body_text)
        print(f"\nFound {len(dates)} date patterns: {dates[:5]}")

    except Exception as e:
        print(f"Error loading news page: {e}")

    browser.close()
