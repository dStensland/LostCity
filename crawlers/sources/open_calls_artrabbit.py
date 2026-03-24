"""
Crawler for ArtRabbit Artist Opportunities (artrabbit.com/artist-opportunities).

ArtRabbit is a UK-based international arts platform that curates a hand-picked
selection of open calls, commissions, residencies, grants, prizes, and
exhibition opportunities for artists, curators, and writers worldwide.

It is NOT the primary source for any listing — it aggregates calls posted by
arts organizations globally — so confidence_tier is "aggregated".

All calls carry metadata.scope = "international" since ArtRabbit is UK-based
with global coverage and serves the "National & International" section of the
Arts portal Open Calls board.

Crawl strategy — single page, no Playwright needed (static HTML):

  The index page https://www.artrabbit.com/artist-opportunities renders all
  ~70 current opportunities in one pass as <div class="artopp"> elements.
  No pagination is required.

  Each <div class="artopp"> contains:
    data-a="YYYYMMDD"              — date added (also in <p class="b_date">)
    data-d="YYYYMMDD"              — deadline date (machine-readable, always present)

    <h3 class="b_categorical-heading mod--artopps">
      Opportunity type, may have "| Promoted" suffix.

    <h2><a href="/artist-opportunities/...">Title</a></h2>
      Relative URL → source_url when resolved to artrabbit.com.

    <div class="m_body-copy">
      <p>Description paragraphs including Eligibility and What you get.</p>
      <p><strong><span class="l_blue">Deadline DD Month YYYY</span></strong></p>
      <div class="l_black">Organiser: ORG NAME</div>
      <div class="l_nomarginp">Locations: REGION</div>
      <div class="l_section">
        <a class="b_submit mod--next" href="APPLY_URL" target="_blank"><span>Apply</span></a>
      </div>

Type mapping (ArtRabbit taxonomy → our call_type):

  Accepted:
    "Artist in Residence"           → residency
    "Curator in Residence"          → residency
    "Studio Space"                  → residency
    "Commission"                    → commission
    "Exhibition Opportunity"        → submission
    "Screening Opportunity"         → submission
    "Competition"                   → submission
    "Prizes and Awards"             → grant
    "Grant"                         → grant
    "Fellowship"                    → grant
    "Collaboration"                  → submission
    "Writing / Publishing Opportunity" → submission
    "Professional Development"      → grant  (bursaries, funded programmes)

  Promoted variants (e.g. "Commission | Promoted") are normalized to the
  base type before mapping — "Promoted" is a display label, not a type.

Fee extraction:
  ArtRabbit does not have a structured fee field. We extract fee mentions from
  the body copy using a regex on lines matching "entry fee:", "application fee:",
  "participation fee:", or "submission fee:". The raw string is stored in
  metadata.fee_raw; fee column remains None (no reliable numeric extraction
  across multi-currency values like "£20 per artwork" or "€40.00 Early Bird").

Past-deadline filtering:
  data-d attribute is parsed as YYYYMMDD and compared to today. Past-deadline
  calls are skipped before insertion.
"""

import logging
import re
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

INDEX_URL = "https://www.artrabbit.com/artist-opportunities"
BASE_URL = "https://www.artrabbit.com"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Polite delay — ArtRabbit is a small nonprofit platform; single page so only
# one request, but we keep a session-level header setup for good citizenship.
REQUEST_TIMEOUT = 30

# ---------------------------------------------------------------------------
# Type mapping
# ---------------------------------------------------------------------------

# Strip the "| Promoted" suffix before normalizing
_PROMOTED_RE = re.compile(r"\s*\|\s*promoted\s*$", re.I)

# ArtRabbit type label → our call_type
_TYPE_MAP: dict[str, str] = {
    "artist in residence": "residency",
    "curator in residence": "residency",
    "studio space": "residency",
    "commission": "commission",
    "exhibition opportunity": "submission",
    "screening opportunity": "submission",
    "competition": "submission",
    "prizes and awards": "grant",
    "grant": "grant",
    "fellowship": "grant",
    "collaboration": "submission",
    "writing / publishing opportunity": "submission",
    "professional development": "grant",
}


