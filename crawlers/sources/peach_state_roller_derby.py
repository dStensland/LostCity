"""
Crawler for Peach State Roller Derby (peachstaterollerderby.com).
WFTDA women's flat track roller derby league playing at Sparkles Family Fun Center in Kennesaw.

Site uses Google Sites with JavaScript rendering - requires Playwright.
Schedule may be limited or image-based; this crawler extracts whatever text-based event data is available.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Optional

from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, smart_update_existing_event
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.peachstaterollerderby.com"

# Venue where bouts are held
VENUE_DATA = {
    "name": "Sparkles Family Fun Center",
    "slug": "sparkles-kennesaw",
    "address": "1000 McCollum Pkwy NW",
    "neighborhood": "Kennesaw",
    "city": "Kennesaw",
    "state": "GA",
    "zip": "30144",
    "lat": 34.0234,
    "lng": -84.6155,
    "venue_type": "arena",
    "spot_type": "arena",
    "website": "https://www.sparkles.com",
    "description": "Family entertainment center with roller skating rink, bowling, laser tag, and arcade games. Home venue for Peach State Roller Derby.",
    "vibes": ["family-friendly", "roller-skating", "entertainment-center", "kennesaw"],
}

# Month names to numbers
MONTH_MAP = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}


def parse_date(date_str: str) -> Optional[str]:
    """
    Parse date from various formats like:
    - 'March 21, 2026'
    - 'March 21'
    - '3/21/26'
    - 'Sat, March 21'
    Returns YYYY-MM-DD string.
    """
    date_str = date_str.strip()

    # Try "Month Day, Year" or "Month Day"
    match = re.search(
        r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)?,?\s*'
        r'(January|February|March|April|May|June|July|August|September|October|November|December|'
        r'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+'
        r'(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}|\d{2}))?',
        date_str,
        re.IGNORECASE
    )

    if match:
        month_name = match.group(1).lower()
        day = int(match.group(2))
        year_str = match.group(3)

        if month_name not in MONTH_MAP:
            return None

        month = MONTH_MAP[month_name]

        # Determine year
        if year_str:
            year = int(year_str)
            if year < 100:  # Two-digit year
                year += 2000 if year >= 0 else 1900
        else:
            # No year provided, assume current or next year
            now = datetime.now()
            year = now.year
            try:
                event_date = datetime(year, month, day)
                if event_date.date() < now.date():
                    year += 1
            except ValueError:
                return None

        try:
            event_date = datetime(year, month, day)
            return event_date.strftime("%Y-%m-%d")
        except ValueError:
            return None

    # Try MM/DD/YYYY or MM/DD/YY format
    match = re.match(r'(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})', date_str)
    if match:
        month, day, year = match.groups()
        month = int(month)
        day = int(day)
        year = int(year)

        if year < 100:
            year += 2000 if year >= 0 else 1900

        try:
            event_date = datetime(year, month, day)
            return event_date.strftime("%Y-%m-%d")
        except ValueError:
            return None

    return None


def parse_time(time_str: str) -> Optional[str]:
    """
    Parse time from format like '7:00pm', '7pm', '7:30 PM'.
    Returns HH:MM in 24-hour format.
    """
    match = re.search(r'(\d{1,2})(?::(\d{2}))?\s*(am|pm)', time_str.strip(), re.IGNORECASE)
    if not match:
        return None

    hour = int(match.group(1))
    minute = match.group(2) if match.group(2) else "00"
    period = match.group(3).lower()

    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0

    return f"{hour:02d}:{minute}"


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Peach State Roller Derby schedule using Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()

            # Get or create venue
            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Peach State Roller Derby: {BASE_URL}")
            page.goto(BASE_URL, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(3000)

            # Scroll to load lazy content
            for _ in range(3):
                page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                page.wait_for_timeout(1000)

            # Get text content directly from Playwright (preserves line breaks better)
            all_text = page.inner_text("body")

            # Also get HTML for link extraction
            html_content = page.content()
            browser.close()

        # Parse HTML with BeautifulSoup for links
        soup = BeautifulSoup(html_content, "html.parser")

        # Strategy 1: Look for text containing date patterns
        lines = [l.strip() for l in all_text.split('\n') if l.strip()]

        potential_events = []

        for i, line in enumerate(lines):
            # Look for lines that contain dates
            date = parse_date(line)
            if date:
                # Found a date, try to find title and time nearby
                title = None
                start_time = None

                # Check surrounding lines (limited range to avoid grabbing unrelated content)
                for offset in [-2, -1, 0, 1]:
                    idx = i + offset
                    if 0 <= idx < len(lines):
                        check_line = lines[idx]

                        # Skip if it's another date
                        if offset != 0 and parse_date(check_line):
                            continue

                        # Skip navigation/header junk
                        if re.search(r'(skip to|search this site|embedded files|main content|navigation)', check_line.lower()):
                            continue

                        # Look for time
                        if not start_time:
                            parsed_time = parse_time(check_line)
                            if parsed_time:
                                start_time = parsed_time

                        # Look for potential title - must be SPECIFIC roller derby content
                        if not title and 10 < len(check_line) < 250:  # Reasonable title length
                            # Skip lines starting with digits
                            if re.match(r'^\d+[:/]', check_line):
                                continue

                            # Check if it contains roller derby keywords or "crash course"
                            has_keywords = any(keyword in check_line.lower() for keyword in ['bout', 'vs', 'versus', 'v.', 'game', 'match', 'crash course', 'training'])

                            if has_keywords:
                                # Only exclude if it's PURELY navigation/junk without valuable content
                                if not re.search(r'^(tickets?|register|more info|click here|page updated|report abuse|thank you)\s*$', check_line.lower()):
                                    title = check_line
                                    break

                # Only add if we found a reasonable title
                if title and date:
                    potential_events.append({
                        'date': date,
                        'title': title,
                        'time': start_time,
                        'raw_line': line
                    })

        # Strategy 2: Look for links to schedules or ticketing
        schedule_links = []
        for link in soup.find_all('a', href=True):
            href = link.get('href', '')
            text = link.get_text(strip=True).lower()

            if any(keyword in text for keyword in ['schedule', 'calendar', 'events', 'tickets', 'bout']):
                if href.startswith('http'):
                    schedule_links.append(href)
                    logger.info(f"Found potential schedule link: {href}")

        # Process found events
        for event_data in potential_events:
            if not event_data['date']:
                continue

            events_found += 1

            # Build title with validation
            raw_title = event_data['title'] or "Event"

            # Clean up title - extract meaningful part
            # Remove email addresses
            clean_title = re.sub(r'\S+@\S+', '', raw_title)
            # Remove "Contact" prefix if present
            clean_title = re.sub(r'^Contact\s+', '', clean_title, flags=re.IGNORECASE)
            # Extract event type keywords
            if 'crash course' in clean_title.lower():
                title = "Peach State Roller Derby Crash Course"
            elif 'training' in clean_title.lower():
                title = "Peach State Roller Derby Training"
            elif 'bout' in clean_title.lower() or 'vs' in clean_title.lower():
                # Try to extract team matchup
                title = clean_title.strip()
                if len(title) > 100:
                    title = "Peach State Roller Derby Bout"
            else:
                # Generic cleanup
                title = clean_title.strip()
                if len(title) > 100 or len(title) < 5:
                    title = "Peach State Roller Derby Event"

            # Add prefix if it doesn't mention derby/bout/peach state
            if not any(keyword in title.lower() for keyword in ['derby', 'bout', 'peach state']):
                title = f"Peach State Roller Derby: {title}"

            # Ensure title is under 500 chars
            if len(title) > 500:
                title = title[:497] + "..."

            start_date = event_data['date']
            start_time = event_data['time'] or "20:00"  # Default to 8pm (from Crash Course schedule)

            # Build description based on event type
            if 'crash course' in raw_title.lower() or 'training' in raw_title.lower():
                description = "New skater training session at Sparkles Family Fun Center in Kennesaw. "
                description += "Peach State Roller Derby's Crash Course is a 4-week training program for prospective skaters. "
                description += "All required safety gear needed including mouth guard, helmet, wrist guards, knee pads and elbow pads. "
                description += "Limited loaner gear and derby skates available. Contact recruitment@peachstaterollerderby.com for details."
            else:
                description = "Peach State Roller Derby event at Sparkles Family Fun Center in Kennesaw. "
                description += "Peach State Roller Derby is a WFTDA member league featuring competitive women's flat track roller derby. "
                description += "Check the team's Facebook page for latest updates and ticket information."

            # Generate content hash
            content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

            # Check for existing event
            existing = find_event_by_hash(content_hash)
            if existing:
                events_updated += 1
                logger.debug(f"Event already exists: {title} on {start_date}")
                continue

            # Create event record
            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": description,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": "sports",
                "subcategory": "roller_derby",
                "tags": ["roller-derby", "peach-state-roller-derby", "kennesaw", "women-sports", "live-sports"],
                "price_min": None,
                "price_max": None,
                "price_note": "Check Facebook or website for ticket information",
                "is_free": False,
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": event_data['raw_line'],
                "extraction_confidence": 0.75,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            try:
                insert_event(event_record)
                events_new += 1
                logger.info(f"Added: {title} on {start_date}")
            except Exception as e:
                logger.error(f"Failed to insert event: {title}: {e}")

        # If no events found, log schedule links for manual review
        if events_found == 0 and schedule_links:
            logger.warning(f"No events parsed, but found schedule links: {schedule_links}")
            logger.info("Consider checking Facebook: https://www.facebook.com/PeachStateRollerDerby")
        elif events_found == 0:
            logger.warning("No events found. Schedule may be image-based or on social media.")
            logger.info("Check: https://www.facebook.com/PeachStateRollerDerby and Instagram @peachstaterollerderby")

        logger.info(
            f"Peach State Roller Derby crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Peach State Roller Derby: {e}")
        raise

    return events_found, events_new, events_updated
