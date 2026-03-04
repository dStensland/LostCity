"""
Crawler for Laughing Skull Lounge (laughingskulllounge.com).
Atlanta's dedicated comedy club since 2009.
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

from playwright.sync_api import sync_playwright

from db import get_or_create_venue, insert_event, find_event_by_hash, find_existing_event_for_insert, smart_update_existing_event
from dedupe import generate_content_hash
from utils import extract_images_from_page, extract_event_links, find_event_url, enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://laughingskulllounge.com"
EVENTS_URL = BASE_URL

VENUE_DATA = {
    "name": "Laughing Skull Lounge",
    "slug": "laughing-skull-lounge",
    "address": "878 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30309",
    "venue_type": "comedy_club",
    "website": BASE_URL,
}


def parse_calendar_date(date_text: str) -> Optional[str]:
    """Parse date from 'Tuesday, January 13, 8:00 pm' format."""
    try:
        # "Tuesday, January 13, 8:00 pm"
        match = re.match(
            r"(\w+),\s+(\w+)\s+(\d+),\s+(\d+):(\d+)\s*(am|pm)", date_text, re.IGNORECASE
        )
        if match:
            _, month, day, hour, minute, period = match.groups()
            current_year = datetime.now().year

            for fmt in ["%B %d %Y", "%b %d %Y"]:
                try:
                    dt = datetime.strptime(f"{month} {day} {current_year}", fmt)
                    if dt < datetime.now():
                        dt = datetime.strptime(f"{month} {day} {current_year + 1}", fmt)
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    continue
        return None
    except Exception:
        return None


def parse_calendar_time(date_text: str) -> Optional[str]:
    """Parse time from 'Tuesday, January 13, 8:00 pm' format."""
    try:
        match = re.search(r"(\d+):(\d+)\s*(am|pm)", date_text, re.IGNORECASE)
        if match:
            hour, minute, period = match.groups()
            hour = int(hour)
            if period.lower() == "pm" and hour != 12:
                hour += 12
            elif period.lower() == "am" and hour == 12:
                hour = 0
            return f"{hour:02d}:{minute}"
        return None
    except Exception:
        return None


def parse_price(price_text: str) -> tuple[Optional[float], Optional[float]]:
    """Parse price from '$25.00 – $35.00' or '$15.00' format."""
    try:
        prices = re.findall(r"\$(\d+(?:\.\d{2})?)", price_text)
        if len(prices) >= 2:
            return float(prices[0]), float(prices[1])
        elif len(prices) == 1:
            return float(prices[0]), float(prices[0])
        return None, None
    except Exception:
        return None, None


def format_time_label(time_24: Optional[str]) -> Optional[str]:
    if not time_24:
        return None
    raw = str(time_24).strip()
    if not raw:
        return None
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt).strftime("%-I:%M %p")
        except ValueError:
            continue
    return raw


def build_comedy_description(
    *,
    title: str,
    base_description: Optional[str],
    start_date: str,
    start_time: Optional[str],
    event_url: str,
    price_min: Optional[float],
    price_max: Optional[float],
) -> str:
    desc = (base_description or "").strip()
    parts: list[str] = []
    if desc and len(desc) >= 120:
        parts.append(desc if desc.endswith(".") else f"{desc}.")
    elif desc:
        parts.append(desc if desc.endswith(".") else f"{desc}.")
        parts.append(f"Stand-up comedy event at Laughing Skull Lounge in Midtown Atlanta.")
    else:
        parts.append(f"{title} is a stand-up comedy event at Laughing Skull Lounge in Midtown Atlanta.")

    parts.append("Location: Laughing Skull Lounge, Midtown, Atlanta, GA.")
    time_label = format_time_label(start_time)
    if start_date and time_label:
        parts.append(f"Scheduled on {start_date} at {time_label}.")
    elif start_date:
        parts.append(f"Scheduled on {start_date}.")

    if price_min is not None and price_max is not None:
        if price_min == price_max:
            parts.append(f"Typical ticket price: ${price_min:.0f}.")
        else:
            parts.append(f"Typical ticket range: ${price_min:.0f}-${price_max:.0f}.")
    elif price_min is not None:
        parts.append(f"Tickets from ${price_min:.0f}.")

    if event_url:
        parts.append(f"Check the official listing for lineup updates and ticket availability ({event_url}).")
    else:
        parts.append("Check the official listing for lineup updates and ticket availability.")
    return " ".join(parts)[:1400]


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Laughing Skull events."""
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

            logger.info(f"Fetching Laughing Skull: {BASE_URL}")
            page.goto(BASE_URL, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)

            # Extract images from page
            image_map = extract_images_from_page(page)

            # Extract event links for specific URLs
            event_links = extract_event_links(page, BASE_URL)

            venue_id = get_or_create_venue(VENUE_DATA)

            body_text = page.inner_text("body")

            # Calendar format:
            # TUE
            # 13
            # Open Mic Night Every Monday - Wednesday
            # Tuesday, January 13, 8:00 pm
            # Description...
            # Get Tickets $15.00

            # Split by day markers (MON, TUE, WED, etc.)
            day_pattern = r"\n(MON|TUE|WED|THU|FRI|SAT|SUN)\n(\d{1,2})\n"
            parts = re.split(day_pattern, body_text)

            # Skip the first part (before first day marker)
            # Then process in groups of 3: day_abbrev, day_num, content
            i = 1
            while i + 2 < len(parts):
                day_abbrev = parts[i]
                day_num = parts[i + 1]
                content = parts[i + 2]
                i += 3

                lines = [l.strip() for l in content.split("\n") if l.strip()]
                if not lines:
                    continue

                # First line is typically the event title
                title = lines[0]

                # Skip navigation/header items
                skip_words = ["PAST EVENT", "View All", "Select date", "Event Views"]
                if any(w.lower() in title.lower() for w in skip_words):
                    continue

                # Look for date/time line: "Tuesday, January 13, 8:00 pm"
                date_line = None
                price_line = None
                description = None

                for line in lines[1:]:
                    if re.match(
                        r"\w+,\s+\w+\s+\d+,\s+\d+:\d+\s*(am|pm)", line, re.IGNORECASE
                    ):
                        date_line = line
                    elif "Get Tickets" in line or "$" in line:
                        price_line = line
                    elif len(line) > 20 and not description:
                        # Likely description
                        description = line

                if not date_line:
                    continue

                start_date = parse_calendar_date(date_line)
                if not start_date:
                    continue

                start_time = parse_calendar_time(date_line)
                price_min, price_max = parse_price(price_line or "")

                events_found += 1

                content_hash = generate_content_hash(
                    title, "Laughing Skull Lounge", start_date + (start_time or "")
                )


                # Get specific event URL


                event_url = find_event_url(title, event_links, EVENTS_URL)



                event_record = {
                    "source_id": source_id,
                    "venue_id": venue_id,
                    "title": title,
                    "description": build_comedy_description(
                        title=title,
                        base_description=description,
                        start_date=start_date,
                        start_time=start_time,
                        event_url=event_url,
                        price_min=price_min,
                        price_max=price_max,
                    ),
                    "start_date": start_date,
                    "start_time": start_time,
                    "end_date": None,
                    "end_time": None,
                    "is_all_day": False,
                    "category": "comedy",
                    "subcategory": "standup",
                    "tags": ["comedy", "standup", "laughing-skull"],
                    "price_min": price_min,
                    "price_max": price_max,
                    "price_note": None,
                    "is_free": None,
                    "source_url": event_url,
                    "ticket_url": event_url if event_url != EVENTS_URL else None,
                    "image_url": image_map.get(title),
                    "raw_text": None,
                    "extraction_confidence": 0.90,
                    "is_recurring": False,
                    "recurrence_rule": None,
                    "content_hash": content_hash,
                }

                # Enrich from detail page
                enrich_event_record(event_record, source_name="Laughing Skull Lounge")

                # Determine is_free if still unknown after enrichment
                if event_record.get("is_free") is None:
                    desc_lower = (event_record.get("description") or "").lower()
                    title_lower = event_record.get("title", "").lower()
                    combined = f"{title_lower} {desc_lower}"
                    if any(kw in combined for kw in ["free", "no cost", "no charge", "complimentary"]):
                        event_record["is_free"] = True
                        event_record["price_min"] = event_record.get("price_min") or 0
                        event_record["price_max"] = event_record.get("price_max") or 0
                    else:
                        event_record["is_free"] = False

                existing = find_event_by_hash(content_hash)
                if existing:
                    smart_update_existing_event(existing, event_record)
                    events_updated += 1
                    continue

                try:
                    insert_event(event_record, genres=["comedy", "stand-up"])
                    events_new += 1
                    logger.info(f"Added: {title} on {start_date} at {start_time}")
                except Exception as e:
                    logger.error(f"Failed to insert: {title}: {e}")

            browser.close()

        logger.info(
            f"Laughing Skull website: {events_found} found, {events_new} new"
        )

    except Exception as e:
        logger.error(f"Failed to crawl Laughing Skull website: {e}")

    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        f, n, u = _generate_recurring_events(source_id, venue_id)
        events_found += f
        events_new += n
        events_updated += u
    except Exception as e:
        logger.error(f"Failed to generate Laughing Skull recurring events: {e}")

    return events_found, events_new, events_updated


