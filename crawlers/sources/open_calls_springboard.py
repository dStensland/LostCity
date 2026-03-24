"""
Crawler for Springboard for the Arts open calls.

Springboard for the Arts (springboardforthearts.org) is a Midwest-based
nonprofit arts service organization — primarily Minnesota, with coverage
extending across the upper Midwest and nationally. They curate a board of
~30-70 active opportunities posted by local arts organizations, venues,
and funders. Because the posts originate with third-party organizations,
confidence_tier is "aggregated".

Data source: WordPress REST API at
  /wp-json/wp/v2/opportunities?per_page=100&acf_format=standard

No auth required (public endpoint). Returns structured JSON with all ACF
custom fields populated. As of March 2026, 68 items fit in a single page
(X-WP-TotalPages: 1), but we handle multi-page responses defensively.

Key ACF fields:
  acf.deadline          — "Mon DD, YYYY" human-readable date (always present)
  acf.website           — external application URL (used when send_to="Website")
  acf.location          — short region string e.g. "MN - Twin Cities Metro"
  acf.location_long     — organization name (despite the field name)
  acf.compensation      — award amount or description; NOT a submission fee
  acf.criteria          — list of requirement strings; may contain "No entry fee required"
  acf.opportunity_type  — list of taxonomy term dicts (can be False when unset)

Opportunity type mapping (oppcats taxonomy → our call_type):

  slug                     → call_type
  ─────────────────────────────────────
  open-calls               → submission
  residency                → residency
  studio-work-space        → residency   (studio access = a form of residency)
  grant-fellowship-award   → grant
  paid-opportunity         → submission  (paid commissions, gigs)
  vendor-tabling-opportunity → submission (art fair artist applications)
  board-member             → SKIP        (governance roles, not artist calls)
  volunteer-opportunity    → SKIP        (unless also tagged open-calls)

When opportunity_type is False (unset), the item is treated as "submission"
if the title or content suggests it is a call for artists, which is the
predominant category on the board.

Scope: "national" — most listings are Midwest-regional but Springboard
explicitly marks some as national and the REST API is geographically scoped
to their network, not Atlanta. We store scope in metadata.

Deadline parsing:
  The API deadline is a human-readable string like "Mar 25, 2026". We parse
  it with strptime and fall back to None on failure. Past-deadline items are
  skipped.

Fee detection:
  "No entry fee required" in acf.criteria → fee = 0.0
  No mention of fee → fee = None (unknown)
  Springboard does not expose numeric entry fees in the API.

HTML in content.rendered is cleaned to plain text for the description field.
"""

import logging
import re
from datetime import date, datetime
from html import unescape
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://springboardforthearts.org"
API_URL = f"{BASE_URL}/wp-json/wp/v2/opportunities"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

REQUEST_TIMEOUT = 30
MAX_PAGES = 10          # safety cap — currently 1 page but may grow
PER_PAGE = 100          # max allowed by this WP install

MAX_DESCRIPTION_CHARS = 2000

# ---------------------------------------------------------------------------
# Opportunity type mapping
# ---------------------------------------------------------------------------

# oppcats slug → our call_type.  None = skip.
_SLUG_TO_CALL_TYPE: dict[str, Optional[str]] = {
    "open-calls": "submission",
    "residency": "residency",
    "studio-work-space": "residency",
    "grant-fellowship-award": "grant",
    "paid-opportunity": "submission",
    "vendor-tabling-opportunity": "submission",
    # governance / volunteer roles are not artist opportunities
    "board-member": None,
    "volunteer-opportunity": None,
}

# Fallback when opportunity_type is unset or unrecognised
_DEFAULT_CALL_TYPE = "submission"


def _classify_type(opportunity_type) -> Optional[str]:
    """
    Map the ACF opportunity_type value to our call_type.

    opportunity_type is either False (field unset) or a list of taxonomy term
    dicts each with a 'slug' key.

    Priority rules:
    1. If any slug maps to None → skip the item entirely.
    2. Otherwise pick the most specific type from the preference order:
       residency > grant > submission.
    3. If the list is empty or False → default to "submission".
    """
    if not opportunity_type:
        return _DEFAULT_CALL_TYPE

    slugs = [term.get("slug", "") for term in opportunity_type if isinstance(term, dict)]

    # Explicit skip slugs — board-member or standalone volunteer
    skip_slugs = {s for s, ct in _SLUG_TO_CALL_TYPE.items() if ct is None}
    # Only skip if ALL non-skip slugs are absent and at least one skip slug is present.
    # Exception: "open-calls" + "volunteer-opportunity" is a legitimate artist call.
    non_skip_slugs = [s for s in slugs if s not in skip_slugs]
    skip_only_slugs = [s for s in slugs if s in skip_slugs]

    if skip_only_slugs and not non_skip_slugs:
        logger.debug("Springboard: skipping — only governance/volunteer slugs: %s", slugs)
        return None

    # Pick most specific type in preference order
    for preferred in ("residency", "grant-fellowship-award"):
        if preferred in slugs:
            return _SLUG_TO_CALL_TYPE[preferred]

    # Look for any mapped type in remaining slugs
    for slug in slugs:
        ct = _SLUG_TO_CALL_TYPE.get(slug)
        if ct is not None:
            return ct

    return _DEFAULT_CALL_TYPE


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------

