"""
Crawler for ArtCall.org open calls for artists.

Source: https://artcall.org/calls

ArtCall.org is a call-for-entry management platform and public aggregator.
The listing page at /calls shows two sections:

  1. "ArtCall™ Calls" — calls managed on ArtCall-hosted subdomains
     (e.g. https://2026louisianacontemporary.artcall.org).
     The listing page carries all key fields directly:
       Entry Deadline:  "May 22, 2026, 11:59:00 PM"
       Eligibility:     "State" / "National" / "International" / "Regional" / "Local"
       Entry Fee:       "13.33" or "15.00 - 25.00" (range) or "Free to Enter"
       Location badge:  State name or "---Non US States---"

  2. "Additional Calls" — calls that link to artcall.org /calls/cNNNN-slug detail
     pages. The listing shows "Call Dates: <start> through <deadline>" and a
     description snippet. The DEADLINE is the END date in that range.
     To get: external application URL + exact call type + eligibility
     we fetch the detail page (table: Call Type, Call Eligibility, Entry Dates,
     Entry Fee?).

HTML structure (verified 2026-03-24):
  div.calls_wrapper
    h3 "ArtCall™ Calls"     — section header
      div.row.mb-5          — one call per row
        div.col-md-3
          a[href]           — link (artcall subdomain)
          a.btn[href]       — same link (or same artcall subdomain)
          span.badge        — state/location badge (may be absent)
        div.col-md-9
          a[href]           — title link (same as col-md-3 link)
          "Entry Deadline:" then text
          "Eligibility:"    then text
          "Entry Fee:"      then text
          text              — state / description snippet

    h3 "Additional Calls" — section header
      div.row.mb-5
        div.col-md-3
          a[href="/calls/cNNNN-slug"]
          a.btn[href="/calls/cNNNN-slug"]
          span.badge        — state or "---Non US States---"
        div.col-md-9
          a[href="/calls/cNNNN-slug"]  — title + detail page link
          "Call Dates:" then "<start> through <deadline>"
          "Call Description:" then snippet

  Detail page (Additional Calls only): https://artcall.org/calls/cNNNN-slug
    h1.entry-title a[href]   — external application URL
    table.table
      "Call Type"            → "Exhibition", "Fair / Festival", "Proposals / Public Art",
                               "Residency", "Grant / Award", etc.
      "Call Eligibility"     → "National", "International", "Regional", "State", "Local"
      "Entry Dates"          → "M/D/YY, H:MM AM - M/D/YY, H:MM AM N Days Left"
      "Entry Fee?"           → "No" (free) or "Yes"
    a "Apply For Call"[href] — external application URL (preferred over h1 link)

Call type mapping:
  Exhibition           → "exhibition_proposal"
  Fair / Festival      → "submission"
  Proposals / Public Art → "commission"
  Residency            → "residency"
  Grant / Award        → "grant"
  Workshop             → "residency"   (closest available)
  Other / (unknown)    → "submission"

Eligibility badge mapping:
  State    → "State"
  Regional → "Regional"
  National → "National"
  Local    → "Local"
  International / ---Non US States--- → "International"

Fee parsing:
  "Free to Enter" / "No" (from detail table) → 0.0
  "13.33"                                     → 13.33
  "15.00 - 25.00"                             → 15.0 (lower bound)
  absent / unparseable                        → None

Date format:
  ArtCall Calls:   "May 22, 2026, 11:59:00 PM"
  Additional Calls (listing): "Feb 25, 2026, 10:00:54 AM through Mar 25, 2026, ..."
  Additional Calls (detail):  "3/6/26, 1:59 PM - 3/30/26, 9:00 AM"

Strategy:
  1. Fetch https://artcall.org/calls (single page — no pagination).
  2. Parse ArtCall Calls section: extract all data from listing page, no detail fetch.
  3. Parse Additional Calls section: collect {title, source_url, dates_text, badge}.
     For each, fetch the detail page to get: application_url, call_type, eligibility,
     entry_fee.
  4. Skip past-deadline calls.
  5. Insert/update via insert_open_call().

Rate limiting:
  0.6s between detail page fetches (Additional Calls section only).
  No delay needed for listing page — single fetch.

Confidence tier: "aggregated" — ArtCall is a platform/aggregator, not the issuing org.
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

BASE_URL = "https://artcall.org"
LISTING_URL = "https://artcall.org/calls"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

DETAIL_DELAY_S = 0.6  # between Additional Calls detail fetches

# Call type text from detail page → call_type enum
_CALL_TYPE_MAP: dict[str, str] = {
    "exhibition": "exhibition_proposal",
    "fair / festival": "submission",
    "fair/festival": "submission",
    "proposals / public art": "commission",
    "proposals/public art": "commission",
    "public art": "commission",
    "residency": "residency",
    "grant / award": "grant",
    "grant/award": "grant",
    "grant": "grant",
    "award": "grant",
    "workshop": "residency",
    "scholarship": "grant",
}

# US non-state badge values
_NON_US_BADGES = {"---non us states---", "non us states", "--non us state--"}

# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[bytes]:
    """Return raw response bytes or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content
    except requests.RequestException as exc:
        logger.warning("ArtCall: failed to fetch %s — %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

# "May 22, 2026, 11:59:00 PM" — ArtCall Calls section
_ARTCALL_DATE_RE = re.compile(
    r"([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4}),?\s+\d+:\d+(?::\d+)?\s*[AP]M",
    re.I,
)

# "M/D/YY, H:MM AM" — detail page Entry Dates cell (first = deadline, preceded by " - ")
_DETAIL_DATE_RE = re.compile(
    r"(\d{1,2})/(\d{1,2})/(\d{2}),?\s+\d+:\d+\s*[AP]M",
    re.I,
)

_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _parse_long_date(text: str) -> Optional[str]:
    """
    Parse "Month D, YYYY, H:MM:SS PM" → "YYYY-MM-DD".

    Used for ArtCall Calls section 'Entry Deadline:' field.
    """
    m = _ARTCALL_DATE_RE.search(text)
    if not m:
        return None
    month_name = m.group(1).lower()[:3]
    month = _MONTH_MAP.get(month_name)
    if not month:
        return None
    day = int(m.group(2))
    year = int(m.group(3))
    try:
        datetime(year, month, day)
    except ValueError:
        return None
    return f"{year}-{month:02d}-{day:02d}"


def _parse_short_date(text: str) -> Optional[str]:
    """
    Parse "M/D/YY, H:MM AM" → "YYYY-MM-DD".

    Used for detail page Entry Dates cell. The FIRST date in the cell is the
    deadline; we stop after the first match.
    """
    m = _DETAIL_DATE_RE.search(text)
    if not m:
        return None
    mo, day, yy = int(m.group(1)), int(m.group(2)), int(m.group(3))
    year = 2000 + yy
    try:
        datetime(year, mo, day)
    except ValueError:
        return None
    return f"{year}-{mo:02d}-{day:02d}"


def _parse_through_date(text: str) -> Optional[str]:
    """
    Parse "Feb 25, 2026, 10:00:54 AM through Mar 25, 2026, 11:59:22 PM"
    → "2026-03-25" (the END / deadline date).

    Also handles "Mar 6, 2026 through Mar 30, 2026" patterns.
    Used for Additional Calls listing rows where deadline = end of the range.
    """
    # Split on "through" and take the second part
    parts = re.split(r"\bthrough\b", text, maxsplit=1, flags=re.I)
    if len(parts) == 2:
        return _parse_long_date(parts[1])
    # Fallback: maybe there's only one date (e.g. just "Mar 30, 2026")
    return _parse_long_date(text)


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if deadline_str (YYYY-MM-DD) has already passed."""
    if not deadline_str:
        return False
    try:
        return date.fromisoformat(deadline_str) < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Fee parsing
# ---------------------------------------------------------------------------

_FEE_RE = re.compile(r"\$?\s*(\d+(?:\.\d+)?)")


def _parse_fee(fee_text: str) -> Optional[float]:
    """
    Parse a fee string from the listing page.

    Examples:
      "13.33"          → 13.33
      "15.00 - 25.00"  → 15.0  (take lower bound)
      "Free to Enter"  → 0.0
      "No"             → 0.0   (from detail page)
      ""               → None
    """
    if not fee_text:
        return None
    t = fee_text.strip().lower()
    if "free" in t or t == "no":
        return 0.0
    # Find all numbers in the string — take the first (lowest)
    numbers = [float(m.group(1)) for m in _FEE_RE.finditer(fee_text)]
    if numbers:
        first = numbers[0]
        return first if first > 0 else 0.0
    return None


# ---------------------------------------------------------------------------
# Eligibility mapping
# ---------------------------------------------------------------------------

_ELIGIBILITY_MAP: dict[str, str] = {
    "state": "State",
    "regional": "Regional",
    "national": "National",
    "local": "Local",
    "international": "International",
}


def _map_eligibility(raw: str, badge_text: str = "") -> str:
    """
    Convert raw eligibility text to a canonical eligibility string.

    Falls back to badge_text if raw is empty.
    """
    t = raw.strip().lower()
    if t in _ELIGIBILITY_MAP:
        return _ELIGIBILITY_MAP[t]

    # Check badge
    badge_lower = badge_text.strip().lower()
    if badge_lower in _NON_US_BADGES:
        return "International"

    # Keyword fallback
    if "international" in t or "worldwide" in t or "global" in t:
        return "International"
    if "national" in t:
        return "National"
    if "regional" in t or "region" in t:
        return "Regional"
    if "local" in t or "city" in t:
        return "Local"
    if "state" in t:
        return "State"

    return "National"  # safe default


# ---------------------------------------------------------------------------
# Call type mapping
# ---------------------------------------------------------------------------


def _map_call_type(call_type_raw: str, title: str = "") -> str:
    """Map a raw Call Type string to a call_type enum value."""
    t = call_type_raw.strip().lower()
    for key, value in _CALL_TYPE_MAP.items():
        if key in t:
            return value

    # Keyword fallback on title
    title_lower = title.lower()
    if any(kw in title_lower for kw in ("residency", "resident in", "artist in residence")):
        return "residency"
    if any(kw in title_lower for kw in ("grant", "award", "prize", "fellowship")):
        return "grant"
    if any(kw in title_lower for kw in ("mural", "public art", "commission", "rfq", "rfp")):
        return "commission"

    return "submission"


# ---------------------------------------------------------------------------
# Listing page parser — ArtCall Calls section
# ---------------------------------------------------------------------------

# Structured label → value separator patterns in col-md-9 text
_LABEL_VALUE_RE = re.compile(
    r"(Entry Deadline|Eligibility|Entry Fee)\s*:\s*(.*?)(?=Entry Deadline|Eligibility|Entry Fee|$)",
    re.I | re.S,
)


def _parse_artcall_row(row_div, source_id: int) -> Optional[dict]:
    """
    Parse one row from the "ArtCall™ Calls" section of the listing page.

    All required data is available on the listing page; no detail fetch needed.
    Returns a raw dict for insert_open_call() or None if data is insufficient.
    """
    col3 = row_div.find("div", class_="col-md-3")
    col9 = row_div.find("div", class_="col-md-9")
    if not col9:
        return None

    # Title
    title_link = col9.find("a")
    if not title_link:
        return None
    title = title_link.get_text(strip=True)
    if not title:
        return None

    # Application URL — same as the artcall subdomain link
    source_url = title_link.get("href", "").strip()
    if not source_url:
        return None

    # Location badge (optional — state name)
    badge_text = ""
    if col3:
        badge = col3.find("span", class_="badge")
        badge_text = badge.get_text(strip=True) if badge else ""

    # Extract structured fields from the text content of col-md-9.
    # The raw text contains label-value pairs like:
    #   Entry Deadline: May 22, 2026, 11:59:00 PM
    #   Eligibility: State
    #   Entry Fee: 13.33
    col9_text = col9.get_text(separator=" ", strip=True)

    # Deadline
    deadline: Optional[str] = None
    dl_match = re.search(r"Entry Deadline\s*:\s*(.+?)(?=Eligibility|Entry Fee|$)", col9_text, re.I | re.S)
    if dl_match:
        deadline = _parse_long_date(dl_match.group(1))

    # Eligibility
    eligibility = "National"
    el_match = re.search(r"Eligibility\s*:\s*(\S+)", col9_text, re.I)
    if el_match:
        eligibility = _map_eligibility(el_match.group(1), badge_text)
    elif badge_text:
        eligibility = _map_eligibility("", badge_text)

    # Fee
    fee: Optional[float] = None
    fee_match = re.search(r"Entry Fee\s*:\s*(.+?)(?=\n|$|\s{2,})", col9_text, re.I)
    if fee_match:
        fee = _parse_fee(fee_match.group(1))

    # Description — text after the last structured field
    description: Optional[str] = None
    # Remove the structured part to get the description
    desc_text = col9_text
    for pattern in (r"Entry Deadline\s*:.*", r"Eligibility\s*:.*", r"Entry Fee\s*:.*"):
        desc_text = re.sub(pattern, "", desc_text, flags=re.I)
    # Remove the title from the description
    desc_text = desc_text.replace(title, "").strip()
    # Remove badge text
    if badge_text:
        desc_text = desc_text.replace(badge_text, "").strip()
    # Remove ellipsis / "…" leftover
    desc_text = re.sub(r"^\s*…\s*", "", desc_text).strip()
    desc_text = re.sub(r"\s{2,}", " ", desc_text).strip()
    if len(desc_text) > 30:
        description = desc_text[:2000]

    # Org slug from subdomain
    # e.g. "2026louisianacontemporary.artcall.org" → "2026louisianacontemporary"
    org_slug = "artcall"
    domain_match = re.search(r"https?://([^.]+)\.artcall\.org", source_url)
    if domain_match:
        org_slug = domain_match.group(1)[:40]

    return {
        "title": title,
        "description": description,
        "deadline": deadline,
        "application_url": source_url,
        "source_url": source_url,
        "call_type": "submission",  # ArtCall-hosted calls are predominantly juried submissions
        "eligibility": eligibility,
        "fee": fee,
        "source_id": source_id,
        "confidence_tier": "aggregated",
        "_org_name": org_slug,
        "metadata": {
            "source": "artcall",
            "section": "artcall_calls",
            "location_badge": badge_text,
        },
    }


# ---------------------------------------------------------------------------
# Listing page parser — Additional Calls section (listing-level extraction)
# ---------------------------------------------------------------------------


def _parse_additional_listing_row(row_div) -> Optional[dict]:
    """
    Parse a row from the "Additional Calls" section listing.

    Returns a partial dict: {title, source_url (relative /calls/cNNNN-slug),
    dates_text, badge_text, description_snippet}.
    The caller will fetch the detail page to complete the record.
    """
    col3 = row_div.find("div", class_="col-md-3")
    col9 = row_div.find("div", class_="col-md-9")
    if not col9:
        return None

    title_link = col9.find("a")
    if not title_link:
        return None

    title = title_link.get_text(strip=True)
    href = title_link.get("href", "").strip()
    if not href or not href.startswith("/calls/c"):
        return None

    source_url = BASE_URL + href

    # Location badge
    badge_text = ""
    if col3:
        badge = col3.find("span", class_="badge")
        badge_text = badge.get_text(strip=True) if badge else ""

    col9_text = col9.get_text(separator=" ", strip=True)

    # Extract "Call Dates:" range text — deadline is the end date
    dates_text = ""
    dates_match = re.search(
        r"Call Dates\s*:\s*(.+?)(?=Call Description|$)", col9_text, re.I | re.S
    )
    if dates_match:
        dates_text = dates_match.group(1).strip()

    # Description snippet
    desc_snippet = ""
    desc_match = re.search(r"Call Description\s*:\s*(.+)$", col9_text, re.I | re.S)
    if desc_match:
        desc_snippet = desc_match.group(1).strip()[:500]

    return {
        "title": title,
        "source_url": source_url,
        "dates_text": dates_text,
        "badge_text": badge_text,
        "description_snippet": desc_snippet,
    }


# ---------------------------------------------------------------------------
# Detail page parser (Additional Calls section)
# ---------------------------------------------------------------------------


def _parse_additional_detail(html_bytes: bytes, source_url: str) -> Optional[dict]:
    """
    Parse an Additional Calls detail page.

    Returns dict with: application_url, call_type, eligibility, fee, deadline,
    description. Or None if the application_url is missing.
    """
    soup = BeautifulSoup(html_bytes, "html.parser")

    # External application URL — prefer "Apply For Call" link, fallback to h1 title link
    apply_link = soup.find("a", string=re.compile(r"apply for call", re.I))
    if not apply_link:
        # Try any link with "apply" in text
        for a in soup.find_all("a"):
            if "apply" in a.get_text(strip=True).lower():
                apply_link = a
                break

    application_url: str = ""
    if apply_link:
        application_url = apply_link.get("href", "").strip()

    # Fallback: h1.entry-title a
    if not application_url:
        h1_link = soup.select_one(".entry-title a")
        if h1_link:
            application_url = h1_link.get("href", "").strip()

    # If the application URL is internal (starts with /), use the source page itself
    if application_url and application_url.startswith("/"):
        application_url = BASE_URL + application_url
    if not application_url:
        application_url = source_url

    # Parse the detail table
    call_type_raw = ""
    eligibility_raw = ""
    entry_dates_raw = ""
    entry_fee_raw = ""

    table = soup.find("table", class_="table")
    if table:
        for row in table.find_all("tr"):
            th = row.find("th")
            td = row.find("td")
            if not th:
                continue
            label = th.get_text(separator=" ", strip=True).lower()

            if "call type" in label and td:
                call_type_raw = td.get_text(strip=True)
            elif "call eligibility" in label and td:
                eligibility_raw = td.get_text(strip=True)
            elif "entry dates" in label and td:
                entry_dates_raw = td.get_text(separator=" ", strip=True)
            elif "entry fee" in label and td:
                entry_fee_raw = td.get_text(strip=True)

    # Deadline: in detail page, Entry Dates = "M/D/YY, H:MM AM - M/D/YY, H:MM AM N Days Left"
    # The FIRST date is deadline (open = when the call closes, i.e. the "to" date)
    # Actually on ArtCall detail: "3/6/26, 1:59 PM - 3/30/26, 9:00 AM 5 Days Left"
    # The first date is the OPEN date; the second date is the CLOSE/deadline.
    # We want the CLOSE date (last date before "Days Left").
    deadline: Optional[str] = None
    if entry_dates_raw:
        # Find all M/D/YY date matches — take the LAST before "Days Left"
        all_date_matches = list(_DETAIL_DATE_RE.finditer(entry_dates_raw))
        if len(all_date_matches) >= 2:
            # Second match is the deadline
            m = all_date_matches[1]
            mo, day, yy = int(m.group(1)), int(m.group(2)), int(m.group(3))
            year = 2000 + yy
            try:
                datetime(year, mo, day)
                deadline = f"{year}-{mo:02d}-{day:02d}"
            except ValueError:
                pass
        elif all_date_matches:
            # Only one date — use it
            m = all_date_matches[0]
            mo, day, yy = int(m.group(1)), int(m.group(2)), int(m.group(3))
            year = 2000 + yy
            try:
                datetime(year, mo, day)
                deadline = f"{year}-{mo:02d}-{day:02d}"
            except ValueError:
                pass

    # Description — main content area
    description: Optional[str] = None
    content_div = soup.find("div", class_="call-content")
    if content_div:
        # Remove the header and table from description extraction
        for tag in content_div.find_all(["table", "header", "h3"]):
            tag.decompose()
        desc_text = content_div.get_text(separator=" ", strip=True)
        desc_text = re.sub(r"\s{2,}", " ", desc_text).strip()
        if len(desc_text) > 30:
            description = desc_text[:2000]

    fee = _parse_fee(entry_fee_raw)

    return {
        "application_url": application_url,
        "call_type_raw": call_type_raw,
        "eligibility_raw": eligibility_raw,
        "deadline": deadline,
        "fee": fee,
        "description": description,
    }


# ---------------------------------------------------------------------------
# Main listing page parser — coordinates both sections
# ---------------------------------------------------------------------------


def _parse_listing_page(html_bytes: bytes) -> tuple[list[dict], list[dict]]:
    """
    Parse the main /calls listing page.

    Returns:
      - artcall_rows: list of partial dicts for "ArtCall™ Calls" section rows
      - additional_rows: list of partial dicts for "Additional Calls" section rows
    """
    soup = BeautifulSoup(html_bytes, "html.parser")
    wrapper = soup.find("div", class_="calls_wrapper")
    if not wrapper:
        logger.warning("ArtCall: could not find .calls_wrapper on listing page")
        return [], []

    # Find section boundaries by h3 headers
    artcall_h3 = None
    additional_h3 = None
    for h3 in wrapper.find_all("h3"):
        text = h3.get_text(strip=True).lower()
        if "artcall" in text and "calls" in text and artcall_h3 is None:
            artcall_h3 = h3
        elif "additional" in text and additional_h3 is None:
            additional_h3 = h3

    artcall_rows: list[dict] = []
    additional_rows: list[dict] = []

    def _collect_rows(start_h3, end_h3) -> list:
        """Collect all .row.mb-5 divs between two h3 elements."""
        rows = []
        node = start_h3.find_next_sibling() if start_h3 else None
        while node:
            if node == end_h3:
                break
            if node.name == "div" and "row" in node.get("class", []):
                if node.find("div", class_="col-md-9"):
                    rows.append(node)
            node = node.find_next_sibling()
        return rows

    # Collect ArtCall Calls rows (between artcall_h3 and additional_h3)
    if artcall_h3:
        for row_div in _collect_rows(artcall_h3, additional_h3):
            entry = {"_row_div": row_div, "_section": "artcall"}
            artcall_rows.append(entry)

    # Collect Additional Calls rows (from additional_h3 to end)
    if additional_h3:
        for row_div in _collect_rows(additional_h3, None):
            listing = _parse_additional_listing_row(row_div)
            if listing:
                additional_rows.append(listing)

    logger.info(
        "ArtCall: listing page — %d ArtCall rows, %d Additional rows",
        len(artcall_rows),
        len(additional_rows),
    )
    return artcall_rows, additional_rows


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl ArtCall.org open calls for artists.

    Strategy:
      1. Fetch https://artcall.org/calls — single page, no pagination.
      2. Parse "ArtCall™ Calls" section: extract all data from the listing page.
         No detail fetches needed — all fields are present on the listing.
      3. Parse "Additional Calls" section: extract title, source_url, dates from
         listing. Fetch each detail page for application_url + call_type.
      4. Skip calls with past deadlines.
      5. Insert/update via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    # -----------------------------------------------------------------------
    # Fetch listing page
    # -----------------------------------------------------------------------
    logger.info("ArtCall: fetching listing page — %s", LISTING_URL)
    html_bytes = _fetch(LISTING_URL, session)
    if not html_bytes:
        logger.error("ArtCall: failed to fetch listing page")
        return 0, 0, 0

    artcall_raw_rows, additional_listings = _parse_listing_page(html_bytes)

    if not artcall_raw_rows and not additional_listings:
        logger.warning("ArtCall: no rows found on listing page — site structure may have changed")
        return 0, 0, 0

    # -----------------------------------------------------------------------
    # Phase 1: ArtCall™ Calls section
    # -----------------------------------------------------------------------
    skipped_expired = 0
    skipped_no_data = 0

    for entry in artcall_raw_rows:
        row_div = entry["_row_div"]
        call_data = _parse_artcall_row(row_div, source_id)
        if not call_data:
            skipped_no_data += 1
            continue

        title = call_data["title"]
        deadline = call_data.get("deadline")

        if _is_past_deadline(deadline):
            skipped_expired += 1
            logger.debug(
                "ArtCall: skipping %r — deadline %s is past", title[:60], deadline
            )
            continue

        found += 1
        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "ArtCall: inserted/updated (artcall) %r (deadline=%s, fee=%s)",
                title[:60],
                deadline,
                call_data.get("fee"),
            )

    logger.info(
        "ArtCall: ArtCall™ Calls — %d found, %d skipped expired, %d skipped no data",
        found,
        skipped_expired,
        skipped_no_data,
    )

    # -----------------------------------------------------------------------
    # Phase 2: Additional Calls section (detail page fetch per call)
    # -----------------------------------------------------------------------
    additional_found = 0
    additional_new = 0
    additional_expired = 0
    additional_errors = 0
    additional_no_url = 0

    for idx, listing in enumerate(additional_listings):
        title = listing["title"]
        source_url = listing["source_url"]
        dates_text = listing.get("dates_text", "")
        badge_text = listing.get("badge_text", "")
        desc_snippet = listing.get("description_snippet", "")

        # Pre-filter: parse deadline from listing "through" date
        deadline_pre = _parse_through_date(dates_text)
        if _is_past_deadline(deadline_pre):
            additional_expired += 1
            logger.debug(
                "ArtCall: skipping (additional) %r — deadline %s is past",
                title[:60],
                deadline_pre,
            )
            continue

        # Rate limit before detail fetch
        if idx > 0:
            time.sleep(DETAIL_DELAY_S)

        detail_bytes = _fetch(source_url, session)
        if not detail_bytes:
            additional_errors += 1
            logger.warning("ArtCall: failed to fetch detail page for %r", title[:60])
            continue

        detail = _parse_additional_detail(detail_bytes, source_url)
        if not detail:
            additional_no_url += 1
            continue

        application_url = detail.get("application_url", "")
        if not application_url:
            additional_no_url += 1
            continue

        # Use detail deadline if available; fallback to listing pre-filter
        deadline = detail.get("deadline") or deadline_pre
        if _is_past_deadline(deadline):
            additional_expired += 1
            logger.debug(
                "ArtCall: skipping (additional) %r — deadline %s is past (detail)",
                title[:60],
                deadline,
            )
            continue

        call_type = _map_call_type(detail.get("call_type_raw", ""), title)
        eligibility = _map_eligibility(detail.get("eligibility_raw", ""), badge_text)
        fee = detail.get("fee")
        description = detail.get("description") or (desc_snippet if desc_snippet else None)

        # Org slug from the /calls/cNNNN-slug path
        url_slug = source_url.rstrip("/").split("/")[-1]
        org_slug = re.sub(r"^c\d+-", "", url_slug)  # strip cNNNN- prefix
        org_slug = org_slug[:40]

        call_data = {
            "title": title,
            "description": description,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": source_url,
            "call_type": call_type,
            "eligibility": eligibility,
            "fee": fee,
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": org_slug or "artcall",
            "metadata": {
                "source": "artcall",
                "section": "additional_calls",
                "call_type_raw": detail.get("call_type_raw"),
                "location_badge": badge_text,
            },
        }

        additional_found += 1
        result = insert_open_call(call_data)
        if result:
            additional_new += 1
            logger.debug(
                "ArtCall: inserted/updated (additional) %r (deadline=%s, type=%s, fee=%s)",
                title[:60],
                deadline,
                call_type,
                fee,
            )

    if additional_expired:
        logger.info("ArtCall: Additional Calls — skipped %d expired", additional_expired)
    if additional_errors:
        logger.warning("ArtCall: Additional Calls — %d detail fetch errors", additional_errors)
    if additional_no_url:
        logger.info("ArtCall: Additional Calls — %d with no application URL", additional_no_url)

    total_found = found + additional_found
    total_new = new + additional_new

    logger.info(
        "ArtCall: crawl complete — %d found (%d artcall + %d additional), "
        "%d new/updated, %d total expired skipped",
        total_found,
        found,
        additional_found,
        total_new,
        skipped_expired + additional_expired,
    )
    return total_found, total_new, updated