WEEKS_AHEAD = 6
DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

RECURRING_SCHEDULE = [
    {"day": 0, "title": "Open Mic Comedy Night", "start_time": "20:00",
     "description": "Monday open mic at Laughing Skull Lounge. ~20 comics performing 4 minutes each. $15.",
     "category": "comedy", "subcategory": "comedy.standup",
     "tags": ["open-mic", "comedy", "standup", "weekly"], "price_min": 15, "price_max": 15},
    {"day": 1, "title": "Open Mic Comedy Night", "start_time": "20:00",
     "description": "Tuesday open mic at Laughing Skull Lounge. ~20 comics performing 4 minutes each. $15.",
     "category": "comedy", "subcategory": "comedy.standup",
     "tags": ["open-mic", "comedy", "standup", "weekly"], "price_min": 15, "price_max": 15},
    {"day": 2, "title": "Open Mic Comedy Night", "start_time": "20:00",
     "description": "Wednesday open mic at Laughing Skull Lounge. ~20 comics performing 4 minutes each. $15.",
     "category": "comedy", "subcategory": "comedy.standup",
     "tags": ["open-mic", "comedy", "standup", "weekly"], "price_min": 15, "price_max": 15},
    {"day": 3, "title": "Best of Atlanta Comedy Showcase", "start_time": "20:00",
     "description": "Thursday comedy showcase at Laughing Skull. 10 professional comics, 10 minutes each.",
     "category": "comedy", "subcategory": "comedy.standup",
     "tags": ["comedy", "standup", "showcase", "weekly"], "price_min": 20, "price_max": 25},
    {"day": 4, "title": "Best of Atlanta Comedy Showcase", "start_time": "20:00",
     "description": "Friday night comedy at Laughing Skull. Two shows: 8pm and 10:30pm.",
     "category": "comedy", "subcategory": "comedy.standup",
     "tags": ["comedy", "standup", "showcase", "weekly", "late-night"], "price_min": 25, "price_max": 35},
    {"day": 5, "title": "Best of Atlanta Comedy Showcase", "start_time": "17:30",
     "description": "Saturday comedy at Laughing Skull. Three shows: 5:30pm, 8pm, and 10:30pm.",
     "category": "comedy", "subcategory": "comedy.standup",
     "tags": ["comedy", "standup", "showcase", "weekly", "late-night"], "price_min": 30, "price_max": 55},
    {"day": 6, "title": "Best of Atlanta Comedy Showcase", "start_time": "19:30",
     "description": "Sunday evening comedy showcase at Laughing Skull Lounge. 7:30pm showtime.",
     "category": "comedy", "subcategory": "comedy.standup",
     "tags": ["comedy", "standup", "showcase", "weekly"], "price_min": 20, "price_max": 25},
]


