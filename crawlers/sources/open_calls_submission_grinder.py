"""
Crawler for The Submission Grinder (thegrinder.diabolicalplots.com).

The Submission Grinder is the dominant aggregator for literary market
opportunities — fiction, poetry, and nonfiction. It tracks 19,000+ markets
worldwide, with ~3,200 currently open for submissions at any time.

This is the largest literary-market source in the LostCity open calls
corpus, covering an entirely different discipline from existing visual-arts
and theater sources.

Architecture — why no Playwright:
  The initial task spec said Playwright was required because the URL
  /Search/SearchResults returns a 404. The actual search is at
  /Search/ByFilter, and results load via a JSON POST to:

    POST /Search/Byfilter/Search
    Content-Type: application/json; charset=utf-8
    X-Requested-With: XMLHttpRequest

  Verified 2026-03-24: the endpoint accepts requests from a plain
  requests.Session() — the ARRAffinity session cookie obtained by a
  single GET to the search page is sufficient. No JavaScript evaluation
  or Playwright needed.

  The API returns a flat JSON array — no pagination. A single call returns
  all open markets (~1,337 Fiction, ~993 Poetry, ~842 Nonfiction as of
  2026-03-24). Markets are filtered server-side:
    ExcludeTempClosed: true  — only currently open markets
    ExcludePermClosed: true  — only currently open markets

  Total HTTP requests: 6 (1 GET + 1 POST per market type).

Data mapping:
  Market fields from the API → our open_calls schema:
    MarketID          → used to construct source_url + application_url
    Name              → title (stripped)
    Genre             → metadata.genres (comma-separated string)
    LengthType        → metadata.length_types
    PayScaleNumeric   → metadata.pay_cents_per_word (see PayScaleNumeric notes)
    AverageReturnDays → metadata.avg_response_days
    MarketType        → metadata.market_type ("Fiction"/"Poetry"/"Nonfiction")
    TempClosed        → post-filter guard (should be false for all)
    PermClosed        → post-filter guard (should be false for all)

  source_url  = https://thegrinder.diabolicalplots.com/Market/Index?id=N
  application_url = same — the Grinder detail page links to submission
                    guidelines and the publication's actual submit page

PayScaleNumeric sentinel values:
  -2  → "Unknown" (no pay data submitted)
  -1  → "Non-paying" (zero pay)
  0   → "Less than 1 cent/word"
  N>0 → N cents/word (e.g. 6 = SFWA pro rate)

  We store pay as metadata only — not in the open_calls fee column
  (which represents submission fees paid by artists, not payment TO them).

Call type:
  All three market types → "submission" (writers submit manuscripts).
  These are not grants, residencies, or commissions.

Eligibility:
  "International" — The Submission Grinder is a global database with no
  geographic restrictions. Writers worldwide can submit to these markets.

Confidence tier:
  "aggregated" — The Grinder is an aggregator, not the issuing publication.

Rate limiting:
  2s pause between market type requests. The 3 POSTs are single bulk calls
  (no per-market requests), so total load is minimal.

Deduplication:
  insert_open_call() deduplicates on (title, application_url) hash.
  application_url is unique per market (Grinder ID-based URL), so each
  market persists correctly across runs.

Note on "always open" markets:
  Many literary magazines are perpetually open — no fixed deadline. We set
  deadline=None for all markets since The Grinder does not expose deadline
  data in the list API (deadlines, when they exist, appear only on
  third-party submission pages linked from the detail view).
"""

import logging
import time
from typing import Optional

import requests

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_BASE_URL = "https://thegrinder.diabolicalplots.com"
_SEARCH_PAGE_URL = _BASE_URL + "/Search/ByFilter?marketType={market_type}"
_SEARCH_API_URL = _BASE_URL + "/Search/Byfilter/Search"
_DETAIL_URL_TEMPLATE = _BASE_URL + "/Market/Index?id={market_id}"

# Market types to crawl — covers all literary categories tracked by The Grinder
MARKET_TYPES = ["Fiction", "Poetry", "Nonfiction"]

# Polite pause between market-type requests (seconds)
_INTER_TYPE_DELAY_S = 2.0

# HTTP timeouts
_GET_TIMEOUT_S = 30
_POST_TIMEOUT_S = 90  # bulk call returns ~3,000 records; allow time for server

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# PayScaleNumeric sentinel values (per Grinder docs)
_PAY_UNKNOWN = -2
_PAY_NON_PAYING = -1


# ---------------------------------------------------------------------------
# HTTP session
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    """
    Build a requests.Session with appropriate default headers.

    The ARRAffinity cookie (Azure sticky-session routing cookie) is obtained
    by performing a GET to each market type's search page before POSTing to
    the API. The cookie is automatically stored by the session.
    """
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    return session


