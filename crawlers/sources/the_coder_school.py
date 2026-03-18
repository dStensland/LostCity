"""
Crawler for theCoderSchool Atlanta-area locations.

theCoderSchool teaches coding and AI to kids ages 6-14 at 4 metro Atlanta
locations: Dunwoody, East Cobb, Johns Creek, and Suwanee.

LOCATION PAGES:
  Each location page at thecoderschool.com/locations/<slug>/ contains a
  <table id="camptable"> with one row per camp session offering:
    - Week range (e.g. "6/1-6/5")
    - Format (In-Person / Online)
    - Camp name + full description paragraph
    - Age range (e.g. "Ages 6-9", "Ages 8+", "Ages 9-12")
    - Price with discounted price + Pike13 sign-up link

SCHEDULING PLATFORM: Pike13 (tcs-<location>.pike13.com/events/<id>)
  Pike13 requires authentication for its API, so we scrape the HTML table
  directly instead of hitting the API.

CRAWL STRATEGY:
  We parse the camp schedule table on each location page and emit one event
  per row — one camp session per week per location. Camps run Mon-Fri, 9am-3pm.
  Week ranges are parsed to produce start_date (Monday) and end_date (Friday).

  For each unique camp session we also emit a year-round Code Coaching program
  event (one per location per WEEKS_AHEAD-week window) to surface the ongoing
  after-school tutoring product in the feed.

Category: "education"  (STEM / coding education for kids)
Tags: kids, coding, stem, camp + age bands (elementary, tween, teen)
"""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# ── constants ─────────────────────────────────────────────────────────────────

BASE_URL = "https://www.thecoderschool.com"

# How many weeks ahead to generate Code Coaching program events
WEEKS_AHEAD = 8

# Request headers — theCoderSchool does not block scraping but a UA helps
REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
}

BASE_TAGS = ["kids", "coding", "stem", "family-friendly", "rsvp-required"]

# ── location config ────────────────────────────────────────────────────────────

LOCATIONS = [
    {
        "location_slug": "dunwoody",
        "name": "theCoderSchool Dunwoody",
        "venue_slug": "the-coder-school-dunwoody",
        "address": "5584 Chamblee Dunwoody Rd",
        "city": "Dunwoody",
        "state": "GA",
        "zip": "30338",
        "neighborhood": "Dunwoody",
        "lat": 33.951353,
        "lng": -84.337710,
        "phone": "(770) 759-5212",
        "email": "dunwoody@thecoderschool.com",
        "pike13_base": "https://tcs-dunwoody.pike13.com",
    },
    {
        "location_slug": "eastcobb",
        "name": "theCoderSchool East Cobb",
        "venue_slug": "the-coder-school-east-cobb",
        "address": "3162 Johnson Ferry Rd Suite 430",
        "city": "Marietta",
        "state": "GA",
        "zip": "30062",
        "neighborhood": "East Cobb",
        "lat": 34.026677,
        "lng": -84.422174,
        "phone": "(404) 947-6047",
        "email": "eastcobb@thecoderschool.com",
        "pike13_base": "https://tcs-eastcobb.pike13.com",
    },
    {
        "location_slug": "johnscreek",
        "name": "theCoderSchool Johns Creek",
        "venue_slug": "the-coder-school-johns-creek",
        "address": "5025 Jones Bridge Rd #610",
        "city": "Johns Creek",
        "state": "GA",
        "zip": "30022",
        "neighborhood": "Johns Creek",
        "lat": 34.062403,
        "lng": -84.213292,
        "phone": "(770) 919-5894",
        "email": "johnscreek@thecoderschool.com",
        "pike13_base": "https://tcs-johnscreek.pike13.com",
    },
    {
        "location_slug": "suwanee",
        "name": "theCoderSchool Suwanee",
        "venue_slug": "the-coder-school-suwanee",
        "address": "4140 Moore Road Ste. B108",
        "city": "Suwanee",
        "state": "GA",
        "zip": "30024",
        "neighborhood": "Suwanee",
        "lat": 34.052346,
        "lng": -84.091344,
        "phone": "(770) 744-5523",
        "email": "suwanee@thecoderschool.com",
        "pike13_base": "https://tcs-suwanee.pike13.com",
    },
]

# ── venue builder ──────────────────────────────────────────────────────────────


def _build_venue_data(loc: dict) -> dict:
    return {
        "name": loc["name"],
        "slug": loc["venue_slug"],
        "address": loc["address"],
        "city": loc["city"],
        "state": loc["state"],
        "zip": loc["zip"],
        "neighborhood": loc["neighborhood"],
        "lat": loc["lat"],
        "lng": loc["lng"],
        "venue_type": "education",
        "spot_type": "education",
        "website": f"{BASE_URL}/locations/{loc['location_slug']}/",
        "vibes": ["family-friendly", "kids", "educational"],
    }


