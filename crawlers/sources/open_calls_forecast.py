"""
Crawler for Forecast Public Art — Artist Opportunities page.

Source: https://forecastpublicart.org/consulting/artist-support/artist-opportunities/

Forecast Public Art (St. Paul, MN) maintains a curated rolling list of ~30–35
public art opportunities organized into four regional tabs: Eastern U.S.,
Minnesota/Midwest, Western U.S., and International.

Each tab contains H4 section headings that describe the call type:
  - "RFQs, COMMISSIONS, & CALLS for ART"     → call_type = "commission"
  - "ARTIST REGISTRIES & ROSTERS"             → call_type = "commission" (pre-qual)
  - "FELLOWSHIPS, RESIDENCIES, ..."           → call_type = "residency"
  - "AWARDS, PROGRAMS, GRANTS, ..."           → call_type = "grant"
  - "EMPLOYMENT & PAID INTERNSHIPS"           → skipped (not artist opportunities)
  - "VOLUNTEER, INTERN, ..."                  → skipped
  - "CONFERENCES, SUMMITS, ..."               → skipped

Each listing is a <p> block:
  - First <a href> in the paragraph is the title + application URL
  - Deadline is embedded in the paragraph text, typically bolded at the end:
      "Apply by March 31, 2026."
      "Apply by 11:59pm EDT, April 2, 2026."
      "Deadline: April 6, 2026."
      "The artist registry has no deadline." → skip
      "Deadline not specified." → skip
  - Budget/award is embedded in the description text:
      "BUDGET: $111,500" or "total budget for the public art project is a maximum of $250,000"

HTML structure (verified 2026-03-24):
  Avada theme WordPress, server-rendered.

  div.tabcontainer                         — wraps all regional tabs
    div.tab_inner_content                  — one per tab (Eastern, Midwest, Western, International)
      h3                                   — region name
      h4                                   — section type heading
      p                                    — one listing per <p>
        a[href]  (first link)              — application URL, link text = title
        strong (last)                      — deadline text, e.g. "Apply by March 31, 2026."

The page is static (no JavaScript required for content).

Confidence tier: "aggregated" — Forecast curates other orgs' calls.
Scope: national (opportunities span all U.S. regions + international tab).
"""

import logging
import re
import time
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup, Tag

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SOURCE_URL = (
    "https://forecastpublicart.org/consulting/artist-support/artist-opportunities/"
)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
)

FETCH_DELAY_S = 1.0

# H4 section heading keywords → call_type (or None = skip section entirely)
# Checked in order; first match wins. Lower-cased at runtime.
_H4_TYPE_MAP: list[tuple[str, Optional[str]]] = [
    ("rfq", "commission"),
    ("commission", "commission"),
    ("calls for art", "commission"),
    ("registr", "commission"),       # "ARTIST REGISTRIES & ROSTERS"
    ("roster", "commission"),
    ("fellowship", "residency"),
    ("residenc", "residency"),
    ("scholarship", "residency"),
    ("cohort", "residency"),
    ("tenure", "residency"),
    ("grant", "grant"),
    ("award", "grant"),
    ("program", "grant"),
    ("funding", "grant"),
    ("employment", None),            # skip employment listings
    ("internship", None),
    ("volunteer", None),
    ("board opening", None),
    ("conference", None),
    ("summit", None),
    ("workshop", None),
    ("event", None),
]

_MONTH_MAP: dict[str, int] = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}

# Paragraph text that signals no actual deadline — skip these listings
_NO_DEADLINE_PHRASES = re.compile(
    r"no deadline|deadline not specified|check regularly|check back soon"
    r"|periodically announces|rolling basis",
    re.I,
)

# Regions → scope tag for metadata
_REGION_SCOPE: dict[str, str] = {
    "Eastern U.S.": "national",
    "Minnesota / Midwest": "national",
    "Western U.S.": "national",
    "International": "international",
}


