#!/usr/bin/env python3
"""
Scrape venue websites and LLM-extract specials, hours, menus, reservation links,
phone, instagram, price level, and vibes in a single pass.

For each venue with a website:
1. Fetches the main page + common subpages (/menu, /happy-hour, /specials, /hours)
2. Regex-extracts instagram handles and phone numbers from HTML
3. LLM-extracts structured data: specials, hours, menu_url, reservation_url,
   phone, instagram, price_level, vibes
4. Upserts into venue_specials + updates venue columns
5. Tracks last_verified_at for freshness

Usage:
    # Scrape venues in a corridor (lat/lng + radius)
    python3 scrape_venue_specials.py --lat 33.7834 --lng -84.3731 --radius 2

    # Scrape specific venues by ID
    python3 scrape_venue_specials.py --venue-ids 100,200,300

    # Scrape venues by type
    python3 scrape_venue_specials.py --venue-type bar --limit 50

    # Venue enrichment only (skip specials table writes)
    python3 scrape_venue_specials.py --venue-type restaurant --skip-specials

    # Overwrite existing data instead of only filling empty fields
    python3 scrape_venue_specials.py --venue-ids 100 --force-update

    # Dry run (don't write to DB)
    python3 scrape_venue_specials.py --lat 33.7834 --lng -84.3731 --radius 2 --dry-run
"""

import re
import sys
import json
import time
import math
import logging
import argparse
import xml.etree.ElementTree as ET
import html as html_lib
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
import requests
from playwright.sync_api import sync_playwright

env_path = Path(__file__).parent.parent / ".env"
from dotenv import load_dotenv

load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from config import get_config
from db import get_client, insert_event
from llm_client import generate_text
from hours_utils import prepare_hours_update, should_update_hours

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# Fallback subpages — only used when smart link discovery finds nothing
FALLBACK_SUBPAGES = ["/menu", "/happy-hour", "/specials", "/hours", "/about"]

# Keyword scoring for link discovery — higher weight = more relevant to specials
_URL_KEYWORDS = {
    3: [
        "happy-hour",
        "happyhour",
        "happy_hour",
        "specials",
        "daily-specials",
        "weekly-specials",
        "deals",
    ],
    2: [
        "menu",
        "menus",
        "food-menu",
        "drink-menu",
        "drinks",
        "cocktails",
        "food-and-drink",
        "food-drink",
    ],
    1: [
        "hours",
        "about",
        "visit",
        "events",
        "brunch",
        "trivia",
        "entertainment",
        "happenings",
        "promotions",
    ],
}
_ANCHOR_KEYWORDS = {
    3: ["happy hour", "specials", "daily deals", "daily specials", "weekly specials"],
    2: [
        "menu",
        "drinks",
        "food & drink",
        "food and drink",
        "cocktails",
        "drink menu",
        "food menu",
    ],
    1: ["hours", "about us", "visit", "events", "brunch", "trivia", "entertainment"],
}

# Known reservation platform patterns
RESERVATION_PATTERNS = [
    "resy.com",
    "opentable.com",
    "yelp.com/reservations",
    "exploretock.com",
    "sevenrooms.com",
    "toast.com",
]

# ISO weekday mapping for LLM output
DAY_MAP = {
    "monday": 1,
    "mon": 1,
    "tuesday": 2,
    "tue": 2,
    "tues": 2,
    "wednesday": 3,
    "wed": 3,
    "thursday": 4,
    "thu": 4,
    "thur": 4,
    "thurs": 4,
    "friday": 5,
    "fri": 5,
    "saturday": 6,
    "sat": 6,
    "sunday": 7,
    "sun": 7,
}

from tags import VALID_VIBES as _CANONICAL_VIBES

# Filter out faith-specific and denomination vibes — not extractable from venue websites
VALID_VIBES = {
    v
    for v in _CANONICAL_VIBES
    if not v.startswith("faith-")
    and v
    not in (
        "episcopal",
        "baptist",
        "methodist",
        "presbyterian",
        "catholic",
        "nondenominational",
        "ame",
    )
}

# Genres from ACTIVITY_GENRE_MAP (venue_enrich.py) + music sub-genres
VALID_GENRES = {
    "dj",
    "karaoke",
    "trivia",
    "game-night",
    "dance-party",
    "beer",
    "live-music",
    "comedy",
    "drag",
    "open-mic",
    "bingo",
    "vinyl",
}

# Chain restaurant/bar indicators (name-based detection)
CHAIN_NAMES = {
    "applebee",
    "chili's",
    "olive garden",
    "red lobster",
    "outback",
    "buffalo wild wings",
    "hooters",
    "tgif",
    "fridays",
    "denny's",
    "ihop",
    "waffle house",
    "mcdonald",
    "wendy's",
    "taco bell",
    "chick-fil-a",
    "zaxby",
    "wingstop",
    "sweetwater",
    "topgolf",
    "dave & buster",
    "main event",
    "twin peaks",
    "yard house",
}

VALID_DIETARY_OPTIONS = {
    "vegetarian-friendly",
    "vegan-options",
    "gluten-free-options",
    "halal",
    "kosher",
    "allergy-aware",
}

VALID_PARKING = {
    "street",
    "lot",
    "garage",
    "valet",
    "no-parking",
}

VALID_SERVICE_STYLES = {
    "quick_service",
    "casual_dine_in",
    "full_service",
    "tasting_menu",
    "bar_food",
    "coffee_dessert",
}

# Regex for US phone numbers
PHONE_RE = re.compile(r"(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}")

# Regex for Instagram handles from links
INSTAGRAM_LINK_RE = re.compile(r"instagram\.com/([A-Za-z0-9_.]{1,30})(?:[/?#]|$)")

# Regex for Facebook page URLs
FACEBOOK_RE = re.compile(r"https?://(www\.)?facebook\.com/[^/?#]+", re.I)

# Known link-in-bio / reservation / menu URL patterns for IG bio parsing
LINKTREE_PATTERNS = ["linktr.ee", "linkin.bio", "lnk.bio", "beacons.ai", "campsite.bio"]
MENU_URL_PATTERNS = ["menu", "toast", "square.site", "squarespace"]
RESERVATION_URL_PATTERNS = [
    "resy.com",
    "opentable.com",
    "exploretock.com",
    "sevenrooms.com",
]

# Day names in order for range expansion (abbreviated — matches frontend hours.ts keys)
DAY_NAMES_ORDERED = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
DAY_ABBREV_ORDERED = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# Hours regex: matches patterns like "5pm-10pm", "5-10pm", "11:30am-2pm", "17:00-22:00"
HOURS_TIME_RE = re.compile(
    r"(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?\s*[-–—to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)?",
)

# Day range regex: "Tue-Sat", "Mon-Fri", "Tuesday-Saturday"
DAY_RANGE_RE = re.compile(
    r"\b(mon(?:day)?s?|tue(?:s(?:day)?)?s?|wed(?:nesday)?s?|thu(?:r(?:s(?:day)?)?)?s?|fri(?:day)?s?|sat(?:urday)?s?|sun(?:day)?s?)"
    r"\s*[-–—&/,]\s*"
    r"(mon(?:day)?s?|tue(?:s(?:day)?)?s?|wed(?:nesday)?s?|thu(?:r(?:s(?:day)?)?)?s?|fri(?:day)?s?|sat(?:urday)?s?|sun(?:day)?s?)",
    re.I,
)

# Shared Playwright browser — lazily initialized, reused across venues
_playwright = None
_browser = None
_playwright_fallback_count = 0

_EMPTY_EXTRACTION_PAYLOAD = {
    "specials": [],
    "holiday_hours": [],
    "holiday_specials": [],
    "hours": None,
    "menu_url": None,
    "reservation_url": None,
    "description": None,
    "short_description": None,
    "phone": None,
    "instagram": None,
    "price_level": None,
    "vibes": [],
    "cuisine": None,
    "service_style": None,
    "genres": [],
    "accepts_reservations": None,
    "is_event_venue": None,
    "is_chain": None,
    "dietary_options": [],
    "parking": [],
    "menu_highlights": None,
    "payment_notes": None,
}

_PARKED_SITE_RE = re.compile(
    r"\b("
    r"this domain is for sale|buy now for|start payment plan|hugedomains|"
    r"domain expert|captcha security check|please prove you're not a robot|"
    r"processing\s+or\s+start payment plan"
    r")\b",
    re.I,
)

_DAY_OR_RANGE_ONLY_RE = re.compile(
    r"^(?:"
    r"(?:mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|"
    r"mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)"
    r"(?:\s*(?:to|through|thru|and|[-–—&/,])\s*"
    r"(?:mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|"
    r"mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun))?"
    r"|weekdays?|weekends?|daily|every day|7 days"
    r")$",
    re.I,
)

_SPECIAL_TRIGGER_RE = re.compile(
    r"\b("
    r"happy hour|brunch|bottomless|bogo|half[\s-]?off|half[\s-]?price|"
    r"\$\d|taco|wing|oyster|wine|margarita|mimosa|sangria|mojito|"
    r"industry night|ladies night|special"
    r")\b",
    re.I,
)

_TITLE_PATTERN_MAP: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bhappy hour\b", re.I), "Happy Hour"),
    (re.compile(r"\bbottomless brunch\b", re.I), "Bottomless Brunch"),
    (re.compile(r"\bbrunch\b", re.I), "Weekend Brunch"),
    (re.compile(r"\btaco\b", re.I), "Taco Tuesday"),
    (re.compile(r"\bwing\b", re.I), "Wing Night"),
    (re.compile(r"\boyster\b", re.I), "Oyster Night"),
    (re.compile(r"\bwine\b", re.I), "Wine Night"),
    (re.compile(r"\bmargarita\b", re.I), "Margarita Night"),
    (re.compile(r"\bindustry night\b", re.I), "Industry Night"),
    (re.compile(r"\bladies night\b", re.I), "Ladies Night"),
]

_PRICE_NOTE_PATTERNS: list[re.Pattern] = [
    re.compile(r"(?:BOGO|bogo)\s+[A-Za-z][^|,.]*", re.I),
    re.compile(r"half[\s-]?(?:off|price)\s+[A-Za-z][^|,.]*", re.I),
    re.compile(
        r"\$\d+(?:\.\d{2})?(?:\s*[-/]\s*\$\d+(?:\.\d{2})?)?\s+[A-Za-z][^|,.]*", re.I
    ),
]

_TITLE_SENTENCE_START_RE = re.compile(
    r"^(join|grab|come|meet|bring|follow|click|view|learn|read|watch|shop|dine|every)\b",
    re.I,
)

_EVENT_PROMO_RE = re.compile(
    r"\b("
    r"click here|make your reservation(?: today)?|buy tickets?|tickets? on sale|"
    r"raffle prizes?|free yoga session|register now"
    r")\b",
    re.I,
)

_DATED_PROMO_RE = re.compile(
    r"\b(save the date|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}\b|\d{1,2}/\d{1,2}(?:/\d{2,4})?)",
    re.I,
)


def _get_browser():
    """Lazily launch a shared headless Chromium for the whole run."""
    global _playwright, _browser
    if _browser is None:
        _playwright = sync_playwright().start()
        _browser = _playwright.chromium.launch(headless=True)
    return _browser


def _close_browser():
    """Cleanup shared browser at end of run."""
    global _playwright, _browser
    if _browser:
        _browser.close()
        _browser = None
    if _playwright:
        _playwright.stop()
        _playwright = None


def fetch_page_playwright(url: str) -> Optional[str]:
    """Fetch a page using headless Chromium. Used as fallback for bot-protected sites."""
    try:
        browser = _get_browser()
        context = browser.new_context(
            user_agent=HEADERS["User-Agent"],
            viewport={"width": 1920, "height": 1080},
        )
        try:
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2000)
            html = page.content()
            return html
        finally:
            context.close()
    except Exception as e:
        logger.debug(f"  Playwright fetch failed: {e}")
        return None


def _normalize_day(day_str: str) -> Optional[str]:
    """Normalize a day abbreviation or full name to a 3-letter abbreviated key."""
    d = day_str.strip().lower().rstrip(".")
    # Map full names and common abbreviations to canonical 3-letter keys
    _FULL_TO_ABBREV = {
        "monday": "mon",
        "mondays": "mon",
        "tuesday": "tue",
        "tuesdays": "tue",
        "wednesday": "wed",
        "wednesdays": "wed",
        "thursday": "thu",
        "thursdays": "thu",
        "friday": "fri",
        "fridays": "fri",
        "saturday": "sat",
        "saturdays": "sat",
        "sunday": "sun",
        "sundays": "sun",
    }
    if d in _FULL_TO_ABBREV:
        return _FULL_TO_ABBREV[d]
    for abbrev in DAY_ABBREV_ORDERED:
        if d == abbrev or d.startswith(abbrev):
            return abbrev
    return None


def _expand_day_range(start_day: str, end_day: str) -> list[str]:
    """Expand 'Tue-Sat' into ['tue', 'wed', 'thu', 'fri', 'sat']."""
    start = _normalize_day(start_day)
    end = _normalize_day(end_day)
    if not start or not end:
        return []
    try:
        si = DAY_NAMES_ORDERED.index(start)
        ei = DAY_NAMES_ORDERED.index(end)
    except ValueError:
        return []
    if ei >= si:
        return DAY_NAMES_ORDERED[si : ei + 1]
    # Wraps around (e.g., Fri-Mon)
    return DAY_NAMES_ORDERED[si:] + DAY_NAMES_ORDERED[: ei + 1]