# The API returns dates like "Mar 25, 2026"
_DEADLINE_FMT = "%b %d, %Y"


def _parse_deadline(raw: str) -> Optional[str]:
    """
    Parse ACF deadline string into ISO date (YYYY-MM-DD).

    Returns None on failure.
    """
    if not raw:
        return None
    raw = raw.strip()
    try:
        dt = datetime.strptime(raw, _DEADLINE_FMT)
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        logger.debug("Springboard: could not parse deadline %r", raw)
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
# HTML → plain text
# ---------------------------------------------------------------------------


def _html_to_text(html: str) -> str:
    """
    Strip HTML tags and return clean plain text, collapsed whitespace.

    Uses html.unescape so entities like &#8220; and &amp; are resolved.
    """
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(separator=" ")
    # Collapse runs of whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return unescape(text)


def _clean_title(raw: str) -> str:
    """Resolve HTML entities in WP title.rendered."""
    return unescape(raw).strip()


# ---------------------------------------------------------------------------
# Fee extraction
# ---------------------------------------------------------------------------

_NO_FEE_RE = re.compile(r"no\s+entry\s+fee\s+required", re.I)
_HAS_FEE_RE = re.compile(r"entry\s+fee\s*[:$]|submission\s+fee", re.I)


def _extract_fee(criteria: list) -> Optional[float]:
    """
    Derive a fee float from the criteria list.

    Returns:
      0.0   — if "No entry fee required" is in criteria
      None  — if fee status is unknown (Springboard doesn't expose numeric fees)

    We never return a non-zero float here: the API has no structured fee field
    and compensation values describe award amounts, not submission fees.
    """
    if not criteria:
        return None
    criteria_text = " ".join(str(c) for c in criteria)
    if _NO_FEE_RE.search(criteria_text):
        return 0.0
    return None


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    return session


def _fetch_page(session: requests.Session, page: int) -> Optional[list]:
    """
    Fetch one page of opportunities from the WP REST API.

    Returns the parsed JSON list, or None on failure.
    """
    params = {
        "per_page": PER_PAGE,
        "page": page,
        "acf_format": "standard",
        "status": "publish",
    }
    try:
        resp = session.get(API_URL, params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, list):
            logger.warning("Springboard: unexpected API response type: %s", type(data))
            return None, 1
        total_pages = int(resp.headers.get("X-WP-TotalPages", 1))
        return data, total_pages
    except requests.RequestException as exc:
        logger.warning("Springboard: failed to fetch page %d: %s", page, exc)
        return None, 1
    except ValueError as exc:
        logger.warning("Springboard: JSON parse error on page %d: %s", page, exc)
        return None, 1


# ---------------------------------------------------------------------------
# Item parser
# ---------------------------------------------------------------------------


