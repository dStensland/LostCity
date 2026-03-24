"""
Crawler for ArtConnect (artconnect.com/opportunities) open calls board.

ArtConnect is a large international aggregator of artist opportunities:
open calls, residencies, commissions, grants, fellowships, and awards.
It is NOT a primary source — it aggregates calls posted by arts organizations
globally — so confidence_tier is "aggregated".

For LostCity Arts portal purposes, ArtConnect populates the
"National & International" section of the Open Calls board. All calls carry
metadata.scope = "international" to allow the API to split local vs national
views in the two-section board layout.

Crawl strategy:
  ArtConnect is a Next.js app. Every paginated listing page embeds full
  opportunity data in a <script id="__NEXT_DATA__"> tag as JSON — no
  Playwright or API key required. We extract the JSON directly from the
  static HTML response.

  Path to opportunities array:
    data["props"]["pageProps"]["opportunities"]["data"]   — list of dicts
    data["props"]["pageProps"]["opportunities"]["pages"]  — total page count
    data["props"]["pageProps"]["opportunities"]["entries"] — per-page count (10)

  Pagination: /opportunities?page=N, N=1..pages.
  We stop early if a page returns 0 opportunities.

Key fields per opportunity object:
  id              — unique ArtConnect ID (used to build source_url)
  title           — opportunity name
  type            — OPEN_CALL | ART_RESIDENCY | COMMISSION | GRANT | FELLOWSHIP
                    | AWARD | JOB | PRIZE (others possible)
  deadline        — ISO 8601 UTC string e.g. "2026-03-27T22:45:00Z"
  fee             — "FREE" | "FEES"
  applicationFees — list of {price, currency, description} dicts
  apply.onlineForm — application URL (may be absent on some listings)
  description     — list of {content: "<markdown>"} dicts
  rewards.rewardTypes — list of strings e.g. ["EXHIBITION", "FUNDING"]
  profile.organizationName — posting organization name
  profile.city / profile.country — organization location

Source URL pattern: https://www.artconnect.com/opportunity/{id}
  (slug field is always null in the JSON; id is used directly in URLs
   as confirmed from the page HTML: href="/opportunity/{id}")

Type mapping:
  OPEN_CALL    → submission
  ART_RESIDENCY → residency
  COMMISSION   → commission
  GRANT        → grant
  FELLOWSHIP   → grant
  AWARD        → grant
  PRIZE        → grant
  JOB          → skip (employment listings, not artist opportunities)

Rate limiting:
  ArtConnect is a commercial platform. We add a short delay between pages
  and respect server responses. No authentication required.
"""

import logging
import re
import time
from datetime import date
from typing import Optional

import requests

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://www.artconnect.com/opportunities"
OPPORTUNITY_URL_TEMPLATE = "https://www.artconnect.com/opportunity/{}"

# Conservative page cap: the site reports ~31 pages. We set a safe ceiling
# so a site misconfiguration can't send us into an infinite loop.
MAX_PAGES = 50

# Polite delay between page requests (seconds)
PAGE_DELAY = 1.0

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# ArtConnect type → our call_type. None means skip this listing.
# The live site uses both the documented enum values AND compound variants
# (e.g. AWARD_OR_PRICE, GRANT_OR_STIPEND) — we map all observed variants.
_TYPE_MAP: dict[str, Optional[str]] = {
    "OPEN_CALL": "submission",
    "ART_RESIDENCY": "residency",
    "COMMISSION": "commission",
    "GRANT": "grant",
    "GRANT_OR_STIPEND": "grant",
    "FELLOWSHIP": "grant",
    "AWARD": "grant",
    "AWARD_OR_PRICE": "grant",    # ArtConnect compound variant (observed live)
    "PRIZE": "grant",
    "CALL_FOR_CURATORS": "submission",  # curator calls are open submissions
    "COLLABORATION": "submission",      # collaborative calls treated as submission
    "JOB": None,  # employment listings — not artist opportunities
    "INTERNSHIP": None,  # employment listings
}


# ---------------------------------------------------------------------------
# HTTP fetch
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.artconnect.com/",
    })
    return session


def _fetch_page(session: requests.Session, page_num: int) -> Optional[str]:
    """Fetch one paginated listing page and return raw HTML, or None on failure."""
    url = f"{BASE_URL}?page={page_num}"
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("ArtConnect: failed to fetch page %d: %s", page_num, exc)
        return None


# ---------------------------------------------------------------------------
# __NEXT_DATA__ extraction
# ---------------------------------------------------------------------------

_NEXT_DATA_RE = re.compile(
    r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
    re.DOTALL,
)


def _extract_next_data(html: str) -> Optional[dict]:
    """
    Parse the __NEXT_DATA__ JSON from a Next.js page.
    Returns the parsed dict or None if not found / invalid JSON.
    """
    import json

    match = _NEXT_DATA_RE.search(html)
    if not match:
        logger.debug("ArtConnect: no __NEXT_DATA__ script tag found")
        return None
    try:
        return json.loads(match.group(1))
    except ValueError as exc:
        logger.warning("ArtConnect: failed to parse __NEXT_DATA__ JSON: %s", exc)
        return None