def _to_24h(hour: int, minute: int, ampm: Optional[str]) -> str:
    """Convert 12-hour time to 24-hour HH:MM string."""
    if ampm:
        ampm = ampm.lower()
        if ampm == "pm" and hour != 12:
            hour += 12
        elif ampm == "am" and hour == 12:
            hour = 0
    # If no AM/PM and hour <= 6, likely PM (e.g., "5-10" means 5pm-10pm for a bar)
    elif hour <= 6:
        hour += 12
    return f"{hour:02d}:{minute:02d}"


def _empty_extraction_payload() -> dict:
    """Return a fresh empty payload matching the LLM schema."""
    return dict(_EMPTY_EXTRACTION_PAYLOAD)


def _normalize_compact_time_tokens(text: str) -> str:
    """Expand compact time suffixes like 3p-6p into 3pm-6pm."""
    if not text:
        return text
    text = re.sub(r"(\d{1,2})(:\d{2})?\s*([ap])\b", r"\1\2\3m", text, flags=re.I)
    return re.sub(r"\b(noon)\b", "12pm", text, flags=re.I)


def _looks_like_parked_site(text: str) -> bool:
    """Detect domain-sale / captcha placeholder pages that should never hydrate venues."""
    if not text:
        return False
    return bool(_PARKED_SITE_RE.search(text))


def _normalize_special_title(title: str, text: str) -> str:
    """Normalize inferred special titles to something displayable."""
    raw_title = re.sub(r"\s+", " ", (title or "").strip(" -:|"))
    title = re.sub(r"\s+", " ", (title or "").strip(" -:|"))
    title = re.sub(
        r"\s*\((?:except holidays?|holiday excluded?)\)\s*$", "", title, flags=re.I
    )
    title = re.sub(
        r"\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*(?:to|[-–—])\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*$",
        "",
        title,
        flags=re.I,
    )
    title = re.sub(r"^[^A-Za-z$]+", "", title)
    skip_fallback = False
    if _DAY_OR_RANGE_ONLY_RE.match(title):
        title = ""
    generic_title = title.lower() if title else ""
    if generic_title == "brunch":
        title = "Weekend Brunch"
        generic_title = "weekend brunch"
    if generic_title.startswith("brunch served"):
        title = "Weekend Brunch"
        generic_title = "weekend brunch"
    if generic_title and any(
        token in generic_title for token in ("special", "menu", "deal", "rotating")
    ):
        title = ""
    if generic_title in {"restaurant", "brewery", "brewpub", "bar", "home"}:
        title = ""
        skip_fallback = True
    if title and (_TITLE_SENTENCE_START_RE.match(title) or title.isdigit()):
        skip_fallback = True
        title = ""
    if title and re.search(r"\bbottomless brunch\b", text, re.I):
        title = "Bottomless Brunch"
    if (
        title
        and "weekend brunch" in title.lower()
        and re.search(r"\bbottomless brunch\b", text, re.I)
    ):
        title = "Bottomless Brunch"
    if title and len(title.split()) > 8:
        title = ""
    if (
        not skip_fallback
        and raw_title
        and (_TITLE_SENTENCE_START_RE.match(raw_title) or raw_title.strip().isdigit())
    ):
        skip_fallback = True
    if title:
        return title[:80]
    if skip_fallback:
        return ""
    for pattern, replacement in _TITLE_PATTERN_MAP:
        if pattern.search(text):
            return replacement
    return ""


def _extract_price_note(text: str) -> Optional[str]:
    """Extract the most useful pricing phrase from a specials candidate line."""
    cleaned = re.sub(r"\s+", " ", text).strip(" |")
    for pattern in _PRICE_NOTE_PATTERNS:
        match = pattern.search(cleaned)
        if match:
            return match.group(0).strip(" .")
    if re.search(r"\bhappy hour\b", cleaned, re.I):
        compact = re.sub(
            r".*?\bhappy hour\b[:!\s-]*", "", cleaned, count=1, flags=re.I
        ).strip(" .")
        if compact:
            if "$" not in compact and not re.search(
                r"\b(half|off|bogo|draft|beer|wine|cocktail|mimosa|well|appetizer|oyster|"
                r"taco|margarita|domestic|pitcher|flight|special)\b",
                compact,
                re.I,
            ):
                return None
            return compact[:160]
        return None
    return None


def _looks_like_special_header(line: str) -> bool:
    cleaned = line.strip()
    if not cleaned or len(cleaned.split()) > 4:
        return False
    if not _SPECIAL_TRIGGER_RE.search(cleaned):
        return False
    lowered = cleaned.lower()
    return lowered.endswith("menu") or lowered in {
        "happy hour",
        "brunch",
        "bottomless brunch",
    }


def _looks_like_schedule_fragment(line: str) -> bool:
    cleaned = line.strip()
    if not cleaned:
        return False
    if _DAY_OR_RANGE_ONLY_RE.match(cleaned):
        return True
    if _infer_days_from_text(cleaned):
        return True
    if _infer_time_from_text(cleaned)[0]:
        return True
    if re.search(r"\$\d", cleaned):
        return True
    lowered = cleaned.lower()
    return lowered.endswith("menu") and len(cleaned.split()) <= 3


def _candidate_special_text(lines: list[str], idx: int) -> Optional[str]:
    """Build a candidate specials string from the current line and nearby day labels."""
    line = lines[idx].strip()
    if not line:
        return None

    parts = [line]
    if idx > 0 and _DAY_OR_RANGE_ONLY_RE.match(lines[idx - 1].strip()):
        parts.insert(0, lines[idx - 1].strip())
    if _DAY_OR_RANGE_ONLY_RE.match(line):
        for next_idx in range(idx + 1, min(idx + 3, len(lines))):
            nxt = lines[next_idx].strip()
            if not nxt:
                continue
            parts.append(nxt)
            if not _DAY_OR_RANGE_ONLY_RE.match(nxt):
                following_idx = next_idx + 1
                if following_idx < len(lines):
                    following = lines[following_idx].strip()
                    if following and (
                        re.search(r"\$\d", following)
                        or _SPECIAL_TRIGGER_RE.search(following)
                    ):
                        parts.append(following)
                break
    elif _looks_like_special_header(line):
        for next_idx in range(idx + 1, min(idx + 4, len(lines))):
            nxt = lines[next_idx].strip()
            if not nxt:
                continue
            if not _looks_like_schedule_fragment(nxt):
                break
            parts.append(nxt)
            if _infer_days_from_text(" | ".join(parts)):
                break

    candidate = " | ".join(part for part in parts if part)
    if re.match(r"^(open|hours?)\b", candidate, re.I):
        return None
    if "|" not in candidate and len(candidate.split()) > 22:
        return None
    if not _SPECIAL_TRIGGER_RE.search(candidate):
        return None
    if not _infer_days_from_text(candidate):
        return None
    return candidate


def _fallback_extract_specials(text: str) -> list[dict]:
    """Heuristically extract recurring specials when the LLM path is unavailable."""
    if not text:
        return []

    text = _normalize_compact_time_tokens(text)
    lines = [line.strip(" |") for line in text.splitlines() if line.strip()]
    seen: set[tuple[str, tuple[int, ...], Optional[str], Optional[str]]] = set()
    extracted: list[dict] = []

    for idx, _line in enumerate(lines):
        if idx > 0 and _DAY_OR_RANGE_ONLY_RE.match(lines[idx - 1].strip()):
            continue
        candidate = _candidate_special_text(lines, idx)
        if not candidate:
            continue
        if _EVENT_PROMO_RE.search(candidate):
            continue
        if _DATED_PROMO_RE.search(candidate):
            continue

        days = _infer_days_from_text(candidate)
        if not days:
            continue

        time_start, time_end = _infer_time_from_text(candidate)
        title_parts = [part.strip() for part in candidate.split("|") if part.strip()]
        title_seed = ""
        for part in title_parts:
            if not _DAY_OR_RANGE_ONLY_RE.match(part):
                title_seed = re.split(r"\bfrom\b|\. ", part, maxsplit=1, flags=re.I)[
                    0
                ].strip()
                break
        title = _normalize_special_title(title_seed, candidate)
        if not title:
            continue

        lowered = candidate.lower()
        special_type = _infer_special_type(lowered)

        price_note = _extract_price_note(candidate)
        key = (title.lower(), tuple(days), time_start, price_note)
        if key in seen:
            continue
        seen.add(key)

        extracted.append(
            {
                "title": title,
                "type": special_type,
                "description": None,
                "days": days,
                "time_start": time_start,
                "time_end": time_end,
                "price_note": price_note,
                "_days_already_parsed": True,
            }
        )

    collapsed: dict[tuple[str, tuple[int, ...]], dict] = {}
    for item in extracted:
        key = (item["title"].lower(), tuple(item["days"]))
        current = collapsed.get(key)
        candidate_score = (
            int(bool(item.get("time_start")))
            + int(bool(item.get("time_end")))
            + int(bool(item.get("price_note")))
        )
        if current is None:
            collapsed[key] = item
            continue
        current_score = (
            int(bool(current.get("time_start")))
            + int(bool(current.get("time_end")))
            + int(bool(current.get("price_note")))
        )
        if candidate_score > current_score:
            collapsed[key] = item

    return list(collapsed.values())


def _fallback_extract_hours(text: str) -> Optional[dict]:
    """Extract only operating-hours lines, excluding specials/happy-hour noise."""
    if not text:
        return None
    candidate_lines = []
    for line in text.splitlines():
        cleaned = line.strip()
        if not cleaned:
            continue
        lowered = cleaned.lower()
        if "happy hour" in lowered or "special" in lowered:
            continue
        if "brunch" in lowered and "open" not in lowered:
            continue
        if re.search(r"\b(open|hours?)\b", lowered) and (
            DAY_RANGE_RE.search(cleaned) or _DAY_NAME_RE.search(cleaned)
        ):
            candidate_lines.append(cleaned)
    if not candidate_lines:
        return None
    merged_hours = {}
    for line in candidate_lines:
        parsed = parse_bio_hours(line)
        if not parsed:
            continue
        for day, value in parsed.items():
            merged_hours.setdefault(day, value)
    return merged_hours or None


def _fallback_extract_data(combined: str) -> dict:
    """Build a minimal extraction payload without any LLM dependency."""
    payload = _empty_extraction_payload()
    normalized = _normalize_compact_time_tokens(combined)
    payload["specials"] = _fallback_extract_specials(normalized)
    if re.search(r"\bbottomless brunch\b", normalized, re.I):
        for special in payload["specials"]:
            if special.get("title") == "Weekend Brunch":
                special["title"] = "Bottomless Brunch"
    payload["hours"] = _fallback_extract_hours(normalized)
    if payload["hours"]:
        payload["_hours_source"] = "website"
    return payload


def _supplement_with_fallback(data: dict, combined: str) -> tuple[dict, list[str]]:
    """Fill missing high-value fields from heuristic extraction when LLM is sparse."""
    fallback = _fallback_extract_data(combined)
    supplemented: list[str] = []

    if not data.get("specials") and fallback.get("specials"):
        data["specials"] = fallback["specials"]
        supplemented.append("specials")

    if not data.get("hours") and fallback.get("hours"):
        data["hours"] = fallback["hours"]
        if fallback.get("_hours_source"):
            data["_hours_source"] = fallback["_hours_source"]
        supplemented.append("hours")

    return data, supplemented


def parse_bio_hours(text: str) -> Optional[dict]:
    """Parse free-text hours from a bio into structured JSONB matching venues.hours schema.

    Handles patterns like:
    - "Open Tue-Sat 5pm-10pm"
    - "Mon-Fri 11:30am-2pm / 5pm-10pm"
    - "Open daily 11am-midnight"

    Returns dict like {"mon": {"open": "11:00", "close": "22:00"}, ...} or None.
    """
    if not text:
        return None

    text = text.replace("midnight", "12:00am").replace("noon", "12:00pm")
    hours = {}

    # Find time ranges first
    time_matches = list(HOURS_TIME_RE.finditer(text))
    if not time_matches:
        return None

    # Find day ranges/individual days near each time match
    for tmatch in time_matches:
        open_h, open_m, open_ampm = (
            int(tmatch.group(1)),
            int(tmatch.group(2) or 0),
            tmatch.group(3),
        )
        close_h, close_m, close_ampm = (
            int(tmatch.group(4)),
            int(tmatch.group(5) or 0),
            tmatch.group(6),
        )

        # If only close has AM/PM, infer open's AM/PM
        if close_ampm and not open_ampm:
            # If open_h > close_h, open is AM (e.g., 11-2pm → 11am-2pm)
            if open_h > int(tmatch.group(4)):
                open_ampm = "am"
            else:
                open_ampm = close_ampm

        open_time = _to_24h(open_h, open_m, open_ampm)
        close_time = _to_24h(close_h, close_m, close_ampm)

        # Look for day indicators in the ~40 chars before the time match
        context_start = max(0, tmatch.start() - 40)
        context = text[context_start : tmatch.start()]

        days = []

        # Check for "daily" / "every day" / "7 days"
        if re.search(r"\b(daily|every\s*day|7\s*days)\b", context, re.I):
            days = list(DAY_NAMES_ORDERED)

        # Check for day ranges (Tue-Sat)
        if not days:
            range_match = DAY_RANGE_RE.search(context)
            if range_match:
                days = _expand_day_range(range_match.group(1), range_match.group(2))

        # Check for individual day names
        if not days:
            for word in re.split(r"[,/&\s]+", context):
                d = _normalize_day(word)
                if d and d not in days:
                    days.append(d)

        # If no days found near the time, check the whole text for day ranges
        if not days:
            range_match = DAY_RANGE_RE.search(text)
            if range_match:
                days = _expand_day_range(range_match.group(1), range_match.group(2))

        # If still no days and "daily" in whole text
        if not days and re.search(r"\b(daily|every\s*day|7\s*days)\b", text, re.I):
            days = list(DAY_NAMES_ORDERED)

        for day in days:
            # Don't overwrite — first match wins (main hours before secondary)
            if day not in hours:
                hours[day] = {"open": open_time, "close": close_time}

    return hours if hours else None


