"""
Crawler for Star Community Bar (starbaratl.bar).

Star Bar is a legendary dive bar and live music venue at 437 Moreland Ave NE
in Little Five Points, Atlanta, open since 1993. Known for punk, metal, indie
rock, comedy, karaoke, DJ nights, and drag shows.

Website: https://www.starbaratl.bar (Squarespace; events listed on homepage)
Note: The original domain starbaratlanta.com is parked/for-sale as of 2026.

Scrapes one-off shows from the homepage (Squarespace eventlist-event articles)
and generates recurring Monday comedy + Tuesday funk events.
Each event has:
  - time[datetime] attributes for ISO date (YYYY-MM-DD)
  - .eventlist-meta-time for start time text (e.g. "7:00 PM")
  - .eventlist-title-link for title and relative URL (/shows/<slug>)
  - .eventlist-excerpt for description text
  - img[src] for event poster (Squarespace CDN)
  - freshtix / zeffy / other ticket links inline

Social media (for one-off announcements not on the website):
  - Facebook: https://www.facebook.com/StarBarAtlanta/
  - Instagram: https://www.instagram.com/starbaratl/
"""

from __future__ import annotations

import re
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash, find_existing_event_for_insert, smart_update_existing_event
from dedupe import generate_content_hash
from source_destination_sync import refresh_venue_specials_from_website
from utils import enrich_event_record

logger = logging.getLogger(__name__)

BASE_URL = "https://www.starbaratl.bar"
# Events are listed on the homepage (path "/")
SHOWS_URL = BASE_URL + "/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

VENUE_DATA = {
    "name": "Star Community Bar",
    "slug": "star-community-bar",
    "address": "437 Moreland Ave NE",
    "neighborhood": "Little Five Points",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30307",
    # 437 Moreland Ave NE — directly across from The Vortex (438 Moreland)
    "lat": 33.7636,
    "lng": -84.3499,
    "venue_type": "bar",
    "spot_type": "bar",
    "website": BASE_URL,
    "vibes": [
        "dive-bar",
        "live-music",
        "punk",
        "metal",
        "indie-rock",
        "karaoke",
        "comedy",
        "drag",
        "little-five-points",
        "late-night",
    ],
}

# Ticket platforms Star Bar uses (for extracting ticket URLs)
TICKET_DOMAINS = ("freshtix.com", "zeffy.com", "eventbrite.com", "ticketweb.com")

# Confirmed weekly recurring events (may not always appear as dated Squarespace articles)
WEEKS_AHEAD = 6
WEEKLY_SCHEDULE = [
    {
        "day": 0,  # Monday
        "title": "Rotknee Presents Comedy at Star Bar",
        "description": (
            "Monday comedy night at Star Bar in Little Five Points. "
            "Atlanta's longest-running inner-city comedy show — free, doors 8pm, show 9pm."
        ),
        "start_time": "21:00",
        "category": "comedy",
        "subcategory": "comedy.standup",
        "tags": ["comedy", "stand-up", "free", "weekly", "little-five-points"],
        "is_free": True,
    },
    {
        "day": 1,  # Tuesday
        "title": "Disco Funk Night at Star Bar",
        "description": (
            "Tuesday disco and funk DJ night at Star Bar in Little Five Points. "
            "Free dance party starting at 10pm — no cover."
        ),
        "start_time": "22:00",
        "category": "nightlife",
        "subcategory": "nightlife.dj",
        "tags": ["dj", "disco", "funk", "dance", "free", "weekly", "little-five-points"],
        "is_free": True,
    },
    {
        "day": 2,  # Wednesday
        "title": "Karaoke Night at Star Bar",
        "description": (
            "Wednesday karaoke night at Star Bar in Little Five Points. "
            "$5 cover, doors 8pm, singing starts at 9pm."
        ),
        "start_time": "21:00",
        "category": "nightlife",
        "subcategory": "nightlife.karaoke",
        "tags": ["karaoke", "nightlife", "weekly", "little-five-points"],
        "is_free": False,
        "price_min": 5.0,
        "price_max": 5.0,
        "price_note": "$5 cover",
    },
]

DAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _get_next_weekday(start_date: datetime, weekday: int) -> datetime:
    days_ahead = weekday - start_date.weekday()
    if days_ahead < 0:
        days_ahead += 7
    return start_date + timedelta(days=days_ahead)

