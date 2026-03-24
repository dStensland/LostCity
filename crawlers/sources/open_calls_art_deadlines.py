"""
Crawler for Art Deadlines List (artdeadlineslist.com) free homepage listings.

Source: https://www.artdeadlineslist.com/

Art Deadlines List is a long-running aggregator of artist opportunities: calls
for entries, grants, residencies, competitions, fellowships, and more. The free
homepage lists approximately 35 opportunities at any given time. The full
archive requires a paid subscription — this crawler only parses the free
publicly visible listings.

HTML structure (verified 2026-03-23):
  The page uses a very old HTML 4.01 layout. Listings are arranged as <dt>/<dd>
  pairs directly inside a <table> cell. The page is divided into sections via
  HTML comments:

    <!-- One Year ADS - START/END -->      (1–2 sponsor entries, DL inside <dl>)
    <!-- Regular Paid ADS - START/END -->  (main free listing, ~33 entries)
    <!-- Paid Subscriber List Sample - START/END -->  (2-entry paywall teaser)

  We parse ONLY the "Regular Paid ADS" section to avoid confusion with the
  paywall sample or ad-only entries.

  Each entry:
    <dt>Month DD, YYYY</dt>   or   <dt>Month D, YYYY</dt>
    <dd>
      <b>TITLE IN CAPS</b>
      Description text...
      "No Entry Fee." or "Entry Fee."
      Details:
      <a href="...">URL</a>
    </dd>
    <p><hr></p>

  Fee handling:
    - "No Entry Fee." → fee=0.0
    - "Entry Fee." only (no dollar amount) → fee=None (fee exists but unknown)
    - "$NN entry fee" → fee=NN.0
    - No fee mention → fee=None

  Category inference: We infer call_type from keywords in the title and
  description since the free listing doesn't expose ADL's own category tags.

Confidence tier: "aggregated" — ADL is an aggregator, not the issuing org.
Eligibility: varies per listing; inferred from title/desc if possible.
"""

import logging
import re
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

SOURCE_URL = "https://www.artdeadlineslist.com/"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
_ORG_NAME = "art-deadlines-list"

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

# HTML comment markers that bound the free listings section
_FREE_START_MARKER = "<!-- Regular Paid ADS - START -->"
_FREE_END_MARKER = "<!-- Regular Paid ADS - END -->"