def fetch_instagram_bio(handle: str) -> Optional[dict]:
    """Fetch Instagram profile and extract bio data (phone, description, links, hours).

    Uses the og:description meta tag which IG reliably sets even for logged-out visitors.
    Returns dict with keys: phone, description, menu_url, reservation_url, bio_hours_text
    """
    url = f"https://www.instagram.com/{handle}/"
    result = {
        "phone": None,
        "description": None,
        "menu_url": None,
        "reservation_url": None,
        "bio_hours_text": None,
    }

    try:
        browser = _get_browser()
        context = browser.new_context(
            user_agent=HEADERS["User-Agent"],
            viewport={"width": 1920, "height": 1080},
        )
        try:
            page = context.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)
            html = page.content()
        finally:
            context.close()
    except Exception as e:
        logger.debug(f"  IG bio fetch failed for @{handle}: {e}")
        return None

    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")

    # Extract og:description — contains the bio text
    og_desc = soup.find("meta", attrs={"property": "og:description"})
    bio_text = ""
    if og_desc and og_desc.get("content"):
        bio_text = og_desc["content"].strip()

    if not bio_text:
        return None

    # Extract phone number from bio
    phone_match = PHONE_RE.search(bio_text)
    if phone_match:
        raw = phone_match.group()
        digits = re.sub(r"\D", "", raw)
        if len(digits) == 10:
            result["phone"] = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        elif len(digits) == 11 and digits[0] == "1":
            result["phone"] = f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"

    # Extract links from the page — IG bios often have linktree, menu, reservation URLs
    for a in soup.find_all("a", href=True):
        href = a["href"]
        href_lower = href.lower()

        # Reservation links
        if not result["reservation_url"]:
            if any(p in href_lower for p in RESERVATION_URL_PATTERNS):
                result["reservation_url"] = href

        # Menu links
        if not result["menu_url"]:
            if any(p in href_lower for p in MENU_URL_PATTERNS):
                result["menu_url"] = href

    # Extract description — first meaningful line of bio (before phone/hours/link patterns)
    # IG og:description format: "N Followers, N Following, N Posts - <bio text>"
    bio_parts = bio_text.split(" - ", 1)
    if len(bio_parts) > 1:
        bio_content = bio_parts[1].strip()
    else:
        bio_content = bio_text

    # First meaningful line as description
    lines = [l.strip() for l in bio_content.split("\n") if l.strip()]
    for line in lines:
        # Skip lines that are just phone numbers or URLs
        if PHONE_RE.match(line):
            continue
        if line.startswith("http") or line.startswith("www."):
            continue
        if len(line) >= 15:
            result["description"] = line[:200]
            break

    # Extract hours text — look for time patterns in bio
    hours_patterns = HOURS_TIME_RE.findall(bio_content)
    if hours_patterns:
        # Capture the raw hours text for the hours parser
        result["bio_hours_text"] = bio_content

    return result