def _warm_session(session: requests.Session, market_type: str) -> bool:
    """
    Perform a GET to the search page to establish the ARRAffinity session
    cookie for the given market type.

    Returns True on success, False on failure.
    """
    url = _SEARCH_PAGE_URL.format(market_type=market_type)
    try:
        resp = session.get(
            url,
            timeout=_GET_TIMEOUT_S,
            headers={
                "Accept": (
                    "text/html,application/xhtml+xml,application/xml;" "q=0.9,*/*;q=0.8"
                ),
            },
        )
        resp.raise_for_status()
        logger.debug(
            "SubmissionGrinder [%s]: session warmed (cookie=%s)",
            market_type,
            bool(session.cookies.get("ARRAffinity")),
        )
        return True
    except requests.RequestException as exc:
        logger.error(
            "SubmissionGrinder [%s]: failed to warm session: %s", market_type, exc
        )
        return False


# ---------------------------------------------------------------------------
# Search payload
# ---------------------------------------------------------------------------


def _build_payload(market_type: str) -> dict:
    """
    Build the JSON payload for the Grinder search API.

    We request all open markets (TempClosed and PermClosed both excluded).
    All other filters are left at defaults so results are as broad as possible.

    SelectedGenres: [-1] — the JS code sends [-1] when no genres are selected
      ("C# has issues receiving empty list, just put a dummy value in").

    ReprintType "1" = Originals only (the default the form loads with).
    """
    return {
        "SelectedGenres": [-1],  # -1 = any genre (Kendo placeholder for empty)
        "MarketType": market_type,
        "Paying": False,
        "WordCount": "",
        "PayScaleNumeric": "",
        "PayScaleNumericReprint": "",
        "SubmissionTypeID": "0",  # Any submission type
        "MaxAvgResponseDays": "",
        "MarketQualificationID": "0",  # Any qualification
        "ReprintType": "1",  # Originals only (site default)
        "AcceptsTranslations": False,
        "AcceptsSimultaneous": False,
        "AcceptsMultiple": False,
        "ShowOnlyAnthologies": False,
        "ShowOnlyContests": False,
        "ExcludeIgnored": False,
        "ExcludeNonFavorites": False,
        "ExcludeTempClosed": True,  # Key: open markets only
        "ExcludePermClosed": True,  # Key: open markets only
        "ExcludeFeeBased": False,  # Include fee-based markets
        "ExcludeMandatoryNewsletter": False,
        "ExcludeBadContract": False,
        "ExcludeAIAllowed": False,
        "ExcludeWherePending": False,
        "AlwaysIncludeGeneral": False,
        "FuzzyMaxLimit": "",
        "Keywords": "",
        "RememberAdvancedSearchSettings": None,
        "SortBy": "Name",
    }


# ---------------------------------------------------------------------------
# API fetch
# ---------------------------------------------------------------------------


def _fetch_markets(session: requests.Session, market_type: str) -> list[dict]:
    """
    POST to the Grinder search API and return the raw list of market dicts.

    Returns [] on any failure.

    Response shape: a flat JSON array, each element is a market dict.
    """
    payload = _build_payload(market_type)
    try:
        resp = session.post(
            _SEARCH_API_URL,
            json=payload,
            headers={
                "Accept": "application/json, text/javascript, */*; q=0.01",
                "Content-Type": "application/json; charset=utf-8",
                "X-Requested-With": "XMLHttpRequest",
                "Referer": _SEARCH_PAGE_URL.format(market_type=market_type),
                "Origin": _BASE_URL,
            },
            timeout=_POST_TIMEOUT_S,
        )
        resp.raise_for_status()

        markets = resp.json()
        if not isinstance(markets, list):
            logger.error(
                "SubmissionGrinder [%s]: unexpected response shape (expected list, got %s)",
                market_type,
                type(markets).__name__,
            )
            return []

        logger.info(
            "SubmissionGrinder [%s]: API returned %d markets", market_type, len(markets)
        )
        return markets

    except requests.RequestException as exc:
        logger.error(
            "SubmissionGrinder [%s]: POST request failed: %s", market_type, exc
        )
        return []
    except ValueError as exc:
        logger.error(
            "SubmissionGrinder [%s]: failed to parse JSON response: %s",
            market_type,
            exc,
        )
        return []


# ---------------------------------------------------------------------------
# Pay scale helpers
# ---------------------------------------------------------------------------


def _pay_display(pay_numeric: int) -> str:
    """
    Return a human-readable pay label from PayScaleNumeric.

      -2 → "Unknown"
      -1 → "Non-paying"
       0 → "Less than 1¢/word"
      N  → "N¢/word"
    """
    if pay_numeric == _PAY_UNKNOWN:
        return "Unknown"
    if pay_numeric == _PAY_NON_PAYING:
        return "Non-paying"
    if pay_numeric == 0:
        return "Less than 1¢/word"
    return "%d¢/word" % pay_numeric


