"""
Crawler for Play Submissions Helper (playsubmissionshelper.com).

Play Submissions Helper is a curated aggregator of play submission
opportunities for playwrights. It publishes a free monthly sample list of
~35 opportunities on /current/ and a gated mega-list for paid members.

This is the first theatrical/playwriting source in the LostCity open calls
corpus — entirely new discipline coverage with zero overlap against existing
visual-arts, music, and literary sources.

HTML structure (verified 2026-03-24):
  WordPress/Divi site. The /current/ page renders a single <table> inside
  an <article> element. No JavaScript rendering required.

  Table columns (6):
    0  Name            — theater/org name, wraps an <a> link to the submit URL
    1  Length          — script length requirement (metadata only)
    2  Nature of       — short description of the opportunity
       Opportunity
    3  Deadline        — "M/D/YY" format, e.g. "4/15/26"
    4  Location        — city or "n/a"
    5  Add'l Info      — free-text: fee, prize, honorarium, or "n/a"

  The first <tr> is a header row (all cells are blue — skip it).
  Data rows start at index 1.

Discovery strategy:
  The /current/ page always points at the upcoming month's batch and is the
  canonical landing page for the free sample. The site also publishes past
  monthly posts on /blog/ (e.g. "35 Play Submissions Opps w/ March 2026
  Deadlines"), but these have passed deadlines and are skipped by the
  expiry filter anyway. We crawl only /current/ — it is updated monthly
  by the site operator and contains live, current deadlines.

Fee extraction:
  "Add'l Info" column is free text. We parse it for:
    - "Fee: $N"           → submission fee (float)
    - "App Fee: $N"       → application fee (float)
    - "No Fee"            → 0.0
    - "$N honorarium"     → honorarium — stored in metadata, fee stays None
    - "Prize: ..."        → prize — metadata only, no fee
    - "n/a"               → None

Call type mapping:
  The site uses "Nature of Opportunity" for free-text descriptions. We
  classify by keyword pattern:

    "residency", "in-residence", "in residence"  → "residency"
    "commission"                                  → "commission"
    "publication opp"                             → "submission" (publication)
    "grant", "fellowship", "financial assistance" → "grant"
    anything else                                 → "submission" (default)

  Fee heuristic: a non-zero submission fee always maps to "submission"
  regardless of type keywords (it's a paid contest, not a grant).

Eligibility:
  Derived from Location column and description keywords:
    "n/a" or no location                → "National"
    specific US city/state              → "National" (still open nationally;
                                          location = where theater is based)
    description contains "Int'l" or    → "International"
    "international" or "worldwide"

Confidence tier: "aggregated" — PSH is an aggregator, not the issuing org.
Source URL: always https://playsubmissionshelper.com/current/
Application URL: the direct <a> link for each row (theater's submit page).

Delay: 0.5s between fetches (only 1 page, but kept for courtesy).
"""

import logging
import re
import time
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

INDEX_URL = "https://playsubmissionshelper.com/current/"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

REQUEST_TIMEOUT = 30

# Minimum delay between HTTP requests (seconds)
REQUEST_DELAY_S = 0.5

# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline(raw: str) -> Optional[str]:
    """
    Parse the deadline column text into ISO 'YYYY-MM-DD'.

    PSH uses M/D/YY format (e.g. "4/15/26", "3/31/26").
    Also handles M/D/YYYY and YYYY-MM-DD for robustness.

    Returns None if the string is empty, "n/a", or unparseable.
    """
    if not raw:
        return None
    text = raw.strip()
    if text.lower() in ("n/a", "n/s", "tba", "rolling"):
        return None

    # M/D/YY or MM/DD/YY (two-digit year — always 20xx)
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2})$", text)
    if m:
        month, day, year_2 = m.groups()
        year = int(year_2) + 2000
        return f"{year}-{int(month):02d}-{int(day):02d}"

    # M/D/YYYY or MM/DD/YYYY (four-digit year)
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", text)
    if m:
        month, day, year = m.groups()
        return f"{year}-{int(month):02d}-{int(day):02d}"

    # Already ISO YYYY-MM-DD
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", text)
    if m:
        return text

    return None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline has already passed today."""
    if not deadline_str:
        return False
    try:
        dl = date.fromisoformat(deadline_str)
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Fee parsing
# ---------------------------------------------------------------------------

# Matches: "Fee: $15", "App Fee: $45", "Fee: $3-30", "Fee: TBA"
_FEE_AMOUNT_RE = re.compile(r"\$\s*(\d+(?:\.\d+)?)", re.I)
_NO_FEE_RE = re.compile(r"\bno\s+fee\b", re.I)
_FREE_RE = re.compile(r"\bfree\b", re.I)


def _parse_fee(raw: str) -> tuple[Optional[float], Optional[str]]:
    """
    Parse the "Add'l Info" column for submission fee.

    Returns (fee_float, raw_string):
      - fee_float: numeric fee amount (first dollar amount found), 0.0 for
        explicitly free, or None if not a fee or unparseable.
      - raw_string: the full cell text, stored as metadata.addl_info.

    Honoraria and prizes are not fees — we return None for those even if
    they contain a dollar amount.
    """
    if not raw:
        return None, None
    text = raw.strip()
    if text.lower() in ("n/a", "n/s", ""):
        return None, None

    # Explicitly free
    if _NO_FEE_RE.search(text) or _FREE_RE.search(text):
        return 0.0, text

    # Check for fee indicator keywords before extracting amount
    has_fee_keyword = bool(re.search(r"\bfee\b", text, re.I))
    # Honorarium, prize, and award in the text mean the dollar amount is
    # a benefit to the artist, NOT a submission fee the artist pays.
    # However, if "fee" is also present (e.g. "Fee: $3 | Prize: $350"),
    # we still extract the fee — it's a fee+prize combo.
    is_benefit_only = (
        bool(
            re.search(r"\bhonorarium\b|\bprize\b|\baward\b|\bcommission\b", text, re.I)
        )
        and not has_fee_keyword
    )

    if has_fee_keyword:
        m = _FEE_AMOUNT_RE.search(text)
        if m:
            return float(m.group(1)), text
        # "Fee: TBA" — fee exists but amount unknown
        return None, text

    if is_benefit_only:
        # Dollar amounts are prizes/honoraria — not a fee the artist pays
        return None, text

    # No fee keyword — store raw text as metadata but return no numeric fee
    return None, text if text.lower() != "n/a" else None


# ---------------------------------------------------------------------------
# Call type inference
# ---------------------------------------------------------------------------

_RESIDENCY_RE = re.compile(
    # Match "residency", "residence", "in residence", "in-residence", "retreat"
    # but NOT "resident" alone (too common in eligibility descriptions like
    # "US resident" or "California resident") and NOT "residential" (adjective).
    r"\bresidency\b|\bresidence\b|\bin[\s-]residence\b|\bretreat\b",
    re.I,
)
_COMMISSION_RE = re.compile(r"\bcommission\b", re.I)
_GRANT_RE = re.compile(
    r"\bgrant\b|\bfellowship\b|\bfinancial\s+(?:emergency\s+)?assistance\b",
    re.I,
)
_PUBLICATION_RE = re.compile(r"\bpublication\s+opp\b", re.I)


def _infer_call_type(description: str, addl_info: str, fee: Optional[float]) -> str:
    """
    Map a PSH listing to our call_type enum.

    Priority:
      1. Residency keywords → "residency"
      2. Commission keyword → "commission"
      3. Grant/fellowship keyword → "grant"
         UNLESS fee > 0 (paid contest, not a grant)
      4. Default → "submission"
    """
    combined = f"{description} {addl_info}"

    if _RESIDENCY_RE.search(combined):
        return "residency"

    if _COMMISSION_RE.search(
        addl_info
    ):  # commission in the prize/type, not description
        return "commission"

    if _GRANT_RE.search(combined):
        # A non-zero fee means it's a paid submission/contest, not a grant
        if fee is not None and fee > 0:
            return "submission"
        return "grant"

    return "submission"


# ---------------------------------------------------------------------------
# Eligibility inference
# ---------------------------------------------------------------------------

_INTL_RE = re.compile(
    r"\bint['']?l\b|\binternational\b|\bworldwide\b|\bworld-wide\b|\bglobal\b",
    re.I,
)

# US state abbreviations (two capital letters) and common US location patterns
# Used to determine if a location is clearly US-based.
_US_LOCATION_RE = re.compile(
    r"\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|"
    r"MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|"
    r"VT|VA|WA|WV|WI|WY|DC|NYC)\b|"
    r"\bUnited States\b|\bUSA\b|\bU\.S\.\b",
    re.I,
)

# Known non-US country names that appear in PSH location column
_NON_US_COUNTRY_RE = re.compile(
    r"\b(?:Italy|Italy|UK|England|Ireland|Scotland|Wales|Australia|Canada|"
    r"France|Germany|Spain|Netherlands|Belgium|Sweden|Norway|Denmark|Finland|"
    r"Switzerland|Austria|Portugal|Poland|Czech|Romania|Greece|Japan|China|"
    r"India|Brazil|Mexico|Argentina|Colombia|Israel|South Africa|New Zealand)\b",
    re.I,
)


def _infer_eligibility(description: str, location: str) -> str:
    """
    Derive eligibility scope from description and location text.

    PSH location column shows where the theater is based, NOT who can apply.
    Rules:
      - Explicit international keywords in description → "International"
      - Theater is in a non-US country → "International" (likely open to intl)
      - Otherwise → "National" (US-national scope is the default for PSH)

    Returns "International" or "National".
    """
    combined = f"{description} {location}"

    # Explicit international keywords take priority
    if _INTL_RE.search(combined):
        return "International"

    # Theater in a non-US country signals international openness
    if location and _NON_US_COUNTRY_RE.search(location):
        return "International"

    return "National"


# ---------------------------------------------------------------------------
# Description building
# ---------------------------------------------------------------------------


def _build_description(nature: str, length: str, location: str, addl_info: str) -> str:
    """
    Assemble a clean description from PSH table columns.

    Format:
      "{Nature of Opportunity}. Script length: {length}."
      + " Location: {location}." (when not n/a)
      + " {addl_info}." (when not n/a and not already in nature)

    Truncated to 1,000 characters.
    """
    parts = []

    nature_clean = nature.strip().rstrip(".")
    if nature_clean:
        parts.append(nature_clean + ".")

    if length and length.lower() not in ("n/a", "n/s", "see right.", ""):
        parts.append(f"Script length: {length}.")

    if location and location.lower() not in ("n/a", "n/s", ""):
        parts.append(f"Location: {location}.")

    if addl_info and addl_info.lower() not in ("n/a", "n/s", ""):
        parts.append(addl_info + ".")

    text = " ".join(parts).strip()
    return text[:1000] if text else ""


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return its HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("PSH: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Table parser
# ---------------------------------------------------------------------------


def _parse_row(cells: list) -> Optional[dict]:
    """
    Parse a single data <tr> row from the PSH table.

    Expected column order:
      0: Name (with <a> link)
      1: Length
      2: Nature of Opportunity
      3: Deadline
      4: Location
      5: Add'l Info

    Returns None if required fields (name/URL) are missing.
    """
    if len(cells) < 4:
        return None

    # Col 0: Name + application URL
    name_cell = cells[0]
    a_tag = name_cell.find("a", href=True)
    if not a_tag:
        return None

    org_name = a_tag.get_text(strip=True)
    if not org_name:
        return None

    application_url = a_tag.get("href", "").strip()
    if not application_url or not application_url.startswith("http"):
        return None

    # Col 1: Script length (metadata)
    length = cells[1].get_text(strip=True) if len(cells) > 1 else ""

    # Col 2: Nature of Opportunity (description seed)
    nature = cells[2].get_text(strip=True) if len(cells) > 2 else ""

    # Col 3: Deadline
    deadline_raw = cells[3].get_text(strip=True) if len(cells) > 3 else ""
    deadline = _parse_deadline(deadline_raw)

    # Col 4: Location
    location = cells[4].get_text(strip=True) if len(cells) > 4 else ""
    if location.lower() in ("n/a", "n/s"):
        location = ""

    # Col 5: Add'l Info
    addl_raw = cells[5].get_text(separator=" | ", strip=True) if len(cells) > 5 else ""

    return {
        "org_name": org_name,
        "application_url": application_url,
        "length": length,
        "nature": nature,
        "deadline": deadline,
        "deadline_raw": deadline_raw,
        "location": location,
        "addl_raw": addl_raw,
    }


def _parse_table(html: str) -> list[dict]:
    """
    Parse the PSH /current/ page HTML, returning a list of raw listing dicts.

    Skips the header row (first <tr>) and any rows with no link in col 0.
    """
    soup = BeautifulSoup(html, "html.parser")

    article = soup.find("article")
    if not article:
        logger.warning(
            "PSH: <article> element not found — page structure may have changed"
        )
        return []

    table = article.find("table")
    if not table:
        logger.warning(
            "PSH: no <table> found inside article — page structure may have changed"
        )
        return []

    rows = table.find_all("tr")
    if not rows:
        logger.warning("PSH: table has no rows")
        return []

    listings: list[dict] = []
    # Skip row 0 — it's the header (blue background, no links)
    for row in rows[1:]:
        cells = row.find_all("td")
        parsed = _parse_row(cells)
        if parsed is not None:
            listings.append(parsed)
        else:
            logger.debug("PSH: skipped unparseable row — cells=%d", len(cells))

    logger.debug(
        "PSH: parsed %d listings from table (%d rows total)", len(listings), len(rows)
    )
    return listings


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Play Submissions Helper current listings page.

    Strategy:
      1. Fetch https://playsubmissionshelper.com/current/ (single page,
         no pagination — the site publishes ~35 free listings per month
         in one HTML table).
      2. Parse every <tr> in the table (skip header row).
      3. Skip any row with a passed deadline.
      4. Infer call_type, eligibility, fee, and description from the table
         columns.
      5. Insert/update each call via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://playsubmissionshelper.com/",
        }
    )

    time.sleep(REQUEST_DELAY_S)
    html = _fetch(INDEX_URL, session)
    if not html:
        logger.error("PSH: failed to fetch index page — aborting")
        return 0, 0, 0

    listings = _parse_table(html)
    if not listings:
        logger.warning("PSH: no listings parsed — check page structure")
        return 0, 0, 0

    logger.info("PSH: %d listings parsed from table", len(listings))

    skipped_deadline = 0
    skipped_no_url = 0

    for listing in listings:
        org_name = listing["org_name"]
        application_url = listing["application_url"]

        if not application_url:
            skipped_no_url += 1
            logger.debug("PSH: skipping %r — no application URL", org_name[:60])
            continue

        # Skip past-deadline calls
        deadline = listing.get("deadline")
        if deadline and _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "PSH: skipping %r — deadline %s passed", org_name[:60], deadline
            )
            continue

        found += 1

        nature = listing.get("nature", "")
        length = listing.get("length", "")
        location = listing.get("location", "")
        addl_raw = listing.get("addl_raw", "")
        deadline_raw = listing.get("deadline_raw", "")

        # Parse fee from Add'l Info column
        fee, addl_info_clean = _parse_fee(addl_raw)

        # Infer call type and eligibility
        call_type = _infer_call_type(nature, addl_raw, fee)
        eligibility = _infer_eligibility(nature, location)

        # Build title: org name is the submit target — that's the title for this call
        title = org_name

        # Build description from table columns
        description = _build_description(
            nature, length, location, addl_info_clean or ""
        )

        call_data: dict = {
            "title": title,
            "description": description or None,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": INDEX_URL,
            "call_type": call_type,
            "eligibility": eligibility,
            "fee": fee,
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_name,
            "metadata": {
                "source": "play-submissions-helper",
                "organization": org_name,
                "script_length": length,
                "location": location,
                "addl_info": addl_raw,
                "deadline_raw": deadline_raw,
                "discipline": "theater",
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "PSH: inserted %r (deadline=%s, type=%s, fee=%s)",
                title[:60],
                deadline,
                call_type,
                fee,
            )

    if skipped_deadline:
        logger.info("PSH: skipped %d past-deadline listings", skipped_deadline)
    if skipped_no_url:
        logger.info("PSH: skipped %d listings with no application URL", skipped_no_url)

    logger.info("PSH: %d found, %d new, %d updated", found, new, updated)
    return found, new, updated