# ── date parsing ───────────────────────────────────────────────────────────────


def _parse_week_range(
    week_str: str, current_year: int
) -> tuple[Optional[date], Optional[date]]:
    """
    Parse a week string like "6/1-6/5", "4/6-4/10", "6/29- 7/3", or "7/6- 7/10"
    into (start_date, end_date).

    The year is inferred from context: if the parsed month is before the current
    month we assume it's next year (to avoid treating already-past camps as future).
    Returns (None, None) on parse failure.
    """
    # Normalise spaces around the dash
    week_str = re.sub(r"\s*-\s*", "-", week_str.strip())

    # Match M/D-M/D or M/D-M/DD etc.
    m = re.match(r"(\d{1,2})/(\d{1,2})-(\d{1,2})/(\d{1,2})", week_str)
    if not m:
        return None, None

    start_month, start_day, end_month, end_day = (int(x) for x in m.groups())

    try:
        start = date(current_year, start_month, start_day)
        end = date(current_year, end_month, end_day)
    except ValueError:
        return None, None

    # If the end date has already passed this year, assume next year
    today = date.today()
    if end < today:
        try:
            start = date(current_year + 1, start_month, start_day)
            end = date(current_year + 1, end_month, end_day)
        except ValueError:
            return None, None

    return start, end


# ── age parsing ────────────────────────────────────────────────────────────────


def _parse_ages(age_str: str) -> tuple[Optional[int], Optional[int], list[str]]:
    """
    Parse age strings like "Ages 6-9", "Ages 8+", "Ages 9-12", "Ages 5-8",
    "Ages 10-13", "Ages 7-12", "Ages 8-12", "Ages 8-14", "Ages 6-10".

    Returns (age_min, age_max, tags).
    age_max is None for "+" strings.
    """
    age_str = age_str.strip()

    # "Ages N+"
    m_plus = re.match(r"Ages\s+(\d+)\+", age_str, re.IGNORECASE)
    if m_plus:
        age_min = int(m_plus.group(1))
        age_max = None
        tags = _age_tags(age_min, 18)
        return age_min, age_max, tags

    # "Ages N-M"
    m_range = re.match(r"Ages\s+(\d+)-(\d+)", age_str, re.IGNORECASE)
    if m_range:
        age_min = int(m_range.group(1))
        age_max = int(m_range.group(2))
        tags = _age_tags(age_min, age_max)
        return age_min, age_max, tags

    return None, None, []


def _age_tags(age_min: int, age_max: int) -> list[str]:
    """Map an age range to LostCity audience tags."""
    tags: list[str] = []
    # elementary: 6-10
    if age_min <= 10 and age_max >= 6:
        tags.append("elementary")
    # tween: 10-12
    if age_min <= 12 and age_max >= 10:
        tags.append("tween")
    # teen: 13+
    if age_max >= 13 or age_min >= 13:
        tags.append("teen")
    return tags


# ── price parsing ─────────────────────────────────────────────────────────────


def _parse_price(
    price_cell: BeautifulSoup,
) -> tuple[Optional[float], Optional[float], str]:
    """
    Extract the discounted (current) price from the price cell.
    The cell contains a <del> with the original price and a text node with the
    sale price, e.g. '<del>$624</del> $549'.
    Returns (price_min, price_max, price_note).
    """
    # Remove <del> text (strikethrough = original price, not what's charged)
    del_tag = price_cell.find("del")
    if del_tag:
        del_tag.decompose()

    text = price_cell.get_text(separator=" ", strip=True)
    prices = re.findall(r"\$(\d+)", text)
    if not prices:
        return None, None, "Registration required. See website for pricing."

    # The first remaining price is the current price
    price = float(prices[0])
    return price, price, f"${int(price)} per week"


# ── camp row parser ───────────────────────────────────────────────────────────