def fetch_facebook_bio(fb_url: str, html: Optional[str] = None) -> Optional[dict]:
    """Extract structured bio data from a Facebook business page.

    If `html` is provided (pre-fetched by _fetch_fb_about_html), skips the
    Playwright fetch — avoids the double-fetch when called alongside LLM text
    extraction in the --include-social-bios flow.

    Returns dict with keys: phone, description, menu_url, reservation_url, bio_hours_text
    """
    result = {
        "phone": None,
        "description": None,
        "menu_url": None,
        "reservation_url": None,
        "bio_hours_text": None,
    }

    # Fetch HTML if not pre-provided
    if html is None:
        try:
            browser = _get_browser()
            context = browser.new_context(
                user_agent=HEADERS["User-Agent"],
                viewport={"width": 1920, "height": 1080},
            )
            try:
                about_url = fb_url.rstrip("/") + "/about"
                page = context.new_page()
                page.goto(about_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(3000)
                html = page.content()
            finally:
                context.close()
        except Exception as e:
            logger.debug(f"  FB bio fetch failed for {fb_url}: {e}")
            return None

    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")

    # Extract og:description for page description
    og_desc = soup.find("meta", attrs={"property": "og:description"})
    if og_desc and og_desc.get("content"):
        desc = og_desc["content"].strip()
        if len(desc) >= 15:
            result["description"] = desc[:200]

    # Extract phone from tel: links
    tel_link = soup.find("a", href=re.compile(r"^tel:", re.I))
    if tel_link:
        raw_tel = tel_link["href"].replace("tel:", "").strip()
        digits = re.sub(r"\D", "", raw_tel)
        if len(digits) == 10:
            result["phone"] = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        elif len(digits) == 11 and digits[0] == "1":
            result["phone"] = f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"

    # Fallback: phone from visible text
    if not result["phone"]:
        body_text = soup.get_text(separator=" ")
        phone_match = PHONE_RE.search(body_text)
        if phone_match:
            raw = phone_match.group()
            digits = re.sub(r"\D", "", raw)
            if len(digits) == 10:
                result["phone"] = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
            elif len(digits) == 11 and digits[0] == "1":
                result["phone"] = f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"

    # Extract hours text from page content
    body_text = soup.get_text(separator="\n")
    hours_matches = HOURS_TIME_RE.findall(body_text)
    if hours_matches:
        # Find lines containing day + time patterns near each other
        for line in body_text.split("\n"):
            if HOURS_TIME_RE.search(line) and DAY_RANGE_RE.search(line):
                result["bio_hours_text"] = line.strip()
                break
        # If no single line has both, capture broader context
        if not result["bio_hours_text"]:
            result["bio_hours_text"] = body_text[:2000]

    # Scan links for menu/reservation URLs
    for a in soup.find_all("a", href=True):
        href = a["href"]
        href_lower = href.lower()
        if not result["reservation_url"] and any(
            p in href_lower for p in RESERVATION_PATTERNS
        ):
            result["reservation_url"] = href
        if not result["menu_url"] and any(p in href_lower for p in MENU_URL_PATTERNS):
            result["menu_url"] = href

    # Check if we got anything useful
    if all(v is None for v in result.values()):
        return None

    return result


EXTRACTION_PROMPT = (
    """You are a venue data extraction system for a nightlife/restaurant guide app.
Given HTML content from a venue's website, extract structured data in one pass.

RULES:
1. Extract ONLY information explicitly stated on the page. Never invent details.
2. For specials: extract ONLY recurring food/drink deals and happy hours. Specifically:

   DAY-OF-WEEK FOOD SPECIALS: Taco Tuesday, Wing Wednesday, Wing Night, Oyster Night,
   Steak Night, Fish Fry Friday, Burger Night, Pizza Night, Sushi Night/Special,
   Crawfish Boil, BBQ Night, Pasta Night, or any "X Night" / "$X [food item]" pattern.

   DAY-OF-WEEK DRINK SPECIALS: Happy hour (capture EXACTLY what's discounted and by how much),
   Wine Night/Wednesday, Margarita Monday, $X beer night, bottomless mimosas,
   industry night pricing, half-price drinks, $X wells/domestics, pitcher specials,
   cocktail of the week, beer flight deals, bottle specials.

   BRUNCH: Weekend brunch with hours and pricing, bottomless brunch, brunch cocktail deals.

   INDUSTRY & SOCIAL NIGHTS: Industry night, ladies' night, military/first responder discounts.

   DO NOT extract as specials: trivia, karaoke, open mic, live music, DJ nights, comedy,
   drag shows, bingo, game nights, run clubs, or other programmed entertainment. Those
   are EVENT-LIKE NIGHTS and should only use type: "event_night" if they appear with a
   clear recurring schedule.

   FOOD/DRINK THEMED RECURRING DEALS STAY AS SPECIALS: Taco Tuesday, Wing Wednesday,
   Oyster Night, Burger Night, Steak Night, Fish Fry Friday, Pizza Night, Sushi Night,
   Crawfish Boil, BBQ Night, Hot Dog Night, Pasta Night, Margarita Monday, Wine Wednesday,
   ladies night pricing, industry night pricing, and happy hours should remain destination
   specials, not event_night.

   HAPPY HOURS should use type: "happy_hour".
   BRUNCH offers should use type: "brunch".
   FOOD/DRINK weekly deals with a named identity should usually use type: "recurring_deal".
   Keep type: "daily_special" for broader or less distinctive recurring pricing.

   DO NOT extract holiday hours, holiday specials, or one-off seasonal events.

3. TITLE GUIDELINES — CRITICAL: Every special MUST have a specific descriptive title.
   GOOD: "Taco Tuesday", "Wing Wednesday", "Half-Price Wine Night", "$1 Oyster Thursday",
         "Happy Hour", "Weekend Brunch", "BOGO Wings Monday"
   BAD: "Special", "Food Special", "Drink Deal", "Weekly Special"
   NEVER use "Special" as a title. If you can't name it specifically, don't include it.

4. DAYS — CRITICAL: Every special MUST have specific days in the "days" array.
   If a special runs "every day" or "daily", use ["mon","tue","wed","thu","fri","sat","sun"].
   If it runs "weekdays" or "Mon-Fri", use ["mon","tue","wed","thu","fri"].
   If it runs "weekends", use ["sat","sun"].
   Read the source carefully: "Happy Hour Mon-Fri" means 5 days, not 1.
   NEVER leave the days array empty if the text mentions when it occurs.

5. PRICING: Always capture specific pricing in price_note.
   GOOD: "$1 oysters", "half-price wings", "$5 margaritas", "$3 domestic drafts", "2-for-1 wells"
   BAD: "discounted", "special pricing", "deals"

6. HAPPY HOURS: Always capture what's discounted, not just "happy hour" generically.
   Include the specific items and prices (e.g., "$2 off drafts, $5 wells, half-price appetizers").

7. DESCRIPTION: Write 1 sentence max that adds info NOT already in the title and price_note.
   Do NOT repeat the title or price in the description. If there's nothing to add, use null.
   GOOD (title="Taco Tuesday", price="$3 tacos"): "Rotating selection with al pastor, carnitas, and fish options"
   BAD: "Taco Tuesday with $3 tacos" (just repeats title and price)
   BAD: "$3 tacos every Tuesday" (repeats everything)

8. TYPE MAPPING:
   - Happy hour offers → happy_hour
   - Weekend brunch / bottomless brunch / brunch pricing → brunch
   - Food/drink themed weekly deals (Taco Tuesday, Wing Wednesday, Wine Wednesday, etc.) → recurring_deal
   - Pure pricing deals without a distinct identity → daily_special
   - Pop-ups, guest chefs, seasonal menus → seasonal_menu
   - Entertainment/programmed recurring nights (trivia, karaoke, open mic, DJ night, comedy, drag, bingo, run club) → event_night

7. For hours: extract operating hours for each day of the week.
8. For menu: find links to their menu page (food menu, drink menu, etc.).
9. For reservations: find links to Resy, OpenTable, SevenRooms, Tock, or any booking system.
10. For phone: extract venue phone number in format "(404) 555-1234".
11. For instagram: extract the handle (no @) from any Instagram link or @mention on the page.
12. For price_level: infer from menu prices or self-description. 1=$, 2=$$, 3=$$$, 4=$$$$. "Fine dining"=4, "dive bar"=1, typical bar/restaurant=2. Only set if evidence exists.
13. For vibes: tag ONLY vibes with explicit evidence on the page (e.g., "dogs welcome" photo of patio, "rooftop bar" in description). Valid values: """
    + ", ".join(f'"{v}"' for v in sorted(VALID_VIBES))
    + """.
14. If information is unclear or not found, use null (or [] for arrays).
15. Times should be 24-hour format "HH:MM".
16. Days should be lowercase 3-letter abbreviations: "mon", "tue", "wed", "thu", "fri", "sat", "sun".
17. special.type must be one of: happy_hour, daily_special, recurring_deal, brunch, seasonal_menu, event_night
18. Do NOT extract holiday_hours or holiday_specials. They are not useful.
19. For cuisine: classify the venue's cuisine type(s). Use 1-3 tags from: mexican, vietnamese, japanese, chinese, thai, indian, korean, pizza, bbq, mediterranean, ethiopian, southern, seafood, french, italian, gastropub, vegan, bakery, deli, brunch_breakfast, steakhouse, chicken_wings, burgers, ice_cream_dessert, coffee, american, new_american, caribbean, cuban, peruvian, brazilian, african, middle_eastern, turkish, german, british, hawaiian, cajun_creole, tex_mex, fusion. Only set for food-serving venues.
22. For service_style: one of "quick_service", "casual_dine_in", "full_service", "tasting_menu", "bar_food", "coffee_dessert". Infer from menu format, pricing, and self-description.
23. For description: Write a 2-4 sentence paragraph (50-200 words) that helps someone decide whether to visit.
    Your tone is a local food/nightlife journalist — specific, opinionated, zero fluff.
    Every sentence must contain a concrete fact: a dish name, a price, an event name, a neighborhood, a capacity,
    a drink program detail, or a specific feature. No sentence should be removable without losing information.

    Example A (bar): "The Porter is a craft beer bar in Little Five Points with 40+ taps and a bottle list that runs
    deep into Belgian and American sours. The burger is legit, and the covered patio is dog-friendly. Tuesday trivia
    packs the place."

    Example B (restaurant): "9 Mile Station sits on the roof of Ponce City Market with open-air seating and downtown
    skyline views. The menu rotates seasonally — expect dishes like truffle rosemary fries ($14) and crab cake benedict
    ($28) at weekend brunch. They run a weekday happy hour 5-7pm with $10 cocktails and $4 drafts."

    Example C (nightclub): "Atlanta Eagle has been a cornerstone of Atlanta's LGBTQ+ nightlife since 1987. The weekly
    calendar runs deep: drag bingo on Wednesdays, country dancing with lessons on Tuesdays, trivia, and late-night
    DJ sets. The upstairs and downstairs levels have different energy depending on the night."

    If the page content is too thin to write something with real details, set to null rather than padding.
24. For short_description: Write a punchy 1-sentence tagline (max 120 chars) that captures what makes THIS
    venue different from every other bar/restaurant. Include a concrete detail: signature item, signature
    night, neighborhood identity, venue quirk, or price point.
    GOOD: "Neighborhood dive with killer wings and $3 PBR tallboys"
    GOOD: "Multi-level Latin market with live mariachi, food stalls, and weekend dance nights"
    GOOD: "Decatur beer haven with 30+ Belgian drafts and a cozy upstairs bar"
    BAD: "A restaurant and bar located in Atlanta" (too generic)
    BAD: "Great food and drinks in a welcoming atmosphere" (could be any venue)
    BAD: "Dive into a unique dining experience!" (marketing fluff)
    NEVER use puns, exclamation marks, or filler words like "welcoming", "unique", "vibrant", "amazing".
    If the page doesn't give enough specifics to write something concrete, set to null.
24. For genres: tag activities/entertainment this venue offers. Valid values: "dj", "karaoke", "trivia",
    "game-night", "dance-party", "beer", "live-music", "comedy", "drag", "open-mic", "bingo", "vinyl".
    Map event descriptions to tags: "DJ [name]" or "DJ night" → "dj", "Bingo" → "bingo",
    "Country Night" or "dance night/party" → "dance-party", "comedy night/show" → "comedy",
    "[Name] Drag Show" → "drag", "Open Mic" → "open-mic", "Vinyl Night" → "vinyl",
    "Trivia" or "pub quiz" → "trivia", "Game Night" → "game-night", "craft beer" or "beer bar" → "beer".
    Scan event calendars, recurring nights, and weekly schedules — tag ALL matching activities.
25. For accepts_reservations: true if the venue takes reservations (Resy/OpenTable link, "Make a reservation"
    button, "Reservations recommended"). false if explicitly walk-in only. null if unclear.
26. For is_event_venue: true if the venue hosts programmed events (concerts, shows, comedy nights, DJ sets,
    art openings). false for restaurants/bars that only serve food/drinks. null if unclear.
27. For dietary_options: tag dietary accommodations from the menu or site copy. Valid values:
    "vegetarian-friendly", "vegan-options", "gluten-free-options", "halal", "kosher", "allergy-aware".
    Look for menu markers: (V) or "V =" → "vegetarian-friendly", (VE) or "VE =" → "vegan-options",
    (GF) or "GF =" or "gluten free" → "gluten-free-options". A "vegetarian" or "vegan" section also counts.
    If ANY menu item has these markers, include the corresponding tag.
28. For parking: describe parking situation if mentioned. Valid values:
    "street", "lot", "garage", "valet", "no-parking". Can be an array if multiple options.
29. For menu_highlights: extract 3-5 signature dishes or notable menu items that define this venue.
    Each item should have: name (string), price (string like "$14" or null), and optionally a
    category ("appetizer", "entree", "cocktail", "dessert", "beer", "wine").
    Only include truly distinctive items — not generic "burger" or "salad" unless the pricing is notable.
    Example: [{"name": "Smoked Wings", "price": "$14", "category": "appetizer"},
              {"name": "Pimento Cheese Burger", "price": "$16", "category": "entree"}]
30. For payment_notes: note if the venue is cash-only, has a card minimum, or ATM on-site.
    null if not mentioned. Example: "Cash only, ATM on site"
31. For is_chain: true if this is a chain restaurant/bar with many locations nationwide.
    false for independent/local venues. null if unclear.

Return valid JSON only, no markdown formatting.

{
  "specials": [
    {
      "title": "Half-Price Wine Wednesday",
      "type": "daily_special",
      "description": "50% off all bottles of wine",
      "days": ["wed"],
      "time_start": "16:00",
      "time_end": "19:00",
      "price_note": "50% off bottles"
    }
  ],
  "holiday_hours": [
    {"name": "Christmas Eve", "date": "2026-12-24", "open": "11:00", "close": "17:00", "closed": false},
    {"name": "Christmas Day", "date": "2026-12-25", "open": null, "close": null, "closed": true}
  ],
  "holiday_specials": [
    {
      "title": "NYE Champagne Toast",
      "date": "2026-12-31",
      "description": "Ring in the new year with complimentary champagne toast at midnight",
      "price_note": "$150/person"
    }
  ],
  "hours": {
    "mon": {"open": "11:00", "close": "22:00"},
    "tue": {"open": "11:00", "close": "22:00"},
    "wed": {"open": "11:00", "close": "22:00"},
    "thu": {"open": "11:00", "close": "23:00"},
    "fri": {"open": "11:00", "close": "00:00"},
    "sat": {"open": "10:00", "close": "00:00"},
    "sun": {"open": "10:00", "close": "22:00"}
  },
  "menu_url": "https://example.com/menu",
  "reservation_url": "https://resy.com/cities/atlanta/example",
  "description": "A neighborhood gastropub in Decatur's town square known for one of the Southeast's deepest beer lists. The downstairs bar is lively and casual with rotating local taps, while the upstairs Belgian Bar offers a quieter setting with rare bottles and curated pairings. They host periodic beer dinners and tap takeovers.",
  "short_description": "Neighborhood dive with killer wings and $3 PBR tallboys",
  "phone": "(404) 555-1234",
  "instagram": "venuename",
  "price_level": 2,
  "vibes": ["patio", "craft-cocktails", "date-spot", "dog-friendly"],
  "cuisine": ["italian", "seafood"],
  "service_style": "casual_dine_in",
  "genres": ["live-music", "trivia"],
  "accepts_reservations": true,
  "is_event_venue": true,
  "is_chain": false,
  "dietary_options": ["vegetarian-friendly", "gluten-free-options"],
  "parking": ["lot", "street"],
  "menu_highlights": [
    {"name": "Smoked Wings", "price": "$14", "category": "appetizer"},
    {"name": "Pimento Cheese Burger", "price": "$16", "category": "entree"}
  ],
  "payment_notes": null
}

If the page has no useful venue information (e.g., it's a generic homepage with no hours/specials), return:
{"specials": [], "holiday_hours": [], "holiday_specials": [], "hours": null, "menu_url": null, "reservation_url": null, "description": null, "short_description": null, "phone": null, "instagram": null, "price_level": null, "vibes": [], "cuisine": null, "service_style": null, "genres": [], "accepts_reservations": null, "is_event_venue": null, "is_chain": null, "dietary_options": [], "parking": [], "menu_highlights": null, "payment_notes": null}
"""
)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in km."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _decode_embedded_json_string(value: str) -> str:
    try:
        return json.loads(f'"{value}"')
    except Exception:
        return html_lib.unescape(value)


def _extract_popmenu_embedded_text(html: str) -> list[str]:
    """Extract special-like menu lines from Popmenu embedded JSON blobs."""
    if not html or "MenuItem:" not in html or "Menu:" not in html:
        return []

    menu_matches = re.findall(
        r'"Menu:(\d+)":\{"__typename":"Menu","id":\d+,"name":"((?:[^"\\\\]|\\\\.)+)"',
        html,
    )
    section_matches = re.findall(
        r'"MenuSection:(\d+)":\{"__typename":"MenuSection","id":\d+,"name":"((?:[^"\\\\]|\\\\.)+)"',
        html,
    )
    item_matches = re.findall(
        r'"MenuItem:(\d+)":\{"__typename":"MenuItem".*?"name":"((?:[^"\\\\]|\\\\.)+)".*?"menu":\{"__ref":"Menu:(\d+)"\}.*?"section":\{"__ref":"MenuSection:(\d+)"\}',
        html,
        re.S,
    )

    menus = {
        menu_id: _decode_embedded_json_string(name) for menu_id, name in menu_matches
    }
    sections = {
        section_id: _decode_embedded_json_string(name)
        for section_id, name in section_matches
    }
    if not menus:
        return []

    items_by_menu: dict[str, list[tuple[str, str]]] = {}
    for _item_id, item_name, menu_id, section_id in item_matches:
        item_label = _decode_embedded_json_string(item_name)
        section_label = sections.get(section_id, "")
        items_by_menu.setdefault(menu_id, []).append((section_label, item_label))

    lines: list[str] = []
    for menu_id, menu_name in menus.items():
        menu_items = items_by_menu.get(menu_id, [])
        section_names = [section for section, _ in menu_items if section]
        item_names = [item for _, item in menu_items if item]
        joined_signal = " | ".join([menu_name] + section_names)
        if not (
            _SPECIAL_TRIGGER_RE.search(joined_signal)
            or _infer_days_from_text(joined_signal)
        ):
            continue

        parts = [menu_name]
        if section_names:
            unique_sections = list(dict.fromkeys(section_names))
            parts.extend(unique_sections[:2])
        if item_names:
            unique_items = list(dict.fromkeys(item_names))
            parts.append(", ".join(unique_items[:4]))
        lines.append(" | ".join(part for part in parts if part))

    return lines


def fetch_page(
    url: str, timeout: int = 10, use_playwright: bool = True
) -> Optional[str]:
    """Fetch a URL and return HTML. Falls back to Playwright on 403."""
    global _playwright_fallback_count
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        if resp.status_code == 200:
            return resp.text
        if resp.status_code == 403 and use_playwright:
            logger.debug("  Retrying with browser (got 403)")
            html = fetch_page_playwright(url)
            if html:
                _playwright_fallback_count += 1
            return html
        return None
    except (requests.ConnectionError, requests.Timeout) as e:
        if use_playwright:
            logger.debug(
                f"  Connection failed ({e.__class__.__name__}), trying browser"
            )
            html = fetch_page_playwright(url)
            if html:
                _playwright_fallback_count += 1
            return html
        return None
    except Exception:
        return None


def extract_page_content(html: str, max_chars: int = 12000) -> str:
    """Extract meaningful text from HTML, stripping scripts/styles/nav."""
    popmenu_lines = _extract_popmenu_embedded_text(html)
    soup = BeautifulSoup(html, "html.parser")

    # Remove non-content elements
    for tag in soup.find_all(
        ["script", "style", "nav", "footer", "header", "noscript", "iframe"]
    ):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)

    # Collapse multiple newlines
    lines = [line.strip() for line in text.split("\n") if line.strip()]
    text = "\n".join(lines)

    if popmenu_lines:
        text = text + "\n" + "\n".join(popmenu_lines)

    return text[:max_chars]


def _score_url_path(path_lower: str) -> int:
    """Score a URL path by keyword relevance."""
    score = 0
    for weight, keywords in _URL_KEYWORDS.items():
        for kw in keywords:
            if kw in path_lower:
                score += weight
                break
    return score


def _fetch_sitemap_urls(base_url: str) -> list[str]:
    """Fetch sitemap.xml and extract same-domain page URLs.

    Many restaurant sites (Squarespace, WordPress, Wix) auto-generate sitemaps
    that list every page — more reliable than parsing <a> tags from JS-heavy sites.
    Returns empty list on 404 or parse failure.
    """
    sitemap_url = base_url.rstrip("/") + "/sitemap.xml"
    base_netloc = urlparse(base_url).netloc
    try:
        resp = requests.get(sitemap_url, headers=HEADERS, timeout=5)
        if resp.status_code != 200:
            return []
        root = ET.fromstring(resp.text)
        urls = []
        # Handle namespaced and non-namespaced sitemaps
        for elem in root.iter():
            if elem.tag.endswith("loc") and elem.text:
                url = elem.text.strip()
                parsed = urlparse(url)
                if parsed.netloc == base_netloc:
                    urls.append(url)
        return urls
    except Exception:
        return []


def discover_relevant_pages(html: str, base_url: str, max_pages: int = 5) -> list[str]:
    """Discover relevant subpages by scoring links from sitemap + HTML.

    Strategy:
    1. Try sitemap.xml for a full page inventory (works for Squarespace/WP/Wix)
    2. Parse <a> tags from HTML for anchor-text scoring
    3. Merge and rank all candidates by keyword relevance

    Returns empty list if no relevant pages found — caller handles fallback.
    """
    base_parsed = urlparse(base_url)
    base_normalized = base_url.rstrip("/")
    scored: dict[str, int] = {}

    # Phase 1: Sitemap URLs (scored by path only — no anchor text)
    sitemap_urls = _fetch_sitemap_urls(base_url)
    if sitemap_urls:
        logger.debug(f"  Sitemap: {len(sitemap_urls)} URLs found")
    for url in sitemap_urls:
        clean = url.split("#")[0].rstrip("/")
        if clean == base_normalized:
            continue
        path_lower = urlparse(url).path.lower()
        score = _score_url_path(path_lower)
        if score > 0:
            scored[clean] = max(scored.get(clean, 0), score)

    # Phase 2: HTML <a> tags (scored by path + anchor text)
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if (
            href.startswith("#")
            or href.startswith("mailto:")
            or href.startswith("tel:")
        ):
            continue

        full_url = urljoin(base_url, href)
        parsed = urlparse(full_url)

        if parsed.scheme not in ("http", "https"):
            continue
        if parsed.netloc and parsed.netloc != base_parsed.netloc:
            continue

        clean_url = full_url.split("#")[0].rstrip("/")
        if clean_url == base_normalized:
            continue

        path_lower = parsed.path.lower()
        anchor_lower = (a.get_text(strip=True) or "").lower()

        score = _score_url_path(path_lower)

        # Anchor text keywords (only available from HTML links)
        for weight, keywords in _ANCHOR_KEYWORDS.items():
            for kw in keywords:
                if kw in anchor_lower:
                    score += weight
                    break

        if score > 0:
            scored[clean_url] = max(scored.get(clean_url, 0), score)

    if scored:
        ranked = sorted(scored.items(), key=lambda x: x[1], reverse=True)
        urls = [url for url, _ in ranked[:max_pages]]
        logger.debug(f"  Link discovery: {len(scored)} scored, top {len(urls)}: {urls}")
        return urls

    return []


