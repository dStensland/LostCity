"""
Crawler for CaFE (Call For Entry) open calls — filtered to Georgia and Southeast.

CaFE (artist.callforentry.org) is the dominant national platform for artist open
calls: juried exhibitions, residencies, grants, public art commissions, competitions,
and festivals. It is not a direct source — it aggregates calls posted by arts
organizations — so confidence_tier is set to "aggregated".

Crawl strategy:
  The page is AJAX-driven. Content loads via POST requests to /festivals-ajax.php
  with form parameters matching the search filters the user has set. We reverse the
  AJAX call directly (no Playwright needed):

    POST https://artist.callforentry.org/festivals-ajax.php
    Content-Type: application/x-www-form-urlencoded
    X-Requested-With: XMLHttpRequest

    start-index=0&keyword=&show-only-fair-id=&region[]=1,4,10,11,18,19,25,34,41,43,47,49

  The server ignores start-index for filtering and returns ALL matching results in a
  single response (verified: 47 Southeast results returned regardless of start-index).
  The frontend uses start-index as a display cursor for its infinite-scroll UI, but
  the backend dumps the full matching set each time.

Filter strategy:
  PRIMARY filter: Southeast region (state IDs 1,4,10,11,18,19,25,34,41,43,47,49).
    This covers: AL, AR, DE, FL, GA, KY, MD, MS, NC, SC, TN, WV.
    47 results as of 2026-03-23. Gives useful regional coverage for the Arts portal.

  SECONDARY filter: Georgia state only (state ID = 11).
    Only a subset of the Southeast results, but confirmed working.

  We run the SOUTHEAST filter to maximize open call coverage for regional artists.
  Georgia-specific calls will naturally be included (FairState == "Georgia").

Application URLs:
  Individual call detail pages use:
    https://artist.callforentry.org/festivals_unique_info.php?ID={FairId}

Call type mapping:
  CaFE FairType values → our call_type:
    Exhibitions       → submission
    Competitions      → submission
    Photography       → submission
    Public Art        → commission
    Residencies       → residency
    Fellowships       → grant
    Grants            → grant
    Festivals         → submission
    Award             → grant
    Unspecified       → submission  (fallback)

Eligibility mapping:
  CaFE FairEligibility values are used directly (International/National/Regional/Local).

Fee extraction:
  ProductCost is a decimal string (e.g. "20.00") or None. No fee = None stored.
"""

import html as _html
import logging
import re
from datetime import date
from typing import Optional

import requests

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AJAX_URL = "https://artist.callforentry.org/festivals-ajax.php"
LISTING_BASE_URL = "https://artist.callforentry.org/festivals_unique_info.php"
SOURCE_URL = "https://artist.callforentry.org/festivals.php"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Southeast region filter value (matches the checkbox in the CaFE search form).
# Covers: AL, AR, DE, FL, GA, KY, MD, MS, NC, SC, TN, WV
SOUTHEAST_REGION = "1,4,10,11,18,19,25,34,41,43,47,49"

# CaFE FairType → our call_type taxonomy
_FAIR_TYPE_MAP: dict[str, str] = {
    "Exhibitions": "submission",
    "Competitions": "submission",
    "Photography": "submission",
    "Festivals": "submission",
    "Unspecified": "submission",
    "Public Art": "commission",
    "Residencies": "residency",
    "Fellowships": "grant",
    "Grants": "grant",
    "Award": "grant",
}

# CaFE FairEligibility → our eligibility taxonomy
# CaFE uses: International, National, Regional, Local, Unspecified
# We pass through directly; None for Unspecified.
_ELIGIBILITY_MAP: dict[str, Optional[str]] = {
    "International": "International",
    "National": "National",
    "Regional": "Regional",
    "Local": "Local",
    "Unspecified": None,
}


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _build_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Referer": SOURCE_URL,
            "Origin": "https://artist.callforentry.org",
            "X-Requested-With": "XMLHttpRequest",
        }
    )
    return session


def _fetch_calls(session: requests.Session) -> list[dict]:
    """
    POST to the CaFE AJAX endpoint with Southeast region filter.

    Returns the raw list of result dicts from the JSON response,
    or an empty list on any failure.
    """
    form_data = [
        ("start-index", "0"),
        ("keyword", ""),
        ("show-only-fair-id", ""),
        ("region[]", SOUTHEAST_REGION),
    ]
    try:
        resp = session.post(AJAX_URL, data=form_data, timeout=30)
        resp.raise_for_status()
        payload = resp.json()
        results = payload.get("results", [])
        logger.debug(
            "CaFE: AJAX returned %d results (num-results=%s)",
            len(results),
            payload.get("num-results"),
        )
        return results
    except requests.RequestException as exc:
        logger.warning("CaFE: failed to fetch AJAX endpoint: %s", exc)
        return []
    except (ValueError, KeyError) as exc:
        logger.warning("CaFE: failed to parse JSON response: %s", exc)
        return []