def _parse_camp_table(soup: BeautifulSoup, loc: dict) -> list[dict]:
    """
    Parse all rows from the camp schedule table on a location page.
    Returns a list of partially-built event dicts (without source_id/venue_id).
    """
    table = soup.find("table", id="camptable")
    if not table:
        # Fallback: first table on page
        table = soup.find("table")
    if not table:
        logger.warning("[the-coder-school] No camp table found for %s", loc["name"])
        return []

    rows = table.find_all("tr")
    current_year = date.today().year
    camps: list[dict] = []

    for row in rows[1:]:  # Skip header row
        cells = row.find_all(["td", "th"])
        if len(cells) < 5:
            continue

        week_str = cells[0].get_text(strip=True)
        camp_cell = cells[2]
        age_str = cells[3].get_text(strip=True)
        price_cell = cells[4]

        # -- dates --
        start_date, end_date = _parse_week_range(week_str, current_year)
        if not start_date:
            logger.debug(
                "[the-coder-school] Could not parse week %r for %s",
                week_str,
                loc["name"],
            )
            continue

        # Skip if entirely in the past
        if end_date and end_date < date.today():
            continue

        # -- camp name + description --
        strong = camp_cell.find(["strong", "b"])
        camp_name = strong.get_text(strip=True) if strong else ""
        if not camp_name:
            # Fall back to first line of text
            first_line = camp_cell.get_text(separator="\n", strip=True).split("\n")[0]
            camp_name = first_line

        # Full description = everything in the cell minus the trailing age span
        age_span = camp_cell.find("span", class_="agespan")
        if age_span:
            age_span.decompose()
        if strong:
            strong.decompose()
        description_raw = camp_cell.get_text(separator=" ", strip=True).strip()

        # -- ages --
        age_min, age_max, age_tags = _parse_ages(age_str)

        # -- price --
        price_min, price_max, price_note = _parse_price(price_cell)

        # -- Pike13 registration URL --
        pike13_links = [
            a["href"]
            for a in cells[4].find_all("a", href=True)
            if "pike13.com" in a["href"] and "/events/" in a["href"]
        ]
        ticket_url = (
            pike13_links[0] if pike13_links else loc["pike13_base"] + "/welcome"
        )

        location_page_url = f"{BASE_URL}/locations/{loc['location_slug']}/"

        camp = {
            "title": f"{camp_name} at theCoderSchool {loc['city']}",
            "description": description_raw,
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d") if end_date else None,
            "start_time": "09:00",
            "end_time": "15:00",
            "is_all_day": False,
            "category": "education",
            "subcategory": "education.stem",
            "tags": list(
                set(BASE_TAGS + ["camp", "summer-camp", "spring-camp"] + age_tags)
            ),
            "age_min": age_min,
            "age_max": age_max,
            "is_free": False,
            "price_min": price_min,
            "price_max": price_max,
            "price_note": price_note,
            "source_url": location_page_url,
            "ticket_url": ticket_url,
            "image_url": None,
            "extraction_confidence": 0.93,
            "is_recurring": False,
            "recurrence_rule": None,
            # raw_text for the hash — title + date + location
            "_raw_for_hash": f"{camp_name}|{loc['name']}|{start_date.strftime('%Y-%m-%d')}",
        }
        camps.append(camp)

    return camps


# ── code coaching program events ──────────────────────────────────────────────


def _generate_code_coaching_events(loc: dict) -> list[dict]:
    """
    Generate one recurring program event per week for the next WEEKS_AHEAD weeks
    representing the year-round after-school Code Coaching program.

    Rather than fabricating individual class slots, we emit a weekly "program
    available" anchor so the school surfaces in the Hooky feed for parents
    researching ongoing coding enrichment.
    """
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    # Anchor on Mondays (start of each school week)
    days_until_mon = (7 - today.weekday()) % 7
    if days_until_mon == 0:
        days_until_mon = 7  # Never use today if it's Monday
    first_monday = today + timedelta(days=days_until_mon)

    title = f"Code Coaching for Kids at theCoderSchool {loc['city']}"
    location_page_url = f"{BASE_URL}/locations/{loc['location_slug']}/"
    description = (
        f"theCoderSchool {loc['city']} offers year-round after-school Code Coaching — "
        f"one-on-one and small-group coding instruction for kids ages 7-18. "
        f"With a 2:1 student-to-coach ratio, kids work on self-paced custom projects "
        f"using Scratch, Python, JavaScript, Roblox Studio, AI tools, and more. "
        f"Sessions run 60 or 90 minutes, typically 1-2 times per week after school. "
        f"No prior experience needed. Free trial session available. "
        f"Enroll at {loc['pike13_base']}/welcome."
    )
    series_hint = {
        "series_type": "class_series",
        "series_title": title,
        "frequency": "weekly",
        "day_of_week": "monday",
        "description": description,
    }

    events: list[dict] = []
    for week in range(WEEKS_AHEAD):
        event_date = first_monday + timedelta(weeks=week)
        start_date_str = event_date.strftime("%Y-%m-%d")

        event = {
            "title": title,
            "description": description,
            "start_date": start_date_str,
            "end_date": None,
            "start_time": "15:00",
            "end_time": "18:00",
            "is_all_day": False,
            "category": "education",
            "subcategory": "education.stem",
            "tags": list(
                set(
                    BASE_TAGS
                    + ["class", "after-school", "elementary", "tween", "teen", "weekly"]
                )
            ),
            "age_min": 7,
            "age_max": 18,
            "is_free": False,
            "price_min": None,
            "price_max": None,
            "price_note": "Monthly tuition. Contact for pricing. Free trial available.",
            "source_url": location_page_url,
            "ticket_url": loc["pike13_base"] + "/welcome",
            "image_url": None,
            "extraction_confidence": 0.88,
            "is_recurring": True,
            "recurrence_rule": "FREQ=WEEKLY;BYDAY=MO",
            "_raw_for_hash": f"{title}|{loc['name']}|{start_date_str}",
            "_series_hint": series_hint,
        }
        events.append(event)

    return events