# ---------------------------------------------------------------------------
# HTTP fetch
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("ArtDeadlines: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# HTML sectioning
# ---------------------------------------------------------------------------


def _extract_free_section(full_html: str) -> str:
    """
    Return the HTML fragment between the free-listing comment markers.
    Falls back to the full HTML if markers are not found (graceful degradation).
    """
    start_idx = full_html.find(_FREE_START_MARKER)
    end_idx = full_html.find(_FREE_END_MARKER)

    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        return full_html[start_idx:end_idx]

    logger.warning(
        "ArtDeadlines: could not find free-section markers — parsing full page"
    )
    return full_html


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------


def _parse_deadline(dt_text: str) -> Optional[str]:
    """
    Parse the DT text (e.g. 'March 27, 2026' or 'June 1, 2026') into 'YYYY-MM-DD'.
    Returns None if the text cannot be parsed.
    """
    m = re.search(
        r"(January|February|March|April|May|June|July|August|September"
        r"|October|November|December)\s+(\d{1,2}),?\s*(\d{4})",
        dt_text,
        re.I,
    )
    if not m:
        return None
    month_name, day, year = m.groups()
    month_num = _MONTH_MAP.get(month_name.lower())
    if not month_num:
        return None
    return f"{year}-{month_num:02d}-{int(day):02d}"


# ---------------------------------------------------------------------------
# Fee parsing
# ---------------------------------------------------------------------------


def _parse_fee(desc_text: str) -> Optional[float]:
    """
    Extract fee from description text.

    Rules:
    - "No Entry Fee." → 0.0
    - "$NN" (explicit dollar amount near "fee") → NN.0
    - "Entry Fee." only → None (fee exists but amount unknown)
    - No fee mention → None
    """
    if re.search(r"\bno\s+entry\s+fee\b", desc_text, re.I):
        return 0.0

    # Look for explicit dollar amount near "fee"
    dollar_m = re.search(r"\$(\d+(?:\.\d+)?)\s*(?:entry\s+)?fee", desc_text, re.I)
    if dollar_m:
        return float(dollar_m.group(1))

    # "Entry Fee." but no dollar amount — fee exists, amount unknown
    return None


# ---------------------------------------------------------------------------
# Call type inference
# ---------------------------------------------------------------------------

# Ordered: more specific checks first
_TYPE_PATTERNS = [
    ("residency", [r"\bresiden(?:cy|ce|t)\b", r"\bin\s+residence\b"]),
    ("fellowship", [r"\bfellowship\b", r"\bfellow\b"]),
    (
        "grant",
        [
            r"\bgrants?\b",
            r"\bfunding\b",
            r"\baward\b",
            r"\bprize\b",
            r"\bscholarship\b",
        ],
    ),
    ("commission", [r"\bcommission\b"]),
    (
        "exhibition_proposal",
        [
            r"\bproposal\b",
            r"\bexhibit\b",
            r"\bexhibition\b",
            r"\bjuried\b",
            r"\bgallery\b",
        ],
    ),
    (
        "submission",
        [
            r"\bcontest\b",
            r"\bcompetition\b",
            r"\bentry\b",
            r"\bentries\b",
            r"\bfestival\b",
            r"\bsubmit\b",
        ],
    ),
]


def _infer_call_type(title: str, description: str) -> str:
    """Infer call_type from combined title and description text."""
    combined = (title + " " + description).lower()
    for call_type, patterns in _TYPE_PATTERNS:
        if any(re.search(pat, combined) for pat in patterns):
            return call_type
    return "submission"


# ---------------------------------------------------------------------------
# Eligibility inference
# ---------------------------------------------------------------------------

_INTL_PATTERNS = [
    r"\binternational\b",
    r"\bworldwide\b",
    r"\bglobal\b",
    r"\bopen\s+to\s+all\b",
]
_NAT_PATTERNS = [
    r"\bunited\s+states\b",
    r"\bu\.s\.?\b",
    r"\bamerican\b",
    r"\bnational\b",
]


def _infer_eligibility(title: str, description: str) -> str:
    """Infer eligibility scope from combined title and description."""
    combined = (title + " " + description).lower()
    if any(re.search(p, combined) for p in _INTL_PATTERNS):
        return "International"
    if any(re.search(p, combined) for p in _NAT_PATTERNS):
        return "National"
    return "International"  # default assumption for ADL listings


# ---------------------------------------------------------------------------
# Application URL extraction
# ---------------------------------------------------------------------------


def _extract_application_url(dd) -> Optional[str]:
    """
    Find the primary application/details URL in a DD element.
    Prefers https URLs over bit.ly shortlinks; skips mailto: links.
    ADL entries typically have exactly one details link after "Details:".
    """
    links = [
        a["href"] for a in dd.find_all("a", href=True) if a["href"].startswith("http")
    ]
    if not links:
        return None

    # Prefer a non-shortlink URL if available
    full_links = [u for u in links if "bit.ly" not in u and "tinyurl" not in u]
    return (full_links or links)[0]


# ---------------------------------------------------------------------------
# Description cleaning
# ---------------------------------------------------------------------------

# "Details:\n<phone> OR\n<url> OR\n<email>" — strip from description
_DETAILS_RE = re.compile(r"\s*Details\s*:.*", re.DOTALL | re.I)


def _clean_description(raw_dd_text: str, title: str) -> str:
    """
    Extract a clean description from the DD text.
    Strips the title (repeated at the start), "Details:" section, and excess whitespace.
    ADL descriptions sometimes contain UTF-8 replacement chars from Latin-1 encoding.
    """
    text = raw_dd_text

    # Remove the title from the start
    if text.startswith(title):
        text = text[len(title) :].lstrip()

    # Remove "Details: phone OR url OR email" suffix
    text = _DETAILS_RE.sub("", text)

    # Normalize whitespace and encoding artifacts
    text = re.sub(r"\s+", " ", text).strip()

    return text[:2000] if text else ""


# ---------------------------------------------------------------------------
# Entry parser
# ---------------------------------------------------------------------------


def _parse_entries(section_html: str) -> list[dict]:
    """
    Parse all DT/DD pairs from the free-listings HTML section.
    Returns a list of raw entry dicts.
    """
    soup = BeautifulSoup(section_html, "html.parser")

    all_dt = soup.find_all("dt")
    all_dd = soup.find_all("dd")

    if len(all_dt) != len(all_dd):
        logger.warning(
            "ArtDeadlines: DT/DD count mismatch (%d dt, %d dd) — pairing sequentially",
            len(all_dt),
            len(all_dd),
        )

    entries: list[dict] = []

    for dt, dd in zip(all_dt, all_dd):
        dt_text = dt.get_text(strip=True)
        deadline_iso = _parse_deadline(dt_text)

        # Title: text inside the first <b> element
        b_el = dd.find("b")
        if not b_el:
            logger.debug(
                "ArtDeadlines: no <b> title found in entry with DT '%s'", dt_text
            )
            continue
        title_raw = b_el.get_text(strip=True)
        # ADL titles are ALL CAPS — preserve as-is for now; portals can normalize display
        title = re.sub(r"\s+", " ", title_raw).strip()
        if not title:
            continue

        dd_text = dd.get_text(separator=" ", strip=True)
        description = _clean_description(dd_text, title)

        fee = _parse_fee(dd_text)
        application_url = _extract_application_url(dd)
        call_type = _infer_call_type(title, description)
        eligibility = _infer_eligibility(title, description)

        entries.append(
            {
                "title": title,
                "description": description,
                "deadline": deadline_iso,
                "application_url": application_url,
                "fee": fee,
                "call_type": call_type,
                "eligibility": eligibility,
            }
        )

    logger.debug("ArtDeadlines: parsed %d entries from free section", len(entries))
    return entries


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Art Deadlines List free homepage listings.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0
    today = date.today()

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    html = _fetch(SOURCE_URL, session)
    if not html:
        logger.error("ArtDeadlines: failed to fetch homepage")
        return 0, 0, 0

    free_section = _extract_free_section(html)
    entries = _parse_entries(free_section)

    if not entries:
        logger.warning("ArtDeadlines: no entries parsed from free section")
        return 0, 0, 0

    for entry in entries:
        found += 1

        # Skip past-deadline entries
        deadline_iso = entry.get("deadline")
        if deadline_iso:
            try:
                deadline_date = date.fromisoformat(deadline_iso)
                if deadline_date < today:
                    logger.debug(
                        "ArtDeadlines: skipping '%s' — deadline %s is in the past",
                        entry["title"],
                        deadline_iso,
                    )
                    continue
            except ValueError:
                pass  # malformed date — proceed anyway

        # Require an application URL
        application_url = entry.get("application_url")
        if not application_url:
            logger.debug(
                "ArtDeadlines: skipping '%s' — no application URL found",
                entry["title"],
            )
            continue

        call_data: dict = {
            "title": entry["title"],
            "description": entry.get("description"),
            "deadline": entry.get("deadline"),
            "application_url": application_url,
            "source_url": SOURCE_URL,
            "call_type": entry["call_type"],
            "eligibility": entry["eligibility"],
            "fee": entry.get("fee"),
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": _ORG_NAME,
            "metadata": {
                "fee_unknown": entry.get("fee") is None
                and re.search(r"\bentry\s+fee\b", entry.get("description", ""), re.I)
                is not None,
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1

    logger.info("ArtDeadlines: %d found, %d new, %d updated", found, new, updated)
    return found, new, updated