# Map title keywords to (category, subcategory, genres, tags)
CATEGORY_RULES: list[tuple[list[str], str, Optional[str], list[str], list[str]]] = [
    (
        ["comedy", "stand-up", "standup", "funny", "comic"],
        "comedy",
        "standup",
        ["comedy", "stand-up"],
        ["comedy", "little-five-points", "star-bar"],
    ),
    (
        ["karaoke"],
        "nightlife",
        "nightlife.karaoke",
        ["karaoke"],
        ["karaoke", "nightlife", "little-five-points", "star-bar"],
    ),
    (
        ["drag", "burlesque", "queen", "trans"],
        "nightlife",
        "nightlife.drag",
        ["drag"],
        ["drag", "nightlife", "lgbtq", "little-five-points", "star-bar"],
    ),
    (
        ["dj", "dance party", "dance night", "disco", "80s night", "90s night"],
        "nightlife",
        "nightlife.dj",
        ["dj", "dance"],
        ["dj", "dance", "nightlife", "little-five-points", "star-bar"],
    ),
    (
        ["trivia", "quiz"],
        "nightlife",
        "nightlife.trivia",
        ["trivia"],
        ["trivia", "nightlife", "little-five-points", "star-bar"],
    ),
    (
        ["market", "pop-up", "vendor", "craft fair"],
        "community",
        None,
        [],
        ["market", "pop-up", "little-five-points", "star-bar"],
    ),
]


def _classify_event(title: str) -> tuple[str, Optional[str], list[str], list[str]]:
    """Return (category, subcategory, genres, tags) based on title keywords."""
    title_lower = title.lower()
    for keywords, category, subcategory, genres, tags in CATEGORY_RULES:
        if any(kw in title_lower for kw in keywords):
            return category, subcategory, genres, tags
    # Default: live music
    return (
        "music",
        "concert",
        ["punk", "indie-rock", "metal"],
        ["live-music", "punk", "metal", "indie-rock", "little-five-points", "star-bar"],
    )


def _parse_time(time_str: str) -> Optional[str]:
    """Parse '7:00 PM', '8 PM', '8:00pm' -> '19:00'."""
    if not time_str:
        return None
    m = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)", time_str.strip(), re.IGNORECASE)
    if not m:
        return None
    hour = int(m.group(1))
    minute = int(m.group(2)) if m.group(2) else 0
    period = m.group(3).lower()
    if period == "pm" and hour != 12:
        hour += 12
    elif period == "am" and hour == 12:
        hour = 0
    return f"{hour:02d}:{minute:02d}"