def _pay_numeric_to_cents(pay_numeric: int) -> Optional[int]:
    """
    Return the numeric cents-per-word value for storage, or None for
    sentinels (-2 unknown, -1 non-paying).
    """
    if pay_numeric in (_PAY_UNKNOWN, _PAY_NON_PAYING):
        return None
    return pay_numeric


# ---------------------------------------------------------------------------
# Market → open_call record
# ---------------------------------------------------------------------------


def _build_call_record(
    market: dict,
    market_type: str,
    source_id: int,
) -> Optional[dict]:
    """
    Convert a raw Grinder market dict to an open_call record for insert.

    Returns None if the market should be skipped (missing name, still closed).
    """
    market_id = market.get("MarketID")
    if not market_id:
        return None

    name = (market.get("Name") or "").strip()
    if not name:
        return None

    # Paranoia guard — server-side filter should have excluded these already
    if market.get("TempClosed") or market.get("PermClosed"):
        logger.debug(
            "SubmissionGrinder: skipping closed market %r (id=%s, type=%s)",
            name,
            market_id,
            market_type,
        )
        return None

    detail_url = _DETAIL_URL_TEMPLATE.format(market_id=market_id)

    genres_raw = (market.get("Genre") or "").strip()
    length_types_raw = (market.get("LengthType") or "").strip()
    pay_numeric = market.get("PayScaleNumeric", _PAY_UNKNOWN)
    avg_days = market.get("AverageReturnDays", 9999)

    # Build a concise description from list-API fields
    desc_parts: list[str] = []
    if genres_raw:
        desc_parts.append("Genres: %s." % genres_raw)
    if length_types_raw:
        desc_parts.append("Lengths: %s." % length_types_raw)
    pay_str = _pay_display(pay_numeric)
    desc_parts.append("Pay: %s." % pay_str)
    if avg_days and avg_days < 9999:
        desc_parts.append("Average response time: %d days." % avg_days)

    description = " ".join(desc_parts) if desc_parts else None

    return {
        "title": name,
        "description": description,
        # Deadline is None: most literary mags have rolling/perpetual open periods.
        # The Grinder list API does not expose deadline data; it only appears
        # on the individual market's linked submission page.
        "deadline": None,
        "application_url": detail_url,
        "source_url": detail_url,
        "call_type": "submission",
        "eligibility": "International",
        # fee = None: this column represents fees paid BY artists. The Grinder
        # list API does not expose per-market submission fees in the list response.
        "fee": None,
        "source_id": source_id,
        "confidence_tier": "aggregated",
        "_org_name": name,
        "metadata": {
            "source": "submission-grinder",
            "market_id": market_id,
            "market_type": market_type,
            "genres": genres_raw or None,
            "length_types": length_types_raw or None,
            "pay_display": pay_str,
            "pay_cents_per_word": _pay_numeric_to_cents(pay_numeric),
            "avg_response_days": avg_days if avg_days < 9999 else None,
            "discipline": "literary",
        },
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl The Submission Grinder for open literary market submissions.

    Strategy:
      For each market type (Fiction, Poetry, Nonfiction):
        1. GET the search page to establish an ARRAffinity session cookie.
        2. POST to /Search/Byfilter/Search with ExcludeTempClosed=true and
           ExcludePermClosed=true to fetch all currently open markets.
        3. Convert each market dict to an open_call record.
        4. Insert or update via insert_open_call().

    Total HTTP requests: 6 (1 GET + 1 POST per market type).
    No Playwright required — the API accepts plain requests.Session() calls.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()

    for i, market_type in enumerate(MARKET_TYPES):
        if i > 0:
            time.sleep(_INTER_TYPE_DELAY_S)

        logger.info("SubmissionGrinder: fetching %s markets", market_type)

        # Warm the session (establishes ARRAffinity cookie)
        if not _warm_session(session, market_type):
            logger.warning(
                "SubmissionGrinder [%s]: session warm failed — skipping", market_type
            )
            continue

        markets = _fetch_markets(session, market_type)
        if not markets:
            logger.warning(
                "SubmissionGrinder [%s]: 0 markets returned — check API", market_type
            )
            continue

        type_found = type_new = 0

        for market in markets:
            record = _build_call_record(market, market_type, source_id)
            if record is None:
                continue

            found += 1
            type_found += 1

            result = insert_open_call(record)
            if result:
                new += 1
                type_new += 1

        logger.info(
            "SubmissionGrinder [%s]: %d found, %d new",
            market_type,
            type_found,
            type_new,
        )

    logger.info(
        "SubmissionGrinder: crawl complete — %d found, %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
