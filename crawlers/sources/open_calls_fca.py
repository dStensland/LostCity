"""
Crawler for Foundation for Contemporary Arts (FCA) open call grant programs.

URL: https://www.foundationforcontemporaryarts.org/grants

FCA runs four core programs. Only one accepts open applications:

  INCLUDED — Emergency Grants (open application, rolling via Submittable)
    - Year-round program for visual and performing artists and poets
    - Grants of $500–$3,000 for urgent project needs
    - Apply 8–10 weeks before project's public presentation date
    - No fixed annual deadline — rolling monthly panel review
    - Application: https://foundationforcontemporaryarts.submittable.com/submit

  EXCLUDED — Grants to Artists ($45,000): nomination-only, no applications
  EXCLUDED — Creative Research Grants ($10,000): invitation-only (invites
             past Emergency Grant recipients), cycle TBA for 2026
  EXCLUDED — Ellsworth Kelly Award ($45,000): invitation-only

Crawl strategy:
  1. Fetch the Emergency Grants overview page for general program description.
  2. Fetch the guidelines page for eligibility detail.
  3. Fetch the process page to confirm Submittable application link and
     detect any announced cycle deadline (rare — program is rolling).
  4. Synthesize into a single open call record.

FCA is the issuing organisation, so confidence_tier is "verified".
No application fee for any FCA program.
"""

import logging
import re
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://www.foundationforcontemporaryarts.org"

# Pages to fetch for the Emergency Grants program
_EG_OVERVIEW_URL = f"{BASE_URL}/grants/emergency-grants/"
_EG_GUIDELINES_URL = f"{BASE_URL}/grants/emergency-grants/guidelines/"
_EG_PROCESS_URL = f"{BASE_URL}/grants/emergency-grants/process/"

