"""
Crawler for Artquest Opportunities (artquest.org.uk/opportunities/).

Artquest is run by University of the Arts London and curates open calls,
residencies, grants, fellowships, and commissions for UK and international
artists.  It is NOT the primary source for any listing — it aggregates calls
posted by arts organisations — so confidence_tier is "aggregated".

All calls carry metadata.scope = "international" because Artquest is UK-based
with global reach and many listings are explicitly open to international
applicants.

Crawl strategy — single page, no Playwright needed (static HTML on the index):

  The index https://www.artquest.org.uk/opportunities/ renders all current
  opportunities as <div class="landing-page-item pt-opportunity"> elements
  (~15-30 items at any one time, typically 100-150 over a rolling year).
  No pagination is required — every active listing appears on the one page.

  The ?filterby=<term_id> filter variants are blocked by CleanTalk anti-bot
  for non-session requests, so we rely solely on the unfiltered index, which
  consistently returns all active listings.

  Each <div class="landing-page-item pt-opportunity"> contains:

    <div class="lp-copy">
      <h5 class="[noimage]"><a href="https://artquest.org.uk/opportunity/SLUG/">
        Title
      </a></h5>
      <p class="deadline"><strong>Deadline: </strong>DD/MM/YYYY</p>
          — or —
      <p class="deadline"><strong>Open deadline</strong></p>
      <p>Short description snippet (truncated at ~200 chars with "…")</p>
      <p class="website"><a href="EXTERNAL_APPLY_URL" target="_blank">…</a></p>
    </div>
    <div class="lp-extra">
      <a class="btn" href="ARTQUEST_DETAIL_URL">Find out more</a>
    </div>

  There are NO category labels per item in the HTML (the filter tags are a
  server-side query parameter, not stored on each card). call_type is
  therefore inferred by keyword matching against the title and description
  snippet, falling back to "submission".

Deadline format: DD/MM/YYYY (UK).  "Open deadline" → None (no expiry date).

Type inference keywords (first match wins, ordered from most-specific):

  residency    — resident, residency, studio space
  fellowship   — fellowship, fellow, schloss, bourse, scholar
  grant        — grant, award, prize, fund, bursary, funding
  commission   — commission
  exhibition_proposal — exhibition, screening, curator, curatorial, show
  submission   — (fallback)

Fee extraction: Artquest does not use a structured fee field. We look for a
fee mention in the description snippet; raw string stored in metadata.fee_raw.
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

INDEX_URL = "https://www.artquest.org.uk/opportunities/"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

REQUEST_TIMEOUT = 30

# ---------------------------------------------------------------------------
# Type inference
# ---------------------------------------------------------------------------

# Ordered: most specific first.  First matching rule wins.
#
# Rule ordering rationale:
#   - residency / fellowship are highly specific terms → check first
#   - grant/award/prize → before exhibition_proposal so "curatorial grants"
#     maps to grant, not exhibition_proposal
#   - commission → unambiguous single word
#   - exhibition_proposal → broadest arts catch-all before fallback
_TYPE_RULES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bresiden(cy|t|ce|cies)\b|\bstudio\s+space\b", re.I), "residency"),
    (re.compile(r"\bfellow(ship)?\b|\bbourse\b", re.I), "fellowship"),
    (re.compile(r"\bgrants?\b|\bawards?\b|\bprize\b|\bfund\b|\bbursary\b|\bfunding\b", re.I), "grant"),
    (re.compile(r"\bcommission\b", re.I), "commission"),
    (
        re.compile(
            r"\bexhibition\b|\bscreening\b|\bcurat(or|orial|ing)\b",
            re.I,
        ),
        "exhibition_proposal",
    ),
]

_VALID_TYPES = {
    "submission", "residency", "grant", "fellowship", "commission", "exhibition_proposal",
}


def _infer_call_type(title: str, description: str) -> str:
    """
    Infer call_type from title and description snippet.

    Checks title first (more reliable signal), then description.
    Falls back to "submission" if no keyword matches.
    """
    combined = f"{title} {description}"
    for pattern, call_type in _TYPE_RULES:
        if pattern.search(combined):
            return call_type
    return "submission"


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline(raw: str) -> Optional[str]:
    """
    Parse a deadline string into ISO format (YYYY-MM-DD).

    Handles:
      "Deadline:30/03/2026"      → "2026-03-30"
      "Deadline: 30/03/2026"     → "2026-03-30"
      "Open deadline"            → None
      Any other form             → None (logged at DEBUG)
    """
    if not raw:
        return None

    # Strip "Deadline:" prefix (with or without space) and normalise whitespace
    cleaned = re.sub(r"(?i)deadline\s*:\s*", "", raw).strip()

    if not cleaned or re.search(r"\bopen\b", cleaned, re.I):
        return None

    # Try DD/MM/YYYY (UK standard on Artquest)
    try:
        dt = datetime.strptime(cleaned, "%d/%m/%Y")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    # Try unambiguous ISO just in case they ever switch
    try:
        dt = datetime.strptime(cleaned, "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        pass

    logger.debug("Artquest: unrecognised deadline format: %r", raw)
    return None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if deadline has already passed today."""
    if not deadline_str:
        return False
    try:
        return date.fromisoformat(deadline_str) < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Fee extraction
# ---------------------------------------------------------------------------

_FEE_RE = re.compile(
    r"(?:entry|application|participation|submission|entry\s+fee)\s*fee\s*:\s*([^\n<]{1,120})",
    re.I,
)


