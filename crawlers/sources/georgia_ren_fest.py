"""
Crawler for Georgia Renaissance Festival (garenfest.com).
Located in Fairburn, GA (~25 miles southwest of Atlanta).

The Georgia Renaissance Festival is a major seasonal family destination running
weekends April through early June each year. Each weekend has a distinct theme
(Vikings, Celtic, Pirates, etc.) with themed entertainment, costume contests,
jousting, and special programming.

Data strategy:
- Scrape the /themed-weekends page, which lists all 8 (or so) themed weekends
  in structured layout-garen-content-image sections.
- Each section has: display dates in the h2, image, description, and a Google
  Calendar link whose dates string encodes UTC start/end time.
- The page-level <p class="dates"> element provides the season year (e.g.
  "April 11- May 31, 2026"), used to resolve the correct year for each weekend.
- Also emit one season-window event for the full season run.

Date parsing approach:
- Extract year from <p class="dates"> (e.g. "April 11- May 31, 2026")
- Parse start/end day from h2 text (e.g. "May 23 thru 25 Pirate Invasion")
- The Google Calendar link provides a sanity-check on time-of-day (10:30am open,
  6:00pm close ET) but its year is stale and must not be trusted.

Hours: Saturdays & Sundays 10:30am–6:00pm (gate closes at 5pm).
       Pirate/Memorial Day weekend includes Monday.

Site is static HTML served by Octane CMS — requests + BeautifulSoup, no Playwright.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Optional
import requests
from bs4 import BeautifulSoup

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.garenfest.com"
THEMED_WEEKENDS_URL = f"{BASE_URL}/themed-weekends"
TICKETS_URL = "https://tickets.garenfest.com/renfest"

# ── Venue record ──────────────────────────────────────────────────────────────
PLACE_DATA = {
    "name": "Georgia Renaissance Festival",
    "slug": "georgia-renaissance-festival",
    "address": "6905 Virlyn B Smith Rd",
    "neighborhood": "Fairburn",
    "city": "Fairburn",
    "state": "GA",
    "zip": "30213",
    "lat": 33.5365,
    "lng": -84.5960,
    "place_type": "festival",
    "spot_type": "festival",
    "website": BASE_URL,
    "vibes": [
        "family-friendly",
        "outdoor-seating",
        "good-for-groups",
        "free-parking",
        "all-ages",
    ],
}

# ── Month name lookup ─────────────────────────────────────────────────────────
_MONTH_MAP: dict[str, int] = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

# Matches "Apr 11 & 12", "April 18 & 19", "May 23 thru 25", "May 30 & 31"
# Group 1: month name, Group 2: first day, Group 3: last day (optional)
_DATE_HEADING_RE = re.compile(
    r"^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?"
    r"|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\s+(\d{1,2})"
    r"(?:\s*(?:&|thru|through|–|-)\s*(\d{1,2}))?",
    re.IGNORECASE,
)

# Season-level date range: "April 11- May 31, 2026"
_SEASON_DATES_RE = re.compile(
    r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?)\s+(\d{1,2})"
    r"\s*[-–]\s*"
    r"(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?)\s+(\d{1,2})"
    r"(?:,?\s*(\d{4}))?",
    re.IGNORECASE,
)


def _parse_season_year(soup: BeautifulSoup) -> int:
    """
    Extract the season year from <p class='dates'> (e.g. 'April 11- May 31, 2026').
    Falls back to current year + 1 if parsing fails and we're past June.
    """
    dates_p = soup.find("p", class_="dates")
    if dates_p:
        text = dates_p.get_text(strip=True)
        year_m = re.search(r"\b(20\d{2})\b", text)
        if year_m:
            return int(year_m.group(1))

    today = datetime.now()
    # If we're already past the typical end of season (June), assume next year
    if today.month > 6:
        return today.year + 1
    return today.year


def _parse_weekend_dates(
    h2_text: str, page_year: int
) -> tuple[Optional[str], Optional[str]]:
    """
    Parse start and end date strings from an h2 heading like:
      'Apr 11 & 12 Valkyries & Vikings Come Ashore'
      'May 23 thru 25 Pirate Invasion Weekend!'

    Returns (start_date, end_date) as 'YYYY-MM-DD' strings, or (None, None).
    """
    m = _DATE_HEADING_RE.match(h2_text.strip())
    if not m:
        return None, None

    month_key = m.group(1).lower().rstrip(".")
    month = _MONTH_MAP.get(month_key, 0)
    if not month:
        return None, None

    try:
        day1 = int(m.group(2))
        day2 = int(m.group(3)) if m.group(3) else day1
        start = f"{page_year}-{month:02d}-{day1:02d}"
        end = f"{page_year}-{month:02d}-{day2:02d}"
        return start, end
    except (ValueError, TypeError):
        return None, None


def _extract_title_from_h2(h2_text: str) -> str:
    """
    Strip the leading date prefix from h2 text to get the event title.
    e.g. 'Apr 11 & 12  Valkyries & Vikings Come Ashore' -> 'Valkyries & Vikings Come Ashore'
    """
    # Remove the date prefix (month day [& day]) and any trailing whitespace/newlines
    stripped = _DATE_HEADING_RE.sub("", h2_text).strip()
    # Normalize internal whitespace
    stripped = re.sub(r"\s+", " ", stripped).strip()
    return stripped if stripped else h2_text.strip()


def _extract_description(section: BeautifulSoup) -> str:
    """Extract paragraph text from the content-container, skipping links."""
    content = section.find("div", class_="content-container")
    if not content:
        return ""
    paras = []
    for p in content.find_all("p"):
        # Skip paragraphs that are purely links (e.g. 'Add to Calendar', registration links)
        if p.find("a") and not p.get_text(strip=True).replace(
            p.find("a").get_text(strip=True), ""
        ).strip():
            continue
        text = p.get_text(separator=" ", strip=True)
        if text and text not in {"Add to Calendar", ""}:
            paras.append(text)
    return " ".join(paras)


def _extract_image_url(section: BeautifulSoup) -> Optional[str]:
    """Get the lazy-loaded image URL from the section."""
    img = section.find("img")
    if not img:
        return None
    # Prefer data-src (lazy loaded), fall back to src
    url = img.get("data-src") or img.get("src")
    if url and url.startswith("http"):
        return url
    return None


def _weekend_tags(data_title: str, display_title: str) -> list[str]:
    """
    Derive event tags from the weekend theme name.
    All weekends get a base set; theme-specific tags are appended.
    """
    base = ["seasonal", "family-friendly", "outdoor", "all-ages", "ticketed"]

    combined = (data_title + " " + display_title).lower()

    if any(kw in combined for kw in ["pirate", "tudor", "seafar"]):
        return base + ["entertainment", "holiday"]
    if any(kw in combined for kw in ["celtic", "highland", "clan", "scottish"]):
        return base + ["entertainment"]
    if any(kw in combined for kw in ["viking", "barbarian", "norse"]):
        return base + ["entertainment"]
    if any(kw in combined for kw in ["pet", "dog", "hound", "companion"]):
        return base + ["entertainment"]
    if any(kw in combined for kw in ["magic", "wizard", "witching", "conclave", "arcane"]):
        return base + ["entertainment"]
    if any(kw in combined for kw in ["fae", "fairy", "faerie", "fantasy", "flight"]):
        return base + ["entertainment"]
    if any(kw in combined for kw in ["romance", "midsummer", "love", "dream"]):
        return base + ["date-night", "entertainment"]
    if any(kw in combined for kw in ["cosplay", "time travel", "clash", "realm"]):
        return base + ["entertainment"]

    return base + ["entertainment"]


# ── Main scraping functions ───────────────────────────────────────────────────


def scrape_themed_weekends(
    session: requests.Session,
    source_id: int,
    venue_id: int,
) -> tuple[int, int, int]:
    """
    Scrape /themed-weekends and emit one event per themed weekend.
    Each section.layout-garen-content-image is one weekend.

    Returns (found, new, updated).
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        resp = session.get(THEMED_WEEKENDS_URL, timeout=20)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"Georgia Ren Fest: could not fetch {THEMED_WEEKENDS_URL}: {e}")
        return 0, 0, 0

    soup = BeautifulSoup(resp.text, "html.parser")
    page_year = _parse_season_year(soup)
    logger.info(f"Georgia Ren Fest: detected season year {page_year}")

    sections = soup.find_all("section", class_="layout-garen-content-image")
    if not sections:
        logger.warning(
            "Georgia Ren Fest: no layout-garen-content-image sections found — "
            "site structure may have changed"
        )
        return 0, 0, 0

    today = datetime.now().date()

    for section in sections:
        try:
            # Get the data-title (canonical theme name from CMS)
            data_title = section.get("data-title", "").strip()

            # Get display title and dates from h2
            h2 = section.find("h2", class_="section-title")
            if not h2:
                logger.debug(
                    f"Georgia Ren Fest: section missing h2.section-title "
                    f"(data-title={data_title!r}) — skipping"
                )
                continue

            h2_text = h2.get_text(separator=" ", strip=True)
            # Collapse internal whitespace (CMS sometimes puts <br> between date and title)
            h2_text = re.sub(r"\s+", " ", h2_text).strip()

            start_date, end_date = _parse_weekend_dates(h2_text, page_year)
            if not start_date:
                logger.warning(
                    f"Georgia Ren Fest: could not parse date from h2 {h2_text!r} — skipping"
                )
                continue

            # Skip events that have already ended (more than 1 day in the past)
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
                if end_dt < today - timedelta(days=1):
                    logger.debug(
                        f"Georgia Ren Fest: skipping past event {data_title!r} ({end_date})"
                    )
                    continue
            except ValueError:
                pass

            # Build display title
            display_title = _extract_title_from_h2(h2_text)
            if not display_title:
                display_title = data_title or "Georgia Renaissance Festival Weekend"

            full_title = f"{display_title} — Georgia Renaissance Festival"

            # Description
            description = _extract_description(section)
            if not description:
                description = (
                    "Join us for a themed weekend at the Georgia Renaissance Festival — "
                    "jousting, live entertainment across 15 stages, artisan market, "
                    "food and drink, games, rides, and more. Located in Fairburn, GA, "
                    "25 miles southwest of Atlanta."
                )
            else:
                description = (
                    f"{description} The Georgia Renaissance Festival features jousting, "
                    "live entertainment across 15 stages, an artisan market with 160+ "
                    "shoppes, food and drink, games, and rides. Fairburn, GA."
                )

            # Image
            image_url = _extract_image_url(section)

            # Tags
            tags = _weekend_tags(data_title, display_title)

            content_hash = generate_content_hash(
                full_title, "Georgia Renaissance Festival", start_date
            )

            event_record = {
                "source_id": source_id,
                "place_id": venue_id,
                "title": full_title,
                "description": description[:1500],
                "start_date": start_date,
                "start_time": "10:30",  # Gates open 10:30am
                "end_date": end_date,
                "end_time": "18:00",   # Festival closes 6pm
                "is_all_day": False,
                "category": "family",
                "subcategory": None,
                "tags": tags,
                "price_min": 25.95,   # Value day adult price
                "price_max": 32.95,   # Peak day adult price
                "price_note": (
                    "Adult (13+) $25.95–$32.95 by date tier; "
                    "Child (6–12) same tier pricing; "
                    "Under 5 free. Tickets online only at tickets.garenfest.com/renfest"
                ),
                "is_free": False,
                "source_url": THEMED_WEEKENDS_URL,
                "ticket_url": TICKETS_URL,
                "image_url": image_url,
                "raw_text": h2_text[:300],
                "extraction_confidence": 0.95,
                "is_recurring": False,
                "recurrence_rule": None,
                "content_hash": content_hash,
            }

            events_found += 1
            existing = find_event_by_hash(content_hash)
            if existing:
                smart_update_existing_event(existing, event_record)
                events_updated += 1
            else:
                try:
                    insert_event(event_record)
                    events_new += 1
                    logger.info(
                        f"Georgia Ren Fest: added '{full_title}' ({start_date}–{end_date})"
                    )
                except Exception as e:
                    logger.error(
                        f"Georgia Ren Fest: failed to insert '{full_title}': {e}"
                    )

        except Exception as e:
            logger.warning(f"Georgia Ren Fest: error processing section: {e}")
            continue

    return events_found, events_new, events_updated


