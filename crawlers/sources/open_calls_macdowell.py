"""
Crawler for MacDowell Fellowship residency open calls.

Source: https://www.macdowell.org/apply

MacDowell is one of the most prestigious artist residency programs in the
United States, founded in 1907 and located in Peterborough, NH. About 300
artists per year receive Fellowships across seven disciplines. There are no
residency fees, and need-based stipends and travel reimbursement are available.

Application cycles — two per year, visible on the /apply page:

  Spring/Summer residencies (March–August):
    Applications open:    August 15
    Application deadline: September 10

  Fall/Winter residencies (September–February):
    Applications open:    January 15
    Application deadline: February 10

The /apply page renders these deadlines inside:
  <div class="info-item">
    <h2>Application Deadlines</h2>
    <div class="copy">
      <p><strong>Spring Summer YYYY</strong>...
         Application deadline: September 10, YYYY
      </p>
      ...
    </div>
  </div>

This crawler reads the live page to capture the current published deadline
dates, then falls back to the known schedule if parsing fails.

Confidence tier: "verified" — MacDowell is the issuing organization.
Application portal: https://macdowell.slideroom.com/
"""

import logging
import re
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SOURCE_URL = "https://www.macdowell.org/apply"
APPLICATION_URL = "https://macdowell.slideroom.com/"

_ORG_NAME = "macdowell"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

_DISCIPLINES = [
    "Architecture",
    "Film/Video",
    "Interdisciplinary Arts",
    "Literature",
    "Music Composition",
    "Theatre",
    "Visual Arts",
]

_ELIGIBILITY = (
    "Open to artists of all backgrounds and nationalities in seven disciplines: "
    "architecture, film/video, interdisciplinary arts, literature, music composition, "
    "theatre, and visual arts. The sole criterion for acceptance is artistic excellence. "
    "Emerging and established artists are both encouraged to apply. Conversational "
    "English is recommended as no interpretation services are provided."
)

# ---------------------------------------------------------------------------
# Hardcoded fallback cycle schedule
#
# MacDowell runs two cycles per year. The schedule has been stable for years.
# Deadlines fall in September (for Spring/Summer residencies) and February
# (for Fall/Winter residencies).
#
# Each entry: month/day the deadline falls, and which residency season it covers.
# ---------------------------------------------------------------------------

_CYCLES = [
    {
        "key": "spring_summer",
        "label_prefix": "Spring/Summer",
        "deadline_month": 9,
        "deadline_day": 10,
        "open_month": 8,
        "open_day": 15,
        # Residency is March–August of the year following the Sep deadline
        "residency_months": "March through August",
        "residency_next_year": True,
    },
    {
        "key": "fall_winter",
        "label_prefix": "Fall/Winter",
        "deadline_month": 2,
        "deadline_day": 10,
        "open_month": 1,
        "open_day": 15,
        # Residency is Sep–Feb spanning two calendar years
        "residency_months": "September through February",
        "residency_next_year": False,
    },
]

_MONTH_NAMES = {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December",
}