def _extract_price(text: str) -> tuple[Optional[float], Optional[float], bool, Optional[str]]:
    """
    Extract price info from description/excerpt text.
    Returns (price_min, price_max, is_free, price_note).
    """
    if not text:
        return None, None, False, None

    text_lower = text.lower()

    # Free patterns
    if re.search(r"\bno cover\b|\bfree admission\b|\bfree entry\b|\bno charge\b", text_lower):
        return None, None, True, "No cover"

    # Dollar amount patterns: "$20 advance", "$15 advance/$20 door", "$30"
    prices = re.findall(r"\$(\d+(?:\.\d{2})?)", text)
    if prices:
        amounts = [float(p) for p in prices]
        price_min = min(amounts)
        price_max = max(amounts)
        # Build a note from the first price mention
        note_match = re.search(r"(\$\d+(?:\.\d{2})?(?:\s+\w+)*)", text)
        price_note = note_match.group(1).strip() if note_match else None
        return price_min, price_max, False, price_note

    return None, None, False, None


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Star Community Bar shows from starbaratl.bar homepage."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    logger.info(f"Star Community Bar venue record ensured (ID: {venue_id})")
    refresh_venue_specials_from_website(venue_id)

    try:
        response = requests.get(SHOWS_URL, headers=HEADERS, timeout=30)
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.error(f"Failed to fetch Star Bar homepage: {exc}")
        return events_found, events_new, events_updated

    soup = BeautifulSoup(response.text, "html.parser")
    event_articles = soup.select("article.eventlist-event")

    if not event_articles:
        logger.warning("Star Bar: no eventlist-event articles found on homepage")
        return events_found, events_new, events_updated

    logger.info(f"Star Bar: found {len(event_articles)} event articles")
    today = datetime.now().date()

    for article in event_articles:
        try:
            # --- Title ---
            title_el = article.select_one(".eventlist-title-link")
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if not title or len(title) < 3:
                continue

            # --- Event URL ---
            rel_url = title_el.get("href", "")
            event_url = (BASE_URL + rel_url) if rel_url.startswith("/") else rel_url
            if not event_url:
                event_url = SHOWS_URL

            # --- Date: first time[datetime] attribute gives start date ---
            time_els = article.select("time[datetime]")
            if not time_els:
                logger.debug(f"Star Bar: no datetime element for '{title}', skipping")
                continue
            start_date_str = time_els[0].get("datetime", "")
            if not start_date_str or len(start_date_str) < 10:
                continue
            start_date = start_date_str[:10]  # ensure YYYY-MM-DD

            try:
                start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                logger.debug(f"Star Bar: invalid date '{start_date}' for '{title}'")
                continue

            # Skip past events
            if start_date_obj < today:
                continue

            events_found += 1

            # --- Start time: .eventlist-meta-time first token ---
            start_time: Optional[str] = None
            time_meta_el = article.select_one(".eventlist-meta-time")
            if time_meta_el:
                time_raw = time_meta_el.get_text(strip=True)
                # "7:00 PM11:00 PM" — take the first time token
                first_time = re.split(r"\s{2,}|\n", time_raw)[0].strip()
                start_time = _parse_time(first_time) or _parse_time(time_raw)

            # --- Excerpt / description ---
            excerpt_el = article.select_one(".eventlist-excerpt")
            excerpt_text = excerpt_el.get_text(separator=" ", strip=True) if excerpt_el else None

            # --- Image: prefer data-src (lazy-loaded), fall back to src ---
            image_url: Optional[str] = None
            img_el = article.select_one("img")
            if img_el:
                raw_src = img_el.get("data-src") or img_el.get("src") or ""
                if raw_src.startswith("//"):
                    raw_src = "https:" + raw_src
                elif raw_src.startswith("/"):
                    raw_src = BASE_URL + raw_src
                if raw_src.startswith("http"):
                    image_url = raw_src

            # --- Ticket link ---
            ticket_url: Optional[str] = None
            for a_el in article.select("a[href]"):
                href = a_el.get("href", "")
                if any(domain in href for domain in TICKET_DOMAINS):
                    ticket_url = href
                    break

            # --- Price extraction from excerpt ---
            price_min, price_max, is_free, price_note = _extract_price(excerpt_text or "")

            # --- Category / genre classification ---
            category, subcategory, genres, tags = _classify_event(title)

            # --- Content hash ---
            content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

            event_record = {
                "source_id": source_id,
                "venue_id": venue_id,
                "title": title,
                "description": excerpt_text or None,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": category,
                "subcategory": subcategory,
                "genres": genres,
                "tags": tags,
                "is_free": is_free,
                "price_min": price_min,
                "price_max": price_max,
                "price_note": price_note,
                "source_url": event_url,
                "ticket_url": ticket_url,
                "image_url": image_url,
                "raw_text": None,
                "extraction_confidence": 0.90,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            # Enrich from detail page when listing data is incomplete
            if event_url and event_url != SHOWS_URL and (not event_record["description"] or not event_record["image_url"]):
                enrich_event_record(event_record, "Star Community Bar")

            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
                continue

            try:
                insert_event(event_record, genres=genres)
                events_new += 1
                logger.debug(f"Star Bar: added '{title}' on {start_date}")
            except Exception as exc:
                logger.error(f"Star Bar: failed to insert '{title}': {exc}")

        except Exception as exc:
            logger.debug(f"Star Bar: error parsing article: {exc}")
            continue

    # Generate recurring weekly events (comedy Mon, funk Tue)
    today_dt = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    for template in WEEKLY_SCHEDULE:
        next_date = _get_next_weekday(today_dt, template["day"])
        day_code = DAY_CODES[template["day"]]
        day_name = DAY_NAMES[template["day"]]

        series_hint = {
            "series_type": "recurring_show",
            "series_title": template["title"],
            "frequency": "weekly",
            "day_of_week": day_name.lower(),
            "description": template["description"],
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
                "description": template["description"],
                "start_date": start_date,
                "start_time": template["start_time"],
                "end_date": None,
                "end_time": None,
                "is_all_day": False,
                "category": template["category"],
                "subcategory": template.get("subcategory"),
                "tags": template["tags"],
                "is_free": template.get("is_free", False),
                "price_min": template.get("price_min"),
                "price_max": template.get("price_max"),
                "price_note": template.get("price_note"),
                "source_url": BASE_URL,
                "ticket_url": None,
                "image_url": None,
                "raw_text": f"{template['title']} - {start_date}",
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
                insert_event(event_record, series_hint=series_hint)
                events_new += 1
            except Exception as exc:
                logger.error(f"Star Bar: failed to insert recurring '{template['title']}' on {start_date}: {exc}")

    logger.info(
        f"Star Community Bar crawl complete: "
        f"{events_found} found, {events_new} new, {events_updated} updated"
    )
    return events_found, events_new, events_updated
