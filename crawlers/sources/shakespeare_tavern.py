"""
Crawler for Atlanta Shakespeare Company at Shakespeare Tavern Playhouse.

The site runs on Umbraco CMS and exposes a content API at:
    /api/content?path=<path>

This API is Cloudflare-protected (403 on direct HTTP), so we use Playwright to
navigate the page and intercept the API response in the browser session.

Content captured:
  - Main stage productions (multi-week runs, opening night as start_date)
  - Special / one-night ASC events (cabaret, improv, guest companies)
  - Summer camps: Shakespeare Superheroes, Musical Theatre, Stage Combat, Improv
    (all Rising 2nd–8th grade, week-long, ~$375)
  - Summer camps: Shakespeare Intensive for Teens (SIT), 4-week audition-based
    program for rising 9th grade through college freshmen (~$995)

Data source hierarchy:
  1. /api/content?path=/on-stage/ → structured productions JSON (main/guest shows)
  2. /education/superheroes/ page text → week-by-week camp schedule (text parsing)
  3. /education/sit/ page text → SIT session + performance dates (text parsing)
"""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from html import unescape
from typing import Any, Optional

from playwright.sync_api import sync_playwright

from db import (
    find_event_by_hash,
    get_or_create_place,
    insert_event,
    smart_update_existing_event,
)
from dedupe import generate_content_hash

logger = logging.getLogger(__name__)

BASE_URL = "https://www.shakespearetavern.com"
ON_STAGE_URL = f"{BASE_URL}/on-stage/"
SUMMER_CAMP_URL = f"{BASE_URL}/education/superheroes/"
SIT_URL = f"{BASE_URL}/education/sit/"

PLACE_DATA = {
    "name": "Shakespeare Tavern Playhouse",
    "slug": "shakespeare-tavern",
    "address": "499 Peachtree St NE",
    "neighborhood": "Midtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "place_type": "theater",
    "website": BASE_URL,
    "lat": 33.7795,
    "lng": -84.3844,
}

# Tags applied to every event from this source
BASE_TAGS = ["theater", "shakespeare", "performing-arts"]

# ─── keyword matchers ────────────────────────────────────────────────────────
_CABARET_RE = re.compile(r"\bcabaret\b", re.IGNORECASE)
_IMPROV_RE = re.compile(r"\bimprov\b|\bout\s+of\s+a\s+hat\b", re.IGNORECASE)
_CAMP_RE = re.compile(
    r"\bcamp\b|\bsuperheroes\b|\bstage\s+combat\b|\bmusical\s+theatre\b",
    re.IGNORECASE,
)
_SIT_RE = re.compile(r"\bshakespeare\s+intensive\b|\bSIT\b")
_FAMILY_RE = re.compile(r"\bfamily\b|\bkids?\b|\bchildren\b|\bpre-k\b", re.IGNORECASE)
_DUNGEON_RE = re.compile(r"\bdungeons\b", re.IGNORECASE)

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
}


# ─── helpers ─────────────────────────────────────────────────────────────────


def _strip_html(text: str) -> str:
    if not text:
        return ""
    text = unescape(text)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _parse_iso_dt(value: str) -> tuple[Optional[str], Optional[str]]:
    """Parse ISO 8601 datetime → (YYYY-MM-DD, HH:MM).

    The Umbraco CMS stores local Eastern time values with a trailing Z
    (i.e. the Z suffix is a CMS artifact, not a true UTC offset).
    Example: "2026-03-29T19:30:00Z" means 7:30 PM ET, not 2:30 PM ET.
    We strip the Z and parse as naive local time so 19:30 → "19:30".
    """
    if not value:
        return None, None
    raw = value.strip().rstrip("Z")
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            dt = datetime.strptime(raw, fmt)
            return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
        except ValueError:
            continue
    return None, None


