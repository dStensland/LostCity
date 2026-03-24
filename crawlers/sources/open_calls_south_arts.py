"""
Crawler for South Arts open calls — grants, residencies, and opportunities.

South Arts is a regional arts council covering 13 Southern states (AL, AR, FL,
GA, KY, LA, MI, MS, NC, SC, TN, VA, WV). They post their own funding programs
directly — no aggregation — making this a "verified" confidence source.

Index page: https://www.southarts.org/grants-opportunities

Each grant listing is an <article class="go-listing"> card containing:
  - <p class="field-date">  — deadline text (various formats, may be empty)
  - <a class="go-wrapper" href="/grants-opportunities/...">  — detail page link
  - <h2 class="go-title">  — grant name
  - <div class="go-content">  — short description blurb

Crawl strategy:
  1. Parse the index for all active grant cards.
  2. Follow each card's detail page to get the full description, a reliable
     deadline (the detail page field-date is the canonical source), and the
     best application URL (Salesforce portal, FilmFreeway, Google Form, etc.).
  3. Fall back to the Salesforce grant portal URL when no specific apply link
     is found — this is South Arts' primary application system.

Deadline text patterns observed:
  - "Application Deadline: April 10, 2026"
  - "Application Deadline: April 10"  (no year — infer current/next year)
  - "Rolling Deadline through April 30, 2026"
  - "Ongoing Monthly Webinars"
  - "Ongoing"
  - "" (empty — Jazz Road Creative Residencies during off-cycle)

Grants that are definitively closed (text includes "Closed on") are skipped.
"""

import logging
import re
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

BASE_URL = "https://www.southarts.org"
INDEX_URL = "https://www.southarts.org/grants-opportunities"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# South Arts' primary grant application portal — used as fallback application_url
_SALESFORCE_PORTAL = "https://southarts.my.site.com/grants/s/"

# Eligibility text: South Arts programs are regionally scoped to the 13-state South
_ELIGIBILITY = (
    "Artists and organizations based in South Arts' 13-state region: Alabama, Arkansas, "
    "Florida, Georgia, Kentucky, Louisiana, Mississippi, North Carolina, South Carolina, "
    "Tennessee, Virginia, and West Virginia."
)

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

# Signals that a grant cycle is definitively closed on the detail page
_CLOSED_RE = re.compile(r"\bClosed\s+on\b", re.I)


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch URL and return HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("SouthArts: failed to fetch %s: %s", url, exc)
        return None


def _resolve_url(href: str) -> str:
    """Ensure href is an absolute URL."""
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return BASE_URL + href
    return BASE_URL + "/" + href


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline(text: str) -> Optional[str]:
    """
    Parse deadline text into an ISO date string (YYYY-MM-DD) or None.

    Handled patterns:
      "Application Deadline: April 10, 2026"  → "2026-04-10"
      "Rolling Deadline through April 30, 2026" → "2026-04-30"
      "Application Deadline: April 10"  (no year) → current or next year
      "Ongoing Monthly Webinars" / "Ongoing" / "" → None (rolling)
    """
    if not text:
        return None

    # Definitively skip closed/ongoing text
    lower = text.lower()
    if any(w in lower for w in ("ongoing", "rolling monthly", "monthly webinar")):
        return None

    # Try "Month DD, YYYY" — most common format
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

    # Try "Month DD" without year — infer current or next year
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September"
        r"|October|November|December)\s+(\d{1,2})(?:\s*$|[^,\d])",
        text,
        re.I,
    )
    if m:
        month_name, day = m.groups()
        month_num = _MONTH_MAP.get(month_name.lower())
        if month_num:
            today = date.today()
            # If this month/day is already past this year, use next year
            year = today.year
            try:
                candidate = date(year, month_num, int(day))
            except ValueError:
                return None
            if candidate < today:
                year += 1
            return f"{year}-{month_num:02d}-{int(day):02d}"

    return None


# ---------------------------------------------------------------------------
# Call type inference
# ---------------------------------------------------------------------------

_CALL_TYPE_RULES: list[tuple[list[str], str]] = [
    (["residency", "residencies", "in residence"], "residency"),
    (["commission", "commissioned"], "commission"),
    (
        ["exhibition proposal", "exhibition call", "call for work", "call for art"],
        "exhibition_proposal",
    ),
    # Check title for grant/fellowship before scanning description — nav menus
    # on detail pages mention "Southern Prize and State Fellowships" which would
    # falsely match grants whose description is scraped with nav text included.
    (["grant", "grants", "funding", "award", "prize"], "grant"),
    (["fellowship", "fellowships"], "fellowship"),
    (
        [
            "call for filmmakers",
            "call for films",
            "screening partner",
            "film submission",
        ],
        "submission",
    ),
    (["webinar", "professional development", "presenter", "venue call"], "submission"),
]