def _parse_opportunities_page(html: str) -> tuple[list[dict], int]:
    """
    Extract opportunities list and total page count from a listing page's
    __NEXT_DATA__ JSON.

    Returns:
      (opportunities_list, total_pages)
      opportunities_list may be empty; total_pages is 0 if parsing fails.
    """
    data = _extract_next_data(html)
    if not data:
        return [], 0

    try:
        opps_block = data["props"]["pageProps"]["opportunities"]
        opp_list: list[dict] = opps_block.get("data", [])
        total_pages: int = int(opps_block.get("pages", 0))
        return opp_list, total_pages
    except (KeyError, TypeError, ValueError) as exc:
        logger.warning(
            "ArtConnect: unexpected __NEXT_DATA__ structure: %s", exc
        )
        return [], 0


# ---------------------------------------------------------------------------
# Field extraction helpers
# ---------------------------------------------------------------------------


def _classify_type(ac_type: str) -> Optional[str]:
    """
    Map an ArtConnect opportunity type to our call_type.
    Returns None for types we skip (jobs, unknown types treated as submission).
    """
    result = _TYPE_MAP.get(ac_type)
    if ac_type not in _TYPE_MAP:
        # Unknown type — default to submission rather than silently dropping
        logger.debug(
            "ArtConnect: unknown type %r — treating as submission", ac_type
        )
        return "submission"
    return result  # None for JOB means skip


def _parse_deadline(iso_string: Optional[str]) -> Optional[str]:
    """
    Convert an ISO 8601 UTC deadline string to 'YYYY-MM-DD'.

    ArtConnect deadlines look like: "2026-03-27T22:45:00Z"
    We take the date part directly, which is safe because these deadlines
    are stored in UTC — the date is accurate enough for our purposes.

    Returns None if the string is absent or malformed.
    """
    if not iso_string:
        return None
    # Fast path: extract date portion directly from ISO string
    m = re.match(r"(\d{4}-\d{2}-\d{2})", iso_string)
    if m:
        return m.group(1)
    return None


def _extract_description(description_field) -> Optional[str]:
    """
    ArtConnect description is a list of {content: "<markdown>"} dicts.
    We concatenate all content blocks and truncate to 3000 chars.
    """
    if not description_field:
        return None
    if isinstance(description_field, str):
        return description_field[:3000] or None

    parts: list[str] = []
    if isinstance(description_field, list):
        for block in description_field:
            if isinstance(block, dict):
                content = block.get("content", "")
                if content:
                    parts.append(content.strip())

    combined = "\n\n".join(parts).strip()
    return combined[:3000] if combined else None


def _extract_fee(opp: dict) -> Optional[float]:
    """
    Extract the application fee amount in USD.

    ArtConnect provides:
      fee: "FREE" | "FEES"
      applicationFees: [{price: 25, currency: "USD", description: ""}]

    We return 0.0 only when fee == "FREE" (unambiguous).
    For "FEES" we look at applicationFees for a USD amount.
    Returns None when fee exists but amount is unknown or non-USD.
    """
    fee_flag = opp.get("fee", "")
    if fee_flag == "FREE":
        return 0.0

    app_fees = opp.get("applicationFees") or []
    for fee_entry in app_fees:
        if isinstance(fee_entry, dict):
            price = fee_entry.get("price")
            currency = fee_entry.get("currency", "")
            if price is not None and str(currency).upper() == "USD":
                try:
                    return float(price)
                except (TypeError, ValueError):
                    pass

    # fee_flag == "FEES" but no parseable USD amount
    return None


def _extract_application_url(opp: dict) -> Optional[str]:
    """
    Return the best available application URL for an opportunity.

    Priority:
      1. apply.onlineForm — direct application link (most common)
      2. contact.url — organization website (fallback)
      3. ArtConnect detail page — always valid as last resort
    """
    apply = opp.get("apply") or {}
    form_url = apply.get("onlineForm")
    if form_url and form_url.startswith("http"):
        return form_url

    contact = opp.get("contact") or {}
    contact_url = contact.get("url")
    if contact_url and contact_url.startswith("http"):
        return contact_url

    # Last resort: the ArtConnect detail page itself
    opp_id = opp.get("id", "")
    if opp_id:
        return OPPORTUNITY_URL_TEMPLATE.format(opp_id)

    return None


def _extract_reward_types(opp: dict) -> list[str]:
    """Extract rewardTypes list from rewards block, defaulting to []."""
    rewards = opp.get("rewards") or {}
    reward_types = rewards.get("rewardTypes") or []
    return [r for r in reward_types if isinstance(r, str)]


def _is_past_deadline(deadline_iso: Optional[str]) -> bool:
    """Return True if the deadline date has already passed."""
    if not deadline_iso:
        return False
    try:
        dl = date.fromisoformat(deadline_iso)
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Single opportunity builder
# ---------------------------------------------------------------------------


