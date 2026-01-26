#!/usr/bin/env python3
"""Check PATH Foundation programs/events pages."""

from playwright.sync_api import sync_playwright

BASE_URL = "https://pathfoundation.org"
pages_to_check = [
    "/path-in-motion-1",
    "/curated-trail-experiences",
    "/announcements",
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    for path in pages_to_check:
        url = f"{BASE_URL}{path}"
        print(f"\n{'='*60}")
        print(f"Checking: {url}")
        print('='*60)

        try:
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            text = page.inner_text("body")
            print(text[:1500])

            # Look for dates
            import re
            dates = re.findall(
                r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}',
                text
            )
            if dates:
                print(f"\n>>> Found dates: {dates[:5]}")

        except Exception as e:
            print(f"Error: {e}")

    browser.close()
