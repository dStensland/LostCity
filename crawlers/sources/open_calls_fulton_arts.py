"""
Crawler for Fulton County Arts & Culture open calls — Contracts for Services (CFS).

The CFS program is Fulton County's primary funding initiative supporting arts and
cultural programming throughout the county. Awards range from $1,000–$50,000.
Eligible applicants include individual artists, nonprofits, public schools, and
municipalities based in Fulton County.

Source page: https://www.fultonarts.org/contract-for-services

Crawl strategy: The CFS page is a single static page (Webflow/custom CMS) that
describes the program in full — eligibility, evaluation criteria, goals, and the
current cycle timeline. There is no separate application portal during off-cycle
periods; the page itself is the canonical reference.

Deadline handling: When the active cycle is closed, the page states an expected
launch window (e.g. "late fall 2026"). We set the deadline to the end of that
window as an approximate date and flag it in the description. When the cycle is
open, the page links to a PDF with guidelines and a deadline date that we parse.

The crawler also scans for any linked PDF guidelines and uses those as the
application_url when present.
"""

import logging
import re
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

SOURCE_URL = "https://www.fultonarts.org/contract-for-services"
BASE_URL = "https://www.fultonarts.org"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_ORG_NAME = "Fulton County Arts & Culture"

# Eligibility text assembled from page content — stable across cycles.
_ELIGIBILITY = (
    "Fulton County-based individual artists, arts and cultural nonprofit organizations, "
    "community-based nonprofit organizations, public schools, colleges, universities, "
    "and municipalities. Programs must provide public-facing arts and cultural "
    "programming that serves Fulton County residents."
)

# Full program description assembled from canonical page text.
_DESCRIPTION_BASE = (
    "The Contracts for Services (CFS) Program is Fulton County's primary funding "
    "initiative supporting the creation, presentation, and preservation of arts and "
    "cultural programming throughout the county. Awards typically range from $1,000 "
    "to $50,000, depending on the funding category and scope of services proposed. "
    "CFS provides general operating and project-based support for organizations and "
    "institutions that produce or present ongoing arts and cultural programming. "
    "Funded programs are expected to reflect the cultural diversity of Fulton County, "
    "engage audiences of all ages and backgrounds, strengthen neighborhood vitality "
    "and community connection, and support jobs and professional opportunities within "
    "the arts sector. Applications are reviewed through a competitive process "
    "evaluated on Artistic Merit, Organizational Effectiveness, Accessibility, Fiscal "
    "Management, Service to the Community and the Field, Leadership Capability, and "
    "Project and Program Clarity. Independent advisory panelists representing a broad "
    "range of artistic disciplines conduct the initial review; funding moves through "
    "FCAC staff review, Fulton County Arts Council review, Allocations Committee "
    "review, and final approval by the Fulton County Board of Commissioners."
)

# Pattern to detect an off-cycle notice like "expected to launch in late fall 2026"
_OFF_CYCLE_RE = re.compile(r"expected\s+to\s+launch\s+(?:in\s+)?(.+?)(?:\.|$)", re.I)

# Pattern to detect an explicit deadline in the page text (for active cycles)
_DEADLINE_RE = re.compile(
    r"(?:deadline|due|applications?\s+(?:due|close))[\s:]*"
    r"((?:January|February|March|April|May|June|July|August|September"
    r"|October|November|December)\s+\d{1,2},?\s*\d{4})",
    re.I,
)

# Month name → int
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

# Off-cycle window → approximate ISO deadline date.
# "late fall 2026" → we use Nov 30 of that year; "early 2027" → Feb 28.
_WINDOW_DATES: dict[str, tuple[int, int]] = {
    "early spring": (3, 15),
    "late spring": (5, 31),
    "early summer": (6, 15),
    "late summer": (8, 31),
    "early fall": (9, 15),
    "late fall": (11, 30),
    "early winter": (12, 15),
    "late winter": (2, 28),
    "early": (2, 28),
    "mid": (6, 30),
    "late": (11, 30),
}


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
        logger.warning("FultonArts: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------


def _resolve_url(href: str) -> str:
    """Ensure href is an absolute URL."""
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return BASE_URL + href
    return BASE_URL + "/" + href


def _find_guidelines_pdf(soup: BeautifulSoup) -> Optional[str]:
    """Return the absolute URL of the most recent guidelines PDF, if linked."""
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True).lower()
        # Match links that look like guidelines PDFs
        if "guideline" in (href + text).lower() and href.lower().endswith(".pdf"):
            return _resolve_url(href)
    return None


