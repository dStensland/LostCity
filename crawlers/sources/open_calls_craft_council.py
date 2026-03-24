"""
Crawler for the American Craft Council (ACC) Opportunities Board.

URL: https://www.craftcouncil.org/opportunities

The ACC aggregates craft-sector opportunities from many organizations —
grants, residencies, calls for entry, jobs, classes, etc. Because they are
an aggregator (not the issuing organization), confidence_tier is "aggregated".

Crawl strategy — two phases, no Playwright needed (static HTML):

  Phase 1 — Index page (https://www.craftcouncil.org/opportunities):
    Parse all <li class="opportunities-feed__card"> items.
    Each card contains:
      • Detail URL — <a class="opportunities-feed__card-link" href="...">
      • Type label  — <p class="opportunities-feed__opportunity-type">
      • Location    — <p class="opportunities-feed__publish-city">
      • Posted date — <p class="opportunities-feed__publish-date">

  Phase 2 — Detail pages (one per listing):
    • <h1 class="page-hero__hero">         — title
    • <h3> containing "Organization:"      — org name
    • <div class="wysiwyg__body">          — full description
    • First <a class="btn page-hero__button" target="_blank"> that is not the
      "Organization Website" button        — application URL
    • Deadline: extracted from hero copy (<div class="page-hero__copy-wrapper">)
      via regex patterns including:
        - "deadline: Month DD, YYYY"
        - "MM/DD/YYYY"
        - "Month DD, YYYY" near "deadline"
        - Short-form "M/D/YY"

Type mapping (ACC taxonomy → our call_type):
  Keep and map:
    "Calls for entry"                → submission
    "Grants, awards & fellowships"  → grant
    "Maker residencies"              → residency

  Skip (not artist opportunities):
    "Jobs & internships"
    "Classes & workshops"
    "Professional development & networking"
    "Volunteer opportunities"

Past-deadline calls are skipped.
"""

import logging
import re
import time
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://craftcouncil.org"
INDEX_URL = "https://www.craftcouncil.org/opportunities"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Seconds between detail page fetches — ACC is a small nonprofit
DETAIL_FETCH_DELAY = 1.2

# ACC opportunity types we skip
_SKIP_TYPES: frozenset[str] = frozenset(
    {
        "jobs & internships",
        "jobs-internships ($50.00)",  # paid listing variant
        "classes & workshops",
        "professional development & networking",
        "volunteer opportunities",
    }
)

# ACC type label → our call_type
_TYPE_MAP: dict[str, str] = {
    "calls for entry": "submission",
    "grants, awards & fellowships": "grant",
    "maker residencies": "residency",
}

_MONTH_MAP: dict[str, int] = {
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


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return its HTML, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("ACC: failed to fetch %s: %s", url, exc)
        return None


def _resolve_url(href: str) -> str:
    """Ensure href is an absolute URL."""
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return BASE_URL + href
    return BASE_URL + "/" + href


# ---------------------------------------------------------------------------
# Type classification
# ---------------------------------------------------------------------------


def _classify_type(raw_type: str) -> Optional[str]:
    """
    Map an ACC type label to our call_type, or return None to skip.

    Normalizes to lowercase for comparison. Unknown types default to
    "submission" since craft calls for entry are the most common case.
    """
    normalized = raw_type.strip().lower()
    if normalized in _SKIP_TYPES:
        return None
    return _TYPE_MAP.get(normalized, "submission")


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline(text: str) -> Optional[str]:
    """
    Extract an application deadline date from free-form text.

    Handles these patterns (found across ACC detail pages):
      "May 3: Application deadline at midnight (CST)" → inferred year
      "deadline: April 15, 2026"                       → "2026-04-15"
      "Deadline 06/30/2026"                            → "2026-06-30"
      "Apply by March 1, 2026"                         → "2026-03-01"
      "8/12/26"                                        → "2026-08-12"
      "Rolling deadline"                               → None
      "No deadline to apply"                           → None
    """
    if not text:
        return None

    lower = text.lower()

    # Skip rolling / no-deadline language
    if any(
        phrase in lower
        for phrase in ("no deadline", "rolling deadline", "rolling basis")
    ):
        return None

    # Pattern 1: "Month D(D), YYYY" — most precise, first date wins
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September"
        r"|October|November|December)\s+(\d{1,2}),?\s+(\d{4})",
        text,
        re.I,
    )
    if m:
        month_name, day, year = m.groups()
        month_num = _MONTH_MAP.get(month_name.lower())
        if month_num:
            return f"{int(year)}-{month_num:02d}-{int(day):02d}"

    # Pattern 2: MM/DD/YYYY
    m = re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", text)
    if m:
        month, day, year = m.groups()
        return f"{int(year)}-{int(month):02d}-{int(day):02d}"

    # Pattern 3: M/D/YY (short two-digit year — e.g. "8/12/26")
    m = re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{2})\b", text)
    if m:
        month, day, year_short = m.groups()
        year = 2000 + int(year_short)
        return f"{year}-{int(month):02d}-{int(day):02d}"

    # Pattern 4: ISO YYYY-MM-DD
    m = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", text)
    if m:
        year, month, day = m.groups()
        return f"{year}-{month}-{day}"

    # Pattern 5: "Month D(D)" with no year — infer current or next year.
    # Only apply when the line contains a deadline keyword to avoid matching
    # event dates (e.g. "September 25: Artist Load-In").
    if any(
        kw in lower
        for kw in (
            "deadline",
            "apply by",
            "apply now through",
            "apply until",
            "apply before",
            "due",
        )
    ):
        m = re.search(
            r"(January|February|March|April|May|June|July|August|September"
            r"|October|November|December)\s+(\d{1,2})(?:\s*[,:]|$)",
            text,
            re.I,
        )
        if m:
            month_name, day = m.groups()
            month_num = _MONTH_MAP.get(month_name.lower())
            if month_num:
                today = date.today()
                year = today.year
                try:
                    candidate = date(year, month_num, int(day))
                except ValueError:
                    return None
                if candidate < today:
                    year += 1
                return f"{year}-{month_num:02d}-{int(day):02d}"

    return None


