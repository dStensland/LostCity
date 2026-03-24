"""
Crawler for Yaddo artist residency open calls.

Source: https://yaddo.org/apply

Yaddo, founded in 1900 in Saratoga Springs, NY, is one of the oldest and most
prestigious artist residency programs in the United States. It hosts approximately
200 artists per year across ten disciplines. Room, board, and a private studio are
provided at no cost. A $35 application fee applies (waivable on financial hardship).

Application cycles — two fixed annual deadlines:

  January 5 deadline:
    - For residencies starting May of the same year through March of the following year
    - Results sent: mid-March
    - Application portal opens: mid-November of the prior year

  August 1 deadline:
    - For residencies starting November of the same year through June of the following year
    - Results sent: early October
    - Application portal opens: June of the same year

Applications are submitted through yaddo.slideroom.com. Late applications are
not accepted. Artists may apply once every other calendar year.

Confidence tier: "verified" — Yaddo is the issuing organization.
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

SOURCE_URL = "https://yaddo.org/apply"
APPLICATION_URL = "https://yaddo.slideroom.com/#/Login"

_ORG_NAME = "yaddo"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

_DISCIPLINES = [
    "Choreography",
    "Film",
    "Literature",
    "Musical Composition",
    "Painting",
    "Performance",
    "Photography",
    "Printmaking",
    "Sculpture",
    "Video",
]

_ELIGIBILITY = (
    "Open to professional creative artists from all nations and backgrounds. "
    "Disciplines: choreography, film, literature, musical composition, painting, "
    "performance, photography, printmaking, sculpture, and video. "
    "Artists enrolled in graduate or undergraduate degree programs are not eligible. "
    "Artists may apply once every other calendar year. "
    "Auxiliary artists (technicians, dancers, designers) are not eligible to apply."
)

# ---------------------------------------------------------------------------
# Application cycles
#
# Two fixed deadlines each year. Each entry: deadline month/day, and the
# coverage period of the resulting residencies.
# ---------------------------------------------------------------------------

_CYCLES = [
    {
        "key": "january",
        "deadline_month": 1,
        "deadline_day": 5,
        # Portal opens mid-November of the PRIOR year
        "portal_opens_note": "mid-November of the prior year",
        "results_note": "mid-March",
        # Residency covers May of same year through March of the following year
        "residency_coverage": (
            "May {deadline_year} through March {next_year}"
        ),
        "results_by": "mid-March",
    },
    {
        "key": "august",
        "deadline_month": 8,
        "deadline_day": 1,
        # Portal opens June of the same year
        "portal_opens_note": "June of the same year",
        "results_note": "early October",
        # Residency covers November of same year through June of the following year
        "residency_coverage": (
            "November {deadline_year} through June {next_year}"
        ),
        "results_by": "early October",
    },
]

_MONTH_NAMES = {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December",
}


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
        logger.warning("Yaddo: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Page validation
# ---------------------------------------------------------------------------


def _validate_page(html: str) -> bool:
    """
    Confirm the page still has the expected deadline structure.
    Catches redesigns before they silently produce zero records.
    """
    text = html.lower()
    return (
        "application deadlines" in text
        and "january" in text
        and "august" in text
        and "slideroom" in text
    )


def _log_live_deadlines(html: str) -> None:
    """Log the live deadline text from the page for drift detection."""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "nav", "footer"]):
        tag.decompose()
    text = soup.get_text(separator=" ", strip=True)
    m = re.search(r"Application Deadlines(.{0,800})", text, re.I | re.DOTALL)
    if m:
        block = m.group(1).strip()[:600]
        logger.debug("Yaddo live deadline block: %s", block)
    else:
        logger.debug("Yaddo: Application Deadlines section not found in page text")


# ---------------------------------------------------------------------------
# Cycle computation
# ---------------------------------------------------------------------------


def _compute_deadline(cycle: dict, today: date) -> Optional[date]:
    """
    Compute the next upcoming deadline date for this cycle.
    If this year's deadline has already passed, advance to next year.
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


def _is_window_active(deadline: date, today: date) -> bool:
    """
    Return True if the deadline is upcoming within a 12-month horizon.
    This surfaces cycles early so artists have lead time to prepare.
    """
    days_until = (deadline - today).days
    return 0 <= days_until <= 365


# ---------------------------------------------------------------------------
# Description builder
# ---------------------------------------------------------------------------

