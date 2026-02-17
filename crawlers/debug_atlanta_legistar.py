"""
Debug script to inspect Atlanta Legistar specifically.
"""

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

url = "https://atlanta.legistar.com/Calendar.aspx"

print(f"Fetching: {url}\n")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        viewport={"width": 1920, "height": 1080},
    )
    page = context.new_page()

    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(5000)  # Wait longer for Atlanta

        # Try to click forward a month to get more meetings
        try:
            # Look for the calendar navigation
            page.wait_for_selector("a.k-nav-next", timeout=5000)
            page.click("a.k-nav-next")
            page.wait_for_timeout(2000)
        except Exception as e:
            print(f"Could not navigate forward: {e}")

        html = page.content()
        soup = BeautifulSoup(html, "html.parser")

        # Save HTML to file for inspection
        with open("atlanta_legistar.html", "w") as f:
            f.write(html)
        print("✓ Saved HTML to atlanta_legistar.html\n")

        # Search for text that might indicate meetings
        text_content = soup.get_text()
        if "meeting" in text_content.lower():
            print("✓ Found text containing 'meeting'")
            # Find lines with meeting
            for line in text_content.split("\n"):
                if "meeting" in line.lower() and len(line.strip()) > 5:
                    print(f"  {line.strip()[:100]}")
        else:
            print("✗ No text containing 'meeting' found")

        # Look for calendar specific selectors
        print("\nSearching for calendar elements:")
        print(f"  .k-calendar: {len(soup.select('.k-calendar'))}")
        print(f"  .k-scheduler: {len(soup.select('.k-scheduler'))}")
        print(f"  .k-event: {len(soup.select('.k-event'))}")
        scheduler_sel = '[data-role="scheduler"]'
        calendar_sel = '[data-role="calendar"]'
        print(f"  {scheduler_sel}: {len(soup.select(scheduler_sel))}")
        print(f"  {calendar_sel}: {len(soup.select(calendar_sel))}")

        # Look for any divs with IDs that might be relevant
        print("\nDivs with IDs:")
        divs_with_ids = soup.find_all("div", id=True)
        for div in divs_with_ids[:20]:
            print(f"  {div.get('id')}")

        # Look for scripts that might initialize calendar
        scripts = soup.find_all("script")
        print(f"\nScripts: {len(scripts)}")
        for script in scripts:
            script_text = script.string or ""
            if "calendar" in script_text.lower() or "scheduler" in script_text.lower():
                print(f"  Found calendar/scheduler init script ({len(script_text)} chars)")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()