def _get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)


def _generate_recurring_events(source_id: int, venue_id: int) -> tuple[int, int, int]:
    events_found = events_new = events_updated = 0
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in RECURRING_SCHEDULE:
        next_date = _get_next_weekday(today, template["day"])
        day_code = DAY_CODES[template["day"]]
        day_name = DAY_NAMES[template["day"]]

        series_hint = {
            "series_type": "recurring_show",
            "series_title": template["title"],
            "frequency": "weekly",
            "day_of_week": day_name,
            "description": build_comedy_description(
                title=template["title"],
                base_description=template["description"],
                start_date=next_date.strftime("%Y-%m-%d"),
                start_time=template["start_time"],
                event_url=BASE_URL,
                price_min=template.get("price_min"),
                price_max=template.get("price_max"),
            ),
        }

        for week in range(WEEKS_AHEAD):
            event_date = next_date + timedelta(weeks=week)
            start_date = event_date.strftime("%Y-%m-%d")
            events_found += 1

            content_hash = generate_content_hash(
                template["title"], VENUE_DATA["name"], start_date
            )

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": template["title"],
                "description": build_comedy_description(
                    title=template["title"],
                    base_description=template["description"],
                    start_date=start_date,
                    start_time=template["start_time"],
                    event_url=BASE_URL,
                    price_min=template.get("price_min"),
                    price_max=template.get("price_max"),
                ),
                "start_date": start_date,
                "start_time": template["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": template["category"],
                "subcategory": template.get("subcategory"),
                "tags": template["tags"],
                "is_free": False,
                "price_min": template.get("price_min"),
                "price_max": template.get("price_max"),
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} at Laughing Skull - {start_date}",
                "extraction_confidence": 0.90,
                "is_recurring": True,
                "recurrence_rule": f"FREQ=WEEKLY;BYDAY={day_code}",
                "content_hash": content_hash,
            }

            existing = find_existing_event_for_insert(event_record)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, series_hint=series_hint, genres=["comedy", "stand-up"])
                events_new += 1
            except Exception as exc:
                logger.error(f"Failed to insert {template['title']} on {start_date}: {exc}")

    logger.info(f"Laughing Skull recurring: {events_found} found, {events_new} new, {events_updated} updated")
    return events_found, events_new, events_updated