_DESC_TEMPLATE = (
    "Yaddo — one of the oldest and most celebrated artist communities in the "
    "United States — offers residencies to professional artists in ten disciplines: "
    "choreography, film, literature, musical composition, painting, performance, "
    "photography, printmaking, sculpture, and video. Founded in 1900 and located on "
    "a 400-acre estate in Saratoga Springs, New York, Yaddo provides private studios, "
    "room, and board at no cost to residents.\n\n"
    "The {deadline_label} cycle supports residencies running {residency_coverage}. "
    "Residencies run from two weeks to two months. Selection is based solely on the "
    "quality of the work, as evaluated by independent peer-review panels that rotate "
    "with each season.\n\n"
    "Results are emailed to applicants by {results_by}. Applications are submitted "
    "electronically through the SlideRoom portal (yaddo.slideroom.com). Late "
    "applications are not accepted. Artists may apply once every other calendar year. "
    "Modest access grants are available to offset travel costs for accepted artists.\n\n"
    "Application fee: $35 (waivable — contact the Program Department at least three "
    "weeks before the deadline if the fee is a barrier)."
)


def _build_description(
    cycle: dict, deadline: date, residency_coverage: str
) -> str:
    deadline_label = (
        f"{_MONTH_NAMES[cycle['deadline_month']]} {cycle['deadline_day']}"
    )
    return _DESC_TEMPLATE.format(
        deadline_label=deadline_label,
        residency_coverage=residency_coverage,
        results_by=cycle["results_by"],
    )


def _build_residency_coverage(cycle: dict, deadline: date) -> str:
    return cycle["residency_coverage"].format(
        deadline_year=deadline.year,
        next_year=deadline.year + 1,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Generate open_call records for active/upcoming Yaddo application cycles.

    Yaddo runs two fixed annual deadlines (January 5 and August 1). The schedule
    is stable and confirmed via the /apply page. This crawler validates the page
    is still live and the deadlines section is intact, then uses the hardcoded
    schedule to generate accurate records for upcoming cycles.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0
    today = date.today()

    html = _fetch(SOURCE_URL)
    if not html:
        logger.error("Yaddo: could not fetch /apply page — aborting")
        return 0, 0, 0

    if not _validate_page(html):
        logger.warning(
            "Yaddo: page structure looks different — application deadlines block "
            "or SlideRoom link not found. Review %s for structural changes.",
            SOURCE_URL,
        )
        # Still proceed — hardcoded schedule is valid unless the program changed

    _log_live_deadlines(html)

    for cycle in _CYCLES:
        deadline = _compute_deadline(cycle, today)
        if not deadline:
            logger.warning("Yaddo: could not compute deadline for %s cycle", cycle["key"])
            continue

        if not _is_window_active(deadline, today):
            logger.debug(
                "Yaddo: %s %s deadline is not in active window — skipping",
                cycle["key"],
                deadline.isoformat(),
            )
            continue

        residency_coverage = _build_residency_coverage(cycle, deadline)
        deadline_label = (
            f"{_MONTH_NAMES[cycle['deadline_month']]} {cycle['deadline_day']}"
        )
        title = f"Yaddo Residency — {deadline_label} {deadline.year} Deadline"
        description = _build_description(cycle, deadline, residency_coverage)

        found += 1

        call_data: dict = {
            "title": title,
            "description": description,
            "deadline": deadline.isoformat(),
            "application_url": APPLICATION_URL,
            "source_url": SOURCE_URL,
            "call_type": "residency",
            "eligibility": _ELIGIBILITY,
            "fee": 35.0,
            "source_id": source_id,
            "confidence_tier": "verified",
            "_org_name": _ORG_NAME,
            "metadata": {
                "application_fee": "$35 (waivable)",
                "residency_fee": None,
                "duration": "2 weeks to 2 months",
                "location": "Saratoga Springs, NY",
                "disciplines": _DISCIPLINES,
                "residency_coverage": residency_coverage,
                "results_by": cycle["results_by"],
                "portal_opens": cycle["portal_opens_note"],
                "application_system": "SlideRoom",
                "access_grants_available": True,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.info(
                "Yaddo: inserted/updated '%s' (deadline=%s)",
                title,
                deadline.isoformat(),
            )

    logger.info(
        "Yaddo: %d active cycles found, %d new/updated records",
        found,
        new,
    )
    return found, new, updated
