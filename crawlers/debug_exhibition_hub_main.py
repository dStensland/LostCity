#!/usr/bin/env python3
"""Debug Exhibition Hub main website structure."""

from playwright.sync_api import sync_playwright

MAIN_URL = "https://exhibitionhub.com/"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    )
    page = context.new_page()

    print(f"Fetching {MAIN_URL}...")
    page.goto(MAIN_URL, wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(5000)

    # Scroll to load content
    for _ in range(5):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(2000)

    # Get page text
    text = page.inner_text("body")
    print("\n=== PAGE TEXT (first 3000 chars) ===")
    print(text[:3000])

    # Look for location info
    if "atlanta" in text.lower():
        print("\n=== ATLANTA REFERENCES ===")
        lines = [l.strip() for l in text.split("\n") if "atlanta" in l.lower()]
        for line in lines[:20]:
            print(f"  {line}")

    # Look for current exhibits
    keywords = ["bubble", "van gogh", "monet", "experience", "exhibition", "immersive"]
    print("\n=== EXHIBIT KEYWORDS ===")
    for keyword in keywords:
        if keyword in text.lower():
            lines = [l.strip() for l in text.split("\n") if keyword in l.lower() and len(l.strip()) > 10]
            if lines:
                print(f"\n{keyword.upper()}:")
                for line in lines[:5]:
                    print(f"  {line}")

    # Check for clickable elements
    print("\n=== INTERACTIVE ELEMENTS ===")
    buttons = page.query_selector_all("button, a[href*='experience'], a[href*='location']")
    print(f"Found {len(buttons)} interactive elements")
    for i, btn in enumerate(buttons[:10]):
        text_content = btn.inner_text().strip()
        if text_content:
            print(f"  {i+1}. {text_content[:100]}")

    # Save full HTML
    html = page.content()
    with open("/tmp/exhibition_hub_main_debug.html", "w") as f:
        f.write(html)
    print("\nFull HTML saved to /tmp/exhibition_hub_main_debug.html")

    browser.close()
