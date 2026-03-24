"""
Crawler for CODAworx Open Calls (codaworx.com/directories/opencalls).

CODAworx is the primary platform for public art commissions, connecting
commissioners with artists for public art projects. It carries ~30-70 active
listings at any time, often high-dollar ($10K-$1.5M+) opportunities spanning
murals, sculpture, light art, public works, and more.

Confidence tier: "aggregated" — CODAworx aggregates calls posted by
municipalities, developers, arts organizations, and private commissioners
worldwide. It is NOT the primary source for any listing.

Scope: "national" (primarily US public art; significant international coverage
from Canada, UK, and other countries — nearly all within CODAworx's public art
commission focus area).

All listings are classified as "commission" call_type (public art commissions
are CODAworx's raison d'être; the API CallType field is used to skip the rare
"Industry" resource calls that are not open calls for artists).

--- Crawl strategy: JSON API (no Playwright needed) ---

CODAworx is an Angular SPA. The listing index is NOT server-rendered — the
HTML shell is empty. However, the backend REST API at api.codaworx.com is
publicly accessible without authentication using an X-Api-Key header.

The key was discovered in the Angular app bundle (chunk-VE7DGSVW.js):

  POST https://api.codaworx.com/api/directories/rfp
  Headers:
    Content-Type: application/json
    X-Api-Key: FAQpT0GPAGjHnmBco3GdQelDnCLUYfkifqdCTp  (public, in-browser)
    Referer: https://www.codaworx.com/directories/opencalls
    Origin: https://www.codaworx.com

  Body (a raw JSON string, NOT nested JSON):
    {"count": true, "filter": null, "search": null,
     "skip": null, "orderby": "<base64('PostedDate desc')>", "top": null}

  The `search` and `orderby` fields must be base64-encoded when non-null,
  mirroring window.btoa() in the Angular app. The initial request passes
  search=null and orderby=base64("PostedDate desc"). Subsequent pages use
  searchNextPageParameters from the previous response, with search/orderby
  re-encoded as base64.

  Returns: {"count": N, "discoverRFP": [...], "searchNextPageParameters": {...}}

  Each listing in discoverRFP:
    Id                    — integer, CODAworx internal ID
    Title                 — call title
    MaxBudget             — numeric, total commission budget (USD or local currency)
    BudgetId              — filter bucket (778-782, maps to BUDGET_BUCKETS below)
    ApplicationCloseDate  — ISO datetime string, the deadline (UTC)
    City                  — commissioner's city
    Country               — ISO country code (US, CA, GB, etc.)
    State                 — ISO subdivision code (US-GA, CA-ON, etc.)
    GeographicEligibility — freetext eligibility notes ("All", "USA only", etc.)
    CallType              — "Artist" or "Industry" (we skip Industry)
    RFPRoutePath          — URL slug for the CODAworx listing page
    IsExternalApplication — bool; if True, the external apply URL requires login

  Note: The detail API (/api/rfp/detail/:slug) requires authentication. The
  description and external application URL are only visible after login. We use
  the CODAworx listing page as application_url for all entries; artists must
  create a free CODAworx account to access the full call details and apply.

--- Deadline ---

ApplicationCloseDate is a UTC ISO datetime string ("2026-04-18T00:00:00Z").
Parsed to "YYYY-MM-DD"; past-deadline calls are skipped.

--- Budget ---

MaxBudget is a numeric field (the actual dollar amount, e.g. 80000.0).
Stored as metadata.budget_usd. We also store the bucket label from BudgetId
as metadata.budget_label for quick human-readable reference.
No application fee (fee column stays null).

--- Pagination ---

Page 1: initial request with skip=null, orderby=base64("PostedDate desc").
Subsequent pages: use searchNextPageParameters dict from the previous response,
re-encoding search/orderby/filter as base64. Stop when searchNextPageParameters
is null or the returned page is empty.

With ~67 active calls total (2026-03-24) this is typically 2 pages of 50.
"""

import base64
import logging
import re
from datetime import date, datetime
from typing import Optional

import requests

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_API_BASE = "https://api.codaworx.com/api"
_LIST_URL = f"{_API_BASE}/directories/rfp"
_LISTING_BASE_URL = "https://www.codaworx.com/rfp/detail"