def _extract_fee_raw(text: str) -> Optional[str]:
    """
    Extract a raw fee mention from the description snippet.

    Returns the fee string or None.  fee column remains None — the snippet is
    too short and multi-currency to reliably parse a numeric value.
    """
    m = _FEE_RE.search(text)
    if m:
        raw = m.group(1).strip().rstrip(".")
        if re.search(r"\bfree\b", raw, re.I):
            return "free"
        return raw[:120]
    return None


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-GB,en;q=0.9",
            "Referer": "https://www.artquest.org.uk/",
        }
    )
    return session


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch URL, return HTML or None on failure."""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        # Artquest uses CleanTalk anti-bot on sub-pages; it returns a 200 with
        # a spinner page.  Detect this so callers can handle it gracefully.
        if "Anti-Crawler Protection" in resp.text:
            logger.warning("Artquest: anti-bot challenge detected on %s", url)
            return None
        return resp.text
    except requests.RequestException as exc:
        logger.warning("Artquest: failed to fetch %s — %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Page parser
# ---------------------------------------------------------------------------


def _parse_item(div) -> Optional[dict]:
    """
    Parse a single <div class="landing-page-item pt-opportunity"> into a dict.

    Returns None if required fields (title or application_url) are missing.

    Keys returned:
      title, source_url, application_url, deadline, description, fee_raw
    """
    lp_copy = div.find(class_="lp-copy")
    if not lp_copy:
        return None

    # --- Title + Artquest detail URL ---
    h5 = lp_copy.find("h5")
    if not h5:
        return None
    a_title = h5.find("a", href=True)
    if not a_title:
        return None
    title = a_title.get_text(strip=True)
    if not title:
        return None
    source_url = a_title["href"]
    if not source_url.startswith("http"):
        source_url = "https://artquest.org.uk" + source_url

    # --- Deadline ---
    deadline_el = lp_copy.find(class_="deadline")
    deadline_raw = deadline_el.get_text(strip=True) if deadline_el else ""
    deadline = _parse_deadline(deadline_raw)

    # --- Description snippet ---
    # Collect <p> tags that are not deadline or website paragraphs
    description_parts = []
    for p in lp_copy.find_all("p"):
        cls = p.get("class") or []
        if "deadline" in cls or "website" in cls:
            continue
        text = p.get_text(separator=" ", strip=True)
        if text:
            description_parts.append(text)
    description = " ".join(description_parts).strip()
    if len(description) > 2000:
        description = description[:1997] + "..."

    # --- Application URL (external link in .website paragraph) ---
    application_url = source_url  # fallback to Artquest detail page
    website_el = lp_copy.find(class_="website")
    if website_el:
        ext_a = website_el.find("a", href=True)
        if ext_a and ext_a["href"].startswith("http"):
            application_url = ext_a["href"]

    # --- Fee (raw from snippet only) ---
    fee_raw = _extract_fee_raw(description) if description else None

    return {
        "title": title,
        "source_url": source_url,
        "application_url": application_url,
        "deadline": deadline,
        "deadline_raw": deadline_raw,
        "description": description or None,
        "fee_raw": fee_raw,
    }


def _parse_index(html: str) -> list[dict]:
    """
    Parse the Artquest opportunities index page.

    Returns a list of raw listing dicts (see _parse_item for keys).
    """
    soup = BeautifulSoup(html, "html.parser")
    listings: list[dict] = []

    for div in soup.find_all("div", class_="pt-opportunity"):
        parsed = _parse_item(div)
        if parsed is not None:
            listings.append(parsed)

    logger.debug("Artquest: parsed %d listings from index", len(listings))
    return listings


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Artquest opportunities index page.

    Strategy:
      1. Fetch the single-page index (no pagination — all active listings
         appear on one page; typically 15-30 at any one time).
      2. Parse all <div class="landing-page-item pt-opportunity"> elements.
      3. Skip past-deadline calls.
      4. Infer call_type from title + description snippet.
      5. Insert or update each call via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0
    skipped_deadline = 0
    skipped_no_url = 0

    session = _build_session()

    html = _fetch(INDEX_URL, session)
    if not html:
        logger.error("Artquest: failed to fetch index page — aborting")
        return 0, 0, 0

    listings = _parse_index(html)
    if not listings:
        logger.warning(
            "Artquest: no listings parsed — check if page structure changed"
        )
        return 0, 0, 0

    logger.info("Artquest: %d listings parsed from index", len(listings))

    for listing in listings:
        title = listing["title"]
        application_url = listing.get("application_url", "")

        if not application_url:
            skipped_no_url += 1
            logger.debug("Artquest: skipping %r — no application URL", title[:60])
            continue

        deadline = listing.get("deadline")
        if _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "Artquest: skipping %r — deadline %s has passed", title[:60], deadline
            )
            continue

        found += 1

        description = listing.get("description")
        fee_raw = listing.get("fee_raw")
        call_type = _infer_call_type(title, description or "")

        call_data: dict = {
            "title": title,
            "description": description,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": listing["source_url"],
            "call_type": call_type,
            # Artquest does not expose eligibility in the index snippet
            "eligibility": "International",
            "fee": None,  # no structured numeric fee in the snippet
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": "artquest",
            "metadata": {
                "scope": "international",
                "raw_deadline": listing.get("deadline_raw", ""),
                "fee_raw": fee_raw,
                "source_platform": "artquest",
            },
        }

        result = insert_open_call(call_data)
        if result:
            new += 1
            logger.debug(
                "Artquest: inserted/updated %r (deadline=%s, type=%s)",
                title[:60],
                deadline,
                call_type,
            )

    if skipped_deadline:
        logger.info("Artquest: skipped %d past-deadline listings", skipped_deadline)
    if skipped_no_url:
        logger.info("Artquest: skipped %d listings with no URL", skipped_no_url)

    logger.info(
        "Artquest: %d found (non-expired), %d new, %d updated", found, new, updated
    )
    return found, new, updated
