"""
Crawler for SwimAtlanta — major Atlanta metro swim school and competitive team.

SwimAtlanta operates 8 locations across the Atlanta metro area:
  - East Cobb (Marietta)
  - Georgia Tech (Midtown Atlanta)
  - Hamilton Mill (Dacula)
  - Johns Creek (Suwanee)
  - Midway / Cumming
  - Piedmont Park (Atlanta)
  - Roswell
  - Sugarloaf (Lawrenceville)

WHAT WE CRAWL:
  1. Swim Meets (events) — Announced on /news (paginated). Each news article may cover
     one competitive swim meet with an embedded event date. We fetch recent pages,
     parse articles with embedded date mentions, and use heuristic + LLM extraction
     to surface the actual meet event. Only articles within LOOKAHEAD_DAYS are kept.

  2. Swim Lessons Program (recurring) — Year-round private/semi-private/small-group
     lessons across all locations. Same anti-flood strategy as Goldfish Swim School:
     ONE recurring program event per location per week rather than thousands of
     individual class-slot events. Points to Jackrabbit registration portals where
     available.

WHAT WE DON'T CRAWL:
  - Individual class time slots (flood risk, no public API)
  - Jackrabbit API (blocks crawler traffic via Cloudflare)

SCHEDULING PLATFORM:
  - Swim school lessons: Jackrabbit Class (jackrabbitclass.com/regv2.asp?id=...)
  - Swim team: TeamUnify (teamunify.com)
  - No open API — we generate descriptive program events only

NOTES:
  - The news page (/news?page=N) has up to ~10 pages of historical items.
     We only scan the first 2 pages (most recent ~16 articles).
  - Meet articles typically include a date inline (e.g., "Georgia Tech Aquatic Center •
     March 7, 2026") but sometimes only mention "this weekend" — we skip those.
  - Piedmont Park and Georgia Tech locations have no Jackrabbit ID (likely sign up in
     person or via phone), so their program events link to the location page directly.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db import (
    get_or_create_venue,
    insert_event,
    find_event_by_hash,
    find_existing_event_for_insert,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

BASE_URL = "https://www.swimatlanta.com"
NEWS_URL = f"{BASE_URL}/news"

# How many news pages to scan for upcoming meets
NEWS_PAGES_TO_SCAN = 2

# Only surface meets that start within this many days from today
LOOKAHEAD_DAYS = 120

# How many weeks of recurring swim lesson events to generate per location
WEEKS_AHEAD = 8

# TeamUnify registration base URL (shared across all locations)
TEAM_UNIFY_REG = "https://www.teamunify.com/MemRegStart.jsp?team=gssa"


# ── Location data ────────────────────────────────────────────────────────────

# Coords sourced from Google Maps for each address.
# swim_school_reg_url: None for locations without a public Jackrabbit portal.
LOCATIONS = [
    {
        "slug": "swim-atlanta-east-cobb",
        "name": "SwimAtlanta - East Cobb",
        "loc_key": "EastCobb",
        "address": "2111 Old Canton Rd",
        "city": "Marietta",
        "state": "GA",
        "zip": "30068",
        "neighborhood": "East Cobb",
        "lat": 33.9803,
        "lng": -84.4018,
        "phone": "614-670-1108",
        "location_url": f"{BASE_URL}/EastCobb",
        "swim_school_reg_url": None,  # No Jackrabbit portal listed
        "county_tag": "cobb",
    },
    {
        "slug": "swim-atlanta-georgia-tech",
        "name": "SwimAtlanta - Georgia Tech",
        "loc_key": "gatech",
        "address": "750 Ferst Drive NW",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "neighborhood": "Midtown",
        "lat": 33.7757,
        "lng": -84.3963,
        "phone": None,
        "location_url": f"{BASE_URL}/gatech",
        "swim_school_reg_url": None,
        "county_tag": "fulton",
    },
    {
        "slug": "swim-atlanta-hamilton-mill",
        "name": "SwimAtlanta - Hamilton Mill",
        "loc_key": "hamiltonmill",
        "address": "1152 Auburn Road",
        "city": "Dacula",
        "state": "GA",
        "zip": "30019",
        "neighborhood": "Hamilton Mill",
        "lat": 33.9924,
        "lng": -83.9127,
        "phone": "678-889-2039",
        "location_url": f"{BASE_URL}/hamiltonmill",
        "swim_school_reg_url": "https://app.jackrabbitclass.com/regv2.asp?id=504768",
        "county_tag": "gwinnett",
    },
    {
        "slug": "swim-atlanta-johns-creek",
        "name": "SwimAtlanta - Johns Creek",
        "loc_key": "johnscreek",
        "address": "4050 Johns Creek Parkway",
        "city": "Suwanee",
        "state": "GA",
        "zip": "30024",
        "neighborhood": "Johns Creek",
        "lat": 34.0455,
        "lng": -84.1761,
        "phone": "770-622-1735",
        "location_url": f"{BASE_URL}/johnscreek",
        "swim_school_reg_url": "https://app.jackrabbitclass.com/regv2.asp?id=539092",
        "county_tag": "gwinnett",
    },
    {
        "slug": "swim-atlanta-midway-cumming",
        "name": "SwimAtlanta - Midway / Cumming",
        "loc_key": "midway",
        "address": "5059 Post Road",
        "city": "Cumming",
        "state": "GA",
        "zip": "30040",
        "neighborhood": "Cumming",
        "lat": 34.2062,
        "lng": -84.1313,
        "phone": "770-888-0010",
        "location_url": f"{BASE_URL}/midway",
        "swim_school_reg_url": "https://app.jackrabbitclass.com/regv2.asp?id=506231",
        "county_tag": None,  # Forsyth County — no tag
    },
    {
        "slug": "swim-atlanta-piedmont-park",
        "name": "SwimAtlanta - Piedmont Park",
        "loc_key": "piedmont-park",
        "address": "1320 Monroe Drive NE",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "neighborhood": "Midtown",
        "lat": 33.7858,
        "lng": -84.3742,
        "phone": None,
        "location_url": f"{BASE_URL}/piedmont-park",
        "swim_school_reg_url": None,
        "county_tag": "fulton",
    },
    {
        "slug": "swim-atlanta-roswell",
        "name": "SwimAtlanta - Roswell",
        "loc_key": "roswell",
        "address": "795 Old Roswell Road",
        "city": "Roswell",
        "state": "GA",
        "zip": "30076",
        "neighborhood": "Roswell",
        "lat": 34.0232,
        "lng": -84.3490,
        "phone": "470-282-1147",
        "location_url": f"{BASE_URL}/roswell",
        "swim_school_reg_url": "https://app3.jackrabbitclass.com/regv2.asp?id=551530",
        "county_tag": "fulton",
    },
    {
        "slug": "swim-atlanta-sugarloaf",
        "name": "SwimAtlanta - Sugarloaf",
        "loc_key": "sugarloaf",
        "address": "4850 Sugarloaf Parkway",
        "city": "Lawrenceville",
        "state": "GA",
        "zip": "30044",
        "neighborhood": "Lawrenceville",
        "lat": 33.9518,
        "lng": -84.0018,
        "phone": "678-442-7946",
        "location_url": f"{BASE_URL}/sugarloaf",
        "swim_school_reg_url": "https://app.jackrabbitclass.com/regv2.asp?id=504635",
        "county_tag": "gwinnett",
    },
]

# Base tags for all SwimAtlanta events
BASE_TAGS = [
    "water-sports",
    "kids",
    "family-friendly",
    "competitive",
]

LESSON_TAGS = BASE_TAGS + [
    "class",
    "rsvp-required",
    "infant",
    "toddler",
    "preschool",
    "elementary",
]

MEET_TAGS = BASE_TAGS + [
    "all-ages",
    "seasonal",
]


# ── HTTP helpers ─────────────────────────────────────────────────────────────

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
}


def _get(url: str, timeout: int = 15) -> Optional[str]:
    """Fetch a URL and return the response text, or None on failure."""
    try:
        resp = requests.get(url, headers=_HEADERS, timeout=timeout)
        resp.raise_for_status()
        return resp.text
    except Exception as exc:
        logger.warning(f"[swim-atlanta] Failed to fetch {url}: {exc}")
        return None


# ── News / meet parsing ──────────────────────────────────────────────────────

# Months for inline date parsing
_MONTH_MAP = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

# Keywords that signal a meet announcement (vs. general news or team articles)
_MEET_KEYWORDS = (
    "meet",
    "splash",
    "invite",
    "invitational",
    "classic",
    "championship",
    "divisional",
    "best of the south",
    "peach state",
    "kick-off",
    "kickoff",
    "last chance",
    "time trial",
)


def _is_meet_article(title: str, text: str) -> bool:
    """Return True if this news article describes a swim meet event."""
    combined = (title + " " + text[:500]).lower()
    return any(kw in combined for kw in _MEET_KEYWORDS)


def _parse_inline_date(
    text: str, post_date: Optional[datetime] = None
) -> Optional[str]:
    """
    Extract the earliest explicit event date from article body text.

    Handles formats like:
      - "March 7, 2026"
      - "March 7-9, 2026"
      - "• March 7, 2026"  (bullet point in heading)
      - "Venue Name • March 7, 2026"

    The post_date is used to exclude the "blog-post-meta" date that appears
    at the top of each article — we only want dates that differ from the
    post date, which signals an actual event date embedded in the body.

    Returns a YYYY-MM-DD string for the earliest qualifying date found,
    or None if no event date could be determined.
    """
    # Pattern: Month DD, YYYY  or Month DD-DD, YYYY
    pat = re.compile(
        r"\b(january|february|march|april|may|june|july|august|"
        r"september|october|november|december|"
        r"jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)"
        r"\s+(\d{1,2})(?:\s*[-–,]\s*\d{1,2})*,?\s*(20\d{2})",
        re.IGNORECASE,
    )
    matches = pat.findall(text)
    if not matches:
        return None

    candidates: list[datetime] = []
    for month_str, day_str, year_str in matches:
        month_num = _MONTH_MAP.get(month_str.lower())
        if not month_num:
            continue
        try:
            dt = datetime(int(year_str), month_num, int(day_str))
            # Skip the post date itself (it appears in the meta header)
            if post_date and dt.date() == post_date.date():
                continue
            candidates.append(dt)
        except ValueError:
            continue

    if not candidates:
        return None
    return min(candidates).strftime("%Y-%m-%d")


def _parse_post_date(meta_text: str) -> Optional[datetime]:
    """
    Parse a news post date like 'Mar 3, 2026' into a datetime object.
    Used to determine article recency.
    """
    meta_text = meta_text.strip()
    for fmt in ("%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(meta_text, fmt)
        except ValueError:
            pass
    return None


def _fetch_news_articles(max_pages: int = NEWS_PAGES_TO_SCAN) -> list[dict]:
    """
    Fetch news articles from swimatlanta.com/news (paginated).

    The page structure: each article is anchored by
      <span class="anchor" id="NNN"></span>
    followed by a <div class="col-md-12"> with h2 + blog-post-meta + body.
    Articles are separated by <hr> tags and all live in a single container div.

    We split on anchor boundaries in raw HTML to correctly isolate each
    article's text (BeautifulSoup parent traversal bleeds across articles
    because they share the same containing div).

    Returns a list of dicts:
      {id, title, post_date (datetime), text (plain text), image_url, source_url}
    """
    articles: list[dict] = []

    for page in range(1, max_pages + 1):
        url = NEWS_URL if page == 1 else f"{NEWS_URL}?page={page}"
        html = _get(url)
        if not html:
            break

        # Find all anchor positions: <span class="anchor" id="NNN"></span>
        anchor_pattern = re.compile(
            r'<span[^>]+class="anchor"[^>]+id="(\d+)"[^>]*></span>', re.IGNORECASE
        )
        anchor_matches = list(anchor_pattern.finditer(html))
        if not anchor_matches:
            logger.debug(f"[swim-atlanta] No news anchors on page {page}")
            break

        page_count = 0
        for i, match in enumerate(anchor_matches):
            article_id = match.group(1)
            start = match.start()
            # End at next anchor (or end of HTML)
            end = (
                anchor_matches[i + 1].start()
                if i + 1 < len(anchor_matches)
                else len(html)
            )
            chunk_html = html[start:end]

            # Parse this article's isolated HTML with BeautifulSoup
            chunk_soup = BeautifulSoup(chunk_html, "html.parser")

            # Title
            h2 = chunk_soup.find("h2")
            title = h2.get_text(strip=True) if h2 else ""
            if not title:
                continue

            # Post date
            meta_p = chunk_soup.find("p", class_="blog-post-meta")
            post_date_dt: Optional[datetime] = None
            if meta_p:
                post_date_dt = _parse_post_date(meta_p.get_text(strip=True))
            if not post_date_dt:
                continue

            # Image: first <img> with a src
            img_tag = chunk_soup.find("img", src=True)
            image_url: Optional[str] = None
            if img_tag:
                src = img_tag.get("src", "")
                if src.startswith("/"):
                    image_url = BASE_URL + src
                elif src.startswith("http"):
                    image_url = src

            # Plain text — strip tags, collapse whitespace
            article_text = chunk_soup.get_text(separator=" ", strip=True)
            article_text = re.sub(r"\s+", " ", article_text).strip()

            articles.append(
                {
                    "id": article_id,
                    "title": title,
                    "post_date": post_date_dt,
                    "text": article_text,
                    "image_url": image_url,
                    "source_url": f"{NEWS_URL}#{article_id}",
                }
            )
            page_count += 1

        logger.info(f"[swim-atlanta] Fetched {page_count} news items from page {page}")

    return articles


def _resolve_meet_venue(
    article_text: str,
) -> tuple[Optional[str], Optional[int]]:
    """
    Try to determine which SwimAtlanta location hosts this meet.

    Returns (venue_name_hint, location_index_in_LOCATIONS) or (None, None)
    if we can't determine it.  Meets at non-SwimAtlanta facilities (GA Tech
    Aquatic Center, Cumming Aquatic Center, etc.) may not map to a location.
    """
    text_lower = article_text.lower()
    loc_hints = {
        "georgia tech": 1,
        "ga tech": 1,
        "gatech": 1,
        "east cobb": 0,
        "hamilton mill": 2,
        "johns creek": 3,
        "midway": 4,
        "cumming": 4,
        "piedmont": 5,
        "roswell": 6,
        "sugarloaf": 7,
        "lawrenceville": 7,
    }
    for hint, idx in loc_hints.items():
        if hint in text_lower:
            return LOCATIONS[idx]["name"], idx
    return None, None


def _crawl_meets(source_id: int) -> tuple[int, int, int]:
    """
    Crawl swim meet events from the SwimAtlanta news feed.

    Strategy:
    1. Fetch recent news articles (first NEWS_PAGES_TO_SCAN pages).
    2. Filter to meet announcement articles only.
    3. Extract the event date from the article body (inline text).
    4. Skip articles where we cannot resolve a concrete date.
    5. Create one event per meet, associated with the best-match venue.
       If the venue is a non-SwimAtlanta facility, fall back to Georgia Tech
       (their primary hosted-meet facility).

    Returns (found, new, updated).
    """
    found = new = updated = 0

    today = datetime.now().date()
    cutoff = today + timedelta(days=LOOKAHEAD_DAYS)

    articles = _fetch_news_articles(max_pages=NEWS_PAGES_TO_SCAN)
    meet_articles = [a for a in articles if _is_meet_article(a["title"], a["text"])]
    logger.info(
        f"[swim-atlanta] {len(meet_articles)} meet articles out of {len(articles)} total"
    )

    for article in meet_articles:
        event_date_str = _parse_inline_date(
            article["text"], post_date=article["post_date"]
        )

        if not event_date_str:
            logger.debug(
                f"[swim-atlanta] No inline date for meet article '{article['title']}' "
                f"(posted {article['post_date'].date()}) — skipping"
            )
            continue

        try:
            event_date = datetime.strptime(event_date_str, "%Y-%m-%d").date()
        except ValueError:
            continue

        if event_date < today:
            logger.debug(
                f"[swim-atlanta] Skipping past meet: {article['title']} ({event_date_str})"
            )
            continue

        if event_date > cutoff:
            logger.debug(
                f"[swim-atlanta] Skipping far-future meet: {article['title']} ({event_date_str})"
            )
            continue

        found += 1

        # Determine venue — try to match to a SwimAtlanta location.
        # Most hosted meets are at GA Tech Aquatic Center.
        _, loc_idx = _resolve_meet_venue(article["text"])
        if loc_idx is None:
            # Default to GA Tech for meets hosted there
            loc_idx = 1  # Georgia Tech

        loc = LOCATIONS[loc_idx]
        venue_data = _build_venue_data(loc)
        try:
            venue_id = get_or_create_venue(venue_data)
        except Exception as exc:
            logger.error(
                f"[swim-atlanta] Failed to get/create venue for {loc['name']}: {exc}"
            )
            continue

        title = article["title"]
        description = _build_meet_description(title, event_date_str, loc)

        tags = MEET_TAGS + ([loc["county_tag"]] if loc.get("county_tag") else [])

        content_hash = generate_content_hash(title, loc["name"], event_date_str)

        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": event_date_str,
            "start_time": "09:00",  # Meets typically start at 9am
            "end_date": None,
            "end_time": None,
            "is_all_day": False,
            "category": "sports",
            "subcategory": None,
            "tags": tags,
            "is_free": False,
            "price_min": None,
            "price_max": None,
            "price_note": "Entry fee for competitors. Spectators typically free.",
            "source_url": article["source_url"],
            "ticket_url": TEAM_UNIFY_REG,
            "image_url": article.get("image_url"),
            "raw_text": article["text"][:500],
            "extraction_confidence": 0.88,
            "is_recurring": False,
            "recurrence_rule": None,
            "content_hash": content_hash,
        }

        existing = find_event_by_hash(content_hash)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
            logger.debug(f"[swim-atlanta] Updated meet: {title} on {event_date_str}")
            continue

        try:
            insert_event(event_record)
            new += 1
            logger.info(f"[swim-atlanta] Added meet: {title} on {event_date_str}")
        except Exception as exc:
            logger.error(f"[swim-atlanta] Failed to insert meet '{title}': {exc}")

    return found, new, updated


def _build_meet_description(title: str, event_date_str: str, loc: dict) -> str:
    """Build a description for a swim meet event."""
    try:
        dt = datetime.strptime(event_date_str, "%Y-%m-%d")
        date_fmt = dt.strftime("%B %-d, %Y")
    except ValueError:
        date_fmt = event_date_str

    return (
        f"SwimAtlanta is hosting a competitive swim meet: {title}. "
        f"This USA/AAU swimming event takes place at the {loc['name']} facility "
        f"starting {date_fmt}. "
        f"SwimAtlanta is one of Metro Atlanta's premier competitive swim programs, "
        f"with alumni including 8 Olympians. "
        f"Only swimmers, officials, coaches, and volunteers are permitted on the pool deck; "
        f"families cheer from spectator seating. "
        f"Visit swimatlanta.com for heat sheets, psych sheets, and meet updates."
    )


# ── Swim Lessons program events ──────────────────────────────────────────────


def _crawl_lessons_program(
    loc: dict, venue_id: int, source_id: int
) -> tuple[int, int, int]:
    """
    Generate one recurring swim lessons program event per week per location.

    Rather than creating thousands of individual class slot events (which would
    flood the feed), we create ONE recurring "program available" event per week
    pointing to the enrollment portal. This follows the same strategy as the
    Goldfish Swim School crawler.

    We generate WEEKS_AHEAD Saturdays, since Saturday is the most visible
    enrollment day and families commonly research over the weekend.
    """
    found = new = updated = 0

    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    days_until_sat = (5 - today.weekday()) % 7
    if days_until_sat == 0:
        days_until_sat = 7
    first_saturday = today + timedelta(days=days_until_sat)

    loc_short = loc["city"]
    reg_url = loc["swim_school_reg_url"] or loc["location_url"]

    title = f"Swim Lessons at SwimAtlanta ({loc_short})"
    description = _build_lessons_description(loc, reg_url)

    series_hint = {
        "series_type": "class_series",
        "series_title": title,
        "frequency": "weekly",
        "day_of_week": "saturday",
        "description": description,
    }

    for week in range(WEEKS_AHEAD):
        event_date = first_saturday + timedelta(weeks=week)
        start_date_str = event_date.strftime("%Y-%m-%d")
        found += 1
        event_record = _build_lessons_event_record(
            loc,
            venue_id,
            source_id,
            start_date_str,
        )

        existing = find_existing_event_for_insert(event_record)
        if existing:
            smart_update_existing_event(existing, event_record)
            updated += 1
            continue

        try:
            insert_event(event_record, series_hint=series_hint)
            new += 1
            logger.debug(
                f"[swim-atlanta] Added swim lessons event for {loc_short} on {start_date_str}"
            )
        except Exception as exc:
            logger.error(
                f"[swim-atlanta] Failed to insert swim lessons for {loc_short} "
                f"on {start_date_str}: {exc}"
            )

    return found, new, updated


def _build_lessons_description(loc: dict, reg_url: str) -> str:
    """Build a description for the recurring swim lessons program event."""
    loc_name = loc["name"]
    phone_note = f" Call {loc['phone']} for questions." if loc.get("phone") else ""

    return (
        f"{loc_name} offers year-round private, semi-private, and small-group swim lessons "
        f"for all ages and skill levels, seven days a week. "
        f"Each facility features a 90-degree teaching pool designed to maximize learning. "
        f"SwimAtlanta's curriculum covers water safety through competitive stroke development, "
        f"with an encouraging coaching philosophy — children are never forced to perform. "
        f"Programs serve infants, toddlers, preschoolers, and school-age swimmers. "
        f"Many graduates go on to join the SwimAtlanta competitive team or local league teams. "
        f"Enroll at {reg_url}.{phone_note}"
    )


def _build_lessons_event_record(
    loc: dict,
    venue_id: int,
    source_id: int,
    start_date_str: str,
) -> dict:
    loc_short = loc["city"]
    reg_url = loc["swim_school_reg_url"] or loc["location_url"]
    title = f"Swim Lessons at SwimAtlanta ({loc_short})"
    description = _build_lessons_description(loc, reg_url)
    county_tag = loc.get("county_tag")
    tags = LESSON_TAGS + ([county_tag] if county_tag else [])
    tags = list(dict.fromkeys(tags))

    return {
        "source_id": source_id,
        "venue_id": venue_id,
        "title": title,
        "description": description,
        "start_date": start_date_str,
        "start_time": "09:00",
        "end_date": None,
        "end_time": "12:00",
        "is_all_day": False,
        "category": "fitness",
        "subcategory": "fitness.swim",
        "tags": tags,
        "is_free": False,
        "price_min": None,
        "price_max": None,
        "price_note": "Private, semi-private, and small group lessons available. Prices vary.",
        "source_url": loc["location_url"],
        "ticket_url": reg_url,
        "image_url": None,
        "raw_text": f"{title} - {start_date_str}",
        "extraction_confidence": 0.90,
        "is_recurring": True,
        "recurrence_rule": "FREQ=WEEKLY;BYDAY=SA",
        "content_hash": generate_content_hash(title, loc["name"], start_date_str),
        "is_class": True,
        "class_category": "fitness",
    }


# ── Venue data helpers ───────────────────────────────────────────────────────


def _build_venue_data(loc: dict) -> dict:
    """Build venue data dict from location config."""
    return {
        "name": loc["name"],
        "slug": loc["slug"],
        "address": loc["address"],
        "city": loc["city"],
        "state": loc["state"],
        "zip": loc["zip"],
        "neighborhood": loc["neighborhood"],
        "lat": loc["lat"],
        "lng": loc["lng"],
        "venue_type": "fitness_center",
        "spot_type": "fitness",
        "website": loc["location_url"],
        "vibes": ["family-friendly", "all-ages"],
    }


# ── Main entry point ─────────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl SwimAtlanta Atlanta-area locations.

    For meets: scrapes the news feed for upcoming competitive swim meets.
    For lessons: generates recurring program events at each location.

    Returns (events_found, events_new, events_updated).
    """
    source_id = source["id"]
    total_found = 0
    total_new = 0
    total_updated = 0

    # 1. Swim meets from news feed (shared across all locations)
    logger.info("[swim-atlanta] Crawling swim meet announcements from news feed")
    try:
        f, n, u = _crawl_meets(source_id)
        total_found += f
        total_new += n
        total_updated += u
        logger.info(f"[swim-atlanta] Meets: {f} found, {n} new, {u} updated")
    except Exception as exc:
        logger.error(f"[swim-atlanta] Error crawling meets: {exc}")

    # 2. Recurring swim lessons program events per location
    for loc in LOCATIONS:
        venue_data = _build_venue_data(loc)
        try:
            venue_id = get_or_create_venue(venue_data)
        except Exception as exc:
            logger.error(
                f"[swim-atlanta] Failed to get/create venue for {loc['name']}: {exc}"
            )
            continue

        logger.info(
            f"[swim-atlanta] Generating lessons events for {loc['name']} (venue_id={venue_id})"
        )
        try:
            f, n, u = _crawl_lessons_program(loc, venue_id, source_id)
            total_found += f
            total_new += n
            total_updated += u
        except Exception as exc:
            logger.error(
                f"[swim-atlanta] Error generating lessons for {loc['name']}: {exc}"
            )

    logger.info(
        f"[swim-atlanta] Crawl complete: {total_found} found, "
        f"{total_new} new, {total_updated} updated"
    )
    return total_found, total_new, total_updated
