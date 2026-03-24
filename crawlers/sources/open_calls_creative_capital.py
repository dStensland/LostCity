"""
Crawler for Creative Capital grant open calls.

Source: https://creative-capital.org/apply

Creative Capital is a national nonprofit founded in 1999 that champions artistic
freedom by providing grants and services to individual artists. It runs a major
open call approximately every two years (recent cadence: 2024, 2026 open calls
for 2025, 2027 award cycles).

The "Creative Capital Award" provides unrestricted project grants of up to
$50,000 plus professional development support. The "State of the Art Prize"
(new in 2026) awards $10,000 to one artist per U.S. state/territory.
All applicants to the Open Call are automatically considered for both.

Crawl strategy:
  1. Fetch https://creative-capital.org/apply
  2. Detect whether an open call is currently active (check for deadline text)
  3. Parse the deadline date and application URL from the page
  4. If no active open call, still create a record with deadline=None to keep
     the program visible on the Arts portal between cycles

The application portal is hosted on Salesforce (creativecapital.my.site.com).

Confidence tier: "verified" — Creative Capital is the issuing organization.
"""

import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SOURCE_URL = "https://creative-capital.org/apply"
_FALLBACK_APPLICATION_URL = "https://creativecapital.my.site.com/apply/s/"

_ORG_NAME = "creative-capital"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

_MONTH_MAP: dict[str, int] = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

_DISCIPLINES = [
    "Visual Arts",
    "Performing Arts (Dance, Theater, Music/Jazz)",
    "Film",
    "Literature",
    "Multidisciplinary",
    "Technology",
    "Socially Engaged Practice",
]

_ELIGIBILITY = (
    "Individual artists residing in all 50 U.S. states and inhabited territories. "
    "Open to artists at all career stages across visual arts, performing arts "
    "(dance, theater, music/jazz), film, literature, technology, multidisciplinary, "
    "and socially engaged forms. Proposals must be for new, original works. "
    "All applicants are automatically considered for both the Creative Capital Award "
    "and the State of the Art Prize."
)


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------


