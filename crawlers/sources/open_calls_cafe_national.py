"""
Crawler for CaFE (Call For Entry) open calls — national, no region filter.

This is the national complement to open_calls_cafe.py (Southeast-only). It
hits the same AJAX endpoint but with NO region[] parameter, returning all
348+ calls from every US state and international submissions.

The two crawlers share the same underlying source platform (CaFE /
artist.callforentry.org) but are registered as separate sources so that:
  - The Southeast crawler continues to serve the Arts-Atlanta portal with
    regionally relevant calls.
  - This national crawler populates the broader open_calls table for any
    future multi-city Arts portals (Nashville, Charlotte, etc.) and for
    aggregated national discovery.

Dedup note: calls that appear in both sources will be caught by the
content-hash dedup in insert_open_call() and simply updated, not double-
inserted. The hash is keyed on (title, application_url), so the same call
from CaFE will always map to the same hash regardless of which crawler
ingested it.

Crawl strategy:
  POST https://artist.callforentry.org/festivals-ajax.php
  Headers: X-Requested-With: XMLHttpRequest
  Form data: start-index=0&keyword=&show-only-fair-id=
  (NO region[] parameter — returns all results)

  The backend returns the full matching set in one response; start-index is
  a display cursor for the frontend infinite-scroll UI only.

FairType → call_type mapping:
  Exhibitions  → submission    Photography  → submission
  Competitions → submission    Online       → submission
  Festivals    → submission    Proposals    → submission
  Member       → submission    Literary     → submission
  Youth        → submission    Workshops    → submission
  Public Art   → commission
  Residencies  → residency
  Fellowships  → grant
  Grants       → grant
  Award        → grant
  Unspecified  → submission    (fallback)
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

# CaFE FairType → our call_type taxonomy
_FAIR_TYPE_MAP: dict[str, str] = {
    "Exhibitions": "submission",
    "Competitions": "submission",
    "Photography": "submission",
    "Festivals": "submission",
    "Online": "submission",
    "Proposals": "submission",
    "Member": "submission",
    "Literary": "submission",
    "Youth": "submission",
    "Workshops": "submission",
    "Unspecified": "submission",
    "Public Art": "commission",
    "Residencies": "residency",
    "Fellowships": "grant",
    "Grants": "grant",
    "Award": "grant",
}

# CaFE FairEligibility values passed through directly; None for Unspecified.
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
    POST to the CaFE AJAX endpoint with NO region filter — returns all calls nationally.

    Returns the raw list of result dicts from the JSON response,
    or an empty list on any failure.
    """
    form_data = [
        ("start-index", "0"),
        ("keyword", ""),
        ("show-only-fair-id", ""),
        # Deliberately omitting region[] to get all national results.
    ]
    try:
        resp = session.post(AJAX_URL, data=form_data, timeout=30)
        resp.raise_for_status()
        payload = resp.json()
        results = payload.get("results", [])
        logger.debug(
            "CaFE national: AJAX returned %d results (num-results=%s)",
            len(results),
            payload.get("num-results"),
        )
        return results
    except requests.RequestException as exc:
        logger.warning("CaFE national: failed to fetch AJAX endpoint: %s", exc)
        return []
    except (ValueError, KeyError) as exc:
        logger.warning("CaFE national: failed to parse JSON response: %s", exc)
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

    CaFE stores None (JSON null) for no-fee calls.
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
    # Decode HTML entities first (&nbsp; → space, &amp; → &)
    text = _html.unescape(html_desc)
    # Strip all HTML tags — CaFE uses basic <p>, <strong>, <em>, <br> tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()
    return text[:2000] if text else None


def _build_description(result: dict) -> Optional[str]:
    """
    Prefer fair_short_desc (concise marketing copy) over fair_description (longer).
    Falls back to fair_description if short desc is absent or too brief.
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
        logger.debug(
            "CaFE national: skipping result with missing fair_id or title: %s", result
        )
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

    # Organization name — each call is from a different org on CaFE
    org_name = (result.get("organization_name") or "").strip()
    city = (result.get("fair_city") or "").strip()
    state_name = result.get("FairState") or ""

    metadata: dict = {
        "source": "cafe_national",
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
        # _org_name is consumed by insert_open_call() for slug generation
        # and then stripped — use the actual org name from each call.
        "_org_name": org_name or "cafe",
        "metadata": metadata,
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl CaFE open calls nationally via the AJAX endpoint (no region filter).

    The endpoint returns all matching calls in a single POST response
    (start-index is a display cursor only; no true server-side pagination).

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _build_session()

    raw_results = _fetch_calls(session)
    if not raw_results:
        logger.warning("CaFE national: no results returned from AJAX endpoint")
        return 0, 0, 0

    logger.info("CaFE national: fetched %d raw results", len(raw_results))

    today = date.today().isoformat()

    for result in raw_results:
        call_data = _result_to_call(result, source_id)
        if not call_data:
            continue

        # Skip past-deadline calls
        if call_data.get("deadline") and call_data["deadline"] < today:
            logger.debug(
                "CaFE national: skipping past-deadline call %r (deadline=%s)",
                call_data["title"],
                call_data["deadline"],
            )
            continue

        found += 1
        inserted_id = insert_open_call(call_data)
        if inserted_id:
            new += 1

    logger.info("CaFE national: %d found, %d new, %d updated", found, new, updated)
    return found, new, updated
