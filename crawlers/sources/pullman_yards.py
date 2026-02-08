"""
Crawler for Pullman Yards (pullmanyards.com).
27-acre historic rail yard complex in Kirkwood with 9 venue spaces.
Hosts major events including SweetWater 420 Fest, Candler Park Music Festival, concerts, and immersive experiences.

Site is Wix-based with events in a role="list" repeater structure.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.pullmanyards.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Pullman Yards",
    "slug": "pullman-yards",
    "address": "225 Rogers St NE",
    "neighborhood": "Kirkwood",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30317",
    "lat": 33.7560,
    "lng": -84.3280,
    "venue_type": "event_space",
    "spot_type": "event_space",
    "website": BASE_URL,
    "description": "Historic 27-acre rail yard complex with 9 venue spaces hosting concerts, festivals, and immersive experiences.",
}


def parse_date_range(date_str: str) -> tuple[Optional[str], Optional[str]]:
    """
    Parse date from various formats.

    Handles:
    - "Opening February 7th 2026" -> (2026-02-07, None)
    - "January 8th 2026" -> (2026-01-08, None)
    - "March 26, 27, and 28 2026" -> (2026-03-26, 2026-03-28)
    - "April 9th 2026" -> (2026-04-09, None)
    """
    date_str = date_str.strip()
    now = datetime.now()

    # Pattern: "Month DD, DD, and DD YYYY" (date range)
    range_match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2})(?:st|nd|rd|th)?,\s*(\d{1,2})(?:st|nd|rd|th)?,\s*and\s*(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})",
        date_str,
        re.IGNORECASE
    )
    if range_match:
        month_str = range_match.group(1)[:3]
        start_day = range_match.group(2)
        end_day = range_match.group(4)
        year = range_match.group(5)
        try:
            start_dt = datetime.strptime(f"{month_str} {start_day} {year}", "%b %d %Y")
            end_dt = datetime.strptime(f"{month_str} {end_day} {year}", "%b %d %Y")
            return start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Pattern: "Opening Month DD YYYY" or "Month DD YYYY"
    single_match = re.search(
        r"(?:Opening\s+)?(January|February|March|April|May|June|July|August|September|October|November|December)\s+"
        r"(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})",
        date_str,
        re.IGNORECASE
    )
    if single_match:
        month_str = single_match.group(1)[:3]
        day = single_match.group(2)
        year = single_match.group(3)
        try:
            dt = datetime.strptime(f"{month_str} {day} {year}", "%b %d %Y")
            if dt.date() < now.date():
                dt = dt.replace(year=now.year + 1)
            return dt.strftime("%Y-%m-%d"), None
        except ValueError:
            pass

    return None, None


def parse_recurring_pattern(date_str: str) -> Optional[tuple[str, str, str]]:
    """
    Parse recurring event patterns.

    Returns: (weekday, start_time, end_time) or None

    Handles:
    - "Wednesdays at 7:30 PM" -> ("Wednesday", "19:30", None)
    - "Thursdays at 7 - 9 PM" -> ("Thursday", "19:00", "21:00")
    """
    # Pattern: "Weekday at H:MM - H:MM PM" or "Weekday at H:MM PM"
    match = re.search(
        r"(Mondays?|Tuesdays?|Wednesdays?|Thursdays?|Fridays?|Saturdays?|Sundays?)\s+at\s+"
        r"(\d{1,2})(?::(\d{2}))?\s*(?:-\s*(\d{1,2})(?::(\d{2}))?)?\s*(am|pm)",
        date_str,
        re.IGNORECASE
    )

    if match:
        weekday = match.group(1).rstrip('s')  # Remove plural 's'
        start_hour = int(match.group(2))
        start_min = int(match.group(3)) if match.group(3) else 0
        end_hour = int(match.group(4)) if match.group(4) else None
        end_min = int(match.group(5)) if match.group(5) else 0
        period = match.group(6).lower()

        # Convert to 24-hour time
        if period == "pm" and start_hour != 12:
            start_hour += 12
        elif period == "am" and start_hour == 12:
            start_hour = 0

        start_time = f"{start_hour:02d}:{start_min:02d}"

        end_time = None
        if end_hour is not None:
            if period == "pm" and end_hour != 12:
                end_hour += 12
            elif period == "am" and end_hour == 12:
                end_hour = 0
            end_time = f"{end_hour:02d}:{end_min:02d}"

        return weekday, start_time, end_time

    return None


EXHIBITION_KEYWORDS = re.compile(
    r"(?:exhibit|exhibition|immersive|experience|world tour|installation|interactive)",
    re.IGNORECASE,
)


def is_exhibition_opening(date_str: str, title: str, description: str = "") -> bool:
    """Detect if this is a long-running exhibition opening (not a one-off event)."""
    has_opening = bool(re.search(r"\bOpening\b", date_str, re.IGNORECASE))
    has_keywords = bool(EXHIBITION_KEYWORDS.search(f"{title} {description}"))
    return has_opening and has_keywords


def generate_recurring_dates(weekday: str, num_weeks: int = 4) -> list[str]:
    """Generate next N occurrences of a weekday."""
    weekdays = {
        "Monday": 0, "Tuesday": 1, "Wednesday": 2, "Thursday": 3,
        "Friday": 4, "Saturday": 5, "Sunday": 6
    }

    target_weekday = weekdays.get(weekday)
    if target_weekday is None:
        return []

    today = datetime.now().date()
    dates = []

    # Find next occurrence
    days_ahead = (target_weekday - today.weekday()) % 7
    if days_ahead == 0:
        days_ahead = 7  # Start from next week

    next_date = today + timedelta(days=days_ahead)

    # Generate N weeks
    for i in range(num_weeks):
        dates.append((next_date + timedelta(weeks=i)).strftime("%Y-%m-%d"))

    return dates


def generate_exhibition_dates(
    opening_date_str: str,
    open_weekdays: list[int],
    num_weeks: int = 12,
) -> list[str]:
    """Generate entries for each open day of a long-running exhibition.

    Args:
        opening_date_str: YYYY-MM-DD of the opening.
        open_weekdays: List of weekday ints (0=Mon, 6=Sun) the exhibition is open.
        num_weeks: How many weeks of entries to generate.
    """
    opening = datetime.strptime(opening_date_str, "%Y-%m-%d").date()
    today = datetime.now().date()
    start = max(opening, today)
    end = start + timedelta(weeks=num_weeks)
    dates = []

    current = start
    while current <= end:
        if current.weekday() in open_weekdays:
            dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)

    return dates


def scrape_exhibition_schedule(page, url: str) -> tuple[list[int], Optional[str], Optional[str]]:
    """Visit an exhibition's external ticket/info page and extract the schedule.

    Returns: (open_weekdays, start_time, end_time)
    Defaults to Wed-Sun 10am-6pm if parsing fails.
    """
    WEEKDAY_MAP = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6,
    }
    # Defaults
    default_days = [2, 3, 4, 5, 6]  # Wed-Sun
    default_start = "10:00"
    default_end = "18:00"

    try:
        logger.info(f"Scraping exhibition schedule from: {url}")
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2000)
        body_text = page.inner_text("body")

        open_days = []
        start_time = None
        end_time = None

        # Look for "closed on Monday and Tuesday" pattern
        closed_match = re.search(
            r"[Cc]losed\s+(?:on\s+)?((?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)"
            r"(?:\s*(?:and|,|&)\s*)?)+)",
            body_text,
        )
        closed_days = set()
        if closed_match:
            for day_name, day_num in WEEKDAY_MAP.items():
                if day_name in closed_match.group(1).lower():
                    closed_days.add(day_num)

        # Look for "From X to Y: time" or "X to Y: time" pattern
        range_match = re.search(
            r"[Ff]rom\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+to\s+"
            r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)"
            r"[:\s]+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)",
            body_text,
            re.IGNORECASE,
        )
        if range_match:
            start_day = WEEKDAY_MAP[range_match.group(1).lower()]
            end_day = WEEKDAY_MAP[range_match.group(2).lower()]
            # Build list of open days from start to end
            d = start_day
            while True:
                open_days.append(d)
                if d == end_day:
                    break
                d = (d + 1) % 7

            # Parse times
            s_hour = int(range_match.group(3))
            s_min = int(range_match.group(4)) if range_match.group(4) else 0
            s_period = range_match.group(5).lower()
            if s_period == "pm" and s_hour != 12:
                s_hour += 12
            elif s_period == "am" and s_hour == 12:
                s_hour = 0
            start_time = f"{s_hour:02d}:{s_min:02d}"

            e_hour = int(range_match.group(6))
            e_min = int(range_match.group(7)) if range_match.group(7) else 0
            e_period = range_match.group(8).lower()
            if e_period == "pm" and e_hour != 12:
                e_hour += 12
            elif e_period == "am" and e_hour == 12:
                e_hour = 0
            end_time = f"{e_hour:02d}:{e_min:02d}"

        # If we found closed days but no explicit range, infer open = all except closed
        if closed_days and not open_days:
            open_days = [d for d in range(7) if d not in closed_days]

        if not open_days:
            open_days = default_days

        # Build recurrence rule from open days
        logger.info(
            f"Exhibition schedule: days={[list(WEEKDAY_MAP.keys())[list(WEEKDAY_MAP.values()).index(d)] for d in sorted(open_days)]}, "
            f"hours={start_time or default_start}-{end_time or default_end}"
        )

        return open_days, start_time or default_start, end_time or default_end

    except Exception as e:
        logger.warning(f"Could not scrape exhibition schedule: {e}, using defaults")
        return default_days, default_start, default_end


def parse_time(time_str: str) -> Optional[str]:
    """Parse time from various formats."""
    match = re.search(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", time_str, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2)) if match.group(2) else 0
        period = match.group(3).lower()
        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0
        return f"{hour:02d}:{minute:02d}"
    return None


def determine_category(title: str, description: str = "") -> tuple[str, Optional[str], list[str]]:
    """Determine category based on event title and description."""
    title_lower = title.lower()
    desc_lower = description.lower()
    combined = f"{title_lower} {desc_lower}"
    tags = ["pullman-yards", "kirkwood", "historic-venue"]

    # Check for specific event types
    if any(w in combined for w in ["serial killer", "exhibition", "exhibit", "true crime", "museum"]):
        return "art", "exhibition", tags + ["exhibition", "immersive"]

    if any(w in combined for w in ["cabaret", "afterdark", "pink puma", "burlesque", "drag"]):
        return "performing_arts", "cabaret", tags + ["cabaret", "nightlife"]

    if any(w in combined for w in ["wine auction", "wine", "tasting", "high museum"]):
        return "food_drink", "tasting", tags + ["wine", "fundraiser"]

    if any(w in combined for w in ["steak championship", "food", "bbq", "chef", "competition"]):
        return "food_drink", "festival", tags + ["food", "competition"]

    if any(w in combined for w in ["comedy", "open mic", "standup", "stand-up"]):
        return "comedy", "standup", tags + ["comedy", "open-mic"]

    if any(w in combined for w in ["skate", "skating", "roller"]):
        return "community", None, tags + ["skating", "family-friendly"]

    if any(w in combined for w in ["420", "sweetwater", "fest", "festival", "music festival"]):
        return "music", "festival", tags + ["festival", "outdoor"]

    if any(w in combined for w in ["concert", "live", "music", "dj", "band"]):
        return "music", "live", tags + ["live-music"]

    if any(w in combined for w in ["immersive", "experience", "art"]):
        return "art", None, tags + ["immersive", "experience"]

    if any(w in combined for w in ["market", "pop-up", "vendor"]):
        return "community", "market", tags + ["market"]

    return "community", None, tags


CTA_PHRASES = {
    "get tickets", "more info", "more information", "ticket support",
    "buy tickets", "learn more", "get tickets!", "buy now",
}

PROMO_PATTERNS = re.compile(
    r"(?:don.?t miss|premiere|coming soon|just announced|now open|on sale)",
    re.IGNORECASE,
)

DATE_LINE_PATTERN = re.compile(
    r"(?:January|February|March|April|May|June|July|August|September|October|November|December"
    r"|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday"
    r"|Opening\s)",
    re.IGNORECASE,
)


def _clean_title(text: str) -> str:
    """Strip trailing punctuation artifacts and normalize whitespace."""
    text = text.strip().rstrip("'\".,;:")
    text = re.sub(r"\s+", " ", text)
    return text


def extract_title_from_card(card_element) -> Optional[str]:
    """
    Extract title from a Wix card element.

    Priority:
    1. Heading tags (h1-h6)
    2. Short non-CTA, non-promotional, non-date text lines (< 80 chars)
    3. Non-CTA link text
    4. Extract title fragment from longer description sentences
    """
    # 1. Try headings first
    for level in range(1, 7):
        heading = card_element.query_selector(f"h{level}")
        if heading:
            title_text = heading.inner_text().strip()
            if len(title_text) > 3:
                return _clean_title(title_text)

    # 2. Try short text lines that look like standalone titles
    all_text = card_element.inner_text()
    lines = [l.strip() for l in all_text.split("\n") if l.strip()]
    for line in lines:
        if len(line) < 5 or len(line) > 80:
            continue
        if line.lower() in CTA_PHRASES:
            continue
        if PROMO_PATTERNS.search(line):
            continue
        if DATE_LINE_PATTERN.search(line):
            continue
        if line.lower().startswith("description:"):
            continue
        return _clean_title(line)

    # 3. Try non-CTA, non-promotional link text
    links = card_element.query_selector_all("a")
    for link in links:
        link_text = link.inner_text().strip()
        if len(link_text) < 5 or len(link_text) > 80:
            continue
        if link_text.lower() in CTA_PHRASES:
            continue
        if PROMO_PATTERNS.search(link_text):
            continue
        return _clean_title(link_text)

    # 4. Extract title from a longer sentence ("Title is a/the ...")
    for line in lines:
        if len(line) > 80:
            match = re.match(r"^(.{10,60}?)\s+is\s+(?:a|an|the)\s+", line)
            if match:
                return _clean_title(match.group(1))

    return None


def _extract_card_data(card) -> Optional[dict]:
    """Extract all data from a Wix card DOM element into a plain dict.

    Must be called while the events page is loaded (DOM references are valid).
    """
    card_text = card.inner_text()

    title = extract_title_from_card(card)
    if not title:
        return None

    # Image URL
    img_elem = card.query_selector("img")
    image_url = img_elem.get_attribute("src") if img_elem else None

    # External link (ticket URL)
    external_url = None
    for link in card.query_selector_all("a"):
        href = link.get_attribute("href")
        if href and not href.startswith("/") and "pullmanyards.com" not in href:
            external_url = href
            break

    return {
        "title": title,
        "text": card_text,
        "image_url": image_url,
        "external_url": external_url,
    }


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Pullman Yards events using Playwright."""
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

            venue_id = get_or_create_venue(VENUE_DATA)

            logger.info(f"Fetching Pullman Yards: {EVENTS_URL}")
            page.goto(EVENTS_URL, wait_until="domcontentloaded", timeout=45000)
            # Wait for Wix repeater items to render
            page.wait_for_selector('[role="listitem"]', timeout=15000)
            page.wait_for_timeout(2000)

            # Extract images and event links while on the page
            image_map = extract_images_from_page(page)
            event_links = extract_event_links(page, BASE_URL)

            # --- Phase 1: extract all card data while DOM is valid ---
            list_container = page.query_selector('main [role="list"]')
            if not list_container:
                logger.warning("Could not find Wix list container")
                browser.close()
                return events_found, events_new, events_updated

            raw_cards = list_container.query_selector_all('[role="listitem"]')
            logger.info(f"Found {len(raw_cards)} event cards")

            card_data_list: list[dict] = []
            for card in raw_cards:
                try:
                    data = _extract_card_data(card)
                    if data:
                        card_data_list.append(data)
                except Exception as e:
                    logger.debug(f"Error extracting card data: {e}")

            # --- Phase 2: process each card (may navigate to external sites) ---
            for card_data in card_data_list:
                try:
                    title = card_data["title"]
                    card_text = card_data["text"]
                    image_url = card_data["image_url"]
                    external_url = card_data["external_url"]

                    start_date = None
                    end_date = None
                    start_time = None
                    end_time = None
                    is_recurring = False
                    recurrence_rule = None
                    dates_to_create = []

                    # Check for recurring pattern (e.g. "Wednesdays at 7:30 PM")
                    recurring_info = parse_recurring_pattern(card_text)
                    if recurring_info:
                        weekday, rec_start_time, rec_end_time = recurring_info
                        is_recurring = True
                        recurrence_rule = f"FREQ=WEEKLY;BYDAY={weekday[:2].upper()}"
                        start_time = rec_start_time
                        end_time = rec_end_time
                        dates_to_create = generate_recurring_dates(weekday, num_weeks=4)
                        logger.info(f"Recurring event: {title} - {weekday} at {start_time}")
                    else:
                        start_date, end_date = parse_date_range(card_text)

                        if not start_date:
                            logger.debug(f"Could not parse date from card: {title}")
                            continue

                        # Check if this is a long-running exhibition
                        if is_exhibition_opening(card_text, title, card_text):
                            # Scrape the ticket/info page for the real schedule
                            exhibit_url = external_url or EVENTS_URL
                            open_days, ex_start, ex_end = scrape_exhibition_schedule(
                                page, exhibit_url
                            )

                            is_recurring = True
                            day_abbrevs = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
                            recurrence_rule = "FREQ=WEEKLY;BYDAY=" + ",".join(
                                day_abbrevs[d] for d in sorted(open_days)
                            )
                            start_time = ex_start
                            end_time = ex_end
                            dates_to_create = generate_exhibition_dates(
                                start_date, open_days, num_weeks=12
                            )
                            logger.info(
                                f"Exhibition series: {title} - {len(dates_to_create)} entries, "
                                f"{start_time}-{end_time}"
                            )
                        else:
                            dates_to_create = [start_date]
                            start_time = parse_time(card_text)

                    # Extract description
                    description_parts = []
                    lines = [l.strip() for l in card_text.split("\n") if l.strip()]
                    for line in lines:
                        if line == title:
                            continue
                        if parse_recurring_pattern(line):
                            continue
                        start_d, _ = parse_date_range(line)
                        if start_d:
                            continue
                        if line.lower() in CTA_PHRASES:
                            continue
                        if len(line) > 20:
                            description_parts.append(line)

                    description = " ".join(description_parts[:3])[:500] if description_parts else None

                    # Event URL
                    event_url = external_url or find_event_url(title, event_links, EVENTS_URL)

                    # Category
                    category, subcategory, tags = determine_category(title, description or "")

                    # Create event(s)
                    for event_date in dates_to_create:
                        events_found += 1

                        content_hash = generate_content_hash(
                            title, "Pullman Yards", event_date
                        )

                        if find_event_by_hash(content_hash):
                            events_updated += 1
                            continue

                        event_record = {
                            "source_id": source_id,
                            "venue_id": venue_id,
                            "title": title,
                            "description": description,
                            "start_date": event_date,
                            "start_time": start_time,
                            "end_date": end_date if not is_recurring else None,
                            "end_time": end_time,
                            "is_all_day": False,
                            "category": category,
                            "subcategory": subcategory,
                            "tags": tags,
                            "price_min": None,
                            "price_max": None,
                            "price_note": None,
                            "is_free": False,
                            "source_url": event_url,
                            "ticket_url": event_url,
                            "image_url": image_url or image_map.get(title),
                            "raw_text": card_text[:500],
                            "extraction_confidence": 0.85,
                            "is_recurring": is_recurring,
                            "recurrence_rule": recurrence_rule if is_recurring else None,
                            "content_hash": content_hash,
                        }

                        try:
                            enrich_event_record(event_record, "Pullman Yards")
                            insert_event(event_record)
                            events_new += 1
                            logger.info(f"Added: {title} on {event_date}")
                        except Exception as e:
                            logger.error(f"Failed to insert: {title}: {e}")

                except Exception as e:
                    logger.debug(f"Error processing event card: {e}")
                    continue

            browser.close()

        logger.info(
            f"Pullman Yards crawl complete: {events_found} found, {events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Pullman Yards: {e}")
        raise

    return events_found, events_new, events_updated