def _classify_type(raw_type: str) -> Optional[str]:
    """
    Map an ArtRabbit type label to our call_type, or None to skip.

    Strips "| Promoted" variants before lookup. Unknown types fall back to
    "submission" — the most common open-call category.
    """
    normalized = _PROMOTED_RE.sub("", raw_type).strip().lower()
    if not normalized:
        return None
    return _TYPE_MAP.get(normalized, "submission")


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline_attr(data_d: str) -> Optional[str]:
    """
    Parse the data-d attribute (YYYYMMDD) into an ISO date string.

    Returns "YYYY-MM-DD" or None if the attribute is absent or malformed.
    """
    if not data_d or len(data_d) != 8:
        return None
    try:
        year = int(data_d[0:4])
        month = int(data_d[4:6])
        day = int(data_d[6:8])
        datetime(year, month, day)  # validate
        return f"{year}-{month:02d}-{day:02d}"
    except (ValueError, TypeError):
        return None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline has already passed."""
    if not deadline_str:
        return False
    try:
        dl = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Fee extraction
# ---------------------------------------------------------------------------

# Regex to capture fee info from body copy lines
_FEE_RE = re.compile(
    r"(?:entry|application|participation|submission)\s+fee\s*:\s*([^\n<]{1,120})",
    re.I,
)


def _extract_fee_raw(body_text: str) -> Optional[str]:
    """
    Extract a raw fee string from the opportunity body text.

    Returns the fee description string (e.g. "£20 per artwork") or None if
    no fee-related line is found. We store this as metadata.fee_raw only —
    we do not attempt to parse a numeric fee because ArtRabbit uses multi-
    currency and compound fee structures that would be misleadingly lossy to
    collapse to a single float.
    """
    m = _FEE_RE.search(body_text)
    if m:
        raw = m.group(1).strip().rstrip(".")
        # If it says "free" or "application is free", treat as 0-fee
        if re.search(r"\bfree\b", raw, re.I):
            return "free"
        return raw[:120]
    return None


# ---------------------------------------------------------------------------
# Eligibility extraction
# ---------------------------------------------------------------------------

# Looks for "Eligibility: ..." or "Who can apply: ..." as a structured label
_ELIG_RE = re.compile(
    r"(?:eligibility|who\s+can\s+apply)\s*:\s*([^\n]{10,300})",
    re.I,
)


def _extract_eligibility(body_text: str) -> Optional[str]:
    """
    Extract eligibility string from body text.

    Returns the first eligibility/who-can-apply sentence or None.
    """
    m = _ELIG_RE.search(body_text)
    if m:
        text = m.group(1).strip()
        # Trim at sentence end or 200 chars
        for sep in [".", "\n"]:
            idx = text.find(sep)
            if idx > 0:
                text = text[:idx].strip()
                break
        return text[:200] if text else None
    return None


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return its HTML, or None on failure."""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("ArtRabbit: failed to fetch %s: %s", url, exc)
        return None


def _resolve_url(href: str) -> str:
    """Ensure href is an absolute URL."""
    if href.startswith("http"):
        return href
    if href.startswith("/"):
        return BASE_URL + href
    return BASE_URL + "/" + href


# ---------------------------------------------------------------------------
# Page parser
# ---------------------------------------------------------------------------


def _parse_item(item) -> Optional[dict]:
    """
    Parse a single <div class="artopp"> element into a raw listing dict.

    Returns None if required fields (title or apply URL) are missing.

    Keys returned:
      title, source_url, application_url, call_type, deadline,
      description, eligibility, organiser, location, fee_raw,
      data_a (added date raw string), data_d (deadline raw string)
    """
    # --- Deadline from data attribute (most reliable signal) ---
    data_d = item.get("data-d", "")
    data_a = item.get("data-a", "")
    deadline = _parse_deadline_attr(data_d)

    # --- Type ---
    h3 = item.find("h3", class_="b_categorical-heading")
    raw_type = h3.get_text(strip=True) if h3 else ""
    call_type = _classify_type(raw_type)
    if call_type is None:
        logger.debug("ArtRabbit: skipping item — no type match for %r", raw_type)
        return None

    # --- Title + source URL ---
    h2 = item.find("h2")
    if not h2:
        return None
    a_tag = h2.find("a", href=True)
    if not a_tag:
        return None
    title = a_tag.get_text(strip=True)
    if not title:
        return None
    source_url = _resolve_url(a_tag["href"])

    # --- Body copy ---
    body_el = item.find(class_="m_body-copy")
    body_text = ""
    description = ""
    if body_el:
        body_text = body_el.get_text(separator="\n", strip=True)

        # Description: collect all <p> paragraphs, stop before the "Deadline" line
        paras = []
        for p in body_el.find_all("p"):
            text = p.get_text(separator=" ", strip=True)
            if not text:
                continue
            # Stop collecting description at the deadline paragraph
            if re.match(r"deadline\b", text, re.I):
                break
            paras.append(text)
        description = "\n".join(paras).strip()
        if len(description) > 2000:
            description = description[:1997] + "..."

    # --- Organiser ---
    organiser = ""
    org_el = body_el.find(class_="l_black") if body_el else None
    if org_el:
        raw_org = org_el.get_text(strip=True)
        # Strip "Organiser: " prefix
        organiser = re.sub(r"(?i)^organis(?:er|er)\s*:\s*", "", raw_org).strip()

    # --- Location (first div.l_nomarginp — span is always empty) ---
    location = ""
    if body_el:
        for el in body_el.find_all("div", class_="l_nomarginp"):
            raw_loc = el.get_text(strip=True)
            if raw_loc:
                location = re.sub(r"(?i)^locations?\s*:\s*", "", raw_loc).strip()
                break

    # --- Application URL ---
    application_url = source_url  # fallback to ArtRabbit listing page
    if body_el:
        apply_btn = body_el.find("a", class_=lambda c: c and "b_submit" in c)
        if apply_btn:
            href = apply_btn.get("href", "")
            if href and href.startswith("http"):
                application_url = href

    # --- Eligibility ---
    eligibility = _extract_eligibility(body_text) if body_text else None

    # --- Fee (raw string only) ---
    fee_raw = _extract_fee_raw(body_text) if body_text else None

    return {
        "title": title,
        "source_url": source_url,
        "application_url": application_url,
        "call_type": call_type,
        "raw_type": raw_type,
        "deadline": deadline,
        "description": description or None,
        "eligibility": eligibility,
        "organiser": organiser,
        "location": location,
        "fee_raw": fee_raw,
        "data_a": data_a,
        "data_d": data_d,
    }