# ---------------------------------------------------------------------------
# HTTP fetch
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return its HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("Forecast: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Section heading → call_type
# ---------------------------------------------------------------------------


def _call_type_from_h4(heading_text: str) -> Optional[str]:
    """
    Map an H4 section heading to a call_type string, or None to skip the section.

    Returns None for employment, volunteer, conference, and workshop sections
    which are not artist-opportunity call types we want to surface.
    """
    lower = heading_text.lower()
    for keyword, call_type in _H4_TYPE_MAP:
        if keyword in lower:
            return call_type  # may be None (skip signal)
    # Unrecognised heading — default to grant (rarely reached)
    return "grant"


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline(text: str) -> Optional[str]:
    """
    Extract an ISO date from paragraph text containing a deadline phrase.

    Handles:
      "Apply by March 31, 2026."                 → "2026-03-31"
      "Apply by 11:59pm EDT, April 2, 2026."     → "2026-04-02"
      "Apply by 5:00 PM CT on April, 6, 2026."   → "2026-04-06"
      "Deadline: April 28, 2026"                 → "2026-04-28"
      "Submissions are due April 10, 2026."      → "2026-04-10"
      "Submit by March 20."                      → None (no year)
    """
    if not text:
        return None

    # "Month D(D), YYYY" — most common Forecast format
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September"
        r"|October|November|December)[,\s]+(\d{1,2})[,\s]+(\d{4})",
        text,
        re.I,
    )
    if m:
        month_name, day, year = m.groups()
        month_num = _MONTH_MAP.get(month_name.lower())
        if month_num:
            return f"{int(year)}-{month_num:02d}-{int(day):02d}"

    # "Month D YYYY" without comma (e.g. "April 6 2026")
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September"
        r"|October|November|December)\s+(\d{1,2})\s+(\d{4})",
        text,
        re.I,
    )
    if m:
        month_name, day, year = m.groups()
        month_num = _MONTH_MAP.get(month_name.lower())
        if month_num:
            return f"{int(year)}-{month_num:02d}-{int(day):02d}"

    # MM/DD/YYYY
    m = re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", text)
    if m:
        month, day, year = m.groups()
        return f"{int(year)}-{int(month):02d}-{int(day):02d}"

    return None


def _is_past_deadline(deadline_str: str) -> bool:
    """Return True if the deadline date has already passed."""
    try:
        dl = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Budget extraction
# ---------------------------------------------------------------------------

_BUDGET_RE = re.compile(
    r"\$[\d,]+(?:\.\d+)?(?:\s*(?:million|M|k|thousand))?"
    r"|\$[\d,]+\+?",
    re.I,
)


def _extract_budget(text: str) -> Optional[str]:
    """
    Extract the first dollar amount from paragraph text as a raw string.

    Returns e.g. "$111,500", "$1 million", "$250,000", or None.
    This is stored as metadata.budget_raw; not parsed to a float since
    Forecast listings often have ranges or multiple budget figures.
    """
    m = _BUDGET_RE.search(text)
    return m.group(0).strip() if m else None


# ---------------------------------------------------------------------------
# Per-paragraph listing parser
# ---------------------------------------------------------------------------


def _parse_listing(p_tag: Tag, section_type: str, region: str) -> Optional[dict]:
    """
    Parse a single <p> block into a raw listing dict.

    Structure:
      <p>
        <a href="...">Title of Opportunity</a>
        ... description text ...
        <strong>Apply by Month DD, YYYY.</strong>
      </p>

    The title is the text of the first <a> tag (application URL).
    The deadline is in the last <strong> containing a date.
    Returns None if required fields are missing or the paragraph should be skipped.
    """
    # Skip trivial placeholders
    raw_text = p_tag.get_text(separator=" ", strip=True)
    if not raw_text or len(raw_text) < 30:
        return None

    # Skip "Check back soon", "Deadline not specified", etc.
    if _NO_DEADLINE_PHRASES.search(raw_text):
        return None

    # Skip paragraphs that start with italic "We recommend checking regularly" etc.
    em = p_tag.find("em")
    if em and len(raw_text) < 100 and em == p_tag.find():
        return None

    # --- Application URL: first <a> with an http href ---
    application_url: Optional[str] = None
    title = ""
    for a in p_tag.find_all("a", href=True):
        href = a["href"]
        # Skip mailto and internal links
        if href.startswith("mailto:"):
            continue
        if "forecastpublicart.org" in href and "/consulting/" not in href:
            # Internal navigation link — skip unless it looks like an application
            pass
        application_url = href
        title = a.get_text(strip=True)
        break

    if not application_url or not title:
        return None

    # Title must be meaningful
    if len(title) < 5:
        return None

    # --- Deadline: search all <strong> tags for a date ---
    deadline: Optional[str] = None
    deadline_raw = ""
    for strong in p_tag.find_all("strong"):
        strong_text = strong.get_text(separator=" ", strip=True)
        # Look for deadline-signal phrases
        if re.search(r"apply|deadline|due|submit|close", strong_text, re.I):
            parsed = _parse_deadline(strong_text)
            if parsed:
                deadline = parsed
                deadline_raw = strong_text
                break

    # Fallback: search the entire paragraph text for a date following deadline signal
    if not deadline:
        for line in raw_text.split("."):
            if re.search(r"apply|deadline|due|submit|close", line, re.I):
                parsed = _parse_deadline(line)
                if parsed:
                    deadline = parsed
                    deadline_raw = line.strip()
                    break

    # --- Description: full paragraph text minus the deadline phrase ---
    description = raw_text
    if deadline_raw:
        description = description.replace(deadline_raw, "").strip()
    description = re.sub(r"\s+", " ", description).strip()
    # Truncate if very long
    if len(description) > 2000:
        description = description[:2000]

    # --- Budget ---
    budget_raw = _extract_budget(raw_text)

    return {
        "title": title,
        "application_url": application_url,
        "description": description or None,
        "deadline": deadline,
        "deadline_raw": deadline_raw,
        "section_type": section_type,
        "region": region,
        "budget_raw": budget_raw,
    }