def _infer_call_type(title: str, description: str) -> str:
    """
    Infer call_type from title first, then the first 500 chars of description.

    We limit description scanning to avoid false matches from navigation text
    that may appear in scraped page content (e.g., "Southern Prize and State
    Fellowships" in the South Arts site nav would misclassify grant programs).
    """
    # Title is the most reliable signal — check it alone first
    title_lower = title.lower()
    for keywords, call_type in _CALL_TYPE_RULES:
        if any(kw in title_lower for kw in keywords):
            return call_type

    # Fall back to beginning of description (avoids nav/footer noise)
    desc_excerpt = description[:500].lower() if description else ""
    for keywords, call_type in _CALL_TYPE_RULES:
        if any(kw in desc_excerpt for kw in keywords):
            return call_type

    return "grant"  # South Arts default is grant programs


# ---------------------------------------------------------------------------
# Application URL resolution
# ---------------------------------------------------------------------------


def _find_application_url(soup: BeautifulSoup, source_url: str) -> str:
    """
    Extract the best application URL from a detail page.

    Priority:
      1. Direct Salesforce/southarts.my.site apply link
      2. External application system (FilmFreeway, Google Forms, etc.)
      3. Salesforce portal fallback
      4. Source URL as last resort
    """
    # Prefer links that explicitly say "apply", "log in to salesforce", "submit"
    apply_keywords = {"apply", "log in", "login", "submit", "register", "apply now"}

    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True).lower()
        # Direct Salesforce grant portal link
        if "southarts.my.site.com/grants" in href:
            return href

    # External application portals (FilmFreeway, Google Forms, safe links, etc.)
    external_apply = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True).lower()
        if not href.startswith("http"):
            continue
        # Skip internal South Arts links
        if "southarts.org" in href:
            continue
        # Skip resource/info links that aren't application systems
        skip_domains = ("youtube.com", "dorisduke.org", "mellon.org", "berea.edu")
        if any(d in href for d in skip_domains):
            continue

        is_apply_text = any(kw in text for kw in apply_keywords)
        is_apply_href = any(
            k in href.lower()
            for k in ("apply", "submit", "filmfreeway", "form", "grants")
        )

        if is_apply_text or is_apply_href:
            external_apply.append(href)

    if external_apply:
        return external_apply[0]

    # Salesforce portal is the canonical fallback for South Arts grant programs
    return _SALESFORCE_PORTAL


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _parse_detail(html: str, detail_url: str) -> dict:
    """
    Parse a South Arts grant detail page.

    Returns a dict with keys:
      description, deadline, application_url, is_closed
    """
    soup = BeautifulSoup(html, "html.parser")
    page_text = soup.get_text(separator=" ", strip=True)

    # Check if this cycle is explicitly closed
    is_closed = bool(_CLOSED_RE.search(page_text))

    # Deadline from the header field-date (canonical source for detail pages)
    field_date_el = soup.find(class_="field-date")
    deadline_raw = field_date_el.get_text(strip=True) if field_date_el else ""
    deadline = _parse_deadline(deadline_raw)

    # If the detail page has a richer deadline in the body text, prefer it
    # (e.g. "Deadline: April 15" buried in program description)
    if not deadline:
        body_deadline_m = re.search(
            r"(?:deadline|due|closes?)[\s:]+([^\n.]{5,60})",
            page_text,
            re.I,
        )
        if body_deadline_m:
            deadline = _parse_deadline(body_deadline_m.group(1))

    # Full description from the main content wrapper
    desc_parts: list[str] = []
    content_wrapper = soup.find("div", class_=lambda c: c and "wysiwyg-layer" in c)
    if content_wrapper:
        for p in content_wrapper.find_all("p"):
            text = p.get_text(separator=" ", strip=True)
            if text and len(text) > 20:
                desc_parts.append(text)

    description = " ".join(desc_parts).strip()
    # Trim to a reasonable length for storage
    if len(description) > 2000:
        description = description[:1997] + "..."

    application_url = _find_application_url(soup, detail_url)

    return {
        "description": description or None,
        "deadline": deadline,
        "application_url": application_url,
        "is_closed": is_closed,
    }