def scrape_season_event(
    session: requests.Session,
    source_id: int,
    venue_id: int,
) -> tuple[int, int, int]:
    """
    Emit a single season-window event covering the full festival run.
    This ensures the festival surfaces in date-range searches even when
    someone is looking weeks before a specific themed weekend.

    Season dates are parsed from <p class='dates'> on the themed-weekends page.

    Returns (found, new, updated).
    """
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        resp = session.get(THEMED_WEEKENDS_URL, timeout=20)
        resp.raise_for_status()
    except requests.RequestException as e:
        logger.warning(f"Georgia Ren Fest: could not fetch season dates: {e}")
        return 0, 0, 0

    soup = BeautifulSoup(resp.text, "html.parser")
    page_year = _parse_season_year(soup)

    # Parse season-level start and end dates
    dates_p = soup.find("p", class_="dates")
    season_start: Optional[str] = None
    season_end: Optional[str] = None

    if dates_p:
        dates_text = dates_p.get_text(strip=True)
        m = _SEASON_DATES_RE.search(dates_text)
        if m:
            start_month = _MONTH_MAP.get(m.group(1).lower(), 0)
            start_day = int(m.group(2))
            end_month = _MONTH_MAP.get(m.group(3).lower(), 0)
            end_day = int(m.group(4))
            year = int(m.group(5)) if m.group(5) else page_year
            if start_month and end_month:
                season_start = f"{year}-{start_month:02d}-{start_day:02d}"
                season_end = f"{year}-{end_month:02d}-{end_day:02d}"

    # Fall back to typical season window if parsing failed
    if not season_start:
        season_start = f"{page_year}-04-11"
    if not season_end:
        season_end = f"{page_year}-05-31"

    today = datetime.now().date()

    # Don't emit if season has already ended
    try:
        end_dt = datetime.strptime(season_end, "%Y-%m-%d").date()
        if end_dt < today - timedelta(days=1):
            return 0, 0, 0
    except ValueError:
        pass

    title = "Georgia Renaissance Festival — Spring Season"
    description = (
        "The Georgia Renaissance Festival returns for its annual spring season in "
        f"Fairburn, GA (25 miles southwest of Atlanta). Running weekends {season_start[5:]} "
        f"through {season_end[5:]}, the festival features 8 themed weekends including "
        "Vikings, Celtic, Pirates, Wizards, Cosplay/Clash of Realms, Romance, Pets, and Fae. "
        "Every weekend includes jousting tournaments, 15 live stages, an artisan market with "
        "160+ shoppes, food and drink, games, rides, and themed costume contests. "
        "The Georgia Renaissance Festival has been running for 41 seasons."
    )

    content_hash = generate_content_hash(
        title, "Georgia Renaissance Festival", season_start
    )

    event_record = {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": description[:1500],
        "start_date": season_start,
        "start_time": "10:30",
        "end_date": season_end,
        "end_time": "18:00",
        "is_all_day": False,
        "category": "family",
        "subcategory": None,
        "tags": [
            "seasonal",
            "family-friendly",
            "outdoor",
            "all-ages",
            "ticketed",
            "entertainment",
        ],
        "price_min": 25.95,
        "price_max": 32.95,
        "price_note": (
            "Adult (13+) $25.95–$32.95 by date tier; "
            "Child (6–12) same pricing; Under 5 free. "
            "Tickets online only at tickets.garenfest.com/renfest"
        ),
        "is_free": False,
        "source_url": THEMED_WEEKENDS_URL,
        "ticket_url": TICKETS_URL,
        "image_url": None,
        "raw_text": f"Season {season_start}–{season_end}",
        "extraction_confidence": 0.95,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }

    events_found += 1
    existing = find_event_by_hash(content_hash)
    if existing:
        smart_update_existing_event(existing, event_record)
        events_updated += 1
    else:
        try:
            insert_event(event_record)
            events_new += 1
            logger.info(
                f"Georgia Ren Fest: added season event ({season_start}–{season_end})"
            )
        except Exception as e:
            logger.error(f"Georgia Ren Fest: failed to insert season event: {e}")

    return events_found, events_new, events_updated


