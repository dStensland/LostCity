"""
Crawler for National Endowment for the Arts (NEA) grant programs.

URL: https://www.arts.gov/grants

The NEA is the federal arts agency and the issuing organization for all
programs listed here — so confidence_tier is "verified".

Crawl strategy — two phases, static HTML only (Drupal 11 site):

  Phase 1 — Grants index (https://www.arts.gov/grants):
    Parse the <section class="dynamic-content-grid"> block with heading
    "NEA Grant Opportunities". Each grant card is an:
      <a href="..." class="dynamic-content-item">
    containing:
      • <div class="dynamic-content-item__title"> — program name
      • <div class="dynamic-content-item__teaser"> — short description and
        often an inline deadline ("Deadline: March 23, 2026")

    The "Manage Your Award" grid on the same page is a second
    dynamic-content-grid section — we stop at the first one labeled
    "NEA Grant Opportunities".

  Phase 2 — Detail pages (one per grant card):
    Full description is in the main content body of each grant program page.
    Each detail page is a Drupal node with a narrow-content layout.
    We extract plain text from the content body for a rich description.
    We also scan for more authoritative deadline text on the detail page.

    Application URL priority:
      1. NEA Applicant Portal link (applicantportal.arts.gov)
      2. Grants.gov link
      3. Detail page URL (canonical fallback — always valid)

Program notes:
  - "Our Town" and "Challenge America" are tagged with
    metadata.civic_crossover = True for potential Citizen portal use.
  - "Partnership Agreement Grants" targets state arts agencies, not individual
    artists. We still include it since organizations apply.
  - "Jazz Masters" is a program solicitation (finding a co-organizer), not a
    grant for artists — call_type is "commission".
  - Programs showing "Deadline has passed" on the index are skipped.

All call_type values are "grant" except Jazz Masters ("commission").
All eligibility is "National".
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

BASE_URL = "https://www.arts.gov"
INDEX_URL = "https://www.arts.gov/grants"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

DETAIL_FETCH_DELAY = 1.5

# Programs that cross over to Citizen portal (civic placemaking / community)
_CIVIC_CROSSOVER_SLUGS: frozenset[str] = frozenset(
    {
        "/grants/our-town",
        "/grants/challenge-america",
    }
)

# Jazz Masters is a program solicitation (procuring a Cooperator), not a grant
_COMMISSION_SLUGS: frozenset[str] = frozenset(
    {
        "/program-solicitation-2027-nea-jazz-masters-tribute-concert-and-related-events",
    }
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
# HTTP helpers
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return its HTML, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("NEA: failed to fetch %s: %s", url, exc)
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
    Extract a deadline date from free-form text.

    Handles:
      "Deadline: March 23, 2026"               → "2026-03-23"
      "Deadlines: February 12, 2026, and July 9, 2026"  → "2026-02-12" (first)
      "April 9, 2026"                          → "2026-04-09"
      "February 25, 2026, at 11:59 p.m."       → "2026-02-25"
      "* Deadline has passed."                 → None (caller should skip)
      "Applications are accepted at the February or July 2026 deadlines."
                                               → None (no specific date)
    """
    if not text:
        return None

    # "Month D(D), YYYY" — most common NEA format; grab the first date found
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

    # ISO YYYY-MM-DD
    m = re.search(r"\b(\d{4})-(\d{2})-(\d{2})\b", text)
    if m:
        year, month, day = m.groups()
        return f"{year}-{month}-{day}"

    return None


def _deadline_has_passed_text(text: str) -> bool:
    """Return True if the teaser text explicitly says the deadline has passed."""
    return bool(re.search(r"deadline has passed", text, re.I))


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline date is in the past."""
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
    Parse the NEA grants index page.

    Returns a list of dicts with keys:
      href, title, teaser, deadline (from teaser), passed
    """
    soup = BeautifulSoup(html, "html.parser")
    listings: list[dict] = []

    # Find the first dynamic-content-grid section titled "NEA Grant Opportunities"
    target_grid = None
    for grid in soup.find_all("section", class_="dynamic-content-grid"):
        heading = grid.find(class_="dynamic-content-grid__title")
        if (
            heading
            and "nea grant opportunities" in heading.get_text(strip=True).lower()
        ):
            target_grid = grid
            break

    if not target_grid:
        logger.warning("NEA: could not find 'NEA Grant Opportunities' grid section")
        return listings

    for item in target_grid.find_all("a", class_="dynamic-content-item", href=True):
        href = item["href"]  # may be relative (/grants/...) or absolute

        # Program title
        title_el = item.find(class_="dynamic-content-item__title")
        title = title_el.get_text(strip=True) if title_el else ""
        if not title:
            continue

        # Teaser text (short description + inline deadline)
        teaser_el = item.find(class_="dynamic-content-item__teaser")
        teaser = teaser_el.get_text(separator=" ", strip=True) if teaser_el else ""

        # Check for "Deadline has passed" in teaser — skip these
        passed = _deadline_has_passed_text(teaser)

        # Extract deadline from teaser for quick filtering;
        # detail page will have the authoritative version
        deadline = _parse_deadline(teaser) if not passed else None

        listings.append(
            {
                "href": href,
                "title": title,
                "teaser": teaser,
                "deadline": deadline,
                "passed": passed,
            }
        )

    logger.debug("NEA: parsed %d grant cards from index", len(listings))
    return listings


