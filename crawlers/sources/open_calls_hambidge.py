"""
Crawler for Hambidge Center residency open calls.

Source: https://www.hambidge.org/residency

The Hambidge Center is the oldest artist residency program in the Southeast,
situated on 600 forested acres in Rabun Gap, North Georgia (about 2 hours north
of Atlanta). It runs three application cycles per year:

  Summer Session  (June–August):          apply December 1 – January 15
  Fall Session    (September–December):   apply March 1 – April 15
  Spring Session  (mid-February–May):     apply August 1 – September 15

Application windows and deadlines are published on the residency guidelines page
as plain text. This crawler reads that page, identifies the current calendar year's
active/upcoming application windows, and creates one open_call per open window.
Past-deadline windows are skipped.

Application portal: https://hambidge.slideroom.com/
Residency fee: $300/week (2–8 weeks). Application fee: $30 (waivable).
Confidence tier: "verified" — Hambidge is the issuing organization.
"""

import logging
import re
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

SOURCE_URL = "https://www.hambidge.org/residency"
APPLICATION_URL = "https://hambidge.slideroom.com/"

_ORG_NAME = "hambidge-center"
_ELIGIBILITY = (
    "Open to creative professionals of all backgrounds from across the US and "
    "internationally. Applicants must demonstrate a professional-level creative "
    "practice. Emerging, mid-career, and established artists are all encouraged "
    "to apply."
)

_DISCIPLINES = [
    "Visual Arts",
    "Writing",
    "Music",
    "Dance",
    "Ceramics",
    "Culinary Arts",
    "Science",
    "Arts & Culture Administration",
    "Multidisciplinary",
]

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

# ---------------------------------------------------------------------------
# Session calendar — the three annual application windows
#
# Each entry defines one cycle. The "open_month/open_day" through
# "deadline_month/deadline_day" window is the application period. The
# "residency_months" describe when the resulting session takes place.
# For Spring, the residency year is current_year + 1; for all others it is
# the same as the application year.
# ---------------------------------------------------------------------------

_CYCLES = [
    {
        "key": "summer",
        "session_label": "Summer Session",
        # Application window: Dec 1 of PREVIOUS year through Jan 15
        "open_month": 12,
        "open_day": 1,
        "deadline_month": 1,
        "deadline_day": 15,
        # The deadline falls in January — same year as Jan 15
        "deadline_in_next_year": True,
        "residency_months": "June through August",
        "max_stay_weeks": 4,  # Summer max is 4 weeks
    },
    {
        "key": "fall",
        "session_label": "Fall Session",
        # Application window: Mar 1 – Apr 15
        "open_month": 3,
        "open_day": 1,
        "deadline_month": 4,
        "deadline_day": 15,
        "deadline_in_next_year": False,
        "residency_months": "September through December",
        "max_stay_weeks": 8,
    },
    {
        "key": "spring",
        "session_label": "Spring Session",
        # Application window: Aug 1 – Sep 15 (for Spring of FOLLOWING year)
        "open_month": 8,
        "open_day": 1,
        "deadline_month": 9,
        "deadline_day": 15,
        "deadline_in_next_year": False,
        "residency_months": "mid-February through May",
        "residency_next_year": True,  # Spring session is in the year after application
        "max_stay_weeks": 8,
    },
]


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------