def _fetch(url: str) -> Optional[str]:
    """Fetch a URL and return HTML, or None on failure."""
    try:
        session = requests.Session()
        session.headers.update({"User-Agent": _USER_AGENT})
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("Creative Capital: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Page parsing
# ---------------------------------------------------------------------------


def _parse_deadline(text: str) -> Optional[str]:
    """
    Extract an ISO deadline date (YYYY-MM-DD) from free-form text.

    Handles:
      "April 2, 2026 at 3PM ET"     → "2026-04-02"
      "Thursday, April 2, 2026"     → "2026-04-02"
      "March 2, 2026"               → "2026-03-02"
    """
    if not text:
        return None

    # "Month D, YYYY" — most common CC format
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

    return None


def _is_past_deadline(deadline_str: str) -> bool:
    """Return True if the deadline date is already in the past."""
    try:
        dl = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        return dl < date.today()
    except ValueError:
        return False


def _extract_application_url(html: str) -> str:
    """
    Find the application portal link on the page.

    Creative Capital uses a Salesforce-hosted portal (creativecapital.my.site.com).
    Falls back to the known constant if not found.
    """
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "creativecapital.my.site.com" in href or "salesforce" in href:
            return href
    return _FALLBACK_APPLICATION_URL


def _parse_open_call_year(html: str) -> Optional[str]:
    """
    Extract the open call year label from the page (e.g., "2027").
    Used to build an accurate title like "Creative Capital 2027 Open Call".
    """
    # Look for "20XX Creative Capital Open Call" or "Creative Capital 20XX Open Call"
    m = re.search(r"(20\d{2})\s+(?:Creative Capital\s+)?Open Call", html, re.I)
    if m:
        return m.group(1)
    m = re.search(r"Creative Capital\s+(20\d{2})\s+Open Call", html, re.I)
    if m:
        return m.group(1)
    return None


def _parse_award_amounts(html: str) -> dict:
    """Extract grant amounts from page text."""
    amounts: dict = {}

    # Main award
    m = re.search(r"up to\s+\$([0-9,]+)\s+to individual artists", html, re.I)
    if m:
        amounts["creative_capital_award_max"] = m.group(1).replace(",", "")

    # State of the Art Prize
    m = re.search(r"State of the Art Prize[^$]*\$([0-9,]+)", html, re.I)
    if m:
        amounts["state_of_the_art_prize"] = m.group(1).replace(",", "")

    return amounts


def _extract_main_content(html: str) -> str:
    """
    Extract the main body text from the Creative Capital /apply page.

    The page uses a standard WordPress/Webflow layout. We collect paragraphs
    from the main content area, stopping at navigation/footer-like sections.
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()

    parts: list[str] = []
    for p in soup.find_all("p"):
        text = p.get_text(separator=" ", strip=True)
        if text and len(text) > 40:
            parts.append(text)

    content = " ".join(parts).strip()
    if len(content) > 2500:
        content = content[:2497] + "..."
    return content


# ---------------------------------------------------------------------------
# Description builder
# ---------------------------------------------------------------------------

_DESC_OPEN = (
    "Creative Capital — a national nonprofit founded in 1999 — provides unrestricted "
    "project grants and professional development support to individual artists creating "
    "bold, experimental new work. The {cycle_label} Open Call awards the Creative "
    "Capital Award (grants up to $50,000 per project) and the State of the Art Prize "
    "($10,000 per artist, one per U.S. state/territory) to artists across visual arts, "
    "performing arts (dance, theater, music/jazz), film, literature, technology, "
    "multidisciplinary, and socially engaged forms.\n\n"
    "All applicants are automatically considered for both awards. In addition to grant "
    "funding, Creative Capital Award recipients receive professional development "
    "services, industry connections, and community-building opportunities, plus access "
    "to Artist Lab — Creative Capital's free online professional development platform.\n\n"
    "The application deadline is {deadline_str}. Applications are submitted via the "
    "Creative Capital application portal."
)

_DESC_CLOSED = (
    "Creative Capital — a national nonprofit founded in 1999 — provides unrestricted "
    "project grants and professional development support to individual artists creating "
    "bold, experimental new work. Open Calls are held approximately every two years.\n\n"
    "The Creative Capital Award provides grants of up to $50,000 plus professional "
    "development support and community access. The State of the Art Prize awards "
    "$10,000 to one artist per U.S. state and inhabited territory.\n\n"
    "The next Open Call dates have not been announced. Check creative-capital.org/apply "
    "for updates, or sign up for their newsletter to be notified when the next cycle opens."
)


def _build_open_description(cycle_label: str, deadline_str: str) -> str:
    return _DESC_OPEN.format(
        cycle_label=cycle_label,
        deadline_str=deadline_str,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Creative Capital /apply page and generate an open_call record.

    If an active open call is found (deadline in the future), creates a record
    with the live deadline and application URL.

    If no active open call is found (between cycles), creates a record with
    deadline=None so the program remains visible to artists between cycles.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    html = _fetch(SOURCE_URL)
    if not html:
        logger.error("Creative Capital: could not fetch /apply page — aborting")
        return 0, 0, 0

    if "creative capital" not in html.lower():
        logger.warning(
            "Creative Capital: page content looks unexpected — check %s",
            SOURCE_URL,
        )

    # Extract key data from the page
    application_url = _extract_application_url(html)
    cycle_year = _parse_open_call_year(html)
    award_amounts = _parse_award_amounts(html)

    # Find the deadline — scan multi-line windows since the date and the word
    # "deadline" often appear on adjacent lines (inline elements split by BS4)
    soup = BeautifulSoup(html, "html.parser")
    page_text = soup.get_text(separator="\n", strip=True)
    deadline: Optional[str] = None
    deadline_display = "TBD"

    lines = page_text.splitlines()
    for i, line in enumerate(lines):
        # Join up to 2 surrounding lines to catch split deadline text
        window = " ".join(
            ln.strip() for ln in lines[max(0, i - 1) : min(len(lines), i + 3)]
            if ln.strip()
        )
        if "deadline" not in window.lower():
            continue
        parsed = _parse_deadline(window)
        if parsed and not _is_past_deadline(parsed):
            deadline = parsed
            deadline_display = window[:120]
            logger.info(
                "Creative Capital: found upcoming deadline: %s → %s",
                deadline_display,
                deadline,
            )
            break
        elif parsed:
            logger.debug(
                "Creative Capital: found past deadline %s — skipping", parsed
            )

    # Build cycle label
    cycle_label = f"{cycle_year} " if cycle_year else ""
    cycle_label = f"{cycle_label}Creative Capital"

    if deadline and not _is_past_deadline(deadline):
        # Active open call
        title = f"{cycle_label} Open Call"
        description = _build_open_description(cycle_label, deadline_display)
        status = "open"
        logger.info(
            "Creative Capital: active open call found (deadline=%s)", deadline
        )
    else:
        # Between cycles — still create a record so artists can discover the program
        title = "Creative Capital Open Call"
        description = _DESC_CLOSED
        deadline = None
        status = "open"  # program is ongoing even when not actively accepting
        logger.info(
            "Creative Capital: no active open call found — creating closed-cycle record"
        )

    found = 1

    call_data: dict = {
        "title": title,
        "description": description,
        "deadline": deadline,
        "application_url": application_url,
        "source_url": SOURCE_URL,
        "call_type": "grant",
        "eligibility": _ELIGIBILITY,
        "fee": None,  # No application fee
        "source_id": source_id,
        "confidence_tier": "verified",
        "_org_name": _ORG_NAME,
        "metadata": {
            "source": "creative-capital",
            "cycle_year": cycle_year,
            "award_amounts": award_amounts or {
                "creative_capital_award_max": "50000",
                "state_of_the_art_prize": "10000",
            },
            "scope": "national",
            "disciplines": _DISCIPLINES,
            "application_system": "salesforce",
            "application_portal": application_url,
            "professional_development_included": True,
            "status": status,
        },
    }

    result = insert_open_call(call_data)
    if result:
        new += 1
        logger.info(
            "Creative Capital: inserted/updated '%s' (deadline=%s)",
            title,
            deadline or "none/rolling",
        )
    else:
        logger.warning(
            "Creative Capital: insert_open_call returned no ID for '%s'", title
        )

    logger.info(
        "Creative Capital: %d found, %d new, %d updated", found, new, updated
    )
    return found, new, updated