# ── Entry point ───────────────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Georgia Renaissance Festival themed weekends.

    Strategy:
    1. Scrape /themed-weekends for per-weekend events (one event per themed weekend).
    2. Emit a season-window event spanning the full festival run.

    All events link to the same venue. Per-weekend events carry the theme
    title, image, description, and precise Sat/Sun (or Mon) dates.
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/121.0.0.0 Safari/537.36"
            )
        }
    )

    try:
        venue_id = get_or_create_place(PLACE_DATA)

        # 1. Per-themed-weekend events
        try:
            f, n, u = scrape_themed_weekends(session, source_id, venue_id)
            events_found += f
            events_new += n
            events_updated += u
        except Exception as e:
            logger.error(f"Georgia Ren Fest: error in themed weekends scraper: {e}")

        # 2. Season-window event
        try:
            f, n, u = scrape_season_event(session, source_id, venue_id)
            events_found += f
            events_new += n
            events_updated += u
        except Exception as e:
            logger.error(f"Georgia Ren Fest: error in season event scraper: {e}")

        # Sanity check: expect 8 weekend events + 1 season = 9 total
        if events_found < 2:
            logger.warning(
                f"Georgia Ren Fest: only {events_found} events found — "
                "expected 9+ (8 weekends + 1 season). Site structure may have changed."
            )

        logger.info(
            f"Georgia Ren Fest crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as e:
        logger.error(f"Georgia Ren Fest: crawl failed: {e}")
        raise

    return events_found, events_new, events_updated