_MONTH_MAP = {v.lower(): k for k, v in _MONTH_NAMES.items()}


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
        logger.warning("MacDowell: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Page parsing — extract live deadline dates
# ---------------------------------------------------------------------------


def _parse_live_deadlines(html: str) -> list[dict]:
    """
    Parse the Application Deadlines block from the MacDowell /apply page.

    HTML structure:
      <div class="info-item">
        <h2>Application Deadlines</h2>
        <div class="copy">
          <p>
            <strong>Spring Summer 2027</strong>
            <em>For residencies March 1 – August 31, 2027</em>
            Applications open: August 15, 2026
            Application deadline: September 10, 2026
          </p>
          ...
        </div>
      </div>

    Returns a list of dicts with keys: session_label, deadline, opens.
    Returns empty list if the structure is not found.
    """
    soup = BeautifulSoup(html, "html.parser")

    # Find the info-item div containing the h2
    info_item = None
    for div in soup.find_all("div", class_="info-item"):
        h2 = div.find("h2")
        if h2 and "application deadlines" in h2.get_text(strip=True).lower():
            info_item = div
            break

    if not info_item:
        logger.warning("MacDowell: 'Application Deadlines' block not found on page")
        return []

    copy_div = info_item.find("div", class_="copy")
    if not copy_div:
        logger.warning("MacDowell: .copy div not found in deadlines block")
        return []

    results = []
    for p in copy_div.find_all("p"):
        text = p.get_text(separator=" ", strip=True)

        # Extract session label from <strong>
        strong = p.find("strong")
        session_label = strong.get_text(strip=True) if strong else ""

        # Extract "Application deadline: Month D, YYYY"
        deadline = _parse_date_from_text(text, keyword="deadline")

        if session_label and deadline:
            results.append(
                {
                    "session_label": session_label,
                    "deadline": deadline,
                }
            )
            logger.debug(
                "MacDowell: parsed live deadline — %s → %s",
                session_label,
                deadline,
            )

    return results


def _parse_date_from_text(text: str, keyword: str = "") -> Optional[str]:
    """
    Extract an ISO date (YYYY-MM-DD) from free-form text.

    If keyword is provided, only search text after the keyword.
    Handles: "September 10, 2026", "February 10, 2027"
    """
    if keyword:
        lower = text.lower()
        idx = lower.find(keyword.lower())
        if idx == -1:
            return None
        text = text[idx:]

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


# ---------------------------------------------------------------------------
# Fallback cycle computation (mirrors Hambidge pattern)
# ---------------------------------------------------------------------------


def _compute_fallback_deadline(cycle: dict, today: date) -> Optional[date]:
    """
    Compute the next upcoming deadline for a cycle from the hardcoded schedule.
    If this year's deadline has passed, advance to next year.
    """
    dm = cycle["deadline_month"]
    dd = cycle["deadline_day"]
    year = today.year

    try:
        deadline = date(year, dm, dd)
    except ValueError:
        return None

    if deadline < today:
        year += 1
        try:
            deadline = date(year, dm, dd)
        except ValueError:
            return None

    return deadline


def _residency_year_label(cycle: dict, deadline: date) -> str:
    """Build the 'YYYY' or 'YYYY–YYYY' label for the residency period."""
    if cycle["residency_next_year"]:
        res_year = deadline.year + 1
        if cycle["key"] == "fall_winter":
            return f"{res_year}–{res_year + 1}"
        return str(res_year)
    else:
        if cycle["key"] == "fall_winter":
            return f"{deadline.year}–{deadline.year + 1}"
        return str(deadline.year)


# ---------------------------------------------------------------------------
# Description builder
# ---------------------------------------------------------------------------

_DESC_TEMPLATE = (
    "MacDowell — one of the most prestigious artist residency programs in the "
    "United States — awards Fellowships to artists across seven disciplines: "
    "architecture, film/video, interdisciplinary arts, literature, music composition, "
    "theatre, and visual arts. The sole criterion for selection is artistic excellence; "
    "emerging and established artists are both welcomed.\n\n"
    "About 300 Fellowships are awarded each year. Residents receive a private studio "
    "(many with sleeping quarters), all meals, and the full support of MacDowell's "
    "100-acre campus in Peterborough, New Hampshire. There are no residency fees. "
    "Need-based stipends ($300–$1,000 per week, up to $5,000 per residency) and "
    "travel reimbursement grants are available.\n\n"
    "The {session_label} residency session runs {residency_period}. "
    "Stays typically range from 2 to 8 weeks, and residents are selected "
    "by discipline-specific independent review panels. MacDowell encourages "
    "applications from artists of all backgrounds and all countries. "
    "Conversational English is recommended."
)


def _build_description(session_label: str, residency_period: str) -> str:
    return _DESC_TEMPLATE.format(
        session_label=session_label,
        residency_period=residency_period,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl MacDowell's /apply page and generate open_call records for each
    active or upcoming application cycle.

    Strategy:
      1. Fetch the /apply page.
      2. Try to parse live deadline dates from the Application Deadlines block.
      3. For each parsed cycle, check if the deadline is upcoming (within 12 months).
      4. Fall back to hardcoded schedule if live parsing fails.
      5. Insert/update via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0
    today = date.today()

    html = _fetch(SOURCE_URL)
    if not html:
        logger.error("MacDowell: could not fetch /apply page — aborting")
        return 0, 0, 0

    # Validate the page is still the right one
    if "macdowell" not in html.lower() or "fellowship" not in html.lower():
        logger.warning(
            "MacDowell: page content looks unexpected — may have been redesigned"
        )

    # Try live deadline parsing first
    live_deadlines = _parse_live_deadlines(html)

    if live_deadlines:
        logger.info(
            "MacDowell: parsed %d live deadline cycles from page",
            len(live_deadlines),
        )
        records = _build_records_from_live(live_deadlines, today)
    else:
        logger.info(
            "MacDowell: live parsing produced no results — using hardcoded schedule"
        )
        records = _build_records_from_hardcoded(today)

    for call_data in records:
        call_data["source_id"] = source_id
        found += 1
        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.info(
                "MacDowell: inserted/updated '%s' (deadline=%s)",
                call_data["title"],
                call_data.get("deadline", "unknown"),
            )

    logger.info(
        "MacDowell: %d active cycles found, %d new/updated records",
        found,
        new,
    )
    return found, new, updated


def _build_records_from_live(
    live_deadlines: list[dict], today: date
) -> list[dict]:
    """Convert live-parsed deadline entries into open_call dicts."""
    records = []
    for entry in live_deadlines:
        deadline_str = entry["deadline"]
        session_label = entry["session_label"]

        try:
            deadline_date = date.fromisoformat(deadline_str)
        except ValueError:
            logger.warning(
                "MacDowell: could not parse deadline %r for %s",
                deadline_str,
                session_label,
            )
            continue

        # Skip if deadline is more than 12 months out or already past
        days_until = (deadline_date - today).days
        if days_until < 0:
            logger.debug(
                "MacDowell: %s deadline %s already passed — skipping",
                session_label,
                deadline_str,
            )
            continue
        if days_until > 365:
            logger.debug(
                "MacDowell: %s deadline %s is >12 months away — skipping for now",
                session_label,
                deadline_str,
            )
            continue

        # Infer season from label
        label_lower = session_label.lower()
        if "spring" in label_lower or "summer" in label_lower:
            residency_months = "March through August"
        elif "fall" in label_lower or "winter" in label_lower:
            residency_months = "September through February"
        else:
            residency_months = "upcoming"

        title = f"MacDowell Fellowship — {session_label}"
        description = _build_description(session_label, residency_months)

        records.append(
            {
                "title": title,
                "description": description,
                "deadline": deadline_str,
                "application_url": APPLICATION_URL,
                "source_url": SOURCE_URL,
                "call_type": "residency",
                "eligibility": _ELIGIBILITY,
                "fee": None,  # No residency fees; no application fee
                "confidence_tier": "verified",
                "_org_name": _ORG_NAME,
                "metadata": {
                    "session": session_label,
                    "residency_months": residency_months,
                    "disciplines": _DISCIPLINES,
                    "location": "Peterborough, NH",
                    "duration": "2–8 weeks (typical)",
                    "stipend_available": True,
                    "travel_reimbursement": True,
                    "application_fee": None,
                    "residency_fee": None,
                    "application_system": "SlideRoom",
                    "source": "live_parse",
                },
            }
        )

    return records


def _build_records_from_hardcoded(today: date) -> list[dict]:
    """Build open_call records from the hardcoded cycle schedule."""
    records = []
    for cycle in _CYCLES:
        deadline = _compute_fallback_deadline(cycle, today)
        if not deadline:
            continue

        days_until = (deadline - today).days
        if days_until < 0 or days_until > 365:
            continue

        res_year_label = _residency_year_label(cycle, deadline)
        session_label = f"{cycle['label_prefix']} {res_year_label}"
        residency_months = cycle["residency_months"]
        title = f"MacDowell Fellowship — {session_label}"
        description = _build_description(session_label, residency_months)

        records.append(
            {
                "title": title,
                "description": description,
                "deadline": deadline.isoformat(),
                "application_url": APPLICATION_URL,
                "source_url": SOURCE_URL,
                "call_type": "residency",
                "eligibility": _ELIGIBILITY,
                "fee": None,
                "confidence_tier": "verified",
                "_org_name": _ORG_NAME,
                "metadata": {
                    "session": session_label,
                    "residency_months": residency_months,
                    "disciplines": _DISCIPLINES,
                    "location": "Peterborough, NH",
                    "duration": "2–8 weeks (typical)",
                    "stipend_available": True,
                    "travel_reimbursement": True,
                    "application_fee": None,
                    "residency_fee": None,
                    "application_system": "SlideRoom",
                    "source": "hardcoded_schedule",
                    "open_date": (
                        f"{_MONTH_NAMES[cycle['open_month']]} {cycle['open_day']}"
                    ),
                },
            }
        )

    return records