def extract_meta_and_links(html: str, base_url: str) -> dict:
    """Extract meta tags, og:image, reservation/menu links, instagram, and phone from HTML."""
    soup = BeautifulSoup(html, "html.parser")
    result = {
        "og_image": None,
        "meta_description": None,
        "reservation_links": [],
        "menu_links": [],
        "instagram": None,
        "facebook_url": None,
        "phone": None,
    }

    # og:image
    og_img = soup.find("meta", attrs={"property": "og:image"})
    if og_img and og_img.get("content"):
        result["og_image"] = og_img["content"]

    # Meta description
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        result["meta_description"] = meta_desc["content"]

    # Scan all links for reservation, menu, and instagram URLs
    for a in soup.find_all("a", href=True):
        href = a["href"]
        href_lower = href.lower()
        text_lower = (a.get_text(strip=True) or "").lower()

        # Instagram links
        if "instagram.com/" in href_lower and not result["instagram"]:
            m = INSTAGRAM_LINK_RE.search(href)
            if m:
                handle = m.group(1).lower()
                # Skip generic pages
                if handle not in ("p", "reel", "stories", "explore", "accounts"):
                    result["instagram"] = handle

        # Facebook links
        if "facebook.com/" in href_lower and not result["facebook_url"]:
            fb_match = FACEBOOK_RE.search(href)
            if fb_match:
                fb_path = fb_match.group(0).split("facebook.com/", 1)[-1].lower()
                # Skip generic FB pages
                if fb_path not in (
                    "sharer",
                    "share",
                    "dialog",
                    "login",
                    "help",
                    "policies",
                ):
                    result["facebook_url"] = fb_match.group(0)

        # Reservation links
        if any(p in href_lower for p in RESERVATION_PATTERNS):
            result["reservation_links"].append(href)
        elif any(
            kw in text_lower
            for kw in ["reserve", "reservation", "book a table", "book now"]
        ):
            if href.startswith("http"):
                result["reservation_links"].append(href)

        # Menu links
        if any(
            kw in href_lower for kw in ["/menu", "/food-menu", "/drink-menu", "/drinks"]
        ):
            full_url = (
                href
                if href.startswith("http")
                else base_url.rstrip("/") + "/" + href.lstrip("/")
            )
            result["menu_links"].append(full_url)
        elif any(kw in text_lower for kw in ["menu", "food & drink", "food and drink"]):
            if "/menu" in href_lower or not href.startswith("#"):
                full_url = (
                    href
                    if href.startswith("http")
                    else base_url.rstrip("/") + "/" + href.lstrip("/")
                )
                result["menu_links"].append(full_url)

    # Phone from tel: links
    tel_link = soup.find("a", href=re.compile(r"^tel:", re.I))
    if tel_link:
        raw_tel = tel_link["href"].replace("tel:", "").strip()
        digits = re.sub(r"\D", "", raw_tel)
        if len(digits) == 10:
            result["phone"] = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
        elif len(digits) == 11 and digits[0] == "1":
            result["phone"] = f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"

    # Phone fallback: scan visible text for phone patterns
    if not result["phone"]:
        body_text = soup.get_text(separator=" ")
        phone_match = PHONE_RE.search(body_text)
        if phone_match:
            raw = phone_match.group()
            digits = re.sub(r"\D", "", raw)
            if len(digits) == 10:
                result["phone"] = f"({digits[:3]}) {digits[3:6]}-{digits[6:]}"
            elif len(digits) == 11 and digits[0] == "1":
                result["phone"] = f"({digits[1:4]}) {digits[4:7]}-{digits[7:]}"

    return result


TIME_RE = re.compile(r"^\d{1,2}:\d{2}$")


def validate_time(val: Optional[str]) -> Optional[str]:
    """Return val if it looks like HH:MM, else None."""
    if val and TIME_RE.match(val):
        return val
    return None


_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def validate_date(val: Optional[str]) -> Optional[str]:
    """Return val if it looks like YYYY-MM-DD, else None."""
    if val and _DATE_RE.match(val):
        return val
    return None


def parse_days(day_names: list) -> list[int]:
    """Convert day name strings to ISO weekday integers."""
    result = []
    for d in day_names:
        d_lower = d.strip().lower()
        if d_lower in DAY_MAP:
            result.append(DAY_MAP[d_lower])
    return sorted(set(result))


# ---------------------------------------------------------------------------
# Post-extraction validation & fixup for specials
# ---------------------------------------------------------------------------

