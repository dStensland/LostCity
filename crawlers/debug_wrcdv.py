#!/usr/bin/env python3
"""Debug script to inspect WRCDV page structure."""

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

URL = "https://www.wrcdv.org/events"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport={"width": 1920, "height": 1080},
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
with open("/tmp/wrcdv_page.html", "w") as f:
    f.write(soup.prettify())

print("HTML saved to /tmp/wrcdv_page.html")

# Check for various selectors
selectors = [
    ".event-item",
    ".event",
    "[class*='event']",
    "[data-testid*='event']",
    "[id*='event']",
]

for selector in selectors:
    elements = soup.select(selector)
    if elements:
        print(f"\n{selector}: Found {len(elements)} elements")
        if len(elements) > 0:
            print(f"First element classes: {elements[0].get('class')}")
            print(f"First 200 chars: {str(elements[0])[:200]}")

# Check page text
text = soup.get_text()
print(f"\nPage contains 'event': {'event' in text.lower()}")
print(f"Page contains 'calendar': {'calendar' in text.lower()}")

# Check for common Wix patterns
print(f"\nWix patterns:")
print(f"Has #SITE_CONTAINER: {bool(soup.find(id='SITE_CONTAINER'))}")
print(f"Has data-hook attributes: {len(soup.find_all(attrs={'data-hook': True}))}")
