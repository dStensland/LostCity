"""
Debug script to inspect Legistar calendar HTML structure.
"""

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

def inspect_legistar(url: str):
    """Fetch and inspect Legistar calendar HTML."""
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
            page.wait_for_timeout(3000)

            html = page.content()
            soup = BeautifulSoup(html, "html.parser")

            # Save HTML to file for inspection
            with open("legistar_calendar.html", "w") as f:
                f.write(html)
            print("✓ Saved HTML to legistar_calendar.html\n")

            # Look for tables
            tables = soup.find_all("table")
            print(f"Found {len(tables)} tables")

            for i, table in enumerate(tables[:5]):  # Show first 5 tables
                print(f"\nTable {i+1}:")
                print(f"  Classes: {table.get('class')}")
                print(f"  ID: {table.get('id')}")

                # Look for rows
                rows = table.find_all("tr")
                print(f"  Rows: {len(rows)}")

                if rows:
                    # Show first row
                    first_row = rows[0]
                    print(f"  First row classes: {first_row.get('class')}")
                    cells = first_row.find_all(["td", "th"])
                    print(f"  First row cells: {len(cells)}")
                    if cells:
                        print(f"  First cell text: {cells[0].get_text(strip=True)[:100]}")

            # Look for divs with calendar classes
            calendar_divs = soup.find_all("div", class_=lambda x: x and "calendar" in x.lower())
            print(f"\nFound {len(calendar_divs)} divs with 'calendar' in class")

            # Look for specific Legistar patterns
            print("\nSearching for Legistar patterns:")
            print(f"  .rgRow: {len(soup.select('.rgRow'))}")
            print(f"  .rgAltRow: {len(soup.select('.rgAltRow'))}")
            print(f"  .rgMasterTable: {len(soup.select('.rgMasterTable'))}")
            print(f"  Links with MeetingDetail: {len(soup.find_all('a', href=lambda x: x and 'MeetingDetail' in x))}")
            print(f"  Links with Calendar: {len(soup.find_all('a', href=lambda x: x and 'Calendar' in x))}")

            # Look for any links
            links = soup.find_all("a", href=True)
            print(f"\nTotal links: {len(links)}")

            # Show some link hrefs
            print("\nSample link hrefs:")
            for link in links[:10]:
                href = link.get("href")
                text = link.get_text(strip=True)[:50]
                print(f"  {href[:80]} -> {text}")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()


if __name__ == "__main__":
    # Test all three URLs
    urls = [
        "https://atlanta.legistar.com/Calendar.aspx",
        "https://fulton.legistar.com/Calendar.aspx",
        "https://dekalbcountyga.legistar.com/Calendar.aspx",
    ]

    for url in urls:
        print("=" * 80)
        inspect_legistar(url)
        print("\n")
