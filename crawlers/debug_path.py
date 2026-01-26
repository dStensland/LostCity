#!/usr/bin/env python3
"""Debug PATH Foundation page structure."""

from playwright.sync_api import sync_playwright

BASE_URL = "https://pathfoundation.org/events/"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        viewport={"width": 1920, "height": 1080},
    )
    page = context.new_page()

    print(f"Loading {BASE_URL}...")
    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(5000)

    # Scroll to load content
    for i in range(5):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1500)

    # Try different selectors
    selectors = [
        "article",
        ".eventitem",
        ".sqs-block-summary-v2 .summary-item",
        "li.eventlist-event",
        ".eventlist-event",
        "[class*='event']",
        ".summary-item",
        ".calendar-event",
    ]

    print("\n=== Testing selectors ===")
    for selector in selectors:
        elements = page.query_selector_all(selector)
        print(f"{selector}: {len(elements)} elements")

    print("\n=== Page text (first 2000 chars) ===")
    body_text = page.inner_text("body")
    print(body_text[:2000])

    print("\n=== HTML structure (simplified) ===")
    html = page.content()

    # Find event-related divs
    import re
    event_divs = re.findall(r'<div[^>]*class="[^"]*event[^"]*"[^>]*>', html)[:10]
    for div in event_divs:
        print(div)

    input("\nPress Enter to close browser...")
    browser.close()
