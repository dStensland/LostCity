"""
Better DOM structure test - look for actual event list containers.
"""

from playwright.sync_api import sync_playwright
import json

def test_tpac():
    """Check TPAC event structure."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://www.tpac.org/events", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)

        print("\n=== TPAC EVENTS ===")

        # Look for specific event card patterns
        selectors_to_try = [
            ".event-card",
            ".show-card",
            ".event-list .event",
            ".show-list .show",
            "[data-event-id]",
            ".events-list-item",
            ".performance",
        ]

        for selector in selectors_to_try:
            elements = page.query_selector_all(selector)
            if elements:
                print(f"\n✓ Found {len(elements)} with selector: {selector}")
                first = elements[0]
                html = page.evaluate("el => el.outerHTML", first)
                print(f"Sample HTML:\n{html[:600]}\n")
                break
        else:
            print("No event containers found with standard selectors")

            # Try to extract structured data
            script_data = page.evaluate("""
                () => {
                    const scripts = Array.from(document.querySelectorAll('script'));
                    for (const script of scripts) {
                        if (script.textContent.includes('event') || script.textContent.includes('show')) {
                            const text = script.textContent;
                            if (text.length < 10000 && (text.includes('[') || text.includes('{'))) {
                                return text.substring(0, 1000);
                            }
                        }
                    }
                    return null;
                }
            """)
            if script_data:
                print(f"Found script data:\n{script_data[:500]}")

        browser.close()

def test_smiths():
    """Check Smith's Olde Bar - handle Cloudflare."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )
        page = context.new_page()

        try:
            page.goto("https://www.smithsoldebar.com", timeout=30000)
            page.wait_for_timeout(8000)  # Wait for Cloudflare

            print("\n=== SMITH'S OLDE BAR ===")

            # Squarespace calendar/event list selectors
            selectors_to_try = [
                ".eventlist-event",
                ".sqs-block-calendar",
                ".summary-item",
                "[data-item-id]",
            ]

            for selector in selectors_to_try:
                elements = page.query_selector_all(selector)
                if elements:
                    print(f"\n✓ Found {len(elements)} with selector: {selector}")
                    first = elements[0]
                    html = page.evaluate("el => el.outerHTML", first)
                    print(f"Sample HTML:\n{html[:600]}\n")
                    break
            else:
                # Just dump the body text to see structure
                text = page.inner_text("body")
                lines = [l.strip() for l in text.split("\n") if l.strip()]
                print(f"Body text lines (first 30):")
                for i, line in enumerate(lines[:30]):
                    print(f"{i:3}: {line[:100]}")

        except Exception as e:
            print(f"Error: {e}")

        browser.close()

def test_atlff():
    """Check Atlanta Film Festival."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Try multiple URLs
        for url in ["https://www.atlantafilmfestival.com/events", "https://www.atlantafilmfestival.com"]:
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)

                print(f"\n=== ATLANTA FILM FESTIVAL ({url}) ===")

                selectors_to_try = [
                    ".eventlist-event",
                    ".summary-item",
                    ".sqs-block-summary-v2",
                    "[data-item-id]",
                ]

                for selector in selectors_to_try:
                    elements = page.query_selector_all(selector)
                    if elements:
                        print(f"\n✓ Found {len(elements)} with selector: {selector}")
                        first = elements[0]
                        html = page.evaluate("el => el.outerHTML", first)
                        print(f"Sample HTML:\n{html[:600]}\n")
                        break
                else:
                    # Check for Squarespace JSON
                    print("Trying Squarespace JSON format...")
                    json_url = url + "?format=json"
                    import requests
                    resp = requests.get(json_url, timeout=10)
                    if resp.status_code == 200:
                        data = resp.json()
                        print(f"✓ Squarespace JSON available!")
                        print(f"Keys: {list(data.keys())[:10]}")

                break  # Success
            except Exception as e:
                print(f"Failed {url}: {e}")
                continue

        browser.close()

if __name__ == "__main__":
    test_tpac()
    test_smiths()
    test_atlff()
