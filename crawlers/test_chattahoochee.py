#!/usr/bin/env python3
"""
Test script for Chattahoochee Nature Center crawler.
Run without database dependencies.
"""

import re
from datetime import datetime
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

BASE_URL = "https://www.chattnaturecenter.org"
EVENTS_URL = f"{BASE_URL}/events"


def parse_date_from_occurrence(url: str):
    """Extract date from occurrence URL parameter."""
    try:
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        occurrence = query_params.get('occurrence', [None])[0]
        if occurrence:
            return occurrence
    except Exception:
        pass
    return None


def parse_time(time_text: str):
    """Parse time from '7:00 PM' or '7:00 pm' format."""
    match = re.search(r"(\d{1,2}):(\d{2})\s*(am|pm)", time_text, re.IGNORECASE)
    if match:
        hour, minute, period = match.groups()
        hour = int(hour)
        if period.lower() == "pm" and hour != 12:
            hour += 12
        elif period.lower() == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute}"
    return None


def test_crawler():
    """Test the crawler logic."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        print(f"Fetching: {EVENTS_URL}")
        page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)

        # Scroll to load all content
        for i in range(5):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(1000)

        # Track seen event IDs
        seen_event_ids = set()
        events_found = 0

        # Find all event articles
        event_articles = page.query_selector_all("article.mec-event-article")
        print(f"\nFound {len(event_articles)} event article elements")

        for article in event_articles:
            try:
                # Get event title and link
                title_link = article.query_selector("h3.mec-event-title a")
                if not title_link:
                    continue

                title = title_link.inner_text().strip()
                event_url = title_link.get_attribute("href")
                event_id_attr = title_link.get_attribute("data-event-id")

                if not title or not event_url:
                    continue

                # Skip duplicate events
                if event_id_attr in seen_event_ids:
                    print(f"  [SKIP] Duplicate event ID: {event_id_attr}")
                    continue
                seen_event_ids.add(event_id_attr)

                # Get description
                description_elem = article.query_selector(".mec-event-description")
                description = description_elem.inner_text().strip() if description_elem else ""

                # Extract start date
                start_date = parse_date_from_occurrence(event_url)
                if not start_date:
                    print(f"  [SKIP] No date in URL: {event_url}")
                    continue

                # Validate date
                try:
                    dt = datetime.strptime(start_date, "%Y-%m-%d")
                    if dt.date() < datetime.now().date():
                        print(f"  [SKIP] Past event: {title} ({start_date})")
                        continue
                except ValueError:
                    print(f"  [SKIP] Invalid date: {start_date}")
                    continue

                # Get time
                start_time = None
                time_elem = article.query_selector(".mec-start-time")
                if time_elem:
                    time_text = time_elem.inner_text().strip()
                    if time_text.lower() != "all day":
                        start_time = parse_time(time_text)

                # Get image
                image_url = None
                img_elem = article.query_selector("img.mec-event-image")
                if img_elem:
                    image_url = img_elem.get_attribute("src") or img_elem.get_attribute("data-src")

                events_found += 1

                print(f"\n[{events_found}] {title}")
                print(f"  Date: {start_date}")
                print(f"  Time: {start_time or 'All day'}")
                print(f"  URL: {event_url}")
                print(f"  Event ID: {event_id_attr}")
                print(f"  Image: {image_url or 'None'}")
                print(f"  Description: {description[:100]}..." if len(description) > 100 else f"  Description: {description}")

            except Exception as e:
                print(f"  [ERROR] {e}")
                continue

        browser.close()

        print(f"\n{'='*60}")
        print(f"Total unique events found: {events_found}")
        print(f"Total event articles on page: {len(event_articles)}")
        print(f"{'='*60}")


if __name__ == "__main__":
    test_crawler()