# ---------------------------------------------------------------------------
# Index parser
# ---------------------------------------------------------------------------


def _parse_index(html: str) -> list[dict]:
    """
    Parse the grants index page and return a list of raw listing dicts.

    Each dict contains:
      title, blurb, detail_url, deadline_raw (from listing card)
    """
    soup = BeautifulSoup(html, "html.parser")
    listings: list[dict] = []

    for article in soup.find_all("article", class_="go-listing"):
        # Title
        title_el = article.find(class_="go-title")
        title = title_el.get_text(strip=True) if title_el else None
        if not title:
            continue

        # Detail page URL
        wrapper = article.find("a", class_="go-wrapper", href=True)
        if not wrapper:
            continue
        detail_href = wrapper["href"]
        detail_url = _resolve_url(detail_href)

        # Short blurb from the listing card (used as fallback description)
        blurb_el = article.find(class_="go-content")
        blurb = ""
        if blurb_el:
            # Remove the field-subtitle <p> which has bold action text, not description
            blurb_soup = BeautifulSoup(str(blurb_el), "html.parser")
            for p in blurb_soup.find_all("p", class_="field-subtitle"):
                p.decompose()
            blurb = blurb_soup.get_text(separator=" ", strip=True)

        # Deadline raw text from the listing card (may differ from detail page)
        date_el = article.find(class_="field-date")
        deadline_raw = date_el.get_text(strip=True) if date_el else ""

        listings.append(
            {
                "title": title,
                "blurb": blurb,
                "detail_url": detail_url,
                "deadline_raw": deadline_raw,
            }
        )

    logger.debug("SouthArts: parsed %d listings from index", len(listings))
    return listings


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the South Arts grants & opportunities index and detail pages.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    # 1. Fetch and parse the index page
    index_html = _fetch(INDEX_URL, session)
    if not index_html:
        logger.error("SouthArts: failed to fetch index page")
        return 0, 0, 0

    listings = _parse_index(index_html)
    if not listings:
        logger.warning("SouthArts: no listings found on index page")
        return 0, 0, 0

    # 2. Process each listing
    for listing in listings:
        title = listing["title"]
        detail_url = listing["detail_url"]

        # Fetch the detail page for full description, authoritative deadline, apply URL
        detail_html = _fetch(detail_url, session)
        if not detail_html:
            logger.warning(
                "SouthArts: skipping %r — could not fetch detail page", title
            )
            continue

        detail = _parse_detail(detail_html, detail_url)

        # Skip grants that are explicitly marked closed on their detail page
        if detail["is_closed"]:
            logger.debug("SouthArts: skipping %r — cycle is closed", title)
            continue

        found += 1

        # Merge blurb into description if detail page description is thin
        description = detail["description"]
        if not description and listing["blurb"]:
            description = listing["blurb"]
        elif description and listing["blurb"] and len(description) < 200:
            # Prepend the blurb as a summary if the detail description is brief
            description = listing["blurb"] + " " + description

        if description and len(description) > 2000:
            description = description[:1997] + "..."

        # Deadline: prefer detail page (more authoritative), fall back to listing card
        deadline = detail["deadline"]
        if not deadline:
            deadline = _parse_deadline(listing["deadline_raw"])

        call_type = _infer_call_type(title, description or "")

        call_data: dict = {
            "title": title,
            "description": description,
            "deadline": deadline,
            "application_url": detail["application_url"],
            "source_url": detail_url,
            "call_type": call_type,
            "eligibility": _ELIGIBILITY,
            "fee": None,  # South Arts does not charge application fees
            "source_id": source_id,
            "confidence_tier": "verified",  # South Arts is the issuing organization
            "_org_name": "south-arts",
            "metadata": {
                "listing_deadline_text": listing["deadline_raw"],
                "region": "Southeast US",
                "states_covered": [
                    "AL",
                    "AR",
                    "FL",
                    "GA",
                    "KY",
                    "LA",
                    "MS",
                    "NC",
                    "SC",
                    "TN",
                    "VA",
                    "WV",
                ],
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "SouthArts: inserted/updated %r (deadline=%s, type=%s)",
                title,
                deadline,
                call_type,
            )

    logger.info("SouthArts: %d found, %d new, %d updated", found, new, updated)
    return found, new, updated
