#!/usr/bin/env python3
"""Debug Exhibition Hub Eventbrite page structure."""

from playwright.sync_api import sync_playwright

EVENTBRITE_URL = "https://www.eventbrite.com/o/exhibition-hub-33046723533"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    )
    page = context.new_page()

    print(f"Fetching {EVENTBRITE_URL}...")
    page.goto(EVENTBRITE_URL, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(3000)

    # Scroll to load events
    for _ in range(3):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1500)

    # Get page text
    text = page.inner_text("body")
    print("\n=== PAGE TEXT (first 2000 chars) ===")
    print(text[:2000])

    # Check for various selectors
    selectors = [
        "article",
        "[data-testid*='event']",
        "[data-testid*='card']",
        ".eds-event-card",
        "[class*='event']",
        "a[href*='/e/']",
    ]

    print("\n=== SELECTOR RESULTS ===")
    for selector in selectors:
        elements = page.query_selector_all(selector)
        print(f"{selector}: {len(elements)} found")
        if elements and len(elements) > 0:
            first = elements[0]
            print("  First element HTML (first 300 chars):")
            html = first.inner_html()
            print(f"  {html[:300]}")

    # Save full HTML for inspection
    html = page.content()
    with open("/tmp/exhibition_hub_debug.html", "w") as f:
        f.write(html)
    print("\nFull HTML saved to /tmp/exhibition_hub_debug.html")

    browser.close()