def _best_image(production: dict[str, Any]) -> Optional[str]:
    for key in ("featureImage", "thumbImage"):
        img = production.get(key)
        if img and isinstance(img, dict):
            src = img.get("src", "")
            if src:
                return f"{BASE_URL}{src}" if src.startswith("/") else src
    return None


def _determine_category(title: str, description: str) -> tuple[str, list[str]]:
    combined = f"{title} {description}"
    tags = list(BASE_TAGS)

    if _SIT_RE.search(combined):
        tags += ["educational", "teen", "all-ages"]
        return "learning", tags
    if _CAMP_RE.search(combined):
        tags += ["educational", "kids", "family-friendly", "all-ages"]
        return "family", tags
    if _CABARET_RE.search(combined):
        tags += ["cabaret", "adults"]
        return "theater", tags
    if _IMPROV_RE.search(combined):
        tags.append("improv")
        return "theater", tags
    if _DUNGEON_RE.search(combined):
        tags += ["games", "improv"]
        return "theater", tags
    if _FAMILY_RE.search(combined):
        tags += ["family-friendly", "all-ages"]
        return "theater", tags

    return "theater", tags


def _is_past(date_str: str) -> bool:
    return date_str < datetime.now().strftime("%Y-%m-%d")


# ─── on-stage API ─────────────────────────────────────────────────────────────


