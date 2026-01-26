"""Debug script to analyze Chattahoochee Nature Center events page."""

from playwright.sync_api import sync_playwright
import re

def debug_events():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        url = "https://chattnaturecenter.org/events/"
        print(f"Navigating to {url}")
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        # Scroll to load all content
        for i in range(5):
            print(f"Scrolling {i+1}/5...")
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(1000)

        # Check for event containers
        print("\n=== Checking for event elements ===")

        # Try different selectors
        selectors = [
            ".mec-event-article",
            ".mec-events-agenda",
            ".event-item",
            "[class*='event']",
            ".mec-event-list-classic",
            ".mec-wrap",
        ]

        for selector in selectors:
            elements = page.query_selector_all(selector)
            if elements:
                print(f"Found {len(elements)} elements with selector: {selector}")

        # Get the full HTML to inspect
        html = page.content()

        # Save HTML for inspection
        with open("/tmp/chattahoochee_events.html", "w") as f:
            f.write(html)
        print("\nSaved full HTML to /tmp/chattahoochee_events.html")

        # Get visible text
        body_text = page.inner_text("body")
        with open("/tmp/chattahoochee_text.txt", "w") as f:
            f.write(body_text)
        print("Saved visible text to /tmp/chattahoochee_text.txt")

        # Count date patterns in text
        lines = body_text.split("\n")
        date_pattern = r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?"

        dates_found = 0
        for line in lines:
            if re.search(date_pattern, line, re.IGNORECASE):
                dates_found += 1
                print(f"Date line: {line[:100]}")

        print(f"\nTotal date patterns found: {dates_found}")

        input("Press Enter to close browser...")
        browser.close()

if __name__ == "__main__":
    debug_events()