def _parse_explicit_deadline(page_text: str) -> Optional[str]:
    """
    Extract an explicit ISO deadline date from the page text.
    Returns 'YYYY-MM-DD' or None.
    """
    m = _DEADLINE_RE.search(page_text)
    if not m:
        return None
    date_str = m.group(1).strip()
    dm = re.search(
        r"(January|February|March|April|May|June|July|August|September"
        r"|October|November|December)\s+(\d{1,2}),?\s*(\d{4})",
        date_str,
        re.I,
    )
    if not dm:
        return None
    month_name, day, year = dm.groups()
    month_num = _MONTH_MAP.get(month_name.lower())
    if not month_num:
        return None
    return f"{year}-{month_num:02d}-{int(day):02d}"


def _parse_off_cycle_deadline(page_text: str) -> Optional[str]:
    """
    When the cycle is off, parse the expected launch window and return an
    approximate deadline representing the *end* of that window.

    E.g. "expected to launch in late fall 2026" → "2026-11-30"
    """
    m = _OFF_CYCLE_RE.search(page_text)
    if not m:
        return None
    window_text = m.group(1).strip().rstrip(".")

    # Extract year
    year_m = re.search(r"(\d{4})", window_text)
    if not year_m:
        return None
    year = int(year_m.group(1))

    # Match window phrase to an approximate month/day
    window_lower = window_text.lower()
    month, day = 12, 31  # fallback: end of year
    for phrase, (m_num, d_num) in _WINDOW_DATES.items():
        if phrase in window_lower:
            month, day = m_num, d_num
            break

    return f"{year}-{month:02d}-{day:02d}"


def _build_description(page_text: str, off_cycle_notice: Optional[str]) -> str:
    """
    Compose the final description. If off-cycle, append a note so portal
    visitors know the cycle is not currently open.
    """
    desc = _DESCRIPTION_BASE
    if off_cycle_notice:
        notice_clean = off_cycle_notice.strip().rstrip(".")
        desc += (
            f" Note: The CFS funding cycle is currently closed. "
            f"The next cycle is {notice_clean}. "
            f"Organizations and artists are encouraged to review program guidelines, "
            f"maintain current compliance documentation, and begin planning programs "
            f"that serve Fulton County residents."
        )
    return desc[:2000]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Fulton County Arts & Culture CFS page and upsert the open call.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    html = _fetch(SOURCE_URL, session)
    if not html:
        logger.error("FultonArts: failed to fetch CFS page")
        return 0, 0, 0

    soup = BeautifulSoup(html, "html.parser")
    page_text = soup.get_text(separator=" ", strip=True)

    # Determine whether we're in an active or off-cycle period
    off_cycle_m = _OFF_CYCLE_RE.search(page_text)
    off_cycle_notice: Optional[str] = off_cycle_m.group(0) if off_cycle_m else None

    # Resolve deadline
    deadline: Optional[str] = None
    if not off_cycle_notice:
        # Active cycle — look for explicit deadline on the page
        deadline = _parse_explicit_deadline(page_text)
    else:
        # Off-cycle — use approximate launch window as a soft deadline
        deadline = _parse_off_cycle_deadline(page_text)

    # Resolve application URL — prefer linked guidelines PDF, fall back to source page
    guidelines_pdf = _find_guidelines_pdf(soup)
    application_url = guidelines_pdf or SOURCE_URL

    # Build description
    description = _build_description(page_text, off_cycle_notice)

    found += 1

    call_data: dict = {
        "title": "Contracts for Services (CFS)",
        "description": description,
        "deadline": deadline,
        "application_url": application_url,
        "fee": None,  # No application fee for government grant
        "eligibility": _ELIGIBILITY,
        "call_type": "grant",
        "source_url": SOURCE_URL,
        "source_id": source_id,
        "confidence_tier": "verified",
        "_org_name": "fulton-county-arts-culture",
        "metadata": {
            "award_range": "$1,000–$50,000",
            "off_cycle": bool(off_cycle_notice),
            "guidelines_pdf": guidelines_pdf,
        },
    }

    result = insert_open_call(call_data)
    if result:
        new += 1
        logger.info(
            "FultonArts: inserted/updated CFS open call (id=%s, deadline=%s, off_cycle=%s)",
            result,
            deadline,
            bool(off_cycle_notice),
        )
    else:
        logger.debug("FultonArts: CFS open call already up to date")

    logger.info("FultonArts: %d found, %d new, %d updated", found, new, updated)
    return found, new, updated
