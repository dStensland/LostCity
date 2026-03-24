"""
Crawler for Musical Chairs composer competitions and courses.

Source: https://www.musicalchairs.info/composer/competitions

Musical Chairs is the world's leading online resource for classical musicians.
The composer section lists competitions (typically ~48) and courses (~31) open
to composers worldwide. Listings come from organizations across 40+ countries
and span submission-based competitions, fellowships, workshops, and courses.

This source opens music composition as a new discipline in our open calls
coverage — no other source in the pipeline currently touches composer-specific
opportunities.

HTML structure (verified 2026-03-24):
  The page is server-rendered. No JavaScript rendering required.

  Index page:
    Listing container: <li class="preview" data-post-preview-id="NNNN">
    Each item contains:
      <a href="/competitions/NNNN?ref=51">         — detail page URL
      .post_item_location                           — city, country
      .post_item_date                               — "Posted: DD Mon YYYY"
      .post_item_name                               — competition title
      .post_item_info                               — date range (start - close)
      .post_item_desc                               — teaser description
      .post_item_closingdate                        — "Closing date: DD MonYYYY"
                                                       or "Closing date: n/a"
      .post_item_flag img[alt]                      — country name

  Detail page:
    .post_item_desc     — full description text (longer than index teaser)
    .post_item_closingdate — canonical closing date
    .post_button_row a[href*="goto-url"] — redirects to organizer website
    Description text sometimes includes the direct external URL.

  Closing date format examples:
    "Closing date:01 Sep2026"   (no space between mon-abbr and year)
    "Closing date:15 May2026"
    "Closing date: n/a"         (no deadline listed)

Pagination:
  All 48 entries appear on a single page — no pagination. The site uses
  ?sort=cd to sort by closing date (ascending) which we use to surface
  the nearest deadlines first and simplify past-deadline pruning.

Courses section:
  https://www.musicalchairs.info/composer/courses
  Same HTML structure. Courses are crawled separately and typed as
  "fellowship" (they represent educational opportunities for composers).

Rate limiting:
  0.5s between detail page fetches. With ~80 total listings (48 + 31),
  a full run with detail fetches takes ~1 minute.

Confidence tier: "aggregated" — Musical Chairs aggregates listings from
  many organizations. We link to the Musical Chairs detail page and extract
  the organizer website URL when available in the description body.
"""

import logging
import re
import time
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_BASE_URL = "https://www.musicalchairs.info"

# Sort by closing date so nearest deadlines appear first
_COMPETITIONS_URL = "https://www.musicalchairs.info/composer/competitions?sort=cd"
_COURSES_URL = "https://www.musicalchairs.info/composer/courses"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_ORG_NAME = "musical-chairs"

# Seconds between detail page fetches — polite crawling
_DETAIL_DELAY = 0.5

_REQUEST_TIMEOUT = 30

# Safety cap — raise if MC grows significantly
_MAX_LISTINGS = 200

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": _BASE_URL + "/",
        }
    )
    return session


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=_REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("MusicalChairs: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

# Closing date text examples:
#   "Closing date:01 Sep2026"  (no space before year)
#   "Closing date:15 May2026"
#   "Closing date: n/a"
#   "Closing date:27 Mar2026"
_CLOSING_DATE_RE = re.compile(
    r"(\d{1,2})\s+" r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)" r"\s*(\d{4})",
    re.I,
)

_MONTH_MAP = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}