# ---------------------------------------------------------------------------
# Detail page parser
# ---------------------------------------------------------------------------


def _extract_application_url(soup: BeautifulSoup, source_url: str) -> str:
    """
    Find the best application URL on an NEA detail page.

    Priority:
      1. Link to applicantportal.arts.gov (NEA's own application system)
      2. Link to grants.gov
      3. Source URL (detail page URL — always a valid canonical reference)
    """
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "applicantportal.arts.gov" in href:
            return href

    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "grants.gov" in href:
            return href

    return source_url


def _parse_detail(html: str, source_url: str) -> dict:
    """
    Parse an NEA grant program detail page.

    Returns a dict with keys:
      description, deadline, application_url
    """
    soup = BeautifulSoup(html, "html.parser")

    # Full description from the main content body
    # NEA uses Drupal's l-narrow-content__main > l-section > l-section__content
    desc_parts: list[str] = []

    # Try the main narrow-content body area
    main_content = soup.find(class_="l-narrow-content__main")
    if not main_content:
        # Fallback: any l-section__content block
        main_content = soup.find(class_="l-section__content")

    if main_content:
        for p in main_content.find_all("p"):
            text = p.get_text(separator=" ", strip=True)
            # Skip very short snippets (navigation fragments, labels)
            if text and len(text) > 30:
                desc_parts.append(text)

    description = " ".join(desc_parts).strip()
    if len(description) > 2500:
        description = description[:2497] + "..."

    # Deadline: scan the page text for deadline references
    # NEA detail pages often have explicit deadline lines in the body
    page_text = soup.get_text(separator="\n", strip=True)
    deadline = None

    for line in page_text.splitlines():
        lower = line.lower()
        if "deadline" in lower and not _deadline_has_passed_text(line):
            parsed = _parse_deadline(line)
            if parsed:
                deadline = parsed
                break

    application_url = _extract_application_url(soup, source_url)

    return {
        "description": description or None,
        "deadline": deadline,
        "application_url": application_url,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the National Endowment for the Arts grant programs page.

    Strategy:
      1. Parse the "NEA Grant Opportunities" grid on the index page.
      2. Skip any program where the teaser says "Deadline has passed."
      3. Fetch each program's detail page for full description,
         authoritative deadline, and application URL.
      4. Skip any program whose deadline is now in the past.
      5. Insert or update via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Referer": "https://www.arts.gov/",
        }
    )

    # Phase 1: parse the index page
    index_html = _fetch(INDEX_URL, session)
    if not index_html:
        logger.error("NEA: failed to fetch grants index page")
        return 0, 0, 0

    listings = _parse_index(index_html)
    if not listings:
        logger.warning("NEA: no grant programs found on index page")
        return 0, 0, 0

    # Filter out listings already marked as passed on the index
    actionable = [item for item in listings if not item["passed"]]
    skipped_passed = len(listings) - len(actionable)
    if skipped_passed:
        logger.info(
            "NEA: skipping %d programs marked 'Deadline has passed' on index",
            skipped_passed,
        )

    # Phase 2: fetch detail pages and insert
    for i, listing in enumerate(actionable):
        href = listing["href"]
        detail_url = _resolve_url(href)
        title = listing["title"]

        detail_html = _fetch(detail_url, session)
        if not detail_html:
            logger.warning("NEA: skipping %r — could not fetch detail page", title)
            continue

        detail = _parse_detail(detail_html, detail_url)

        # Reconcile deadline: prefer detail-page deadline (more specific),
        # fall back to what we parsed from the index teaser
        deadline = detail["deadline"] or listing["deadline"]

        # Skip if deadline is now in the past
        if _is_past_deadline(deadline):
            logger.debug(
                "NEA: skipping %r — deadline %s already passed", title[:60], deadline
            )
            if i < len(actionable) - 1:
                time.sleep(DETAIL_FETCH_DELAY)
            continue

        found += 1

        # Determine call_type
        call_type = "commission" if href in _COMMISSION_SLUGS else "grant"

        # Metadata flags
        is_civic = any(slug in href for slug in _CIVIC_CROSSOVER_SLUGS)
        metadata: dict = {
            "program_slug": href,
            "teaser": listing["teaser"],
        }
        if is_civic:
            metadata["civic_crossover"] = True

        # Build the slug-friendly org name fragment
        # NEA slug uses the title words; strip "nea" prefix for cleaner slugs
        org_slug = "nea"

        call_data: dict = {
            "title": title,
            "description": detail["description"],
            "deadline": deadline,
            "application_url": detail["application_url"],
            "source_url": detail_url,
            "call_type": call_type,
            "eligibility": "National",
            "fee": None,  # NEA does not charge application fees
            "source_id": source_id,
            "confidence_tier": "verified",
            "_org_name": org_slug,
            "metadata": metadata,
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "NEA: inserted/updated %r (deadline=%s, type=%s, civic=%s)",
                title[:60],
                deadline,
                call_type,
                is_civic,
            )

        if i < len(actionable) - 1:
            time.sleep(DETAIL_FETCH_DELAY)

    logger.info("NEA: %d found (non-expired), %d new, %d updated", found, new, updated)
    return found, new, updated