# ---------------------------------------------------------------------------
# Field extraction helpers
# ---------------------------------------------------------------------------


def _application_url(fair_id: str) -> str:
    """Build the canonical call detail URL from its FairId."""
    return f"{LISTING_BASE_URL}?ID={fair_id}"


def _map_call_type(fair_type: Optional[str]) -> str:
    """Map CaFE FairType to our call_type taxonomy. Defaults to 'submission'."""
    return _FAIR_TYPE_MAP.get(fair_type or "", "submission")


def _map_eligibility(fair_eligibility: Optional[str]) -> Optional[str]:
    """Map CaFE FairEligibility to our eligibility taxonomy."""
    return _ELIGIBILITY_MAP.get(fair_eligibility or "", None)


def _parse_fee(product_cost: Optional[str]) -> Optional[float]:
    """
    Convert ProductCost string (e.g. "20.00") to float, or None if absent/zero.

    CaFE stores "None" as Python None (JSON null) for no-fee calls.
    """
    if not product_cost:
        return None
    try:
        val = float(product_cost)
        return val if val > 0 else None
    except (ValueError, TypeError):
        return None


def _clean_html_description(html_desc: Optional[str]) -> Optional[str]:
    """
    Strip HTML tags from CaFE's HTML-formatted description fields.
    Returns plain text trimmed to 2000 chars, or None if empty.
    """
    if not html_desc:
        return None
    # Decode HTML entities first (e.g. &nbsp; → space, &amp; → &)
    text = _html.unescape(html_desc)
    # Strip all HTML tags — CaFE uses basic <p>, <strong>, <em>, <br> tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text[:2000] if text else None


def _build_description(result: dict) -> Optional[str]:
    """
    Prefer fair_short_desc (concise marketing copy) over fair_description (longer).
    Falls back to fair_description if short desc is empty.
    """
    short = _clean_html_description(result.get("fair_short_desc"))
    if short and len(short) > 40:
        return short
    return _clean_html_description(result.get("fair_description"))


# ---------------------------------------------------------------------------
# Result → call_data conversion
# ---------------------------------------------------------------------------


def _result_to_call(result: dict, source_id: str) -> Optional[dict]:
    """
    Convert a single CaFE AJAX result dict to a call_data dict ready for
    insert_open_call(). Returns None if required fields are missing.
    """
    fair_id = result.get("FairId") or result.get("id")
    title = (result.get("fair_name") or "").strip()

    if not fair_id or not title:
        logger.debug("CaFE: skipping result with missing fair_id or title: %s", result)
        return None

    fair_type = result.get("FairType") or result.get("fair_type")
    fair_eligibility = result.get("FairEligibility") or result.get("fair_eligibility")

    # Deadline: use the structured fair_deadline (YYYY-MM-DD) from the raw field.
    # The formatted Deadline field ("3/29/26") is for display only.
    deadline = result.get("fair_deadline") or None
    if deadline == "0000-00-00":
        deadline = None

    application_url = _application_url(str(fair_id))

    description = _build_description(result)

    # Organization name and city/state for metadata context
    org_name = (result.get("organization_name") or "").strip()
    city = (result.get("fair_city") or "").strip()
    state_name = result.get("FairState") or ""

    metadata: dict = {
        "source": "cafe",
        "fair_id": str(fair_id),
    }
    if org_name:
        metadata["organization_name"] = org_name
    if city:
        metadata["city"] = city
    if state_name:
        metadata["state"] = state_name

    return {
        "title": title,
        "description": description,
        "deadline": deadline,
        "application_url": application_url,
        "source_url": application_url,
        "call_type": _map_call_type(fair_type),
        "eligibility": _map_eligibility(fair_eligibility),
        "fee": _parse_fee(result.get("ProductCost")),
        "source_id": source_id,
        "confidence_tier": "aggregated",
        "_org_name": "CaFE",
        "metadata": metadata,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl CaFE open calls for the Southeast region via the AJAX endpoint.

    The endpoint returns all matching calls in a single POST response (no
    real server-side pagination — start-index is a display cursor only).

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _build_session()

    raw_results = _fetch_calls(session)
    if not raw_results:
        logger.warning("CaFE: no results returned from AJAX endpoint")
        return 0, 0, 0

    logger.info("CaFE: fetched %d raw results from Southeast filter", len(raw_results))

    today = date.today().isoformat()

    for result in raw_results:
        call_data = _result_to_call(result, source_id)
        if not call_data:
            continue

        # Skip past-deadline calls
        if call_data.get("deadline") and call_data["deadline"] < today:
            logger.debug("CaFE: skipping past-deadline call %r (deadline=%s)", call_data["title"], call_data["deadline"])
            continue

        found += 1
        inserted_id = insert_open_call(call_data)
        if inserted_id:
            new += 1

    logger.info("CaFE: %d found, %d new, %d updated", found, new, updated)
    return found, new, updated