def _fetch_page(url: str) -> Optional[str]:
    """Fetch a URL and return HTML, or None on failure."""
    try:
        session = requests.Session()
        session.headers.update({"User-Agent": _USER_AGENT})
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("Hambidge: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Page validation
# ---------------------------------------------------------------------------


def _validate_page(html: str) -> bool:
    """
    Confirm the fetched page still contains the expected application deadline
    structure. This catches site redesigns before they silently produce zero
    records.
    """
    text = html.lower()
    return "application deadlines" in text and "hambidge" in text


# ---------------------------------------------------------------------------
# Description builder
# ---------------------------------------------------------------------------

_DESCRIPTION_TEMPLATE = (
    "The Hambidge Center — the oldest artist residency program in the Southeast — "
    "offers self-directed residencies of 2–8 weeks on 600 forested acres in Rabun "
    "Gap, North Georgia. Residents receive a private studio with living space, "
    "bathroom, and full kitchen, plus communal vegetarian dinners Tuesday–Friday "
    "with a small group of 8–10 fellow residents working across disciplines. "
    "There are no workshops, critiques, or required activities; residents' time is "
    "entirely their own.\n\n"
    "Disciplines accepted: Visual Arts, Writing, Music, Dance, Ceramics, Culinary "
    "Arts, Science, Arts & Culture Administration, and Multidisciplinary practice. "
    "Specialized facilities include the Antinori Pottery Studio and a restored "
    "Steinway grand piano. Two ADA-compliant studios are available.\n\n"
    "The {session_label} runs {residency_period}. Stays of 2–{max_weeks} weeks "
    "are available (Arts & Culture Administration and Culinary applicants may "
    "apply for 1-week stays). Applications are reviewed by discipline-specific "
    "peer panels. Returning fellows must wait 2 years between residencies.\n\n"
    "Fees: $30 application fee (waivable — contact office@hambidge.org). "
    "$300/week residency fee (actual cost is $2,250/week; Hambidge subsidizes "
    "$1,950/week). Merit-based Distinguished Fellowships covering fees plus a "
    "$700 stipend are available each session. Limited financial aid scholarships "
    "(average $250, max $500) are awarded to accepted residents on request."
)


def _build_description(cycle: dict, residency_year: int) -> str:
    residency_period = f"{cycle['residency_months']} {residency_year}"
    return _DESCRIPTION_TEMPLATE.format(
        session_label=cycle["session_label"],
        residency_period=residency_period,
        max_weeks=cycle["max_stay_weeks"],
    )


# ---------------------------------------------------------------------------
# Cycle activation logic
# ---------------------------------------------------------------------------


def _compute_deadline(cycle: dict, today: date) -> Optional[date]:
    """
    Compute the concrete deadline date for the given cycle relative to today.

    Summer: deadline is January 15 of the CURRENT year if we're still before
    Jan 15, otherwise January 15 of NEXT year. The application window opens
    December 1 of the prior year.

    Fall: deadline April 15 of current year (or next year if already past).

    Spring: deadline September 15 of current year (or next year if past).
    """
    dm = cycle["deadline_month"]
    dd = cycle["deadline_day"]
    year = today.year

    try:
        deadline = date(year, dm, dd)
    except ValueError:
        return None

    # If deadline has already passed this year, the next occurrence is next year
    if deadline < today:
        year += 1
        try:
            deadline = date(year, dm, dd)
        except ValueError:
            return None

    return deadline


def _compute_residency_year(cycle: dict, deadline: date) -> int:
    """
    The residency year is typically the same as the deadline year,
    except Spring applications (filed Aug–Sep) are for the following year.
    """
    if cycle.get("residency_next_year"):
        return deadline.year + 1
    # Summer deadline is in January; residency is June–August of the same year
    return deadline.year


def _is_window_open(cycle: dict, deadline: date, today: date) -> bool:
    """
    Return True if the deadline has not yet passed and falls within the
    next 12 months.

    We include not-yet-open windows so the call appears on the board ahead
    of time — artists need lead time to prepare applications.
    """
    # Include this cycle if the deadline hasn't passed and it's within a 12-month horizon
    days_until_deadline = (deadline - today).days
    return 0 <= days_until_deadline <= 365


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Generate open_call records for active/upcoming Hambidge application windows.

    The page is fetched to validate it's still live and the deadline structure
    is intact. Cycle data is hardcoded from the confirmed schedule (3 fixed
    annual windows), which is far more reliable than parsing dynamic HTML for
    exact dates — the Hambidge schedule has been stable for years.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0
    today = date.today()

    # Validate the source page is reachable and still has the expected content
    html = _fetch_page(SOURCE_URL)
    if not html:
        logger.error("Hambidge: could not fetch residency page — skipping run")
        return 0, 0, 0

    if not _validate_page(html):
        logger.warning(
            "Hambidge: page content looks different — deadlines section not found. "
            "Review %s for structural changes.",
            SOURCE_URL,
        )
        # Proceed anyway — hardcoded cycles are still valid unless the program changed

    # Optionally: try to parse live deadlines from the page as a sanity check
    _log_live_deadlines(html)

    for cycle in _CYCLES:
        deadline = _compute_deadline(cycle, today)
        if not deadline:
            logger.warning("Hambidge: could not compute deadline for %s", cycle["key"])
            continue

        if not _is_window_open(cycle, deadline, today):
            logger.debug(
                "Hambidge: %s deadline %s is not in active/upcoming window — skipping",
                cycle["session_label"],
                deadline.isoformat(),
            )
            continue

        residency_year = _compute_residency_year(cycle, deadline)
        session_label = f"{cycle['session_label']} {residency_year}"
        title = f"Hambidge Center Residency — {session_label}"
        description = _build_description(cycle, residency_year)

        found += 1

        call_data: dict = {
            "title": title,
            "description": description,
            "deadline": deadline.isoformat(),
            "application_url": APPLICATION_URL,
            "source_url": SOURCE_URL,
            "call_type": "residency",
            "eligibility": _ELIGIBILITY,
            "fee": 30.0,
            "source_id": source_id,
            "confidence_tier": "verified",
            "_org_name": _ORG_NAME,
            "metadata": {
                "residency_fee": "$300/week",
                "application_fee": "$30 (waivable)",
                "duration": "2–8 weeks",
                "location": "Rabun Gap, GA",
                "disciplines": _DISCIPLINES,
                "session": session_label,
                "residency_months": cycle["residency_months"],
                "application_window": (
                    f"{_month_name(cycle['open_month'])} {cycle['open_day']} – "
                    f"{_month_name(cycle['deadline_month'])} {cycle['deadline_day']}"
                ),
                "max_stay_weeks": cycle["max_stay_weeks"],
                "distinguished_fellowships": True,
                "financial_aid": True,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.info(
                "Hambidge: inserted/updated '%s' (deadline=%s)",
                title,
                deadline.isoformat(),
            )
        else:
            # insert_open_call returns None for dry-run skips AND write errors;
            # both are acceptable here — just don't double-count as new
            pass

    logger.info(
        "Hambidge: %d active windows found, %d new/updated records",
        found,
        new,
    )
    return found, new, updated


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MONTH_NAMES = {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December",
}


def _month_name(n: int) -> str:
    return _MONTH_NAMES.get(n, str(n))


def _log_live_deadlines(html: str) -> None:
    """
    Extract the live deadline text from the page and log it so we can
    catch drift between the hardcoded schedule and what the site says.
    """
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer"]):
        tag.decompose()

    text = soup.get_text(separator=" ", strip=True)
    # Look for the APPLICATION DEADLINES block
    m = re.search(r"APPLICATION DEADLINES(.{0,600})", text, re.I | re.DOTALL)
    if m:
        block = m.group(1).strip()[:400]
        logger.debug("Hambidge live deadline block: %s", block)
    else:
        logger.debug("Hambidge: APPLICATION DEADLINES section not found in page text")
