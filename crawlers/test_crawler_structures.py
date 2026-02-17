"""
Quick test to examine DOM structure of the three problematic crawlers.
"""

from playwright.sync_api import sync_playwright

def test_tpac():
    """Check TPAC event structure."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://www.tpac.org/events", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)  # Give JS time to load

        # Look for event containers
        print("\n=== TPAC DOM STRUCTURE ===")

        # Try to find event cards/containers
        event_elements = page.query_selector_all(".event, .show, [class*='event'], [class*='show']")
        print(f"Found {len(event_elements)} potential event elements")

        if event_elements:
            first = event_elements[0]
            html = page.evaluate("el => el.outerHTML", first)
            print(f"First event outer HTML (first 500 chars):\n{html[:500]}")

        # Check for data attributes
        data_attrs = page.evaluate("""
            () => {
                const els = document.querySelectorAll('[data-event], [data-show], [data-title], [data-date]');
                return Array.from(els).slice(0, 3).map(el => ({
                    tag: el.tagName,
                    classes: el.className,
                    html: el.outerHTML.substring(0, 200)
                }));
            }
        """)
        print(f"\nData attribute elements: {data_attrs}")

        browser.close()

def test_smiths():
    """Check Smith's Olde Bar structure."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
        )
        page = context.new_page()

        try:
            page.goto("https://www.smithsoldebar.com", wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(5000)

            print("\n=== SMITH'S OLDE BAR DOM STRUCTURE ===")

            # Check for Squarespace event blocks
            event_elements = page.query_selector_all(".eventlist-event, .sqs-block-summary, [class*='event']")
            print(f"Found {len(event_elements)} potential event elements")

            if event_elements:
                first = event_elements[0]
                print(f"First event classes: {first.get_attribute('class')}")
                html = page.evaluate("el => el.outerHTML", first)
                print(f"First event HTML (first 500 chars):\n{html[:500]}")
        except Exception as e:
            print(f"Error accessing Smith's: {e}")

        browser.close()

def test_atlff():
    """Check Atlanta Film Festival structure."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("https://www.atlantafilmfestival.com/schedule", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        print("\n=== ATLANTA FILM FESTIVAL DOM STRUCTURE ===")

        # Squarespace calendar blocks
        event_elements = page.query_selector_all(".eventlist-event, .summary-item, [class*='event'], [class*='calendar']")
        print(f"Found {len(event_elements)} potential event elements")

        if event_elements:
            first = event_elements[0]
            print(f"First event classes: {first.get_attribute('class')}")
            html = page.evaluate("el => el.outerHTML", first)
            print(f"First event HTML (first 500 chars):\n{html[:500]}")

        browser.close()

if __name__ == "__main__":
    test_tpac()
    test_smiths()
    test_atlff()