def _extract_deadline_from_hero(soup: BeautifulSoup) -> Optional[str]:
    """
    Extract the application deadline from an ACC detail page's hero section.

    The hero copy contains paragraphs with "Key Dates:" or inline deadline
    language. We scan the entire hero copy wrapper for deadline signals.

    Returns an ISO date string or None.
    """
    hero = soup.find(class_="page-hero__copy-wrapper")
    if not hero:
        return None

    hero_text = hero.get_text(separator="\n", strip=True)

    # Line-by-line: look for a line mentioning "deadline"
    for line in hero_text.splitlines():
        if "deadline" in line.lower():
            parsed = _parse_deadline(line)
            if parsed:
                return parsed

    # Also try "apply by" / "apply now through" / "apply until" lines
    for line in hero_text.splitlines():
        lower = line.lower()
        if any(
            kw in lower
            for kw in ("apply by", "apply now through", "apply until", "apply before")
        ):
            parsed = _parse_deadline(line)
            if parsed:
                return parsed

    # Fallback: scan the full hero text for any date near deadline context
    # Look for "deadline" within 100 chars of a date
    m = re.search(
        r"deadline.{0,80}?"
        r"((?:January|February|March|April|May|June|July|August|September"
        r"|October|November|December)\s+\d{1,2},?\s+\d{4}"
        r"|\d{1,2}/\d{1,2}/\d{4})",
        hero_text,
        re.I | re.DOTALL,
    )
    if m:
        return _parse_deadline(m.group(1))

    return None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline has already passed."""
    if not deadline_str:
        return False
    try:
        dl = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Index page parser
# ---------------------------------------------------------------------------


def _parse_index(html: str) -> list[dict]:
    """
    Parse the ACC opportunities index page.

    Returns a list of dicts with keys:
      detail_url, raw_type, location, posted
    """
    soup = BeautifulSoup(html, "html.parser")
    listings: list[dict] = []

    for card in soup.find_all("li", class_="opportunities-feed__card"):
        # Detail page URL
        link_el = card.find("a", class_="opportunities-feed__card-link", href=True)
        if not link_el:
            continue
        detail_url = _resolve_url(link_el["href"])

        # Opportunity type
        type_el = card.find(class_="opportunities-feed__opportunity-type")
        raw_type = type_el.get_text(strip=True) if type_el else ""

        # Location (city, state)
        city_el = card.find(class_="opportunities-feed__publish-city")
        location = city_el.get_text(strip=True) if city_el else ""

        # Posted date string (e.g. "Posted 5 days ago")
        date_el = card.find(class_="opportunities-feed__publish-date")
        posted = date_el.get_text(strip=True) if date_el else ""

        listings.append(
            {
                "detail_url": detail_url,
                "raw_type": raw_type,
                "location": location,
                "posted": posted,
            }
        )

    logger.debug("ACC: parsed %d listings from index", len(listings))
    return listings


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _parse_detail(html: str, detail_url: str) -> dict:
    """
    Parse an ACC opportunity detail page.

    Returns a dict with keys:
      title, org_name, description, deadline, application_url
    """
    soup = BeautifulSoup(html, "html.parser")

    # Title
    h1 = soup.find("h1", class_="page-hero__hero")
    title = h1.get_text(strip=True) if h1 else ""

    # Organization name — in an <h3> containing "Organization:"
    org_name = ""
    for h3 in soup.find_all("h3"):
        text = h3.get_text(strip=True)
        if "organization:" in text.lower():
            # Strip the label, keep the rest
            org_name = re.sub(r"(?i)organization\s*:\s*", "", text).strip()
            # Also strip any bold wrapper text
            org_name = org_name.strip()
            break

    # Deadline — extracted from hero section
    deadline = _extract_deadline_from_hero(soup)

    # If no deadline found in hero, try the wysiwyg body (for inline deadline language)
    if not deadline:
        body_el = soup.find(class_="wysiwyg__body")
        if body_el:
            body_text = body_el.get_text(separator="\n", strip=True)
            for line in body_text.splitlines():
                if "deadline" in line.lower():
                    deadline = _parse_deadline(line)
                    if deadline:
                        break

    # Application URL — first btn.page-hero__button[target=_blank] that is not
    # the org website button (which has aria-label="Organization Website...")
    application_url = detail_url  # fallback to source URL
    hero_buttons = soup.find_all(
        "a",
        class_=lambda c: c and "page-hero__button" in c,
        target="_blank",
    )
    for btn in hero_buttons:
        aria = btn.get("aria-label", "").lower()
        if "organization website" in aria:
            continue
        href = btn.get("href", "")
        if href and href.startswith("http"):
            application_url = href
            break

    # Description from wysiwyg body
    description = ""
    body_el = soup.find(class_="wysiwyg__body")
    if body_el:
        paragraphs = [
            p.get_text(separator=" ", strip=True)
            for p in body_el.find_all("p")
            if p.get_text(strip=True)
        ]
        # Also grab list items (eligibility criteria, benefits, etc.)
        list_items = [
            li.get_text(separator=" ", strip=True)
            for li in body_el.find_all("li")
            if li.get_text(strip=True)
        ]
        all_parts = paragraphs + (
            ["• " + item for item in list_items] if list_items else []
        )
        description = "\n".join(all_parts).strip()
        if len(description) > 2000:
            description = description[:1997] + "..."

    return {
        "title": title,
        "org_name": org_name,
        "description": description or None,
        "deadline": deadline,
        "application_url": application_url,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the American Craft Council Opportunities Board.

    Strategy:
      1. Parse the index page for all listing cards.
      2. Skip Jobs, Classes, Professional Development, and Volunteer types.
      3. Fetch each detail page for title, org, description, deadline, apply URL.
      4. Skip past-deadline calls.
      5. Insert or update each call via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    # Phase 1: parse the index
    index_html = _fetch(INDEX_URL, session)
    if not index_html:
        logger.error("ACC: failed to fetch index page")
        return 0, 0, 0

    listings = _parse_index(index_html)
    if not listings:
        logger.warning("ACC: no listings found on index page")
        return 0, 0, 0

    # Filter out non-artist types before hitting detail pages
    actionable: list[dict] = []
    skipped_type = 0
    for listing in listings:
        call_type = _classify_type(listing["raw_type"])
        if call_type is None:
            skipped_type += 1
            logger.debug("ACC: skipping listing (type=%r)", listing["raw_type"])
            continue
        listing["call_type"] = call_type
        actionable.append(listing)

    logger.info(
        "ACC: %d total listings — %d actionable, %d skipped (non-artist type)",
        len(listings),
        len(actionable),
        skipped_type,
    )

    # Phase 2: fetch detail pages and insert
    for i, listing in enumerate(actionable):
        detail_url = listing["detail_url"]

        detail_html = _fetch(detail_url, session)
        if not detail_html:
            logger.warning("ACC: skipping %r — could not fetch detail page", detail_url)
            continue

        detail = _parse_detail(detail_html, detail_url)

        title = detail["title"]
        if not title:
            # Fallback: extract from URL slug
            slug = detail_url.rstrip("/").split("/")[-1]
            title = slug.replace("-", " ").title()

        # Skip past-deadline calls
        if _is_past_deadline(detail["deadline"]):
            logger.debug(
                "ACC: skipping %r — deadline %s already passed",
                title[:60],
                detail["deadline"],
            )
            if i < len(actionable) - 1:
                time.sleep(DETAIL_FETCH_DELAY)
            continue

        found += 1

        # Build the org display name for slug generation
        org_name = detail["org_name"] or "craft-council"

        call_data: dict = {
            "title": title,
            "description": detail["description"],
            "deadline": detail["deadline"],
            "application_url": detail["application_url"],
            "source_url": detail_url,
            "call_type": listing["call_type"],
            "eligibility": "National",
            "fee": None,  # ACC does not publish fee info on listing cards
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_name,
            "metadata": {
                "organization": detail["org_name"],
                "location": listing["location"],
                "raw_type": listing["raw_type"],
                "posted": listing["posted"],
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "ACC: inserted/updated %r (deadline=%s, type=%s)",
                title[:60],
                detail["deadline"],
                listing["call_type"],
            )

        # Rate-limit between detail fetches
        if i < len(actionable) - 1:
            time.sleep(DETAIL_FETCH_DELAY)

    logger.info("ACC: %d found (non-expired), %d new, %d updated", found, new, updated)
    return found, new, updated
