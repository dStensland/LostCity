#!/usr/bin/env python3
"""Check PATH Foundation site structure."""

from playwright.sync_api import sync_playwright
import re

BASE_URL = "https://pathfoundation.org"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Check main site
    print("=== Checking main site ===")
    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_timeout(3000)

    # Get all navigation links
    all_links = []
    for link in page.query_selector_all("a"):
        href = link.get_attribute("href")
        text = link.inner_text().strip()
        if href and not href.startswith("#") and not href.startswith("javascript"):
            all_links.append((text, href))

    # Deduplicate and filter
    unique_links = {}
    for text, href in all_links:
        if href not in unique_links:
            unique_links[href] = text

    print("\nAll site links:")
    for href, text in sorted(unique_links.items()):
        if BASE_URL in href or href.startswith("/"):
            print(f"  {text}: {href}")

    # Try to check if they use Eventbrite or other platforms
    print("\n=== Checking for external event platforms ===")
    content = page.content()
    if "eventbrite" in content.lower():
        eventbrite_urls = re.findall(r'https?://[^\s"\']*eventbrite[^\s"\']*', content)
        print(f"Found Eventbrite links: {eventbrite_urls[:5]}")
    if "facebook.com/events" in content.lower():
        print("Found Facebook Events links")
    if "calendar" in content.lower():
        print("Found 'calendar' mention in page")

    browser.close()
