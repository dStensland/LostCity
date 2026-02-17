#!/usr/bin/env python3
"""Debug script to inspect PAWS Atlanta events page structure."""

from playwright.sync_api import sync_playwright

BASE_URL = "https://pawsatlanta.org"
EVENTS_URL = f"{BASE_URL}/events/"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        viewport={"width": 1920, "height": 1080},
        ignore_https_errors=True,
    )
    page = context.new_page()

    print(f"Loading: {EVENTS_URL}")
    page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(3000)

    # Scroll to load any lazy-loaded content
    for _ in range(3):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1500)

    # Get page HTML
    html = page.content()
    print(f"\nPage title: {page.title()}")
    print(f"URL: {page.url}")
    print(f"HTML length: {len(html)}")

    # Try different selectors
    selectors = [
        ".tribe-events-list-event",
        ".event-item",
        ".events-list .event",
        "article.event",
        ".event-card",
        "[class*='event']",
        "article",
        ".entry",
        ".post",
    ]

    for selector in selectors:
        count = page.locator(selector).count()
        if count > 0:
            print(f"\n{selector}: {count} elements found")
            # Get first element
            first = page.locator(selector).first
            print(f"  First element HTML: {first.inner_html()[:200]}")

    # Get body text
    body_text = page.inner_text("body")
    print(f"\nBody text (first 1000 chars):\n{body_text[:1000]}")

    # Save full HTML to file
    with open("/tmp/paws_atlanta_events.html", "w") as f:
        f.write(html)
    print("\nFull HTML saved to /tmp/paws_atlanta_events.html")

    input("\nPress Enter to close browser...")
    browser.close()