def _parse_item(item: dict) -> Optional[dict]:
    """
    Parse a single WP REST API opportunity item into a call_data dict.

    Returns None if the item should be skipped (board/volunteer-only,
    missing title, or missing application URL).
    """
    # Title
    raw_title = item.get("title", {}).get("rendered", "")
    title = _clean_title(raw_title)
    if not title:
        return None

    # Source URL (Springboard listing page)
    source_url = item.get("link", "")
    if not source_url:
        source_url = BASE_URL

    # Application URL (always "Website" send_to in current data)
    acf = item.get("acf") or {}
    application_url = acf.get("website", "").strip()
    if not application_url:
        # Fall back to the Springboard listing page itself
        application_url = source_url

    # Call type
    opportunity_type = acf.get("opportunity_type", False)
    call_type = _classify_type(opportunity_type)
    if call_type is None:
        return None

    # Deadline
    raw_deadline = acf.get("deadline", "")
    deadline = _parse_deadline(raw_deadline)

    # Description — from content.rendered, stripped to plain text
    content_html = item.get("content", {}).get("rendered", "")
    description = _html_to_text(content_html)
    if len(description) > MAX_DESCRIPTION_CHARS:
        description = description[: MAX_DESCRIPTION_CHARS - 3] + "..."
    description = description or None

    # Organization name (stored in location_long despite the field name)
    org_name = acf.get("location_long", "").strip() or "Springboard for the Arts"

    # Region / location
    location = acf.get("location", "").strip()

    # Fee from criteria
    criteria = acf.get("criteria") or []
    fee = _extract_fee(criteria)

    # Eligibility — join criteria into a readable string if present
    eligibility: Optional[str] = None
    if criteria:
        eligibility = "; ".join(str(c) for c in criteria if c)
        if len(eligibility) > 300:
            eligibility = eligibility[:297] + "..."

    # Compensation (award amount, not submission fee — stored in metadata)
    compensation = str(acf.get("compensation", "") or "").strip()

    # Disciplines (taxonomy IDs — stored in metadata for potential future use)
    disciplines = item.get("disciplines") or []

    # WP post ID and modified date for metadata
    wp_id = item.get("id")
    modified = item.get("modified", "")

    return {
        "title": title,
        "description": description,
        "deadline": deadline,
        "application_url": application_url,
        "source_url": source_url,
        "call_type": call_type,
        "eligibility": eligibility,
        "fee": fee,
        "_org_name": org_name,
        "metadata": {
            "organization": org_name,
            "location": location,
            "compensation": compensation,
            "raw_deadline": raw_deadline,
            "wp_id": wp_id,
            "wp_modified": modified,
            "disciplines": disciplines,
            "criteria": criteria,
            "scope": "national",
        },
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the Springboard for the Arts opportunities board.

    Strategy:
      1. Hit the WordPress REST API (/wp-json/wp/v2/opportunities) which
         returns all active listings as structured JSON with ACF fields.
      2. Handle multi-page responses defensively (currently 1 page of 68).
      3. Skip past-deadline calls and governance/volunteer-only types.
      4. Insert or update each call via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _build_session()

    all_items: list[dict] = []
    page = 1

    while page <= MAX_PAGES:
        result = _fetch_page(session, page)
        if result[0] is None:
            if page == 1:
                logger.error("Springboard: failed to fetch first page — aborting")
                return 0, 0, 0
            break

        items, total_pages = result
        all_items.extend(items)
        logger.debug(
            "Springboard: fetched page %d/%d — %d items", page, total_pages, len(items)
        )

        if page >= total_pages:
            break
        page += 1

    if not all_items:
        logger.warning("Springboard: no items returned — check if API structure changed")
        return 0, 0, 0

    logger.info("Springboard: %d total items from API", len(all_items))

    skipped_deadline = 0
    skipped_type = 0
    skipped_no_url = 0

    for item in all_items:
        parsed = _parse_item(item)

        if parsed is None:
            skipped_type += 1
            continue

        deadline = parsed.get("deadline")
        if _is_past_deadline(deadline):
            skipped_deadline += 1
            logger.debug(
                "Springboard: skipping %r — deadline %s passed",
                parsed["title"][:60],
                deadline,
            )
            continue

        application_url = parsed.get("application_url", "")
        if not application_url:
            skipped_no_url += 1
            logger.debug(
                "Springboard: skipping %r — no application URL", parsed["title"][:60]
            )
            continue

        found += 1

        call_data: dict = {
            **parsed,
            "source_id": source_id,
            "confidence_tier": "aggregated",
        }

        result_id = insert_open_call(call_data)
        if result_id:
            # insert_open_call returns the ID whether inserted or updated;
            # we can't distinguish new vs updated without an extra lookup.
            # Follow the ArtRabbit pattern and count all successful writes as new.
            new += 1
            logger.debug(
                "Springboard: upserted %r (deadline=%s, type=%s)",
                parsed["title"][:60],
                deadline,
                parsed["call_type"],
            )

    if skipped_deadline:
        logger.info("Springboard: skipped %d past-deadline items", skipped_deadline)
    if skipped_type:
        logger.info("Springboard: skipped %d board/volunteer-only items", skipped_type)
    if skipped_no_url:
        logger.info("Springboard: skipped %d items with no application URL", skipped_no_url)

    logger.info(
        "Springboard: %d found (non-expired), %d new/updated", found, new
    )
    return found, new, updated