def _build_call_data(opp: dict, source_id: int) -> Optional[dict]:
    """
    Convert one ArtConnect opportunity object into a call_data dict ready
    for insert_open_call(), or return None if the call should be skipped.
    """
    opp_id = opp.get("id", "")
    title = (opp.get("title") or "").strip()
    if not title:
        logger.debug("ArtConnect: skipping opportunity with empty title (id=%s)", opp_id)
        return None

    # Type classification
    ac_type = opp.get("type", "")
    call_type = _classify_type(ac_type)
    if call_type is None:
        logger.debug(
            "ArtConnect: skipping %r (type=%s — not an artist opportunity)",
            title[:60], ac_type,
        )
        return None

    # Deadline
    deadline = _parse_deadline(opp.get("deadline"))
    if _is_past_deadline(deadline):
        logger.debug(
            "ArtConnect: skipping %r — deadline %s already passed",
            title[:60], deadline,
        )
        return None

    # Profile / organization
    profile = opp.get("profile") or {}
    org_name = (profile.get("organizationName") or "").strip() or "ArtConnect"
    org_city = profile.get("city") or ""
    org_country = profile.get("country") or ""

    # Core fields
    application_url = _extract_application_url(opp)
    if not application_url:
        logger.debug(
            "ArtConnect: skipping %r — no application URL available", title[:60]
        )
        return None

    source_url = OPPORTUNITY_URL_TEMPLATE.format(opp_id) if opp_id else BASE_URL
    description = _extract_description(opp.get("description"))
    fee = _extract_fee(opp)
    reward_types = _extract_reward_types(opp)

    return {
        "title": title,
        "description": description,
        "deadline": deadline,
        "application_url": application_url,
        "source_url": source_url,
        "call_type": call_type,
        "eligibility": "International",
        "fee": fee,
        "source_id": source_id,
        "confidence_tier": "aggregated",
        "_org_name": org_name,
        "metadata": {
            "source": "artconnect",
            "artconnect_id": opp_id,
            "artconnect_type": ac_type,
            "organization": org_name,
            "org_city": org_city,
            "org_country": org_country,
            "reward_types": reward_types,
            "scope": "international",
        },
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl ArtConnect open calls board.

    Strategy:
      1. Fetch page 1 to determine total page count from __NEXT_DATA__.
      2. Iterate pages 1..N, extracting opportunities from each.
      3. Skip JOB type listings (employment, not artist opportunities).
      4. Skip past-deadline calls.
      5. Insert or update each call via insert_open_call().

    Returns (found, new, updated).

    found  = opportunities that passed type + deadline filters (eligible to insert)
    new    = successfully inserted (insert_open_call returned an id for a new row)
    updated = updated (currently 0 — update is handled inside insert_open_call
              transparently via hash dedup, so we can't distinguish here without
              tracking pre-existing hashes separately)
    """
    source_id = source["id"]
    found = new = updated = 0
    seen_ids: set[str] = set()

    session = _make_session()

    # --- Page 1: discover total page count ---
    html = _fetch_page(session, 1)
    if not html:
        logger.error("ArtConnect: failed to fetch page 1 — aborting")
        return 0, 0, 0

    first_page_opps, total_pages = _parse_opportunities_page(html)
    if total_pages == 0:
        logger.warning(
            "ArtConnect: could not determine total pages from page 1 __NEXT_DATA__"
        )
        total_pages = MAX_PAGES  # proceed with cap

    total_pages = min(total_pages, MAX_PAGES)
    logger.info(
        "ArtConnect: %d total pages to crawl", total_pages
    )

    # --- Iterate all pages ---
    for page_num in range(1, total_pages + 1):
        if page_num == 1:
            page_opps = first_page_opps
        else:
            time.sleep(PAGE_DELAY)
            html = _fetch_page(session, page_num)
            if not html:
                logger.warning(
                    "ArtConnect: failed to fetch page %d — skipping", page_num
                )
                continue
            page_opps, _ = _parse_opportunities_page(html)

        if not page_opps:
            logger.info(
                "ArtConnect: page %d returned 0 opportunities — stopping early",
                page_num,
            )
            break

        logger.debug(
            "ArtConnect: page %d/%d — %d opportunities",
            page_num, total_pages, len(page_opps),
        )

        for opp in page_opps:
            opp_id = opp.get("id", "")

            # Deduplicate within a single crawl run (ArtConnect may feature
            # the same call on multiple pages or listing configurations)
            if opp_id and opp_id in seen_ids:
                continue
            if opp_id:
                seen_ids.add(opp_id)

            call_data = _build_call_data(opp, source_id)
            if call_data is None:
                continue

            found += 1
            result = insert_open_call(call_data)
            if result:
                new += 1

    logger.info(
        "ArtConnect: crawl complete — %d found (eligible), %d new, %d updated",
        found, new, updated,
    )
    return found, new, updated