def _collect_productions(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Walk the Umbraco API payload and collect all `onStageFeature` productions."""
    productions: list[dict[str, Any]] = []
    try:
        rows = data["properties"]["bodyGrid"]["sections"][0]["rows"]
    except (KeyError, IndexError, TypeError):
        return productions
    for row in rows:
        for area in row.get("areas", []):
            for control in area.get("controls", []):
                if control.get("alias") == "onStageFeature":
                    val = control.get("value") or {}
                    for prod in val.get("productions") or []:
                        if isinstance(prod, dict):
                            productions.append(prod)
    return productions


def _fetch_api_response(page, url: str) -> Optional[dict[str, Any]]:
    """Navigate to `url` in the Playwright page and capture the /api/content response."""
    captured: list[bytes] = []

    def _on_response(response):
        if "api/content" in response.url and response.status == 200:
            try:
                captured.append(response.body())
            except Exception:
                pass

    page.on("response", _on_response)
    try:
        page.goto(url, wait_until="networkidle", timeout=45000)
    except Exception as exc:
        logger.warning(
            f"Shakespeare Tavern: goto({url}) error (partial capture ok): {exc}"
        )
    page.wait_for_timeout(2000)
    page.remove_listener("response", _on_response)

    if not captured:
        return None
    try:
        return json.loads(captured[-1])
    except Exception as exc:
        logger.warning(
            f"Shakespeare Tavern: could not parse API response from {url}: {exc}"
        )
        return None


def _fetch_page_text_fresh(url: str) -> Optional[str]:
    """Open a fresh Playwright browser session targeted at `url` and return inner text.

    Education pages have stricter Cloudflare rules than the main site. We open a
    fresh context (no shared state) and let Cloudflare resolve the challenge before
    we scrape the text.  Returns None on failure.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
        )
        page = context.new_page()
        try:
            page.goto(url, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(4000)
            text = page.inner_text("body")
            # If Cloudflare challenge page, return None
            if (
                "Performing security verification" in text
                or "Enable JavaScript and cookies" in text
            ):
                logger.warning(f"Shakespeare Tavern: Cloudflare blocked {url}")
                return None
            return text
        except Exception as exc:
            logger.warning(f"Shakespeare Tavern: fresh fetch of {url} failed: {exc}")
            return None
        finally:
            browser.close()


# ─── camp page parsing ────────────────────────────────────────────────────────


def _parse_camp_sessions(text: str) -> list[dict[str, Any]]:
    """Parse week-by-week Shakespeare Superheroes camp schedule from page text.

    Each session block looks like:
        Shakespeare Superheroes
        Rising 2nd-5th Grades:
        June 1st - 5th: A Midsummer Night's Dream

        Musical Theatre Camp
        Rising 2nd-8th Grades:
        July 6th - 10th: Twelfth Night: The Musical!
    """
    sessions: list[dict[str, Any]] = []
    current_year = datetime.now().year
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

    section_re = re.compile(
        r"^(shakespeare\s+superheroes|musical\s+theatre\s+camp|stage\s+combat\s+camp"
        r"|improv\s+camp)",
        re.IGNORECASE,
    )
    grade_re = re.compile(r"rising\s+\w[\w\s-]*(?:grade[s]?|freshmen)", re.IGNORECASE)
    date_range_re = re.compile(
        r"(january|february|march|april|may|june|july|august|september|october|november|december)"
        r"\s+(\d{1,2})(?:st|nd|rd|th)?"
        r"\s*[-–]\s*"
        r"(?:(january|february|march|april|may|june|july|august|september|october|november|december)"
        r"\s+)?(\d{1,2})(?:st|nd|rd|th)?",
        re.IGNORECASE,
    )

    current_section = ""
    current_grade = ""

    for i, line in enumerate(lines):
        if section_re.match(line):
            current_section = line.strip()
            current_grade = ""
            continue

        if grade_re.search(line) and current_section:
            current_grade = line.strip()
            continue

        if current_section:
            m = date_range_re.search(line)
            if m:
                start_mon = _MONTH_MAP.get(m.group(1).lower(), 0)
                start_day = int(m.group(2))
                end_mon = _MONTH_MAP.get((m.group(3) or m.group(1)).lower(), 0)
                end_day = int(m.group(4))
                if not start_mon or not end_mon:
                    continue

                start_date = f"{current_year}-{start_mon:02d}-{start_day:02d}"
                end_date = f"{current_year}-{end_mon:02d}-{end_day:02d}"

                # Optional theme/play after a colon
                colon = line.find(":")
                theme = ""
                if colon != -1:
                    rest = line[colon + 1 :].strip()
                    if rest and not re.match(r"^\d{1,2}:\d{2}", rest):
                        theme = rest

                title = f"{current_section}: {theme}" if theme else current_section
                grade_info = current_grade

                desc_parts = ["Summer theater camp at the Atlanta Shakespeare Academy."]
                if grade_info:
                    desc_parts.append(f"Open to {grade_info}.")
                desc_parts.append(
                    "Camps meet 9:00 AM–3:00 PM daily at 497 Peachtree St NE, Atlanta, GA 30308."
                )
                desc_parts.append("Tuition: $375 for a 5-day session.")

                sessions.append(
                    {
                        "title": title,
                        "start_date": start_date,
                        "end_date": end_date,
                        "start_time": "09:00",
                        "description": " ".join(desc_parts),
                        "grade_range": grade_info,
                        "source_url": SUMMER_CAMP_URL,
                        "price_min": 375.0,
                        "price_note": "5-day camp tuition; early bird discount available",
                    }
                )

    return sessions


def _parse_sit_sessions(text: str) -> list[dict[str, Any]]:
    """Parse SIT session class-weeks and performance dates from page text.

    Block structure:
        Session 1:
        Class: Monday, June 1st - Friday, June 26th (M-F, 9:00am - 4:00pm)
        Performance #1: Sunday, June 28th
        Performance #2: Monday, June 29th
    """
    sessions: list[dict[str, Any]] = []
    current_year = datetime.now().year
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]

    session_hdr_re = re.compile(r"^Session\s+(\d+)\s*:", re.IGNORECASE)
    class_re = re.compile(
        r"Class:\s+\w+,?\s+"
        r"(january|february|march|april|may|june|july|august|september|october|november|december)"
        r"\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–]\s*"
        r"(?:\w+,?\s+)?"
        r"(january|february|march|april|may|june|july|august|september|october|november|december)?"
        r"\s*(\d{1,2})(?:st|nd|rd|th)?",
        re.IGNORECASE,
    )
    perf_re = re.compile(
        r"Performance\s+#?(\d+):\s+\w+,?\s+"
        r"(january|february|march|april|may|june|july|august|september|october|november|december)"
        r"\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*@\s*(\d{1,2}:\d{2})\s*(am|pm))?",
        re.IGNORECASE,
    )

    current_session = None
    current_class_end = None

    for line in lines:
        m_hdr = session_hdr_re.match(line)
        if m_hdr:
            current_session = int(m_hdr.group(1))
            current_class_end = None
            continue

        if current_session is None:
            continue

        m_class = class_re.search(line)
        if m_class:
            s_mon = _MONTH_MAP.get(m_class.group(1).lower(), 0)
            s_day = int(m_class.group(2))
            e_mon_str = m_class.group(3)
            e_mon = _MONTH_MAP.get(e_mon_str.lower(), s_mon) if e_mon_str else s_mon
            e_day = int(m_class.group(4))
            start_date = f"{current_year}-{s_mon:02d}-{s_day:02d}"
            current_class_end = f"{current_year}-{e_mon:02d}-{e_day:02d}"

            sessions.append(
                {
                    "title": f"Shakespeare Intensive for Teens (SIT) – Session {current_session}",
                    "start_date": start_date,
                    "end_date": current_class_end,
                    "start_time": "09:00",
                    "description": (
                        f"Four-week professional Shakespeare training for teens "
                        f"(rising 9th grade–college freshmen), Session {current_session}. "
                        "Instruction in text work, voice, movement, stage combat, and madrigal; "
                        "culminates in two public performances of a full-length play. "
                        "Location: Shakespeare Tavern Playhouse, 499 Peachtree St NE, Atlanta, GA 30308. "
                        "Tuition: $995. Financial aid available."
                    ),
                    "grade_range": "Rising 9th grade through college freshmen",
                    "source_url": SIT_URL,
                    "price_min": 995.0,
                    "price_note": "4-week intensive tuition; financial aid available",
                }
            )
            continue

        m_perf = perf_re.search(line)
        if m_perf and current_class_end:
            p_num = int(m_perf.group(1))
            p_mon = _MONTH_MAP.get(m_perf.group(2).lower(), 0)
            p_day = int(m_perf.group(3))
            if not p_mon:
                continue
            perf_date = f"{current_year}-{p_mon:02d}-{p_day:02d}"

            time_str = "19:30"  # ASC default show time
            if m_perf.group(4):
                h, mn = map(int, m_perf.group(4).split(":"))
                period = (m_perf.group(5) or "pm").lower()
                if period == "pm" and h != 12:
                    h += 12
                elif period == "am" and h == 12:
                    h = 0
                time_str = f"{h:02d}:{mn:02d}"

            sessions.append(
                {
                    "title": (
                        f"Shakespeare Intensive for Teens (SIT) – "
                        f"Session {current_session} Performance {p_num}"
                    ),
                    "start_date": perf_date,
                    "end_date": None,
                    "start_time": time_str,
                    "description": (
                        f"Public performance by SIT Session {current_session} students. "
                        "The Shakespeare Intensive for Teens is a four-week professional training "
                        "program for rising 9th graders through college freshmen. "
                        "Location: Shakespeare Tavern Playhouse, 499 Peachtree St NE, Atlanta, GA 30308."
                    ),
                    "grade_range": "Rising 9th grade through college freshmen",
                    "source_url": SIT_URL,
                    "price_min": None,
                    "price_note": "Performance tickets — check site for pricing",
                }
            )

    return sessions


