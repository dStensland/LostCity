#!/usr/bin/env python3
"""Debug script to inspect SCHR page structure."""

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

URL = "https://www.schr.org/events/"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport={"width": 1920, "height": 1080},
        extra_http_headers={
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }
    )
    page = context.new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(5000)

    # Scroll
    for _ in range(3):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1000)

    html = page.content()
    browser.close()

soup = BeautifulSoup(html, "html.parser")

# Save HTML for inspection
with open("/tmp/schr_page.html", "w") as f:
    f.write(soup.prettify())

print("HTML saved to /tmp/schr_page.html")

# Find events with [class*='event']
events = soup.select("[class*='event']")
print(f"\nFound {len(events)} elements with [class*='event']")

# Show first 5
for i, event in enumerate(events[:10]):
    print(f"\n--- Event {i+1} ---")
    print(f"Classes: {event.get('class')}")
    print(f"Text (first 200 chars): {event.get_text(strip=True)[:200]}")

    # Check for title elements
    title_selectors = ["h1", "h2", "h3", "h4", ".title", ".event-title", "[class*='title']"]
    for sel in title_selectors:
        title_elem = event.select_one(sel)
        if title_elem:
            print(f"Title ({sel}): {title_elem.get_text(strip=True)}")
            break