# Match full month names too (used in description bodies)
_MONTH_MAP_FULL = {
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
_MONTH_MAP_FULL.update(_MONTH_MAP)

_FULL_DATE_RE = re.compile(
    r"(\d{1,2})\s+"
    r"(January|February|March|April|May|June|July|August|September|October|November|December)"
    r",?\s+(\d{4})",
    re.I,
)


def _parse_closing_date(text: str) -> Optional[str]:
    """
    Parse a closing date from listing/detail page text.

    Handles abbreviated month names (Jan/Feb/...) without spaces before year.
    Returns "YYYY-MM-DD" or None if "n/a" or unparseable.
    """
    if not text or "n/a" in text.lower():
        return None

    m = _CLOSING_DATE_RE.search(text)
    if m:
        day = int(m.group(1))
        month = _MONTH_MAP.get(m.group(2).lower()[:3])
        year = int(m.group(3))
        if month:
            try:
                date(year, month, day)  # validate
                return f"{year}-{month:02d}-{day:02d}"
            except ValueError:
                pass

    # Fallback: full month name (used in description text)
    m2 = _FULL_DATE_RE.search(text)
    if m2:
        day = int(m2.group(1))
        month = _MONTH_MAP_FULL.get(m2.group(2).lower())
        year = int(m2.group(3))
        if month:
            try:
                date(year, month, day)
                return f"{year}-{month:02d}-{day:02d}"
            except ValueError:
                pass

    return None


def _is_past_deadline(deadline_iso: Optional[str]) -> bool:
    """Return True when the deadline has already passed."""
    if not deadline_iso:
        return False
    try:
        return date.fromisoformat(deadline_iso) < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Call type inference
# ---------------------------------------------------------------------------

# Ordered by specificity — first match wins
_TYPE_RULES: list[tuple[re.Pattern, str]] = [
    (
        re.compile(
            r"\bresidenc(?:y|ies|t)\b|\bin\s+residence\b|\bstudio\s+residency\b", re.I
        ),
        "residency",
    ),
    (re.compile(r"\bfellowship\b|\bfellow\b", re.I), "fellowship"),
    (re.compile(r"\bgrant\b|\bfunding\b|\bbursary\b|\bscholarship\b", re.I), "grant"),
    (re.compile(r"\bcommission(?:ed|s)?\b", re.I), "commission"),
    (
        re.compile(
            r"\bworkshop\b|\bcourse\b|\bmasterclass\b|\bsummer\s+school\b|\bacademy\b",
            re.I,
        ),
        "fellowship",
    ),
]

_DEFAULT_TYPE = "submission"


def _infer_call_type(title: str, description: str, is_course: bool = False) -> str:
    """
    Infer call_type from title and description keywords.

    Courses default to "fellowship" since they represent educational
    opportunities (workshops, masterclasses, summer schools) rather than
    competition submissions. Competitions default to "submission".
    """
    if is_course:
        # Still check for residency/commission overrides in courses
        combined = f"{title} {description[:400]}"
        for pattern, call_type in _TYPE_RULES:
            if pattern.search(combined):
                return call_type
        return "fellowship"

    combined = f"{title} {description[:400]}"
    for pattern, call_type in _TYPE_RULES:
        if pattern.search(combined):
            return call_type
    return _DEFAULT_TYPE


# ---------------------------------------------------------------------------
# Eligibility inference
# ---------------------------------------------------------------------------

_INTL_PATTERNS = [
    re.compile(r"\binternational\b", re.I),
    re.compile(r"\bworldwide\b", re.I),
    re.compile(r"\bglobal\b", re.I),
    re.compile(r"\bopen\s+to\s+all\b", re.I),
]

_NAT_PATTERNS = [
    re.compile(r"\birish\s+composers\b", re.I),
    re.compile(r"\bamerican\s+composers\b", re.I),
    re.compile(r"\buk\s+composers\b", re.I),
    re.compile(r"\bnational\b", re.I),
]

_AGE_PATTERNS = [
    re.compile(r"\byoung\s+composers?\b", re.I),
    re.compile(r"\bunder\s+\d{2}\b", re.I),
    re.compile(r"\bage\s*\d{1,2}\b", re.I),
    re.compile(r"\bstudents?\b", re.I),
]


def _infer_eligibility(title: str, description: str) -> str:
    """Infer eligibility from title + description text."""
    combined = f"{title} {description[:600]}"

    # Check for nationality restrictions
    for p in _NAT_PATTERNS:
        if p.search(combined):
            return "Restricted — see listing for details"

    # Check for age restrictions (mention alongside to allow international)
    has_age_restriction = any(p.search(combined) for p in _AGE_PATTERNS)

    if any(p.search(combined) for p in _INTL_PATTERNS):
        if has_age_restriction:
            return "International — age restrictions may apply"
        return "International"

    # Musical Chairs default: most listings are international
    return "International"


# ---------------------------------------------------------------------------
# External URL extraction from description text
# ---------------------------------------------------------------------------

_URL_RE = re.compile(r"https?://[^\s\)\]\"'<>]{10,}", re.I)


def _extract_external_url_from_desc(description: str) -> Optional[str]:
    """
    Extract an external application/details URL from the description body.

    Musical Chairs descriptions often include the organizer's direct URL
    (e.g. "For full details visit: https://example.com/competition").
    This gives users a direct link without going through the MC redirect.
    """
    urls = _URL_RE.findall(description)
    if not urls:
        return None

    # Filter out Musical Chairs own URLs
    external = [u.rstrip(".,;)") for u in urls if "musicalchairs.info" not in u]
    return external[0] if external else None


# ---------------------------------------------------------------------------
# Index page parser
# ---------------------------------------------------------------------------


def _parse_index_page(html: str, section_type: str = "competition") -> list[dict]:
    """
    Parse the Musical Chairs listing index page.

    Returns a list of dicts with keys:
      detail_url, mc_id, title, teaser, closing_date_iso, location, country
    """
    soup = BeautifulSoup(html, "html.parser")
    items = soup.select("li.preview")
    listings: list[dict] = []

    for item in items:
        a = item.find("a", href=True)
        if not a:
            continue

        href = a["href"]
        # Make absolute
        if href.startswith("/"):
            href = _BASE_URL + href
        elif not href.startswith("http"):
            href = _BASE_URL + "/" + href

        # Extract MC post ID from data attribute or URL
        mc_id = item.get("data-post-preview-id", "")
        if not mc_id:
            m = re.search(r"/(?:competitions|courses)/(\d+)", href)
            mc_id = m.group(1) if m else ""

        # Title
        name_el = item.select_one(".post_item_name")
        title = name_el.get_text(strip=True) if name_el else ""
        if not title:
            continue

        # Teaser description
        desc_el = item.select_one(".post_item_desc")
        teaser = desc_el.get_text(strip=True) if desc_el else ""

        # Closing date
        closing_el = item.select_one(".post_item_closingdate")
        closing_text = (
            closing_el.get_text(separator=" ", strip=True) if closing_el else ""
        )
        closing_date = _parse_closing_date(closing_text)

        # Location
        loc_el = item.select_one(".post_item_location")
        location = loc_el.get_text(strip=True) if loc_el else ""

        # Country from flag alt text
        flag_img = item.select_one(".post_item_flag img")
        country = flag_img.get("alt", "") if flag_img else ""

        listings.append(
            {
                "detail_url": href,
                "mc_id": mc_id,
                "title": title,
                "teaser": teaser,
                "closing_date": closing_date,
                "location": location,
                "country": country,
                "section_type": section_type,
            }
        )

    return listings


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _parse_detail_page(html: str, detail_url: str) -> dict:
    """
    Parse a Musical Chairs competition/course detail page.

    Returns a dict with:
      title, description, closing_date, application_url
    """
    soup = BeautifulSoup(html, "html.parser")

    # Authoritative title from h1
    h1 = soup.find("h1")
    title = h1.get_text(strip=True) if h1 else ""

    # Full description (longer than index teaser)
    desc_el = soup.select_one(".post_item_desc")
    description = ""
    if desc_el:
        description = desc_el.get_text(separator=" ", strip=True)
        # Clean up repeated title at start (common pattern)
        if description.upper().startswith(title.upper()):
            description = description[len(title) :].lstrip()
        description = re.sub(r"\s+", " ", description).strip()

    # Closing date (canonical from detail page)
    closing_el = soup.select_one(".post_item_closingdate")
    closing_text = closing_el.get_text(separator=" ", strip=True) if closing_el else ""
    closing_date = _parse_closing_date(closing_text)

    # Application URL: prefer external URL found in description body,
    # fall back to the Musical Chairs goto-url redirect, then the detail page itself.
    application_url = detail_url  # safe fallback

    external_from_desc = _extract_external_url_from_desc(description)
    if external_from_desc:
        application_url = external_from_desc
    else:
        # Check "Visit website" button href
        for btn in soup.select(".post_button_row a.button_link"):
            btn_text = btn.get_text(strip=True)
            if "visit website" in btn_text.lower() or "website" in btn_text.lower():
                btn_href = btn.get("href", "")
                if btn_href and "goto-url" in btn_href:
                    # Use the MC redirect URL — it will forward to the organizer site
                    if btn_href.startswith("/"):
                        btn_href = _BASE_URL + btn_href
                    application_url = btn_href
                    break

    return {
        "title": title,
        "description": description[:3000] if description else None,
        "closing_date": closing_date,
        "application_url": application_url,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Musical Chairs composer competitions and courses.

    Strategy:
      1. Fetch the competitions index (sorted by closing date ascending) and
         the courses index. Collect all listing cards.
      2. For each listing: fast-path deadline check on index-level date.
         Skip entries with past deadlines.
      3. Fetch each detail page for full description, authoritative deadline,
         and the best application URL.
      4. Insert via insert_open_call(). call_type="submission" for competitions,
         "fellowship" for courses; both adjusted by keyword inference.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()

    # -----------------------------------------------------------------------
    # Phase 1: collect all listings from both index pages
    # -----------------------------------------------------------------------
    all_listings: list[dict] = []

    for index_url, section_type in [
        (_COMPETITIONS_URL, "competition"),
        (_COURSES_URL, "course"),
    ]:
        logger.debug("MusicalChairs: fetching %s index — %s", section_type, index_url)
        html = _fetch(index_url, session)
        if not html:
            logger.error(
                "MusicalChairs: failed to fetch %s index — skipping section",
                section_type,
            )
            continue

        listings = _parse_index_page(html, section_type=section_type)
        logger.info(
            "MusicalChairs: %s index — %d listings found", section_type, len(listings)
        )
        all_listings.extend(listings)

        if len(all_listings) >= _MAX_LISTINGS:
            logger.warning(
                "MusicalChairs: hit safety cap of %d — stopping index collection",
                _MAX_LISTINGS,
            )
            break

    if not all_listings:
        logger.warning(
            "MusicalChairs: no listings found — check if site structure has changed"
        )
        return 0, 0, 0

    # -----------------------------------------------------------------------
    # Phase 2: fetch detail pages and insert
    # -----------------------------------------------------------------------
    skipped_deadline = 0
    skipped_no_url = 0
    detail_request_count = 0

    for listing in all_listings:
        title = listing["title"]
        detail_url = listing["detail_url"]
        index_deadline = listing["closing_date"]
        is_course = listing["section_type"] == "course"

        # Fast-path: skip past-deadline entries without fetching detail page
        if index_deadline and _is_past_deadline(index_deadline):
            skipped_deadline += 1
            logger.debug(
                "MusicalChairs: skipping %r — index deadline %s passed",
                title[:60],
                index_deadline,
            )
            continue

        # Polite delay before every detail fetch
        if detail_request_count > 0:
            time.sleep(_DETAIL_DELAY)

        detail_html = _fetch(detail_url, session)
        detail_request_count += 1

        if not detail_html:
            logger.warning(
                "MusicalChairs: could not fetch detail page for %r — using index data",
                title[:60],
            )
            # Fall back to index-level data
            detail = {
                "title": title,
                "description": listing["teaser"] or None,
                "closing_date": index_deadline,
                "application_url": detail_url,
            }
        else:
            detail = _parse_detail_page(detail_html, detail_url)

        # Use detail title if present; fall back to index title
        final_title = detail["title"] or title
        if not final_title:
            continue

        # Authoritative deadline from detail; fall back to index
        deadline = detail["closing_date"] or index_deadline

        # Post-fetch deadline guard (detail page may differ from index)
        if deadline and _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "MusicalChairs: skipping %r — detail deadline %s passed",
                final_title[:60],
                deadline,
            )
            continue

        application_url = detail.get("application_url")
        if not application_url:
            skipped_no_url += 1
            logger.debug(
                "MusicalChairs: skipping %r — no application URL", final_title[:60]
            )
            continue

        found += 1

        description = detail.get("description") or listing.get("teaser") or None

        call_type = _infer_call_type(
            final_title, description or "", is_course=is_course
        )
        eligibility = _infer_eligibility(final_title, description or "")

        # Org slug from location or generic fallback
        location = listing.get("location", "")
        country = listing.get("country", "")
        mc_id = listing.get("mc_id", "")

        call_data: dict = {
            "title": final_title,
            "description": description,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": detail_url,
            "call_type": call_type,
            "eligibility": eligibility,
            "fee": None,  # Musical Chairs doesn't expose structured fee data
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": _ORG_NAME,
            "metadata": {
                "source": "musical-chairs",
                "mc_id": mc_id,
                "section": listing["section_type"],
                "location": location,
                "country": country,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "MusicalChairs: inserted %r (deadline=%s, type=%s, country=%s)",
                final_title[:60],
                deadline,
                call_type,
                country,
            )

    if skipped_deadline:
        logger.info(
            "MusicalChairs: skipped %d past-deadline listings", skipped_deadline
        )
    if skipped_no_url:
        logger.info("MusicalChairs: skipped %d listings with no URL", skipped_no_url)

    logger.info(
        "MusicalChairs: crawl complete — %d found (eligible), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
