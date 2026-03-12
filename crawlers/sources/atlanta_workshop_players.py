"""
Crawler for Atlanta Workshop Players (AWP) — atlantaworkshopplayers.com

AWP is a children's theater and performing arts training nonprofit in Roswell, GA.
All content is family/kids-oriented and maps to the Hooky family portal.

The site runs on Wix. Content is split across two sources:

  1. /camp  — Summer camp sessions (server-rendered HTML). Four named programs
     with explicit date ranges, prices, and descriptions are readable without JS.
     Parsed with BeautifulSoup.

  2. /shows + /events — Current productions and the Wix Events calendar widget.
     Both are JS-rendered (Wix app widgets). We use Playwright to render the
     page and extract visible text, then parse dates and show info from the
     rendered inner text.

Venue: AWP's Studio 13, 1580 Holcomb Bridge Rd Suite 13, Roswell, GA 30076
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from html import unescape
from typing import Any, Optional

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

from db import (
    find_event_by_hash,
    get_or_create_venue,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.atlantaworkshopplayers.com"
CAMP_URL = f"{BASE_URL}/camp"
SHOWS_URL = f"{BASE_URL}/shows"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Atlanta Workshop Players",
    "slug": "atlanta-workshop-players",
    "address": "1580 Holcomb Bridge Rd Suite 13",
    "neighborhood": "Roswell",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30076",
    "lat": 34.0232,
    "lng": -84.3616,
    "venue_type": "theater",
    "spot_type": "theater",
    "website": BASE_URL,
    "vibes": [
        "kids",
        "family-friendly",
        "performing-arts",
        "theater",
        "educational",
        "nonprofit",
        "roswell",
    ],
}

# Tags common to all AWP events
BASE_TAGS = [
    "family-friendly",
    "kids",
    "performing-arts",
    "atlanta-workshop-players",
    "roswell",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

# Month name → int
_MONTH_MAP: dict[str, int] = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sep": 9,
    "sept": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}

# Regexes
_DATE_RANGE_RE = re.compile(
    r"(january|february|march|april|may|june|july|august|september|october|november|december|"
    r"jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)"
    r"\.?\s+(\d{1,2})(?:st|nd|rd|th)?"
    r"(?:\s*[-–]\s*"
    r"(?:(january|february|march|april|may|june|july|august|september|october|november|december|"
    r"jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+)?"
    r"(\d{1,2})(?:st|nd|rd|th)?)?"
    r"(?:,?\s*(202\d))?",
    re.IGNORECASE,
)
_PRICE_RE = re.compile(r"\$\s*([\d,]+(?:\.\d{1,2})?)")
_TIME_RE = re.compile(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", re.IGNORECASE)
_SHOW_DATE_RE = re.compile(
    r"((?:january|february|march|april|may|june|july|august|september|october|november|december)"
    r"\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*[-–&,]\s*"
    r"(?:(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+)?"
    r"\d{1,2}(?:st|nd|rd|th)?)?(?:,?\s*202\d)?)",
    re.IGNORECASE,
)


# ─── helpers ──────────────────────────────────────────────────────────────────


def _strip_html(html: str) -> str:
    """Remove HTML tags and normalise whitespace."""
    text = unescape(html)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _is_past(date_str: str) -> bool:
    return date_str < datetime.now().strftime("%Y-%m-%d")


def _parse_date_range(
    text: str, assumed_year: Optional[int] = None
) -> tuple[Optional[str], Optional[str]]:
    """
    Parse a date-range string like 'June 29th-July 3rd 2026' or 'July 13th-18th'.

    Returns (start_date, end_date) in YYYY-MM-DD format or (None, None).
    """
    current_year = assumed_year or datetime.now().year
    m = _DATE_RANGE_RE.search(text)
    if not m:
        return None, None

    start_month_str, start_day_str, end_month_str, end_day_str, year_str = m.groups()
    start_month = _MONTH_MAP.get(start_month_str.lower(), 0)
    if not start_month:
        return None, None
    start_day = int(start_day_str)

    year = int(year_str) if year_str else current_year
    start_date = f"{year}-{start_month:02d}-{start_day:02d}"

    end_date: Optional[str] = None
    if end_day_str:
        end_month = (
            _MONTH_MAP.get(end_month_str.lower(), start_month)
            if end_month_str
            else start_month
        )
        end_day = int(end_day_str)
        end_date = f"{year}-{end_month:02d}-{end_day:02d}"

    return start_date, end_date


def _parse_price(text: str) -> Optional[float]:
    """Extract the first dollar amount from text."""
    m = _PRICE_RE.search(text)
    if not m:
        return None
    try:
        return float(m.group(1).replace(",", ""))
    except ValueError:
        return None


def _parse_time(text: str) -> Optional[str]:
    """Extract first HH:MM time in 24h format from text."""
    m = _TIME_RE.search(text)
    if not m:
        return None
    h = int(m.group(1))
    mn = int(m.group(2)) if m.group(2) else 0
    period = m.group(3).lower()
    if period == "pm" and h != 12:
        h += 12
    elif period == "am" and h == 12:
        h = 0
    return f"{h:02d}:{mn:02d}"


def _age_band_tags(text: str) -> list[str]:
    """
    Infer age-band tags from program text.

    AWP camps list 'kids' (elementary-age) and 'teens' programs.
    """
    tags: list[str] = []
    lower = text.lower()
    # VIP Movie / Kids programs skew elementary (ages 7-12)
    if any(
        kw in lower
        for kw in ["kids vip", "kids camp", "elementary", "grades 1", "grade 1-"]
    ):
        tags.append("elementary")
    # Teens programs
    if any(
        kw in lower
        for kw in [
            "teens vip",
            "teen",
            "tween",
            "grades 6",
            "grades 7",
            "grades 8",
            "middle school",
        ]
    ):
        tags.append("tween")
        tags.append("teen")
    # General youth
    if "adventure camp" in lower or "performing arts adventure" in lower:
        tags += ["elementary", "tween"]  # broad age camp
    # Musical theater intensive tends toward older youth
    if "intensive" in lower and "performing arts" in lower:
        tags += ["tween", "teen"]
    return list(set(tags))


# ─── camp page (requests + BeautifulSoup) ─────────────────────────────────────


def _fetch_camp_sessions() -> list[dict[str, Any]]:
    """
    Parse summer camp sessions from the /camp page.

    The Wix site server-renders paragraph text for camp sessions including:
    - Session number header (SESSION #N)
    - Date range (e.g. 'June 29th-July 3rd 2026')
    - Program title (PERFORMING ARTS ADVENTURE CAMP)
    - Description paragraphs
    - Investment price ($450, $595, etc.)
    - Studio Director enrollment URL

    Returns a list of raw session dicts.
    """
    try:
        response = requests.get(CAMP_URL, timeout=20, headers=HEADERS)
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.error("AWP: failed to fetch camp page: %s", exc)
        return []

    soup = BeautifulSoup(response.text, "lxml")
    full_text = response.text
    current_year = datetime.now().year

    # Session headers are rendered inside <h4><span> tags, not <p> tags.
    # soup.get_text() reliably extracts all visible text in document order,
    # capturing both the "SESSION #N" markers and the content that follows.
    body_text = soup.get_text("\n", strip=True)

    sessions: list[dict[str, Any]] = []

    # Split on SESSION markers — the body text is structured as:
    #   ['prefix', 'SESSION #1', 'content1', 'SESSION #2', 'content2', ...]
    session_blocks = re.split(r"(SESSION\s*#\s*\d+)", body_text, flags=re.IGNORECASE)

    # session_blocks alternates between: ['prefix', 'SESSION #1', 'content', 'SESSION #2', ...]
    i = 1
    while i < len(session_blocks) - 1:
        header = session_blocks[i].strip()
        content = session_blocks[i + 1]
        i += 2

        # Extract date range from content
        start_date, end_date = _parse_date_range(content, assumed_year=current_year)
        if not start_date:
            logger.debug("AWP camp: no date in block '%s'", header)
            continue

        # Skip sessions entirely in the past
        if _is_past(start_date):
            logger.debug("AWP camp: session starting %s is past, skipping", start_date)
            continue

        # Program title: first ALL-CAPS line after the date
        title_match = re.search(
            r"(PERFORMING ARTS [A-Z &]+|KIDS VIP MOVIE|TEENS VIP MOVIE|[A-Z ]{10,}CAMP[^a-z]*)",
            content,
        )
        raw_title = (
            title_match.group(1).strip().title() if title_match else header.title()
        )
        program_title = f"AWP {raw_title}"
        # Normalise spacing / excessive whitespace in title
        program_title = re.sub(r"\s+", " ", program_title).strip()

        # Description: main descriptive paragraphs
        desc_lines: list[str] = []
        for line in content.split("\n"):
            line = line.strip()
            if not line:
                continue
            # Skip date/header/investment/address lines and short fragments
            if re.match(r"^SESSION\s*#?\d", line, re.IGNORECASE):
                continue
            if re.match(
                r"^\$|^Investment:|^AWP['\u2019]?s Studio|^1580 Holcomb|^Roswell,|^Red Carpet",
                line,
                re.IGNORECASE,
            ):
                continue
            if re.match(
                r"^(June|July|August|September|October|November|December)\s+\d",
                line,
                re.IGNORECASE,
            ):
                continue
            if len(line) > 30:
                desc_lines.append(line)
        description = " ".join(desc_lines[:6])  # first 6 substantive lines
        if len(description) > 1200:
            description = description[:1197] + "..."

        # Append standard footer
        desc_parts = []
        if description:
            desc_parts.append(description)
        desc_parts.append(
            "AWP offers performing arts training for youth at Studio 13, "
            "1580 Holcomb Bridge Rd, Suite 13, Roswell, GA 30076."
        )
        full_description = " ".join(desc_parts)

        # Start time — content has "9am-4pm" or "9am-6pm"
        start_time = _parse_time(content) or "09:00"

        # Price
        price = _parse_price(content)

        # Enrollment URL — each session has its own Studio Director link.
        # We locate the link that appears near this session in the raw HTML
        # by scanning for the enrollment URL closest to the SESSION #N marker.
        # As a fallback we find any SD URL on the page.
        session_num = re.search(r"#\s*(\d+)", header)
        ticket_url = CAMP_URL
        if session_num:
            # Find the position of this SESSION header in raw HTML
            session_marker = f"SESSION #{session_num.group(1)}"
            session_pos = full_text.find(session_marker)
            if session_pos == -1:
                session_pos = 0
            # Find first SD enrollment URL after this position
            sd_match = re.search(
                r'href="(https://app\.thestudiodirector\.com/atlantaworkshopplayers[^"]+)"',
                full_text[session_pos:],
            )
            if sd_match:
                ticket_url = sd_match.group(1).replace("&amp;", "&")
        if ticket_url == CAMP_URL:
            # Global fallback
            sd_match_global = re.search(
                r'href="(https://app\.thestudiodirector\.com/atlantaworkshopplayers[^"]+)"',
                full_text,
            )
            if sd_match_global:
                ticket_url = sd_match_global.group(1).replace("&amp;", "&")

        # Age band
        age_tags = _age_band_tags(program_title + " " + content)

        sessions.append(
            {
                "title": program_title,
                "start_date": start_date,
                "end_date": end_date,
                "start_time": start_time,
                "description": full_description[:2000],
                "price": price,
                "ticket_url": ticket_url,
                "age_tags": age_tags,
                "source_url": CAMP_URL,
            }
        )

    logger.info("AWP camp: parsed %d sessions from %s", len(sessions), CAMP_URL)
    return sessions


# ─── shows + events page (Playwright) ─────────────────────────────────────────


def _fetch_page_rendered(url: str) -> Optional[str]:
    """
    Open a fresh Playwright session, navigate to `url`, and return inner text
    after JavaScript has rendered. Returns None on failure.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=HEADERS["User-Agent"],
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        try:
            page.goto(url, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(4000)
            text = page.inner_text("body")
            if (
                "Performing security verification" in text
                or "Enable JavaScript and cookies" in text
            ):
                logger.warning("AWP: Cloudflare blocked %s", url)
                return None
            return text
        except Exception as exc:
            logger.warning("AWP: Playwright fetch of %s failed: %s", url, exc)
            return None
        finally:
            browser.close()


def _parse_shows_from_rendered(text: str) -> list[dict[str, Any]]:
    """
    Parse upcoming show performance dates from the rendered /shows page.

    The shows page renders the current production with cast and crew, but
    performance dates are embedded as text like 'April 20th, 2026' or
    date ranges. We extract all future date references and group them
    under the most recent show title found above them.
    """
    shows: list[dict[str, Any]] = []
    if not text:
        return shows

    current_year = datetime.now().year
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

    # Find show title — typically a short ALL-CAPS or Title Case heading
    # before the cast list. Common patterns: "THE PROM", "The Prom"
    show_title: Optional[str] = None
    show_description: Optional[str] = None
    current_description_lines: list[str] = []
    title_candidates: list[str] = []

    for line in lines:
        # Skip navigation / footer noise
        if any(
            nav in line
            for nav in [
                "Blog",
                "Staff",
                "Donate",
                "Sponsors",
                "Gallery",
                "Videos",
                "Alumni",
                "Contact",
                "Services",
                "Studio 13",
                "Scholarships",
                "Coaching",
                "Training",
                "Events",
                "Calendar",
                "Improv Maniacs",
                "Press to zoom",
                "press to zoom",
            ]
        ):
            continue
        if line.startswith("©") or "AWP's programs" in line or "Fulton County" in line:
            continue

        # Look for the show description (typically the first long-ish sentence
        # that isn't a cast list item or navigation)
        if 20 < len(line) < 300 and "-" not in line[:3] and ":" not in line[:20]:
            if not any(c.islower() for c in line[:3]):
                # Looks like a show title (all caps or title case short line)
                title_candidates.append(line)
            elif len(line) > 40 and not re.match(r"^[A-Z\s]+$", line):
                current_description_lines.append(line)

    # First title candidate is likely the show title
    if title_candidates:
        show_title = title_candidates[0]

    # First substantive description line
    if current_description_lines:
        show_description = current_description_lines[0]

    if not show_title:
        logger.debug("AWP shows: could not identify show title from rendered text")
        return shows

    # Extract future dates
    found_dates: list[str] = []
    for line in lines:
        dates_in_line = _SHOW_DATE_RE.findall(line)
        for date_str in dates_in_line:
            start_date, end_date = _parse_date_range(date_str, current_year)
            if start_date and not _is_past(start_date):
                found_dates.append(start_date)

    found_dates = sorted(set(found_dates))

    if not found_dates:
        logger.debug(
            "AWP shows: found show '%s' but no future performance dates in rendered text",
            show_title,
        )
        return shows

    # Extract time if present
    start_time = _parse_time(text) or "19:30"  # default to 7:30pm

    desc_parts: list[str] = []
    if show_description:
        desc_parts.append(show_description)
    desc_parts.append(
        "Produced by Atlanta Workshop Players at Studio 13, "
        "1580 Holcomb Bridge Rd Suite 13, Roswell, GA 30076."
    )
    description = " ".join(desc_parts)

    # Build one event per performance date
    for date in found_dates:
        shows.append(
            {
                "title": show_title,
                "start_date": date,
                "end_date": None,
                "start_time": start_time,
                "description": description[:2000],
                "price": None,
                "ticket_url": SHOWS_URL,
                "age_tags": ["elementary", "tween", "teen"],
                "source_url": SHOWS_URL,
            }
        )

    logger.info(
        "AWP shows: parsed %d performance dates for '%s'",
        len(shows),
        show_title,
    )
    return shows


def _parse_events_from_rendered(text: str) -> list[dict[str, Any]]:
    """
    Parse events from the rendered Wix Events calendar page (/events).

    The Wix Events widget renders event cards with title, date, and time.
    We use simple line-based parsing after rendering.
    """
    events: list[dict[str, Any]] = []
    if not text:
        return events

    current_year = datetime.now().year
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

    # Wix Events renders cards as: [Title] [Month Day, Year] [Time]
    # We scan for date-like lines and look for a title on the line(s) above.
    i = 0
    while i < len(lines):
        line = lines[i]
        # Check if this line contains a date
        start_date, end_date = _parse_date_range(line, current_year)
        if start_date and not _is_past(start_date):
            # Look for title — the non-empty line just above
            title = ""
            for j in range(i - 1, max(0, i - 5), -1):
                candidate = lines[j].strip()
                if candidate and len(candidate) > 3 and len(candidate) < 150:
                    # Skip navigation / noise lines
                    if not any(
                        nav in candidate
                        for nav in ["Blog", "Staff", "Events", "Calendar", "Contact"]
                    ):
                        title = candidate
                        break

            if not title:
                i += 1
                continue

            # Check for time on the next line
            start_time: Optional[str] = None
            if i + 1 < len(lines):
                start_time = _parse_time(lines[i + 1])

            events.append(
                {
                    "title": title,
                    "start_date": start_date,
                    "end_date": end_date,
                    "start_time": start_time,
                    "description": (
                        f"{title}. An event at Atlanta Workshop Players, Studio 13, "
                        "1580 Holcomb Bridge Rd Suite 13, Roswell, GA 30076."
                    ),
                    "price": None,
                    "ticket_url": EVENTS_URL,
                    "age_tags": [],
                    "source_url": EVENTS_URL,
                }
            )
            logger.debug("AWP events: found '%s' on %s", title, start_date)
        i += 1

    logger.info("AWP events: parsed %d events from rendered calendar", len(events))
    return events


# ─── DB upsert ────────────────────────────────────────────────────────────────


def _upsert_event(
    *,
    item: dict[str, Any],
    category: str,
    subcategory: Optional[str],
    extra_tags: list[str],
    source_id: int,
    venue_id: int,
) -> tuple[bool, bool]:
    """
    Upsert a single event record.

    Returns (found_existing, was_new).
    """
    title = item.get("title", "").strip()
    start_date = item.get("start_date")
    if not title or not start_date:
        return False, False
    if _is_past(start_date):
        return False, False

    price = item.get("price")
    price_note: Optional[str] = None
    if price:
        price_note = f"${price:,.0f}" if price == int(price) else f"${price:,.2f}"

    tags = list(BASE_TAGS)
    tags.extend(item.get("age_tags", []))
    tags.extend(extra_tags)
    tags = list(dict.fromkeys(tags))  # dedupe, preserve order

    content_hash = generate_content_hash(title, VENUE_DATA["name"], start_date)

    event_record: dict[str, Any] = {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": (item.get("description") or "")[:2000],
        "start_date": start_date,
        "start_time": item.get("start_time"),
        "end_date": item.get("end_date"),
        "end_time": None,
        "is_all_day": False,
        "category": category,
        "subcategory": subcategory,
        "tags": tags,
        "price_min": price,
        "price_max": None,
        "price_note": price_note,
        "is_free": price is not None and price == 0.0,
        "source_url": item.get("source_url") or BASE_URL,
        "ticket_url": item.get("ticket_url") or BASE_URL,
        "image_url": None,
        "raw_text": title[:200],
        "extraction_confidence": 0.88,
        "is_recurring": False,
        "recurrence_rule": None,
        "content_hash": content_hash,
    }

    existing = find_event_by_hash(content_hash)
    if existing:
        smart_update_existing_event(existing, event_record)
        return True, False

    try:
        insert_event(event_record)
        logger.info("AWP: added '%s' (%s)", title, start_date)
        return True, True
    except Exception as exc:
        logger.error("AWP: failed to insert '%s': %s", title, exc)
        return True, False


# ─── main entrypoint ──────────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Atlanta Workshop Players camps, shows, and events.

    Strategy:
      1. Camp sessions  → requests + BeautifulSoup (server-rendered HTML)
      2. Show dates     → Playwright (JS-rendered Wix page)
      3. Events calendar→ Playwright (JS-rendered Wix Events widget)

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)
    logger.info("AWP: venue record ensured (ID: %s)", venue_id)

    # ── 1. Summer camp sessions ────────────────────────────────────────────
    logger.info("AWP: fetching camp sessions from %s", CAMP_URL)
    camp_sessions = _fetch_camp_sessions()
    logger.info("AWP: found %d camp sessions", len(camp_sessions))

    for session in camp_sessions:
        found, new = _upsert_event(
            item=session,
            category="education",
            subcategory="camp",
            extra_tags=["summer-camp", "theater-camp"],
            source_id=source_id,
            venue_id=venue_id,
        )
        if found:
            events_found += 1
            if new:
                events_new += 1
            else:
                events_updated += 1

    # ── 2. Shows (current production) ─────────────────────────────────────
    logger.info("AWP: rendering shows page via Playwright: %s", SHOWS_URL)
    shows_text = _fetch_page_rendered(SHOWS_URL)
    if shows_text:
        shows = _parse_shows_from_rendered(shows_text)
        logger.info("AWP: found %d show performance dates", len(shows))
        for show in shows:
            found, new = _upsert_event(
                item=show,
                category="arts",
                subcategory="theater",
                extra_tags=["musical-theater", "theater"],
                source_id=source_id,
                venue_id=venue_id,
            )
            if found:
                events_found += 1
                if new:
                    events_new += 1
                else:
                    events_updated += 1
    else:
        logger.warning("AWP: could not render shows page (Playwright)")

    # ── 3. Wix Events calendar ─────────────────────────────────────────────
    logger.info("AWP: rendering events calendar via Playwright: %s", EVENTS_URL)
    events_text = _fetch_page_rendered(EVENTS_URL)
    if events_text:
        calendar_events = _parse_events_from_rendered(events_text)
        logger.info("AWP: found %d events from calendar widget", len(calendar_events))
        for event in calendar_events:
            # Dedupe against shows already inserted (same title+date = same record)
            found, new = _upsert_event(
                item=event,
                category="arts",
                subcategory="theater",
                extra_tags=["theater"],
                source_id=source_id,
                venue_id=venue_id,
            )
            if found:
                events_found += 1
                if new:
                    events_new += 1
                else:
                    events_updated += 1
    else:
        logger.warning("AWP: could not render events calendar page (Playwright)")

    if events_found == 0:
        logger.warning(
            "AWP: no events found — site structure may have changed or all content is past-dated"
        )

    logger.info(
        "AWP crawl complete: %d found, %d new, %d updated",
        events_found,
        events_new,
        events_updated,
    )
    return events_found, events_new, events_updated