# ─── DB upsert helpers ────────────────────────────────────────────────────────


def _upsert_production(
    *,
    production: dict[str, Any],
    source_id: int,
    venue_id: int,
) -> tuple[bool, bool]:
    """Upsert a main-stage or guest production. Returns (found, new)."""
    title = (production.get("title") or "").strip()
    if not title:
        return False, False

    start_date, start_time = _parse_iso_dt(production.get("startDate") or "")
    end_date, _ = _parse_iso_dt(production.get("endDate") or "")
    if not start_date:
        return False, False

    # Skip productions that have fully closed (end_date in the past)
    if end_date and _is_past(end_date):
        return False, False
    # Skip single-night past events
    if not end_date and _is_past(start_date):
        return False, False

    raw_desc = _strip_html(production.get("description") or "")
    category, tags = _determine_category(title, raw_desc)

    prod_url = production.get("url") or ""
    source_url = (
        f"{BASE_URL}{prod_url}"
        if prod_url.startswith("/")
        else (prod_url or ON_STAGE_URL)
    )

    prod_number = production.get("prodNumber")
    ticket_url = f"{BASE_URL}/tickets/?mos={prod_number}" if prod_number else source_url

    desc_parts: list[str] = []
    if raw_desc:
        desc_parts.append(raw_desc if raw_desc.endswith(".") else raw_desc + ".")
    desc_parts.append(
        "Performed at Shakespeare Tavern Playhouse, 499 Peachtree St NE, Atlanta, GA 30308."
    )
    if end_date and end_date != start_date:
        desc_parts.append(f"This production runs through {end_date}.")

    content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)
    event_record: dict[str, Any] = {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": " ".join(desc_parts)[:2000],
        "start_date": start_date,
        "start_time": start_time,
        "end_date": end_date,
        "end_time": None,
        "is_all_day": False,
        "category": category,
        "subcategory": None,
        "tags": tags,
        "price_min": None,
        "price_max": None,
        "price_note": None,
        "is_free": False,
        "source_url": source_url,
        "ticket_url": ticket_url,
        "image_url": _best_image(production),
        "raw_text": json.dumps({"prodNumber": prod_number})[:200],
        "extraction_confidence": 0.92,
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
        logger.info(f"Shakespeare Tavern: added '{title}' ({start_date})")
        return True, True
    except Exception as exc:
        logger.error(f"Shakespeare Tavern: failed to insert '{title}': {exc}")
        return True, False


def _upsert_camp_session(
    *,
    session: dict[str, Any],
    source_id: int,
    venue_id: int,
) -> tuple[bool, bool]:
    """Upsert a summer camp or SIT session. Returns (found, new)."""
    title = (session.get("title") or "").strip()
    start_date = session.get("start_date")
    if not title or not start_date:
        return False, False
    if _is_past(start_date):
        return False, False

    category, tags = _determine_category(title, session.get("description") or "")
    required_tags = ["educational", "all-ages"]
    if category == "family":
        required_tags.extend(["kids", "family-friendly"])
    for t in required_tags:
        if t not in tags:
            tags.append(t)

    grade_range = session.get("grade_range") or ""
    if re.search(r"2nd|3rd|4th|5th", grade_range):
        if "elementary" not in tags:
            tags.append("elementary")
    if re.search(r"6th|7th|8th", grade_range):
        if "tween" not in tags:
            tags.append("tween")
    if re.search(r"9th|freshmen", grade_range, re.IGNORECASE):
        if "teen" not in tags:
            tags.append("teen")

    content_hash = generate_content_hash(title, PLACE_DATA["name"], start_date)
    event_record: dict[str, Any] = {
        "source_id": source_id,
        "place_id": venue_id,
        "title": title,
        "description": (session.get("description") or "")[:2000],
        "start_date": start_date,
        "start_time": session.get("start_time"),
        "end_date": session.get("end_date"),
        "end_time": None,
        "is_all_day": False,
        "category": category,
        "subcategory": "camp",
        "tags": list(set(tags)),
        "price_min": session.get("price_min"),
        "price_max": None,
        "price_note": session.get("price_note"),
        "is_free": False,
        "source_url": session.get("source_url") or SUMMER_CAMP_URL,
        "ticket_url": session.get("source_url") or SUMMER_CAMP_URL,
        "image_url": None,
        "raw_text": title,
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
        logger.info(f"Shakespeare Tavern: added camp '{title}' ({start_date})")
        return True, True
    except Exception as exc:
        logger.error(f"Shakespeare Tavern: failed to insert camp '{title}': {exc}")
        return True, False


# ─── main entrypoint ──────────────────────────────────────────────────────────


def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Shakespeare Tavern productions and summer camps via Playwright."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/122.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1920, "height": 1080},
            )
            page = context.new_page()
            venue_id = get_or_create_place(PLACE_DATA)

            # ----------------------------------------------------------------
            # 1. On-stage productions (main stage + guest events)
            # ----------------------------------------------------------------
            logger.info(f"Shakespeare Tavern: fetching on-stage API via {ON_STAGE_URL}")
            on_stage_data = _fetch_api_response(page, ON_STAGE_URL)
            if on_stage_data:
                productions = _collect_productions(on_stage_data)
                logger.info(
                    f"Shakespeare Tavern: {len(productions)} productions in API response"
                )
                for prod in productions:
                    found, new = _upsert_production(
                        production=prod, source_id=source_id, venue_id=venue_id
                    )
                    if found:
                        events_found += 1
                        if new:
                            events_new += 1
                        else:
                            events_updated += 1
            else:
                logger.warning("Shakespeare Tavern: no on-stage API response captured")

            browser.close()

        # ----------------------------------------------------------------
        # 2. Summer camps (Shakespeare Superheroes page, text parsing)
        #    Education pages have stricter Cloudflare rules; open a fresh
        #    browser session rather than reusing the on-stage session.
        # ----------------------------------------------------------------
        logger.info(f"Shakespeare Tavern: fetching summer camps: {SUMMER_CAMP_URL}")
        camp_text = _fetch_page_text_fresh(SUMMER_CAMP_URL)
        if camp_text:
            camp_sessions = _parse_camp_sessions(camp_text)
            logger.info(
                f"Shakespeare Tavern: parsed {len(camp_sessions)} camp sessions"
            )
            for session in camp_sessions:
                found, new = _upsert_camp_session(
                    session=session, source_id=source_id, venue_id=venue_id
                )
                if found:
                    events_found += 1
                    if new:
                        events_new += 1
                    else:
                        events_updated += 1
        else:
            logger.warning(
                "Shakespeare Tavern: could not fetch summer camps page (Cloudflare)"
            )

        # ----------------------------------------------------------------
        # 3. Shakespeare Intensive for Teens (SIT, text parsing)
        # ----------------------------------------------------------------
        logger.info(f"Shakespeare Tavern: fetching SIT page: {SIT_URL}")
        sit_text = _fetch_page_text_fresh(SIT_URL)
        if sit_text:
            sit_sessions = _parse_sit_sessions(sit_text)
            logger.info(
                f"Shakespeare Tavern: parsed {len(sit_sessions)} SIT sessions/performances"
            )
            for session in sit_sessions:
                found, new = _upsert_camp_session(
                    session=session, source_id=source_id, venue_id=venue_id
                )
                if found:
                    events_found += 1
                    if new:
                        events_new += 1
                    else:
                        events_updated += 1
        else:
            logger.warning("Shakespeare Tavern: could not fetch SIT page (Cloudflare)")

        if events_found < 3:
            logger.warning(
                f"Shakespeare Tavern: only {events_found} events found — "
                "site structure may have changed or Cloudflare blocking."
            )

        logger.info(
            f"Shakespeare Tavern crawl complete: {events_found} found, "
            f"{events_new} new, {events_updated} updated"
        )

    except Exception as exc:
        logger.error(f"Shakespeare Tavern: crawl failed: {exc}")
        raise

    return events_found, events_new, events_updated