def _parse_index(html: str) -> list[dict]:
    """
    Parse the ArtRabbit opportunities index page.

    Returns a list of raw listing dicts (see _parse_item for keys).
    """
    soup = BeautifulSoup(html, "html.parser")
    listings: list[dict] = []

    for item in soup.find_all("div", class_="artopp"):
        parsed = _parse_item(item)
        if parsed is not None:
            listings.append(parsed)

    logger.debug("ArtRabbit: parsed %d listings from index", len(listings))
    return listings


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the ArtRabbit Artist Opportunities index page.

    Strategy:
      1. Fetch the single-page index (no pagination required — ~70 items).
      2. Parse all <div class="artopp"> elements.
      3. Skip past-deadline calls.
      4. Insert or update each call via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0
    today = date.today()

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    html = _fetch(INDEX_URL, session)
    if not html:
        logger.error("ArtRabbit: failed to fetch index page")
        return 0, 0, 0

    listings = _parse_index(html)
    if not listings:
        logger.warning(
            "ArtRabbit: no listings parsed — check if page structure changed"
        )
        return 0, 0, 0

    logger.info("ArtRabbit: %d listings parsed from index", len(listings))

    skipped_deadline = 0
    skipped_no_url = 0

    for listing in listings:
        title = listing["title"]
        application_url = listing.get("application_url", "")

        if not application_url:
            skipped_no_url += 1
            logger.debug("ArtRabbit: skipping %r — no application URL", title[:60])
            continue

        # Skip past-deadline calls
        deadline = listing.get("deadline")
        if deadline:
            try:
                if date.fromisoformat(deadline) < today:
                    skipped_deadline += 1
                    logger.debug(
                        "ArtRabbit: skipping %r — deadline %s passed",
                        title[:60],
                        deadline,
                    )
                    continue
            except ValueError:
                pass  # malformed date — proceed anyway

        found += 1

        organiser = listing.get("organiser") or "artrabbit"
        description = listing.get("description")
        eligibility = listing.get("eligibility") or "International"
        fee_raw = listing.get("fee_raw")
        location = listing.get("location", "")
        call_type = listing["call_type"]

        # Enrich description with organiser prefix when not already present
        if organiser and organiser.lower() != "artrabbit" and description:
            if organiser.lower() not in description.lower()[:100]:
                description = f"{organiser}: {description}"

        call_data: dict = {
            "title": title,
            "description": description,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": listing["source_url"],
            "call_type": call_type,
            "eligibility": eligibility,
            "fee": None,  # ArtRabbit has no structured numeric fee field
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": organiser,
            "metadata": {
                "organization": organiser,
                "location": location,
                "raw_type": listing.get("raw_type", ""),
                "fee_raw": fee_raw,
                "data_a": listing.get("data_a"),
                "data_d": listing.get("data_d"),
                "scope": "international",
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "ArtRabbit: inserted/updated %r (deadline=%s, type=%s)",
                title[:60],
                deadline,
                call_type,
            )

    if skipped_deadline:
        logger.info("ArtRabbit: skipped %d past-deadline listings", skipped_deadline)
    if skipped_no_url:
        logger.info("ArtRabbit: skipped %d listings with no URL", skipped_no_url)

    logger.info(
        "ArtRabbit: %d found (non-expired), %d new, %d updated", found, new, updated
    )
    return found, new, updated