# Public API key embedded in the Angular app bundle (chunk-VE7DGSVW.js).
# This key gates guest-accessible endpoints only; no MSAL auth token required.
_API_KEY = "FAQpT0GPAGjHnmBco3GdQelDnCLUYfkifqdCTp"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_REQUEST_TIMEOUT = 30

# Budget bucket ID → human-readable label (from /api/directories/rfp/filters)
_BUDGET_BUCKETS: dict[int, str] = {
    778: "$0 - $25,000",
    779: "$25,000 - $75,000",
    780: "$75,000 - $150,000",
    781: "$150,000 - $250,000",
    782: "$250,000 and up",
}

# ---------------------------------------------------------------------------
# Base64 encoding (mirrors Angular window.btoa(unescape(encodeURIComponent(s))))
# ---------------------------------------------------------------------------


def _b64(value: str) -> str:
    """Base64-encode a UTF-8 string — matches the Angular app's encoding."""
    return base64.b64encode(value.encode("utf-8")).decode("ascii")


# ---------------------------------------------------------------------------
# Call type mapping
# ---------------------------------------------------------------------------

# CODAworx CallType values from the API
_CALL_TYPE_MAP: dict[str, Optional[str]] = {
    "artist": "commission",   # public art commissions — the platform's core
    "industry": None,         # industry resource calls (not artist open calls)
}


def _classify_call_type(raw: str) -> Optional[str]:
    """
    Map a CODAworx CallType string to our call_type value, or None to skip.

    Unknown types default to "commission" — overwhelmingly the right answer
    for CODAworx listings.
    """
    return _CALL_TYPE_MAP.get(raw.strip().lower(), "commission")


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline(close_date: Optional[str]) -> Optional[str]:
    """
    Parse ApplicationCloseDate ("2026-04-18T00:00:00Z") to "YYYY-MM-DD".

    Returns None if absent or malformed.
    """
    if not close_date:
        return None
    try:
        dt = datetime.strptime(close_date[:10], "%Y-%m-%d")
        return dt.strftime("%Y-%m-%d")
    except ValueError:
        return None


def _is_past_deadline(deadline_str: Optional[str]) -> bool:
    """Return True if the deadline date is strictly before today."""
    if not deadline_str:
        return False
    try:
        return date.fromisoformat(deadline_str) < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Budget extraction
# ---------------------------------------------------------------------------


def _parse_budget(max_budget: object) -> Optional[float]:
    """
    Parse the MaxBudget field to a float.

    MaxBudget is the actual dollar amount (e.g. 80000.0 for an $80K commission).
    Returns None if absent, zero, or unparseable.
    """
    if max_budget is None:
        return None
    try:
        val = float(max_budget)
        return val if val > 0 else None
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Eligibility extraction
# ---------------------------------------------------------------------------


def _build_eligibility(geo: Optional[str], country: Optional[str]) -> Optional[str]:
    """
    Combine GeographicEligibility and Country into a short eligibility string.

    Examples:
      geo="All",               country="US" → "Open to all; US commission"
      geo="USA only",          country="US" → "USA only; US commission"
      geo="Regional preference",country="CA" → "Regional preference; CA commission"
    """
    parts = []

    if geo:
        geo_stripped = geo.strip()
        geo_lower = geo_stripped.lower()
        if geo_lower in ("all", "all applicants welcome", "no geographic restrictions"):
            parts.append("Open to all applicants")
        elif geo_lower:
            parts.append(geo_stripped)

    if country:
        parts.append(f"{country.upper()} commission")

    return "; ".join(parts) if parts else None


# ---------------------------------------------------------------------------
# HTTP session
# ---------------------------------------------------------------------------


def _build_session() -> requests.Session:
    """Build a requests session with the CODAworx API headers."""
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "X-Api-Key": _API_KEY,
            "Referer": "https://www.codaworx.com/directories/opencalls",
            "Origin": "https://www.codaworx.com",
        }
    )
    return session


# ---------------------------------------------------------------------------
# Pagination params builders
# ---------------------------------------------------------------------------


def _initial_params() -> dict:
    """
    Build the POST body for the first page request.

    orderby is base64-encoded per Angular convention. search=null skips the
    asterisk wildcard that is only needed on page 2+.
    """
    return {
        "count": True,
        "filter": None,
        "search": None,
        "skip": None,
        "orderby": _b64("PostedDate desc"),
        "top": None,
    }