# ---------------------------------------------------------------------------
# Tab content parser
# ---------------------------------------------------------------------------


def _parse_tab_content(tab_div: Tag) -> list[dict]:
    """
    Parse all listings from a single tab's inner content div.

    Walks through H3 (region name), H4 (section type), and P (listing) elements.
    Skips sections whose H4 maps to None (employment, volunteer, etc.).
    """
    # Determine region from H3
    h3 = tab_div.find("h3")
    region = h3.get_text(strip=True) if h3 else "Unknown"

    listings: list[dict] = []
    current_section_type: Optional[str] = "commission"  # default until first H4
    skip_section = False

    for element in tab_div.find_all(["h3", "h4", "p"]):
        if element.name == "h3":
            # Region heading — resets section type
            region = element.get_text(strip=True)
            current_section_type = "commission"
            skip_section = False
            continue

        if element.name == "h4":
            heading_text = element.get_text(strip=True)
            if not heading_text:
                continue
            mapped = _call_type_from_h4(heading_text)
            if mapped is None:
                # Employment/volunteer/conference section — skip until next H4
                skip_section = True
                logger.debug("Forecast: skipping section %r", heading_text[:60])
            else:
                current_section_type = mapped
                skip_section = False
            continue

        if element.name == "p":
            if skip_section:
                continue
            if current_section_type is None:
                continue

            listing = _parse_listing(element, current_section_type, region)
            if listing:
                listings.append(listing)

    return listings


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Forecast Public Art Artist Opportunities page.

    Strategy:
      1. Fetch the single opportunities page.
      2. Find the tabcontainer with regional tabs.
      3. Parse each tab's inner content: walk H4 section headings and P listings.
      4. Skip past-deadline listings, employment/volunteer sections.
      5. Insert/update each listing via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    })

    time.sleep(FETCH_DELAY_S)
    html = _fetch(SOURCE_URL, session)
    if not html:
        logger.error("Forecast: failed to fetch opportunities page — aborting")
        return 0, 0, 0

    soup = BeautifulSoup(html, "html.parser")

    # Find the tabcontainer that holds the regional tabs
    tabcontainer = soup.find("div", class_=lambda c: c and "tabcontainer" in c)
    if not tabcontainer:
        logger.error("Forecast: tabcontainer not found — page structure may have changed")
        return 0, 0, 0

    tab_sections = tabcontainer.find_all("div", class_="tab_inner_content")
    if not tab_sections:
        logger.error("Forecast: no tab_inner_content divs found — check page structure")
        return 0, 0, 0

    logger.info("Forecast: found %d regional tabs", len(tab_sections))

    # Parse all tabs
    all_listings: list[dict] = []
    for tab_div in tab_sections:
        tab_listings = _parse_tab_content(tab_div)
        all_listings.extend(tab_listings)

    logger.info("Forecast: %d raw listings parsed across all tabs", len(all_listings))

    if not all_listings:
        logger.warning("Forecast: no listings parsed — check page structure")
        return 0, 0, 0

    skipped_deadline = 0
    skipped_no_deadline = 0
    skipped_no_url = 0

    for listing in all_listings:
        title = listing["title"]
        application_url = listing.get("application_url", "")

        if not application_url:
            skipped_no_url += 1
            logger.debug("Forecast: skipping %r — no application URL", title[:60])
            continue

        deadline = listing.get("deadline")
        if not deadline:
            skipped_no_deadline += 1
            logger.debug(
                "Forecast: skipping %r — no parseable deadline (raw: %r)",
                title[:60],
                listing.get("deadline_raw", ""),
            )
            continue

        if _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "Forecast: skipping %r — deadline %s already passed",
                title[:60],
                deadline,
            )
            continue

        found += 1

        section_type = listing.get("section_type", "commission")
        region = listing.get("region", "")
        description = listing.get("description") or ""

        # Determine scope from region
        scope = _REGION_SCOPE.get(region, "national")

        call_data: dict = {
            "title": title,
            "description": description or None,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": SOURCE_URL,
            "call_type": section_type,
            "eligibility": "National",
            "fee": None,
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": "forecast-public-art",
            "metadata": {
                "organization": "Forecast Public Art",
                "region": region,
                "section_type": section_type,
                "deadline_raw": listing.get("deadline_raw"),
                "budget_raw": listing.get("budget_raw"),
                "scope": scope,
                "source_page": SOURCE_URL,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "Forecast: inserted/updated %r (deadline=%s, type=%s, region=%s)",
                title[:60],
                deadline,
                section_type,
                region,
            )

    if skipped_deadline:
        logger.info("Forecast: skipped %d past-deadline listings", skipped_deadline)
    if skipped_no_deadline:
        logger.info(
            "Forecast: skipped %d listings with no parseable deadline",
            skipped_no_deadline,
        )
    if skipped_no_url:
        logger.info("Forecast: skipped %d listings with no URL", skipped_no_url)

    logger.info(
        "Forecast: %d found (non-expired), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
