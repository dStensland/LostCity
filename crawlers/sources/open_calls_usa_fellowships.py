"""
Crawler for United States Artists (USA) Fellowship Awards.

Source: https://www.unitedstatesartists.org/programs/usa-fellowship

United States Artists awards $50,000 unrestricted fellowships each year to
artists and collaboratives across ten disciplines: Architecture & Design, Craft,
Dance, Film, Media, Music, Theater & Performance, Traditional Arts, Visual Art,
and Writing. Fellows additionally receive tailored services (financial planning,
career consulting, legal advice).

IMPORTANT — NOMINATION-ONLY PROGRAM:
  The USA Fellowship is NOT an open application program. Artists are nominated
  by an anonymous rotating network of arts professionals; nominators identify
  artists demonstrating artistic integrity and significant contributions to
  their field. Ten panels then review applications from nominated artists.

  There is no public application portal or deadline for individual artists.
  Artists cannot apply directly — they must be nominated.

This crawler creates a single informational open_call record so artists can
discover the program on the Arts portal and understand how the nomination
process works. The record uses call_type="fellowship" and deadline=None to
accurately represent the program structure.

Confidence tier: "verified" — USA is the issuing organization.
"""

import logging
from typing import Optional

import requests

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SOURCE_URL = "https://www.unitedstatesartists.org/programs/usa-fellowship"
# No public application URL — nomination only
PROGRAM_URL = "https://www.unitedstatesartists.org/programs/usa-fellowship"

_ORG_NAME = "united-states-artists"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

_DISCIPLINES = [
    "Architecture & Design",
    "Craft",
    "Dance",
    "Film",
    "Media",
    "Music",
    "Theater & Performance",
    "Traditional Arts",
    "Visual Art",
    "Writing",
]

_ELIGIBILITY = (
    "Nomination-only program — artists cannot apply directly. "
    "A rotating network of anonymous nominators identifies artists "
    "demonstrating artistic integrity and significant contributions to their field. "
    "Open to artists and collaboratives at all career stages in all disciplines "
    "throughout all U.S. states and territories."
)

_DESCRIPTION = (
    "United States Artists (USA) awards $50,000 unrestricted fellowships each year "
    "to artists and collaboratives across ten disciplines: Architecture & Design, "
    "Craft, Dance, Film, Media, Music, Theater & Performance, Traditional Arts, "
    "Visual Art, and Writing.\n\n"
    "In addition to the $50,000 unrestricted grant, USA Fellows receive tailored "
    "services including financial planning, career consulting, certified accounting "
    "services, and legal advice. USA also hosts events and gatherings for Fellows "
    "to connect with each other and with arts funders and leaders.\n\n"
    "NOMINATION-ONLY: This is not an open-application program. USA does not accept "
    "unsolicited applications. Instead, a diverse and rotating group of arts "
    "professionals anonymously nominates artists who demonstrate artistic integrity "
    "and make significant contributions to the broader arts ecosystem. Nominated "
    "artists are then invited to apply; ten discipline-specific panels review "
    "applications and identify finalists, which are approved by the Board of Trustees.\n\n"
    "To be considered, artists should: build a visible public track record of "
    "significant work, engage with the broader arts community, and be known to "
    "curators, critics, presenters, and peers who may serve as nominators. There is "
    "no way to request or expedite a nomination."
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
        logger.warning("USA Fellowships: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Page validation
# ---------------------------------------------------------------------------


def _validate_page(html: str) -> bool:
    """Confirm the page still describes the USA Fellowship program."""
    text = html.lower()
    return "usa fellowship" in text and "nominator" in text


def _extract_current_fellows_year(html: str) -> Optional[str]:
    """
    Extract the most recent fellowship year from the page.
    Used for the metadata record to track when data was last verified.
    """
    import re
    m = re.search(r"(20\d{2})\s+USA\s+Fellowship", html, re.I)
    if m:
        return m.group(1)
    return None


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Create an informational open_call record for the USA Fellowship Awards.

    Because this is a nomination-only program, the record serves as
    artist-facing documentation of the program — how it works, who is
    eligible, and how artists can position themselves for nomination.

    The record has deadline=None and status="open" (nominations are
    ongoing/annual even though direct applications are not accepted).

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    html = _fetch(SOURCE_URL)
    if not html:
        logger.warning(
            "USA Fellowships: could not fetch program page — proceeding with "
            "hardcoded data (program details are stable)"
        )

    fellows_year = None
    if html:
        if not _validate_page(html):
            logger.warning(
                "USA Fellowships: page content looks unexpected — "
                "program structure may have changed. Review %s",
                SOURCE_URL,
            )
        fellows_year = _extract_current_fellows_year(html)
        if fellows_year:
            logger.info(
                "USA Fellowships: most recent fellowship class year: %s", fellows_year
            )

    found = 1

    call_data: dict = {
        "title": "United States Artists Fellowship Awards",
        "description": _DESCRIPTION,
        "deadline": None,  # Nomination-only — no public deadline
        "application_url": PROGRAM_URL,
        "source_url": SOURCE_URL,
        "call_type": "fellowship",
        "eligibility": _ELIGIBILITY,
        "fee": None,
        "source_id": source_id,
        "confidence_tier": "verified",
        "_org_name": _ORG_NAME,
        "metadata": {
            "source": "usa-fellowships",
            "award_amount": "$50,000 unrestricted",
            "scope": "national",
            "disciplines": _DISCIPLINES,
            "application_type": "nomination_only",
            "nomination_process": (
                "Anonymous rotating network of arts professionals nominates artists. "
                "Nominated artists are invited to apply; discipline panels select finalists."
            ),
            "services_included": [
                "financial_planning",
                "career_consulting",
                "legal_advice",
                "certified_accounting",
            ],
            "current_fellows_year": fellows_year,
            "frequency": "annual",
        },
    }

    result = insert_open_call(call_data)
    if result:
        new += 1
        logger.info(
            "USA Fellowships: inserted/updated program record "
            "(nomination-only, no deadline)"
        )
    else:
        logger.warning(
            "USA Fellowships: insert_open_call returned no ID"
        )

    logger.info(
        "USA Fellowships: %d found, %d new, %d updated", found, new, updated
    )
    return found, new, updated