def _next_page_params(next_page: dict) -> dict:
    """
    Build the POST body for subsequent pages from searchNextPageParameters.

    searchNextPageParameters fields (as returned by the API):
      search   — raw string (e.g. "*"), must be base64-encoded when non-null
      filter   — OData filter string, base64-encoded when non-null
      orderby  — raw orderby string (e.g. "search.score() desc,PostedDate desc")
      skip     — integer offset (passed through as-is)
      count    — bool
      top      — max results per page (null = server default)

    The Angular loadDiscover() function re-encodes search/orderby/filter with
    window.btoa() before sending, so we replicate that here.
    """
    search = next_page.get("search")
    orderby = next_page.get("orderby")
    filt = next_page.get("filter")

    return {
        "count": next_page.get("count", True),
        "filter": _b64(filt) if filt else None,
        "search": _b64(search) if search else None,
        "skip": next_page.get("skip"),
        "orderby": _b64(orderby) if orderby else None,
        "top": next_page.get("top"),
    }


# ---------------------------------------------------------------------------
# API request
# ---------------------------------------------------------------------------


def _fetch_page(session: requests.Session, params: dict) -> Optional[dict]:
    """
    POST to the RFP listing endpoint.

    The body is sent as a raw JSON string (data=, not json=) because the
    Angular app sends JSON.stringify(params) as a text body. The server
    accepts it via Content-Type: application/json.

    Returns the parsed JSON response dict, or None on failure.
    """
    import json as _json

    try:
        resp = session.post(_LIST_URL, data=_json.dumps(params), timeout=_REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        logger.warning("CODAworx: request failed: %s", exc)
        return None
    except ValueError as exc:
        logger.warning("CODAworx: JSON parse error: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Item parser
# ---------------------------------------------------------------------------


def _parse_item(item: dict) -> Optional[dict]:
    """
    Parse a single discoverRFP element into a standardised listing dict.

    Returns None if the call should be skipped (Industry resource calls,
    missing title).
    """
    # --- Call type ---
    raw_type = item.get("CallType", "")
    call_type = _classify_call_type(raw_type)
    if call_type is None:
        logger.debug(
            "CODAworx: skipping %r — CallType=%r (not an artist open call)",
            (item.get("Title") or "")[:60],
            raw_type,
        )
        return None

    # --- Title ---
    title = (item.get("Title") or "").strip()
    if not title:
        return None

    # --- Route path and listing URL ---
    route_path = (item.get("RFPRoutePath") or "").strip()
    if not route_path:
        # Fallback: generate a slug from the title
        route_path = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]

    listing_url = f"{_LISTING_BASE_URL}/{route_path}"

    # --- Deadline ---
    deadline = _parse_deadline(item.get("ApplicationCloseDate"))

    # --- Budget ---
    budget_usd = _parse_budget(item.get("MaxBudget"))
    budget_bucket_id = item.get("BudgetId")
    budget_label = _BUDGET_BUCKETS.get(budget_bucket_id, "") if budget_bucket_id else ""

    # --- Location and eligibility ---
    city = (item.get("City") or "").strip()
    country = (item.get("Country") or "").strip()
    state = (item.get("State") or "").strip()
    geo = (item.get("GeographicEligibility") or "").strip()
    eligibility = _build_eligibility(geo, country)

    # --- Tags (medium/type, often null) ---
    tag_names = (item.get("TagNames") or "").strip()
    tags = [t.strip() for t in tag_names.split(",") if t.strip()] if tag_names else []

    return {
        "title": title,
        "deadline": deadline,
        "listing_url": listing_url,
        "call_type": call_type,
        "raw_call_type": raw_type,
        "budget_usd": budget_usd,
        "budget_label": budget_label,
        "city": city,
        "country": country,
        "state": state,
        "geo": geo,
        "eligibility": eligibility,
        "tags": tags,
        "coda_id": item.get("Id"),
        "old_id": item.get("OldId"),
        "is_external": item.get("IsExternalApplication", False),
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl the CODAworx open calls listing via the /api/directories/rfp endpoint.

    Strategy:
      1. POST to /api/directories/rfp with page 1 params (X-Api-Key, no auth).
      2. Parse discoverRFP items; skip Industry resource calls.
      3. Follow pagination via searchNextPageParameters until exhausted.
      4. Skip past-deadline calls.
      5. Insert or update each call via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _build_session()
    params = _initial_params()

    skipped_deadline = 0
    skipped_type = 0
    page_num = 0

    while True:
        page_num += 1
        logger.debug("CODAworx: fetching page %d", page_num)

        data = _fetch_page(session, params)
        if not data:
            logger.error("CODAworx: failed to fetch page %d — aborting", page_num)
            break

        listings = data.get("discoverRFP", [])
        if not listings:
            logger.debug("CODAworx: page %d returned no listings — done", page_num)
            break

        if page_num == 1:
            total = data.get("count", 0)
            logger.info("CODAworx: %d total active calls reported by API", total)

        for raw_item in listings:
            parsed = _parse_item(raw_item)
            if parsed is None:
                skipped_type += 1
                continue

            title = parsed["title"]
            deadline = parsed["deadline"]

            # Skip past-deadline calls
            if deadline and _is_past_deadline(deadline):
                skipped_deadline += 1
                logger.debug(
                    "CODAworx: skipping %r — deadline %s passed",
                    title[:60],
                    deadline,
                )
                continue

            found += 1
            listing_url = parsed["listing_url"]

            # Build a structured description from available listing metadata.
            # The full description requires auth (detail API is login-gated);
            # we surface what's available without requiring a login round-trip.
            desc_parts: list[str] = []
            if parsed["city"] and parsed["country"]:
                desc_parts.append(f"Location: {parsed['city']}, {parsed['country']}")
            elif parsed["city"]:
                desc_parts.append(f"Location: {parsed['city']}")
            if parsed["geo"]:
                desc_parts.append(f"Geographic eligibility: {parsed['geo']}")
            if parsed["budget_usd"]:
                desc_parts.append(f"Budget: ${parsed['budget_usd']:,.0f}")
            elif parsed["budget_label"]:
                desc_parts.append(f"Budget range: {parsed['budget_label']}")
            if parsed["tags"]:
                desc_parts.append(f"Medium/type: {', '.join(parsed['tags'])}")
            description = "\n".join(desc_parts) or None

            metadata: dict = {
                "scope": "national",
                "coda_id": parsed["coda_id"],
                "old_id": parsed["old_id"],
                "city": parsed["city"],
                "country": parsed["country"],
                "state": parsed["state"],
                "geographic_eligibility": parsed["geo"],
                "is_external_application": parsed["is_external"],
            }
            if parsed["budget_usd"] is not None:
                metadata["budget_usd"] = parsed["budget_usd"]
            if parsed["budget_label"]:
                metadata["budget_label"] = parsed["budget_label"]
            if parsed["tags"]:
                metadata["tags"] = parsed["tags"]

            call_data: dict = {
                "title": title,
                "description": description,
                "deadline": deadline,
                # application_url = CODAworx listing page. Artists need a free
                # CODAworx account to see the full description and external apply
                # link — which matches the expected user journey on this platform.
                "application_url": listing_url,
                "source_url": listing_url,
                "call_type": parsed["call_type"],
                "eligibility": parsed["eligibility"],
                "fee": None,  # CODAworx has no application fee
                "source_id": source_id,
                "confidence_tier": "aggregated",
                "_org_name": "codaworx",
                "metadata": metadata,
            }

            result = insert_open_call(call_data)
            if result:
                new += 1
                logger.debug(
                    "CODAworx: inserted/updated %r (deadline=%s, budget_usd=%s)",
                    title[:60],
                    deadline,
                    parsed["budget_usd"],
                )

        # Follow pagination
        next_page = data.get("searchNextPageParameters")
        if not next_page:
            logger.debug(
                "CODAworx: no searchNextPageParameters — done after page %d", page_num
            )
            break

        params = _next_page_params(next_page)

    if skipped_deadline:
        logger.info("CODAworx: skipped %d past-deadline listings", skipped_deadline)
    if skipped_type:
        logger.info("CODAworx: skipped %d non-artist (Industry) listings", skipped_type)

    logger.info(
        "CODAworx: %d found (non-expired), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