# FCA's Submittable application portal (confirmed on process page)
_SUBMITTABLE_URL = "https://foundationforcontemporaryarts.submittable.com/submit"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

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
# HTTP helper
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return its HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("FCA: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Content extraction helpers
# ---------------------------------------------------------------------------


def _extract_content_copy(html: str) -> str:
    """
    Extract the main body copy from an FCA page.

    FCA uses a consistent layout: the editorial content is inside
    <div class="c-content__copy">. We gather all <p> and <li> text from
    that block.
    """
    soup = BeautifulSoup(html, "html.parser")
    content_div = soup.find("div", class_="c-content__copy")
    if not content_div:
        return ""

    parts: list[str] = []
    for el in content_div.find_all(["p", "li"]):
        text = el.get_text(separator=" ", strip=True)
        if text and len(text) > 20:
            parts.append(text)

    return " ".join(parts).strip()


def _find_submittable_url(html: str) -> Optional[str]:
    """
    Look for a Submittable application link on the page.

    Returns the href if found, None otherwise.
    """
    soup = BeautifulSoup(html, "html.parser")
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "submittable.com" in href:
            return href
    return None


def _parse_deadline(text: str) -> Optional[str]:
    """
    Extract an ISO deadline date (YYYY-MM-DD) from free-form text.

    Only matches explicit named-month dates. Rolling/ongoing programs
    return None (the caller stores deadline=None for open/rolling calls).

    Handled patterns:
      "February 24, 2026"     → "2026-02-24"
      "October 2026"          → None (month-only, not specific enough)
      "rolling"               → None
    """
    if not text:
        return None

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


def _scan_for_deadline(html: str) -> Optional[str]:
    """
    Scan all text on a page for an explicit deadline date.

    FCA's Emergency Grants process page sometimes announces a specific
    information session date or a cycle deadline. We scan for any line
    containing "deadline" and try to parse a date from it.

    Returns the first match, or None if no specific deadline is found
    (which is the normal case for this rolling program).
    """
    soup = BeautifulSoup(html, "html.parser")
    page_text = soup.get_text(separator="\n", strip=True)

    for line in page_text.splitlines():
        lower_line = line.lower()
        if "deadline" not in lower_line:
            continue
        # Skip lines about the 3-year waiting period or information sessions
        if any(
            phrase in lower_line
            for phrase in (
                "wait period",
                "waiting period",
                "information session",
                "information sessions",
            )
        ):
            continue
        parsed = _parse_deadline(line)
        if parsed:
            return parsed

    return None


# ---------------------------------------------------------------------------
# Program builder
# ---------------------------------------------------------------------------


def _build_emergency_grants(
    overview_html: str,
    guidelines_html: str,
    process_html: str,
) -> dict:
    """
    Synthesise an open_calls record for FCA Emergency Grants from three pages.

    Description priority:
      1. Overview page body (most concise program summary)
      2. Augmented with key eligibility facts from guidelines page

    Application URL:
      - Confirmed Submittable link from process page (most authoritative)
      - Falls back to known Submittable URL constant

    Deadline:
      - Scan process page for any explicitly announced cycle deadline
      - If none found, deadline=None (this is a rolling/year-round program)
    """
    # Description: pull from overview, trim to a readable length
    overview_copy = _extract_content_copy(overview_html)

    # Eligibility summary pulled from the first ~600 chars of guidelines copy
    # (covers the "who is eligible" section without all the exclusions)
    guidelines_copy = _extract_content_copy(guidelines_html)

    description_parts: list[str] = []
    if overview_copy:
        description_parts.append(overview_copy[:1800])
    if guidelines_copy:
        # Prepend with "Eligibility:" label and a brief excerpt
        eligibility_excerpt = guidelines_copy[:600]
        if eligibility_excerpt not in (overview_copy or ""):
            description_parts.append(f"Eligibility: {eligibility_excerpt}")

    description = " ".join(description_parts).strip()
    if len(description) > 2500:
        description = description[:2497] + "..."

    # Application URL from process page (most authoritative source)
    application_url = _find_submittable_url(process_html) or _SUBMITTABLE_URL

    # Deadline: scan process page for any explicitly announced cycle deadline
    deadline = _scan_for_deadline(process_html)

    return {
        "title": "FCA Emergency Grants",
        "description": description or None,
        "deadline": deadline,
        "application_url": application_url,
        "source_url": _EG_OVERVIEW_URL,
        "call_type": "grant",
        "eligibility": (
            "Individual artists and artist collectives working in dance, "
            "music/sound, performance art/theater, poetry, or visual arts "
            "who live and work in the United States or U.S. territories. "
            "Must have a U.S. Tax ID (SSN, EIN, or ITIN). "
            "Artists enrolled in any degree-granting program are not eligible."
        ),
        "fee": None,
        "confidence_tier": "verified",
        "_org_name": "foundation-for-contemporary-arts",
        "metadata": {
            "source": "fca",
            "award_amount": "$500–$3,000",
            "scope": "national",
            "program": "emergency_grants",
            "application_system": "submittable",
            "panel_frequency": "monthly",
            "disciplines": [
                "dance",
                "music/sound",
                "performance art/theater",
                "poetry",
                "visual arts",
            ],
        },
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl FCA Emergency Grants and insert as an open call.

    FCA runs only one program open for direct application: Emergency Grants.
    The other three programs (Grants to Artists, Creative Research Grants,
    Ellsworth Kelly Award) are nomination-only or invitation-only and are
    excluded from open_calls.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Referer": BASE_URL + "/",
        }
    )

    # Fetch all three Emergency Grants pages
    overview_html = _fetch(_EG_OVERVIEW_URL, session)
    if not overview_html:
        logger.error("FCA: failed to fetch Emergency Grants overview page")
        return 0, 0, 0

    guidelines_html = _fetch(_EG_GUIDELINES_URL, session)
    if not guidelines_html:
        logger.warning(
            "FCA: could not fetch guidelines page — proceeding with overview only"
        )
        guidelines_html = ""

    process_html = _fetch(_EG_PROCESS_URL, session)
    if not process_html:
        logger.warning(
            "FCA: could not fetch process page — application URL falls back to constant"
        )
        process_html = ""

    # Build the record
    call_data = _build_emergency_grants(overview_html, guidelines_html, process_html)
    call_data["source_id"] = source_id

    found = 1

    result = insert_open_call(call_data)
    if result:
        new += 1
        logger.info(
            "FCA: inserted/updated Emergency Grants "
            "(deadline=%s, application_url=%s)",
            call_data.get("deadline") or "rolling",
            call_data.get("application_url"),
        )
    else:
        logger.warning("FCA: insert_open_call returned no ID for Emergency Grants")

    logger.info("FCA: %d found, %d new, %d updated", found, new, updated)
    return found, new, updated