_DAY_NAME_RE = re.compile(
    r"\b(mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?"
    r"|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b",
    re.I,
)
_EVERY_DAY_RE = re.compile(r"\b(every\s*day|daily|7\s*days)\b", re.I)
_WEEKDAY_RE = re.compile(
    r"\b(weekdays?|mon(?:day)?s?\s*(?:[-–—through]+|to)\s*fri(?:day)?s?)\b", re.I
)
_WEEKEND_RE = re.compile(
    r"\b(weekends?|sat(?:urday)?s?\s*(?:[-–—&/,]|and)\s*sun(?:day)?s?)\b", re.I
)
_TIME_EXTRACT_RE = re.compile(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", re.I)


def _infer_days_from_text(text: str) -> Optional[list[int]]:
    """Parse day-of-week info from free text. Returns ISO weekday ints or None."""
    if not text:
        return None
    days = set()
    for match in DAY_RANGE_RE.finditer(text):
        for day in _expand_day_range(match.group(1), match.group(2)):
            if day in DAY_MAP:
                days.add(DAY_MAP[day])
    if _WEEKDAY_RE.search(text):
        days.update([1, 2, 3, 4, 5])
    if _WEEKEND_RE.search(text):
        days.update([6, 7])
    for m in _DAY_NAME_RE.finditer(text):
        d = m.group(1).lower()
        if d in DAY_MAP:
            days.add(DAY_MAP[d])
    if not days and _EVERY_DAY_RE.search(text):
        return [1, 2, 3, 4, 5, 6, 7]
    return sorted(days) if days else None


def _infer_time_from_text(text: str) -> tuple[Optional[str], Optional[str]]:
    """Parse start/end times from free text. Returns (time_start, time_end) in HH:MM."""
    if not text:
        return None, None
    range_match = HOURS_TIME_RE.search(text)
    if range_match:
        open_h = int(range_match.group(1))
        open_m = int(range_match.group(2) or 0)
        open_ampm = range_match.group(3)
        close_h = int(range_match.group(4))
        close_m = int(range_match.group(5) or 0)
        close_ampm = range_match.group(6)
        if close_ampm and not open_ampm:
            if open_h == 12:
                open_ampm = close_ampm
            else:
                open_ampm = "am" if open_h > close_h else close_ampm
        return _to_24h(open_h, open_m, open_ampm), _to_24h(close_h, close_m, close_ampm)
    matches = _TIME_EXTRACT_RE.findall(text)
    if not matches:
        return None, None
    times = []
    for hour_str, minute_str, ampm in matches:
        h = int(hour_str)
        m = int(minute_str) if minute_str else 0
        if ampm.lower() == "pm" and h < 12:
            h += 12
        elif ampm.lower() == "am" and h == 12:
            h = 0
        times.append(f"{h:02d}:{m:02d}")
    if len(times) >= 2:
        return times[0], times[1]
    return times[0], None


def _infer_title_from_description(desc: str, special_type: str) -> Optional[str]:
    """Try to extract a meaningful title from the description text."""
    if not desc:
        return None
    # If description starts with a name-like phrase before a comma or colon, use it
    # Don't split on hyphens — they appear in prices like "Half-priced"
    first_part = re.split(r"[,:]", desc, maxsplit=1)[0].strip()
    if 5 <= len(first_part) <= 60 and first_part.lower() != "special":
        return first_part
    return None


# Types that are actually events, not specials
_EVENT_TYPES = {"event_night"}
# Types that are holiday noise
_HOLIDAY_TYPES = {"holiday_hours", "holiday_special"}
# Content patterns that indicate entertainment events (not food/drink deals)
_EVENT_CONTENT_RE = re.compile(
    r"\b(trivia|karaoke|open mic|live music|dj set|comedy|drag show|bingo|"
    r"run club|jazz jam|game night|pub quiz|vinyl night)\b",
    re.I,
)

# Content patterns for recurring food/drink deal language that should remain
# destination specials even when they have a named weekly identity.
_DEAL_CONTENT_RE = re.compile(
    r"\b(taco|wing|oyster|burger|steak|fish fry|pizza|sushi|pasta|crawfish|bbq|hot dog|"
    r"happy hour|brunch|ladies night|wine night|wine wednesday|margarita|industry night)\b",
    re.I,
)

# Map event content keywords to categories for insert_event
_EVENT_CATEGORY_MAP = {
    "trivia": "nightlife",
    "pub quiz": "nightlife",
    "karaoke": "nightlife",
    "dj set": "nightlife",
    "live music": "music",
    "jazz jam": "music",
    "open mic": "music",
    "vinyl night": "music",
    "comedy": "comedy",
    "drag show": "nightlife",
    "bingo": "nightlife",
    "game night": "nightlife",
    "run club": "fitness",
    # Food/drink nights → nightlife so infer_genres handles the rest
    "taco": "nightlife",
    "wing": "nightlife",
    "oyster": "nightlife",
    "burger": "nightlife",
    "steak": "nightlife",
    "fish fry": "nightlife",
    "pizza": "nightlife",
    "sushi": "nightlife",
    "pasta": "nightlife",
    "crawfish": "nightlife",
    "bbq": "nightlife",
    "hot dog": "nightlife",
    "happy hour": "nightlife",
    "brunch": "nightlife",
    "ladies night": "nightlife",
    "wine night": "nightlife",
    "wine wednesday": "nightlife",
    "margarita": "nightlife",
    "industry night": "nightlife",
}

# Map special types to genres for Regular Hangs matching
_SPECIAL_TYPE_GENRES = {
    "happy_hour": ["happy-hour"],
    "brunch": ["brunch"],
    "daily_special": ["specials"],
    "recurring_deal": ["specials"],
    "event_night": [],  # Let tag_inference handle it from title
}

# ISO weekday (1=Mon) to Python weekday (0=Mon)
_ISO_TO_PYTHON_WEEKDAY = {1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6}
_ISO_DAY_NAMES = {
    1: "monday",
    2: "tuesday",
    3: "wednesday",
    4: "thursday",
    5: "friday",
    6: "saturday",
    7: "sunday",
}


def _infer_special_type(text: str) -> str:
    """Infer the destination-special type from the extracted text."""
    lowered = text.lower()
    if "happy hour" in lowered:
        return "happy_hour"
    if "brunch" in lowered:
        return "brunch"
    if any(
        phrase in lowered
        for phrase in (
            "taco",
            "wing",
            "oyster",
            "wine",
            "margarita",
            "industry night",
            "ladies night",
            "bogo",
            "half off",
            "half-price",
        )
    ):
        return "recurring_deal"
    return "daily_special"


def _coerce_special_type(s: dict) -> str:
    """Normalize extracted types so food/drink deals stay in venue_specials."""
    raw_type = (s.get("type") or "daily_special").strip()
    title = (s.get("title") or "").strip()
    desc = (s.get("description") or "").strip()
    combined_text = f"{title} {desc}".strip()

    if raw_type in _HOLIDAY_TYPES:
        return raw_type
    if raw_type == "event_night":
        if _EVENT_CONTENT_RE.search(combined_text):
            return raw_type
        return _infer_special_type(combined_text or title or desc)
    if raw_type in {
        "happy_hour",
        "daily_special",
        "recurring_deal",
        "brunch",
        "seasonal_menu",
    }:
        return raw_type
    return _infer_special_type(combined_text or title or desc)


def _fixup_common_fields(s: dict) -> dict:
    """Parse/infer days, times, and title for a raw special/event dict. Mutates and returns it."""
    title = (s.get("title") or "").strip()
    desc = (s.get("description") or "").strip()
    days = s.get("days") or []

    # Parse structured days from LLM output
    if days and all(isinstance(day, int) for day in days):
        parsed_days = sorted(day for day in days if 1 <= day <= 7)
    else:
        parsed_days = parse_days(days) if days else []

    # If no structured days, try to infer from description or title
    if not parsed_days:
        inferred = _infer_days_from_text(desc) or _infer_days_from_text(title)
        if inferred:
            parsed_days = inferred

    # If no structured times, try to infer from description or title
    time_start = validate_time(s.get("time_start"))
    time_end = validate_time(s.get("time_end"))
    if not time_start:
        inf_start, inf_end = _infer_time_from_text(desc) or (None, None)
        if not inf_start:
            inf_start, inf_end = _infer_time_from_text(title) or (None, None)
        if inf_start:
            time_start = inf_start
        if inf_end and not time_end:
            time_end = inf_end

    # Try to fix generic titles
    if not title or title.lower() == "special":
        inferred_title = _infer_title_from_description(desc, s.get("type", ""))
        if inferred_title:
            title = inferred_title

    # Clean up redundant description
    if desc and desc.lower().strip() == title.lower().strip():
        desc = ""

    s["title"] = title
    s["description"] = desc or None
    s["days"] = parsed_days
    s["time_start"] = time_start
    s["time_end"] = time_end
    s["_days_already_parsed"] = True
    return s


def validate_specials(specials: list[dict]) -> list[dict]:
    """Filter and fix up extracted specials. Returns only valid food/drink deals."""
    validated = []
    for s in specials:
        stype = _coerce_special_type(s)

        # Event and holiday types are handled separately
        if stype in _EVENT_TYPES or stype in _HOLIDAY_TYPES:
            continue

        title = (s.get("title") or "").strip()
        desc = (s.get("description") or "").strip()
        price = (s.get("price_note") or "").strip()

        # Content-based event filter: skip items routed to events via extract_event_items()
        combined_text = f"{title} {desc}"
        # Entertainment events without price → events
        if _EVENT_CONTENT_RE.search(combined_text) and not price:
            continue

        s = _fixup_common_fields(s)

        # Reject generic or too-short titles
        if not s["title"] or s["title"].lower() in (
            "special",
            "specials",
            "deal",
            "deals",
        ):
            continue
        if len(s["title"]) < 5:
            continue

        # Gate: must have days. A special without a schedule can't be displayed usefully.
        if not s["days"]:
            continue

        s["price_note"] = price or None
        s["type"] = stype
        validated.append(s)

    return validated


def extract_event_items(specials: list[dict]) -> list[dict]:
    """Extract event-like items from raw LLM output.

    Routes entertainment/programmed recurring nights to insert_event() instead
    of venue_specials. Food/drink recurring deals remain destination specials.
    """
    events = []
    for s in specials:
        stype = _coerce_special_type(s)
        title = (s.get("title") or "").strip()
        desc = (s.get("description") or "").strip()
        price = (s.get("price_note") or "").strip()
        combined_text = f"{title} {desc}"

        # Capture explicit event_night types
        is_event_type = stype in _EVENT_TYPES
        # Entertainment events: trivia, karaoke, etc. (no price = not a drink deal)
        is_entertainment = bool(_EVENT_CONTENT_RE.search(combined_text)) and not price

        if not is_event_type and not is_entertainment:
            continue

        s = _fixup_common_fields(s)

        # Must have a real title and days to create events
        if not s["title"] or s["title"].lower() == "special":
            continue
        if not s["days"]:
            continue

        # Determine category from content
        category = "nightlife"  # default for event nights
        for keyword, cat in _EVENT_CATEGORY_MAP.items():
            if keyword in combined_text.lower():
                category = cat
                break

        # Attach metadata for Regular Hangs matching and series creation
        s["_category"] = category
        s["_genres"] = _SPECIAL_TYPE_GENRES.get(stype, [])
        s["_price_note"] = (
            price  # Preserved for series.price_note (separate from description)
        )
        events.append(s)

    return events


def _get_specials_source_id() -> int:
    """Resolve or cache the venue-specials-scraper source ID."""
    if not hasattr(_get_specials_source_id, "_cached"):
        client = get_client()
        result = (
            client.table("sources")
            .select("id")
            .eq("slug", "venue-specials-scraper")
            .execute()
        )
        if result.data:
            _get_specials_source_id._cached = result.data[0]["id"]
        else:
            raise ValueError(
                "Source 'venue-specials-scraper' not found in sources table"
            )
    return _get_specials_source_id._cached


def upsert_event_items(
    venue: dict, event_items: list[dict], dry_run: bool = False
) -> int:
    """Insert event items as recurring events via insert_event(). Returns count inserted."""
    from datetime import date as date_cls, timedelta
    from dedupe import generate_content_hash, find_event_by_hash

    venue_id = venue["id"]
    venue_name = venue.get("name", "")
    source_id = _get_specials_source_id()
    today = date_cls.today()
    inserted = 0

    now_iso = datetime.now(timezone.utc).isoformat()

    for item in event_items:
        title = item["title"]
        category = item.get("_category", "nightlife")
        genres = item.get("_genres", [])
        time_start = item.get("time_start")
        desc = item.get("description")
        price_note = item.get("price_note") or item.get("_price_note")
        iso_days = item["days"]  # Already ISO weekday ints

        for iso_day in iso_days:
            day_name = _ISO_DAY_NAMES.get(iso_day, "")
            py_day = _ISO_TO_PYTHON_WEEKDAY[iso_day]
            day_label = day_name.title() if day_name else ""

            # Create one series per day. Multi-day operations need distinct titles
            # so series records stay stable instead of mutating across weekdays.
            if len(iso_days) > 1 and venue_name and day_label:
                series_title = f"{title} ({day_label}) at {venue_name}"
            elif venue_name:
                series_title = f"{title} at {venue_name}"
            else:
                series_title = title

            # Series hint scoped to this venue + this day
            series_hint = {
                "series_type": "recurring_show",
                "series_title": series_title,
                "frequency": "weekly",
                "day_of_week": day_name,
                "last_verified_at": now_iso,
            }
            if price_note:
                series_hint["price_note"] = price_note

            # Generate next 2 weekly occurrences for this day
            days_ahead = (py_day - today.weekday()) % 7
            next_date = today + timedelta(days=days_ahead)

            for i in range(2):
                event_date = next_date + timedelta(weeks=i)
                date_str = event_date.isoformat()

                # Dedup check
                content_hash = generate_content_hash(title, venue_name, date_str)
                if find_event_by_hash(content_hash):
                    continue

                event_data = {
                    "title": title,
                    "place_id": venue_id,
                    "source_id": source_id,
                    "start_date": date_str,
                    "start_time": time_start,
                    "category": category,
                    "description": desc,
                    "source_url": venue.get("website"),
                    "is_recurring": True,
                    "content_hash": content_hash,
                    "_suppress_title_participants": True,
                }

                if dry_run:
                    logger.info(
                        f"    [dry-run] Would insert event: {title} on {date_str} ({day_name})"
                    )
                    inserted += 1
                    continue

                try:
                    insert_event(
                        event_data, series_hint=series_hint, genres=genres or None
                    )
                    inserted += 1
                except (ValueError, Exception) as e:
                    logger.debug(
                        f"    Event insert failed for '{title}' on {date_str}: {e}"
                    )

        if inserted and not dry_run:
            logger.info(f"  Inserted {inserted} instances of recurring event: {title}")

    return inserted


def _merge_social_bio(data: dict, bio: dict, venue: dict) -> None:
    """Merge social bio data into extraction results using fill-gaps logic.

    Only writes fields that are still empty in both the extracted data and the venue record.
    """
    if not bio:
        return

    # Phone: fill if neither website scrape nor venue DB has it
    if bio.get("phone") and not data.get("phone") and not venue.get("phone"):
        data["phone"] = bio["phone"]

    # Description: fill if missing
    if (
        bio.get("description")
        and not data.get("description")
        and not venue.get("description")
    ):
        data["description"] = bio["description"]

    # Menu URL: fill if missing
    if bio.get("menu_url") and not data.get("menu_url") and not venue.get("menu_url"):
        data["menu_url"] = bio["menu_url"]

    # Reservation URL: fill if missing
    if (
        bio.get("reservation_url")
        and not data.get("reservation_url")
        and not venue.get("reservation_url")
    ):
        data["reservation_url"] = bio["reservation_url"]

    # Hours: parse from bio text and fill if missing (lowest confidence source)
    if bio.get("bio_hours_text") and not data.get("hours"):
        current_source = venue.get("hours_source")
        if not venue.get("hours") or should_update_hours(current_source, "social_bio"):
            parsed_hours = parse_bio_hours(bio["bio_hours_text"])
            if parsed_hours:
                data["hours"] = parsed_hours
                data["_hours_source"] = "social_bio"


def _fetch_fb_about_html(fb_url: str) -> Optional[str]:
    """Fetch a Facebook about page and return raw HTML.

    Single fetch shared by both LLM text extraction and structured bio parsing,
    avoiding the double-fetch problem.
    """
    try:
        about_url = fb_url.rstrip("/") + "/about"
        browser = _get_browser()
        context = browser.new_context(
            user_agent=HEADERS["User-Agent"],
            viewport={"width": 1920, "height": 1080},
        )
        try:
            page = context.new_page()
            page.goto(about_url, wait_until="domcontentloaded", timeout=10000)
            page.wait_for_timeout(2000)
            return page.content()
        finally:
            context.close()
    except Exception as e:
        logger.debug(f"  FB about fetch failed for {fb_url}: {e}")
        return None


def fetch_venue_content(
    venue: dict, use_playwright: bool = True, include_social_bios: bool = False
) -> Optional[tuple[str, dict]]:
    """Fetch a venue's website content without LLM extraction.

    Returns (combined_text, meta_dict) or None if fetching fails.
    Used by both scrape_venue() and the --dump mode.
    """
    website = venue.get("website", "")
    if not website:
        return None

    # Normalize URL
    if not website.startswith("http"):
        website = "https://" + website

    # Fetch main page — try requests first, log if Playwright needed
    main_html = fetch_page(website, use_playwright=False)
    if not main_html and use_playwright:
        logger.info("  Using browser fallback (got 403)")
        main_html = fetch_page_playwright(website)
        global _playwright_fallback_count
        if main_html:
            _playwright_fallback_count += 1
    if not main_html:
        logger.info("  Could not fetch main page")
        return None

    # Extract meta info and links from HTML
    meta = extract_meta_and_links(main_html, website)
    main_text = extract_page_content(main_html, max_chars=10000)
    if _looks_like_parked_site(main_text) or _looks_like_parked_site(main_html):
        logger.info("  Website appears to be a parked or placeholder domain; skipping")
        return None

    # Smart link discovery — sitemap + HTML link scoring
    discovered_urls = discover_relevant_pages(main_html, website, max_pages=5)

    # Option C: If static HTML yielded nothing, retry with Playwright-rendered HTML
    if not discovered_urls and use_playwright:
        logger.debug("  No links from static HTML, retrying with Playwright")
        pw_html = fetch_page_playwright(website)
        if pw_html:
            discovered_urls = discover_relevant_pages(pw_html, website, max_pages=5)

    # Final fallback: common subpages
    if not discovered_urls:
        logger.debug("  Using fallback subpages")
        discovered_urls = [website.rstrip("/") + sub for sub in FALLBACK_SUBPAGES]

    # Fetch top discovered subpages
    subpage_texts = []
    for url in discovered_urls:
        if len(subpage_texts) >= 3:
            break
        html = fetch_page(url, timeout=5, use_playwright=use_playwright)
        if html:
            text = extract_page_content(html, max_chars=3000)
            if (
                len(text) > 100 and text != main_text[: len(text)]
            ):  # Skip if same as main
                path = urlparse(url).path or url
                subpage_texts.append(f"--- Page: {path} ---\n{text}")

    # Social content (opt-in via --include-social-bios)
    fb_text = None
    ig_captions = None
    if include_social_bios:
        # Facebook: fetch once, use for both LLM text and structured bio
        fb_url = meta.get("facebook_url")
        if fb_url:
            logger.debug(f"  Fetching FB about page: {fb_url}")
            fb_html = _fetch_fb_about_html(fb_url)
            if fb_html:
                fb_text = extract_page_content(fb_html, max_chars=2000)
                if fb_text and len(fb_text) < 50:
                    fb_text = None
                # Store HTML for structured bio extraction later (after LLM pass)
                meta["_fb_about_html"] = fb_html
                if fb_text:
                    logger.debug(f"  FB about: {len(fb_text)} chars")

        # Instagram captions
        ig_handle = meta.get("instagram") or venue.get("instagram")
        if ig_handle:
            logger.debug(f"  Fetching IG captions for @{ig_handle}")
            try:
                from scrape_instagram_specials import fetch_instagram_captions

                ig_captions = fetch_instagram_captions(ig_handle)
                if ig_captions:
                    ig_captions = ig_captions[:3000]
                    logger.debug(f"  IG captions: {len(ig_captions)} chars")
            except ImportError:
                logger.debug("  Could not import fetch_instagram_captions")

    # Combine all content for LLM (budget: 20K total)
    combined = f"--- Main Page ---\n{main_text}"
    if subpage_texts:
        combined += "\n\n" + "\n\n".join(subpage_texts[:3])
    if fb_text:
        combined += f"\n\n--- Facebook Page ---\n{fb_text}"
    if ig_captions:
        combined += f"\n\n--- Instagram Posts ---\n{ig_captions}"

    # Truncate to stay within LLM context
    combined = combined[:20000]

    return combined, meta


def merge_meta_and_validate(data: dict, meta: dict, venue: dict) -> dict:
    """Merge HTML-extracted meta fields into LLM output, then validate all fields.

    Used by both scrape_venue() (live LLM) and import mode (pre-extracted JSON).
    """
    # Merge in meta-extracted data (HTML extraction preferred for links/phone/instagram)
    if not data.get("reservation_url") and meta.get("reservation_links"):
        data["reservation_url"] = meta["reservation_links"][0]

    if not data.get("menu_url") and meta.get("menu_links"):
        data["menu_url"] = meta["menu_links"][0]

    # Only fall back to meta_description if LLM returned nothing AND the meta tag
    # looks like an actual description (not SEO spam or navigation text)
    if not data.get("description") and meta.get("meta_description"):
        desc = meta["meta_description"].strip()
        _junk = (
            "order directly",
            "expand menu",
            "check out",
            "see what's",
            "click here",
            "follow us",
            "sign up",
            "subscribe",
        )
        if len(desc) >= 60 and not any(j in desc.lower() for j in _junk):
            data["description"] = desc

    data["og_image"] = meta.get("og_image")

    # Prefer HTML-extracted instagram/phone (more reliable than LLM)
    if meta.get("instagram"):
        data["instagram"] = meta["instagram"]
    elif data.get("instagram"):
        # Clean LLM output: strip @ prefix if present
        data["instagram"] = data["instagram"].lstrip("@").lower()

    if meta.get("phone"):
        data["phone"] = meta["phone"]

    # Store Facebook URL from meta extraction
    if meta.get("facebook_url"):
        data["facebook_url"] = meta["facebook_url"]

    # Validate vibes — only keep valid ones
    raw_vibes = data.get("vibes") or []
    data["vibes"] = [v for v in raw_vibes if v in VALID_VIBES]

    # Validate service_style against DB check constraint
    ss = data.get("service_style")
    if isinstance(ss, list):
        ss = ss[0] if ss else None
        data["service_style"] = ss
    if ss and ss not in VALID_SERVICE_STYLES:
        data["service_style"] = None

    # Clean description/short_description — strip filler adjectives that gpt-4o-mini can't resist
    _FILLER_RE = re.compile(
        r"\b(vibrant|welcoming|unique|amazing|unforgettable|must-visit|hidden gem)\b\s*"
    )
    _FILLER_PHRASE_RE = re.compile(
        r"making it (a |an )?(perfect|ideal|great) spot [^.]*\."
    )
    for _field in ("description", "short_description"):
        _val = data.get(_field)
        if _val:
            _val = _FILLER_RE.sub("", _val)
            _val = _FILLER_PHRASE_RE.sub("", _val)
            _val = re.sub(r"\s+", " ", _val).strip()
            data[_field] = _val if len(_val) > 20 else None

    # Validate price_level
    pl = data.get("price_level")
    if pl is not None:
        try:
            pl = int(pl)
            if pl < 1 or pl > 4:
                pl = None
        except (ValueError, TypeError):
            pl = None
        data["price_level"] = pl

    # Price level: derive from menu_highlights prices when available (more accurate than LLM guess)
    if data.get("menu_highlights"):
        _prices = []
        for item in data["menu_highlights"]:
            p = item.get("price") if isinstance(item, dict) else None
            if p:
                m = re.search(r"\$(\d+(?:\.\d+)?)", str(p))
                if m:
                    _prices.append(float(m.group(1)))
        if len(_prices) >= 2:  # Need at least 2 prices for a reliable signal
            avg = sum(_prices) / len(_prices)
            # Thresholds calibrated for Atlanta market
            if avg <= 12:
                data["price_level"] = 1
            elif avg <= 20:
                data["price_level"] = 2
            elif avg <= 35:
                data["price_level"] = 3
            else:
                data["price_level"] = 4

    # Validate genres
    raw_genres = data.get("genres") or []
    data["genres"] = [g for g in raw_genres if g in VALID_GENRES]

    # Validate short_description length
    sd = data.get("short_description")
    if sd and len(sd) > 120:
        data["short_description"] = sd[:117] + "..."

    # Validate boolean fields
    for bool_field in ("accepts_reservations", "is_event_venue", "is_chain"):
        val = data.get(bool_field)
        if val is not None and not isinstance(val, bool):
            data[bool_field] = None

    # Derive accepts_reservations from reservation_url (ground truth beats LLM guess)
    if data.get("accepts_reservations") is None and data.get("reservation_url"):
        data["accepts_reservations"] = True

    # Derive is_event_venue from genres (if we found event programming, it's an event venue)
    if data.get("is_event_venue") is None and data.get("genres"):
        data["is_event_venue"] = True

    # Validate dietary_options
    raw_dietary = data.get("dietary_options") or []
    data["dietary_options"] = [d for d in raw_dietary if d in VALID_DIETARY_OPTIONS]

    # Validate parking
    raw_parking = data.get("parking") or []
    if isinstance(raw_parking, str):
        raw_parking = [raw_parking]
    data["parking"] = [p for p in raw_parking if p in VALID_PARKING]

    # Validate menu_highlights
    raw_menu = data.get("menu_highlights") or []
    validated_menu = []
    for item in raw_menu[:5]:  # Cap at 5
        if isinstance(item, dict) and item.get("name"):
            _valid_cats = {"appetizer", "entree", "cocktail", "dessert", "beer", "wine"}
            cat = item.get("category")
            validated_menu.append(
                {
                    "name": str(item["name"])[:80],
                    "price": str(item["price"])[:20] if item.get("price") else None,
                    "category": cat if cat in _valid_cats else None,
                }
            )
    data["menu_highlights"] = validated_menu or None

    # Validate payment_notes
    pn = data.get("payment_notes")
    if pn and len(pn) > 200:
        data["payment_notes"] = pn[:200]

    # Chain detection fallback: name-based check
    if data.get("is_chain") is None:
        venue_lower = venue.get("name", "").lower()
        if any(chain in venue_lower for chain in CHAIN_NAMES):
            data["is_chain"] = True

    return data


def scrape_venue(
    venue: dict, use_playwright: bool = True, include_social_bios: bool = False
) -> Optional[dict]:
    """Scrape a single venue's website and extract structured data."""
    result = fetch_venue_content(
        venue, use_playwright=use_playwright, include_social_bios=include_social_bios
    )
    if not result:
        return None
    combined, meta = result

    data = None
    extraction_mode = "llm"

    # LLM extraction
    cfg = get_config()
    primary_provider = (cfg.llm.provider or "").strip() or None
    provider_attempts: list[tuple[Optional[str], Optional[str]]] = [
        (primary_provider, None),
    ]
    if cfg.llm.openai_api_key and primary_provider != "openai":
        provider_attempts.append(("openai", cfg.llm.openai_model))
    if cfg.llm.anthropic_api_key and primary_provider != "anthropic":
        provider_attempts.append(("anthropic", cfg.llm.model))

    for provider_override, model_override in provider_attempts:
        try:
            raw = generate_text(
                EXTRACTION_PROMPT,
                combined,
                provider_override=provider_override,
                model_override=model_override,
            )

            # Strip markdown code fences if present
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

            data = json.loads(raw)
            provider_label = provider_override or primary_provider or "auto"
            logger.info(f"  LLM extraction provider: {provider_label}")
            break
        except (json.JSONDecodeError, Exception) as e:
            provider_label = provider_override or primary_provider or "auto"
            logger.info(f"  LLM extraction failed via {provider_label}: {e}")

    if data is None:
        data = _fallback_extract_data(combined)
        extraction_mode = "heuristic"

    if extraction_mode == "heuristic":
        logger.info(
            f"  Fallback extraction: {len(data.get('specials', []))} specials"
            + (" + hours" if data.get("hours") else "")
        )
    else:
        data, supplemented = _supplement_with_fallback(data, combined)
        if supplemented:
            logger.info(f"  Heuristic supplementation added: {', '.join(supplemented)}")

    data = merge_meta_and_validate(data, meta, venue)

    # --- Social bio enrichment (fill gaps from IG and FB bios) ---
    if include_social_bios:
        # Instagram bio
        ig_handle = data.get("instagram") or venue.get("instagram")
        if ig_handle:
            logger.debug(f"  Fetching IG bio for @{ig_handle}")
            ig_bio = fetch_instagram_bio(ig_handle)
            if ig_bio:
                _merge_social_bio(data, ig_bio, venue)
                bio_fields = [k for k, v in ig_bio.items() if v]
                if bio_fields:
                    logger.info(f"  IG bio: {', '.join(bio_fields)}")

        # Facebook bio — reuse pre-fetched HTML from earlier (no double-fetch)
        fb_url = data.get("facebook_url") or venue.get("facebook_url")
        if fb_url:
            pre_fetched_html = meta.get("_fb_about_html")
            fb_bio = fetch_facebook_bio(fb_url, html=pre_fetched_html)
            if fb_bio:
                _merge_social_bio(data, fb_bio, venue)
                bio_fields = [k for k, v in fb_bio.items() if v]
                if bio_fields:
                    logger.info(f"  FB bio: {', '.join(bio_fields)}")

    return data


def upsert_results(
    venue: dict,
    data: dict,
    dry_run: bool = False,
    skip_specials: bool = False,
    force_update: bool = False,
) -> dict:
    """Write extracted data to the database."""
    client = get_client()
    venue_id = venue["id"]
    now = datetime.utcnow().isoformat()
    stats = {
        "specials_added": 0,
        "holiday_hours_added": 0,
        "holiday_specials_added": 0,
        "raw_extracted": 0,
        "venue_updated": False,
    }

    def should_set(field_name: str, data_key: str = None) -> bool:
        """Return True if we should write this field (has data + empty or forced)."""
        dk = data_key or field_name
        if not data.get(dk):
            return False
        return force_update or not venue.get(field_name)

    # --- Update venue columns ---
    updates = {"last_verified_at": now}

    if data.get("hours"):
        hours_source = data.get("_hours_source", "website")
        current_source = venue.get("hours_source")
        if should_update_hours(current_source, hours_source):
            hours_json, hours_display = prepare_hours_update(
                data["hours"],
                source=hours_source,
                venue_type=venue.get("place_type") or venue.get("place_type"),
            )
            if hours_json:
                updates["hours"] = hours_json
                if hours_display:
                    updates["hours_display"] = hours_display
                updates["hours_source"] = hours_source
                updates["hours_updated_at"] = now

    if should_set("menu_url"):
        updates["menu_url"] = data["menu_url"]

    if should_set("reservation_url"):
        updates["reservation_url"] = data["reservation_url"]

    # Description: overwrite if new is substantially better (longer + LLM-written vs junk meta tag)
    new_desc = data.get("description")
    if new_desc:
        existing_desc = venue.get("description") or ""
        if (
            force_update
            or not existing_desc
            or (len(new_desc) > len(existing_desc) * 1.5 and len(new_desc) > 80)
        ):
            updates["description"] = new_desc

    if should_set("image_url", "og_image"):
        updates["image_url"] = data["og_image"]

    if should_set("phone"):
        updates["phone"] = data["phone"]

    if should_set("instagram"):
        updates["instagram"] = data["instagram"]

    if should_set("facebook_url"):
        updates["facebook_url"] = data["facebook_url"]

    if data.get("price_level") and (force_update or not venue.get("price_level")):
        updates["price_level"] = data["price_level"]

    # Vibes: merge new vibes with existing ones (never remove)
    new_vibes = data.get("vibes") or []
    if new_vibes:
        existing_vibes = venue.get("vibes") or []
        merged = list(set(existing_vibes) | set(new_vibes))
        if force_update or set(merged) != set(existing_vibes):
            updates["vibes"] = sorted(merged)

    # Cuisine: merge new with existing (never remove)
    new_cuisine = data.get("cuisine") or []
    if new_cuisine:
        existing_cuisine = venue.get("cuisine") or []
        merged_cuisine = list(dict.fromkeys(existing_cuisine + new_cuisine))
        if force_update or set(merged_cuisine) != set(existing_cuisine):
            updates["cuisine"] = merged_cuisine

    # Service style: fill if empty
    if data.get("service_style") and (force_update or not venue.get("service_style")):
        updates["service_style"] = data["service_style"]

    # Short description
    if should_set("short_description"):
        updates["short_description"] = data["short_description"]

    # Genres: merge like vibes (union, never remove)
    new_genres = data.get("genres") or []
    if new_genres:
        existing_genres = venue.get("genres") or []
        merged_genres = list(set(existing_genres) | set(new_genres))
        if force_update or set(merged_genres) != set(existing_genres):
            updates["genres"] = sorted(merged_genres)

    # Boolean fields: fill if empty
    if data.get("accepts_reservations") is not None and (
        force_update or venue.get("accepts_reservations") is None
    ):
        updates["accepts_reservations"] = data["accepts_reservations"]

    if data.get("is_event_venue") is not None and (
        force_update or venue.get("is_event_venue") is None
    ):
        updates["is_event_venue"] = data["is_event_venue"]

    if data.get("is_chain") is not None and (
        force_update or venue.get("is_chain") is None
    ):
        updates["is_chain"] = data["is_chain"]

    # Dietary options: merge (union)
    new_dietary = data.get("dietary_options") or []
    if new_dietary:
        existing_dietary = venue.get("dietary_options") or []
        merged_dietary = list(set(existing_dietary) | set(new_dietary))
        if force_update or set(merged_dietary) != set(existing_dietary):
            updates["dietary_options"] = sorted(merged_dietary)

    # Parking: merge (union)
    new_parking = data.get("parking") or []
    if new_parking:
        existing_parking = venue.get("parking") or []
        merged_parking = list(set(existing_parking) | set(new_parking))
        if force_update or set(merged_parking) != set(existing_parking):
            updates["parking"] = sorted(merged_parking)

    # Menu highlights: replace (LLM extraction is holistic, not incremental)
    if data.get("menu_highlights") and (
        force_update or not venue.get("menu_highlights")
    ):
        updates["menu_highlights"] = json.dumps(data["menu_highlights"])

    # Payment notes
    if data.get("payment_notes") and (force_update or not venue.get("payment_notes")):
        updates["payment_notes"] = data["payment_notes"]

    if len(updates) > 1:  # More than just last_verified_at
        stats["venue_updated"] = True

    if not dry_run:
        client.table("places").update(updates).eq("id", venue_id).execute()

    # --- Upsert specials ---
    if not skip_specials:
        raw_specials = data.get("specials", [])
        specials = validate_specials(raw_specials)

        if specials:
            logger.info(
                f"  Specials: {len(raw_specials)} extracted → {len(specials)} validated"
            )
        elif raw_specials:
            logger.info(
                f"  Specials: {len(raw_specials)} extracted → 0 validated (all filtered)"
            )

        if not dry_run and specials:
            # Delete existing recurring specials for this venue (start_date IS NULL)
            client.table("place_specials").delete().eq("place_id", venue_id).is_(
                "start_date", "null"
            ).execute()

        for special in specials:
            # Days are already parsed as ints by validate_specials
            days = special.get("days") or None
            if special.get("_days_already_parsed"):
                pass  # days are already ISO ints
            else:
                days = parse_days(days) if days else None

            row = {
                "place_id": venue_id,
                "title": special["title"],
                "type": special.get("type", "daily_special"),
                "description": special.get("description"),
                "days_of_week": days if days else None,
                "time_start": special.get("time_start"),
                "time_end": special.get("time_end"),
                "price_note": special.get("price_note"),
                "confidence": "medium",
                "source_url": venue.get("website"),
                "last_verified_at": now,
                "is_active": True,
            }

            if not dry_run:
                client.table("place_specials").insert(row).execute()

            stats["specials_added"] += 1

        # --- Route event-like items to events table ---
        event_items = extract_event_items(raw_specials)
        if event_items:
            n_events = upsert_event_items(venue, event_items, dry_run=dry_run)
            stats["events_routed"] = n_events
            if n_events:
                logger.info(
                    f"  Events routed: {len(event_items)} items → {n_events} event instances"
                )

    return stats


def get_venues(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 2.0,
    venue_ids: Optional[list[int]] = None,
    venue_type: Optional[str] = None,
    limit: int = 200,
) -> list[dict]:
    """Fetch venues to scrape from the database."""
    client = get_client()

    query = (
        client.table("places")
        .select(
            "id, name, slug, website, place_type, description, short_description, "
            "image_url, lat, lng, hours, menu_url, reservation_url, instagram, "
            "facebook_url, phone, price_level, vibes, cuisine, service_style, "
            "genres, accepts_reservations, is_event_venue, is_chain, "
            "dietary_options, parking, menu_highlights, payment_notes, "
            "last_verified_at, hours_source"
        )
        .neq("is_active", False)
        .not_.is_("website", "null")
    )

    if venue_ids:
        query = query.in_("id", venue_ids)
    elif venue_type:
        query = query.eq("place_type", venue_type)

    result = query.order("name").limit(5000).execute()
    venues = result.data or []

    # Filter by distance if lat/lng provided
    if lat is not None and lng is not None:
        venues = [
            v
            for v in venues
            if v.get("lat")
            and v.get("lng")
            and haversine_km(lat, lng, float(v["lat"]), float(v["lng"])) <= radius_km
        ]

    # Sort by distance from center if available
    if lat is not None and lng is not None:
        venues.sort(
            key=lambda v: haversine_km(lat, lng, float(v["lat"]), float(v["lng"]))
        )

    return venues[:limit]


def main():
    parser = argparse.ArgumentParser(
        description="Scrape venue websites — extract specials, hours, phone, instagram, vibes, and more"
    )
    parser.add_argument("--lat", type=float, help="Center latitude for corridor search")
    parser.add_argument(
        "--lng", type=float, help="Center longitude for corridor search"
    )
    parser.add_argument(
        "--radius", type=float, default=2.0, help="Radius in km (default: 2)"
    )
    parser.add_argument("--venue-ids", type=str, help="Comma-separated venue IDs")
    parser.add_argument(
        "--venue-type", type=str, help="Filter by venue type (bar, restaurant, etc.)"
    )
    parser.add_argument("--limit", type=int, default=200, help="Max venues to process")
    parser.add_argument(
        "--dry-run", action="store_true", help="Don't write to database"
    )
    parser.add_argument(
        "--verbose", action="store_true", help="Show LLM extraction details"
    )
    parser.add_argument(
        "--skip-specials",
        action="store_true",
        help="Skip venue_specials writes (venue enrichment only)",
    )
    parser.add_argument(
        "--force-update",
        action="store_true",
        help="Overwrite existing data (default: only fill empty fields)",
    )
    parser.add_argument(
        "--no-playwright",
        action="store_true",
        help="Disable Playwright fallback for bot-protected sites",
    )
    parser.add_argument(
        "--include-social-bios",
        action="store_true",
        help="Also fetch IG/FB bios to fill gaps in phone, hours, description, links",
    )
    parser.add_argument(
        "--max-age-days",
        type=int,
        default=14,
        help="Skip venues verified within this many days (default: 14)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Ignore freshness check — re-scrape all venues",
    )
    parser.add_argument(
        "--dump",
        type=str,
        metavar="DIR",
        help="Dump mode: fetch venue content and save to DIR for offline LLM extraction (e.g., via Claude Code)",
    )
    parser.add_argument(
        "--import-dir",
        type=str,
        metavar="DIR",
        help="Import mode: read pre-extracted JSON results from DIR and run validation + upsert",
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # --- IMPORT MODE: read pre-extracted results, validate, upsert ---
    if args.import_dir:
        import_dir = Path(args.import_dir)
        if not import_dir.is_dir():
            logger.error(f"Import directory not found: {import_dir}")
            sys.exit(1)

        result_files = sorted(import_dir.glob("*.json"))
        if not result_files:
            logger.error(f"No .json files found in {import_dir}")
            sys.exit(1)

        logger.info(f"Importing {len(result_files)} venue results from {import_dir}")
        if args.dry_run:
            logger.info("DRY RUN — no database writes")
        if args.force_update:
            logger.info("FORCE UPDATE — overwriting existing data")
        logger.info("=" * 60)

        # Build venue lookup by ID
        all_venue_ids = []
        for f in result_files:
            try:
                payload = json.loads(f.read_text())
                all_venue_ids.append(payload["venue_id"])
            except (json.JSONDecodeError, KeyError):
                continue

        venues_list = get_venues(venue_ids=all_venue_ids, limit=len(all_venue_ids) + 10)
        venue_lookup = {v["id"]: v for v in venues_list}

        totals = {"imported": 0, "venues_updated": 0, "specials": 0, "failed": 0}

        for f in result_files:
            try:
                payload = json.loads(f.read_text())
                venue_id = payload["venue_id"]
                extracted = payload["extracted"]
                meta = payload.get("meta", {})
            except (json.JSONDecodeError, KeyError) as e:
                logger.info(f"  Skipping {f.name}: {e}")
                totals["failed"] += 1
                continue

            venue = venue_lookup.get(venue_id)
            if not venue:
                logger.info(f"  Skipping {f.name}: venue {venue_id} not found in DB")
                totals["failed"] += 1
                continue

            name = venue["name"][:45]
            logger.info(f"  Importing {name} ({f.name})")

            data = merge_meta_and_validate(extracted, meta, venue)

            stats = upsert_results(
                venue,
                data,
                dry_run=args.dry_run,
                skip_specials=args.skip_specials,
                force_update=args.force_update,
            )
            totals["imported"] += 1
            totals["specials"] += stats["specials_added"]
            if stats["venue_updated"]:
                totals["venues_updated"] += 1

        logger.info("=" * 60)
        logger.info(f"Done! Imported {totals['imported']} venues")
        logger.info(f"  Venues updated: {totals['venues_updated']}")
        logger.info(f"  Specials: {totals['specials']}")
        logger.info(f"  Failed: {totals['failed']}")
        return

    # Parse venue IDs
    venue_ids = None
    if args.venue_ids:
        venue_ids = [int(x.strip()) for x in args.venue_ids.split(",") if x.strip()]

    venues = get_venues(
        lat=args.lat,
        lng=args.lng,
        radius_km=args.radius,
        venue_ids=venue_ids,
        venue_type=args.venue_type,
        limit=args.limit,
    )

    use_playwright = not args.no_playwright

    # --- DUMP MODE: fetch content, save to files, exit ---
    if args.dump:
        dump_dir = Path(args.dump)
        dump_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"DUMP MODE — saving venue content to {dump_dir}")
        logger.info(f"Found {len(venues)} venues to fetch")
        logger.info("=" * 60)

        dumped = 0
        failed = 0
        try:
            for i, venue in enumerate(venues, 1):
                name = venue["name"][:45]
                logger.info(f"[{i}/{len(venues)}] {name}")

                result = fetch_venue_content(
                    venue,
                    use_playwright=use_playwright,
                    include_social_bios=args.include_social_bios,
                )
                if not result:
                    logger.info("  Failed to fetch")
                    failed += 1
                    continue

                combined, meta = result
                # Strip non-serializable keys from meta
                serializable_meta = {
                    k: v for k, v in meta.items() if not k.startswith("_")
                }

                slug = venue.get("slug") or f"venue-{venue['id']}"
                dump_file = dump_dir / f"{slug}.json"
                dump_file.write_text(
                    json.dumps(
                        {
                            "place_id": venue["id"],
                            "venue_slug": slug,
                            "venue_name": venue["name"],
                            "website": venue.get("website"),
                            "combined_text": combined,
                            "meta": serializable_meta,
                        },
                        indent=2,
                        ensure_ascii=False,
                    )
                )

                logger.info(f"  Saved {len(combined)} chars → {dump_file.name}")
                dumped += 1

                time.sleep(1)
        finally:
            _close_browser()

        logger.info("=" * 60)
        logger.info(f"Done! Dumped {dumped} venues, {failed} failed")
        logger.info(
            f"Next: process files in {dump_dir}/ with Claude Code, then import with --import-dir"
        )
        return

    logger.info(f"Found {len(venues)} venues to scrape")
    if args.dry_run:
        logger.info("DRY RUN — no database writes")
    if args.skip_specials:
        logger.info("SKIP SPECIALS — venue enrichment only")
    if args.force_update:
        logger.info("FORCE UPDATE — overwriting existing data")
    if not use_playwright:
        logger.info("PLAYWRIGHT DISABLED — no browser fallback for 403s")
    if args.include_social_bios:
        logger.info("SOCIAL BIOS — enriching from Instagram and Facebook bios")
    logger.info("=" * 60)

    totals = {
        "scraped": 0,
        "specials": 0,
        "holiday_hours": 0,
        "holiday_specials": 0,
        "venues_updated": 0,
        "failed": 0,
        "skipped": 0,
        "playwright_fallbacks": 0,
    }

    try:
        for i, venue in enumerate(venues, 1):
            name = venue["name"][:45]
            dist_str = ""
            if args.lat and args.lng and venue.get("lat") and venue.get("lng"):
                dist = haversine_km(
                    args.lat, args.lng, float(venue["lat"]), float(venue["lng"])
                )
                dist_str = f" ({dist:.1f}km)"

            logger.info(f"[{i}/{len(venues)}] {name}{dist_str}")

            # Freshness skip — don't re-scrape recently verified venues
            if not args.force and venue.get("last_verified_at"):
                try:
                    verified = datetime.fromisoformat(
                        venue["last_verified_at"].replace("Z", "+00:00")
                    )
                    age_days = (datetime.now(timezone.utc) - verified).days
                    if age_days < args.max_age_days:
                        logger.info(f"  Skipping (verified {age_days}d ago)")
                        totals["skipped"] += 1
                        continue
                except (ValueError, TypeError):
                    pass  # If parsing fails, proceed with scrape

            data = scrape_venue(
                venue,
                use_playwright=use_playwright,
                include_social_bios=args.include_social_bios,
            )
            if not data:
                totals["failed"] += 1
                continue

            n_specials = len(data.get("specials", []))
            n_hol_hours = len(data.get("holiday_hours", []))
            n_hol_specials = len(data.get("holiday_specials", []))
            has_hours = bool(data.get("hours"))
            has_menu = bool(data.get("menu_url"))
            has_resy = bool(data.get("reservation_url"))
            has_phone = bool(data.get("phone"))
            has_ig = bool(data.get("instagram"))
            has_fb = bool(data.get("facebook_url"))
            has_price = bool(data.get("price_level"))
            n_vibes = len(data.get("vibes", []))

            details = []
            if n_specials:
                details.append(f"{n_specials} specials")
            if n_hol_hours:
                details.append(f"{n_hol_hours} holiday hours")
            if n_hol_specials:
                details.append(f"{n_hol_specials} holiday specials")
            if has_hours:
                details.append("hours")
            if has_menu:
                details.append("menu")
            if has_resy:
                details.append("reservations")
            if has_phone:
                details.append(f"phone:{data['phone']}")
            if has_ig:
                details.append(f"ig:@{data['instagram']}")
            if has_fb:
                details.append("facebook")
            if has_price:
                details.append(f"${'$' * data['price_level']}")
            if n_vibes:
                details.append(f"{n_vibes} vibes")

            if details:
                logger.info(f"  Found: {', '.join(details)}")
            else:
                logger.info("  No data extracted")
                totals["skipped"] += 1
                continue

            stats = upsert_results(
                venue,
                data,
                dry_run=args.dry_run,
                skip_specials=args.skip_specials,
                force_update=args.force_update,
            )
            totals["scraped"] += 1
            totals["specials"] += stats["specials_added"]
            totals["holiday_hours"] += stats["holiday_hours_added"]
            totals["holiday_specials"] += stats["holiday_specials_added"]
            if stats["venue_updated"]:
                totals["venues_updated"] += 1

            # Be polite — 1 second between requests
            time.sleep(1)
    finally:
        _close_browser()

    totals["playwright_fallbacks"] = _playwright_fallback_count

    logger.info("=" * 60)
    logger.info(f"Done! Scraped {totals['scraped']} venues")
    logger.info(f"  Specials found: {totals['specials']}")
    logger.info(f"  Holiday hours: {totals['holiday_hours']}")
    logger.info(f"  Holiday specials: {totals['holiday_specials']}")
    logger.info(f"  Venues updated: {totals['venues_updated']}")
    logger.info(f"  Playwright fallbacks: {totals['playwright_fallbacks']}")
    logger.info(f"  Failed/unreachable: {totals['failed']}")
    logger.info(f"  No data extracted: {totals['skipped']}")


if __name__ == "__main__":
    main()