# ── HTTP fetch ────────────────────────────────────────────────────────────────


def _fetch_location_page(location_slug: str) -> Optional[BeautifulSoup]:
    url = f"{BASE_URL}/locations/{location_slug}/"
    try:
        resp = requests.get(url, headers=REQUEST_HEADERS, timeout=20)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "html.parser")
    except Exception as exc:
        logger.warning("[the-coder-school] Failed to fetch %s: %s", url, exc)
        return None


def _extract_og_image(soup: BeautifulSoup) -> Optional[str]:
    """Extract og:image meta tag value from a parsed page."""
    tag = soup.find("meta", property="og:image")
    if tag and tag.get("content"):
        return tag["content"].strip() or None
    return None


# ── per-location crawl ────────────────────────────────────────────────────────


def _crawl_location(loc: dict, source_id: int) -> tuple[int, int, int]:
    found = new = updated = 0

    # 1. Ensure venue record exists
    venue_data = _build_venue_data(loc)
    try:
        venue_id = get_or_create_venue(venue_data)
    except Exception as exc:
        logger.error(
            "[the-coder-school] Failed to get/create venue for %s: %s", loc["name"], exc
        )
        return 0, 0, 0

    logger.info("[the-coder-school] Crawling %s (venue_id=%s)", loc["name"], venue_id)

    # 2. Parse camp schedule from HTML
    soup = _fetch_location_page(loc["location_slug"])
    camp_events: list[dict] = []
    location_image_url: Optional[str] = None
    if soup:
        location_image_url = _extract_og_image(soup)
        camp_events = _parse_camp_table(soup, loc)
        logger.info(
            "[the-coder-school] %s: found %d camp sessions in table (image=%s)",
            loc["name"],
            len(camp_events),
            "yes" if location_image_url else "no",
        )
    else:
        logger.warning(
            "[the-coder-school] Skipping camp table for %s — fetch failed", loc["name"]
        )

    # 3. Add Code Coaching program anchors
    coaching_events = _generate_code_coaching_events(loc)

    all_events = camp_events + coaching_events

    # Apply the location's image to all events that don't already have one
    if location_image_url:
        for ev in all_events:
            if not ev.get("image_url"):
                ev["image_url"] = location_image_url

    for ev in all_events:
        found += 1
        raw_for_hash = ev.pop("_raw_for_hash")
        series_hint = ev.pop("_series_hint", None)

        content_hash = generate_content_hash(
            raw_for_hash, loc["name"], ev["start_date"]
        )

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "content_hash": content_hash,
            "raw_text": raw_for_hash,
            **{k: v for k, v in ev.items()},
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
            logger.debug(
                "[the-coder-school] Updated: %s on %s", ev["title"], ev["start_date"]
            )
            continue

        try:
            insert_event(event_record, series_hint=series_hint)
            new += 1
            logger.info(
                "[the-coder-school] Added: %s on %s", ev["title"], ev["start_date"]
            )
        except Exception as exc:
            logger.error(
                "[the-coder-school] Failed to insert %s on %s: %s",
                ev["title"],
                ev["start_date"],
                exc,
            )

    return found, new, updated


# ── entrypoint ────────────────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl all theCoderSchool Atlanta-area locations.

    For each location:
      1. Ensure the venue record exists in the DB.
      2. Parse the camp schedule table from the location page and insert each
         future camp session as a discrete event.
      3. Generate recurring Code Coaching program events for the next
         WEEKS_AHEAD weeks to surface the year-round offering.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    total_found = total_new = total_updated = 0

    for loc in LOCATIONS:
        try:
            f, n, u = _crawl_location(loc, source_id)
            total_found += f
            total_new += n
            total_updated += u
            logger.info(
                "[the-coder-school] %s: %d found, %d new, %d updated",
                loc["name"],
                f,
                n,
                u,
            )
        except Exception as exc:
            logger.error("[the-coder-school] Error crawling %s: %s", loc["name"], exc)

    logger.info(
        "[the-coder-school] Crawl complete: %d found, %d new, %d updated",
        total_found,
        total_new,
        total_updated,
    )
    return total_found, total_new, total_updated
