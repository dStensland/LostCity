"""
Crawler for EntryThingy (app.entrythingy.com/calls_list/) open calls board.

EntryThingy aggregates calls for artists from multiple submission platforms:
its own native calls, CaFE, Zapplication, ArtCall, ShowSubmit, and independent
galleries. The site currently lists ~1,370 active calls, making it the
largest single open-calls source we crawl.

This is NOT a primary source — EntryThingy aggregates calls posted by arts
organizations — so confidence_tier is "aggregated".

Crawl strategy:
  The page is server-rendered Django HTML. Every paginated listing page
  embeds full call data as a JSON-LD <script type="application/ld+json">
  block structured as:

    CollectionPage > mainEntity (ItemList) > itemListElement (array of ListItems)
    Each ListItem.item is a Schema.org Event object with these key fields:

      name              — call title
      description       — truncated description (~200 chars)
      url               — EntryThingy detail page (canonical source_url)
                          Also used as application_url since it links to the
                          call's application page or redirects there
      registrationDeadline — ISO 8601 with timezone offset (e.g. "2026-03-31T23:59:00-07:00")
      isAccessibleForFree  — true = free, false = fee exists
      offers.price         — numeric fee (USD); only meaningful if isAccessibleForFree=False AND price > 0
                             isAccessibleForFree=False + price=0 means fee exists but amount unknown
      location.address.addressLocality — city
      location.address.addressRegion   — state/region
      location.address.addressCountry  — country code (US, USA, CA, etc.)
      organizer.name    — posting organization name

  Pagination: ?page=N, starting at 1. Currently 28 pages at 50 items/page.
  Stop early when a page returns 0 items. Check for rel="next" link header
  as an additional pagination signal.

  Call type: NOT provided in the JSON-LD. We infer from title + description
  using keyword patterns (residency, commission, grant, festival, juried, etc.)
  The vast majority are exhibition submissions / art festival calls.

  Location scope: most calls are US-based, so default scope is "national".
  We elevate to "international" when the location country is non-US or when
  title/description contains international scope keywords.

Rate limiting:
  EntryThingy is a small arts platform. We pause 0.75s between page requests
  to avoid hammering their server.
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

BASE_LIST_URL = "https://app.entrythingy.com/calls_list/"

# Conservative hard cap: site has ~28 pages; this prevents infinite loops
# if pagination metadata is ever missing.
MAX_PAGES = 60

# Polite inter-page delay (seconds)
PAGE_DELAY = 0.75

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Country codes that indicate a US-based call (both "US" and "USA" appear in their data)
_US_COUNTRY_CODES = {"US", "USA", "U.S.", "U.S.A."}


# ---------------------------------------------------------------------------
# Type inference patterns
# ---------------------------------------------------------------------------
#
# EntryThingy doesn't expose a structured call type. We infer from combined
# title + description text. Most calls (~90%) are exhibitions/art fairs —
# "submission" is the appropriate default when no stronger signal is found.
#
# Ordered most-specific first so residency isn't misclassified as grant, etc.

_TYPE_PATTERNS: list[tuple[str, list[str]]] = [
    (
        "residency",
        [
            r"\bresiden(?:cy|ce|t)\b",
            r"\bin\s+residence\b",
            r"\bartist[- ]in[- ]residence\b",
        ],
    ),
    (
        "fellowship",
        [
            r"\bfellowship\b",
            r"\bfellow(?:s)?\b(?!\s+artists)",  # "fellow" but not "fellow artists"
        ],
    ),
    (
        "grant",
        [
            r"\bgrants?\b",
            r"\bfunding\s+opportunit",
            r"\bprize\s+money\b",
            r"\bstipend\b",
            r"\baward(?:s|ing)?\b(?!\s*(?:winning|show|exhibition|ceremony))",
        ],
    ),
    (
        "commission",
        [
            r"\bcommission(?:ed|ing)?\b",
            r"\bpublic\s+art\s+(?:project|rfp|request|proposal)\b",
            r"\brequest\s+for\s+(?:proposal|qualifications)\b",
            r"\bRFP\b",
            r"\bRFQ\b",
        ],
    ),
    (
        "exhibition_proposal",
        [
            r"\bproposal\s+for\s+(?:exhibition|show)\b",
            r"\bcurator(?:ial)?\s+(?:proposal|call|pitch)\b",
        ],
    ),
    # "submission" is the broad default — matched by festival, juried show, open call, etc.
    (
        "submission",
        [
            r"\bjuried\b",
            r"\bfestival\b",
            r"\bopen\s+call\b",
            r"\bcall\s+for\s+(?:entr|artist|submission|work|art)\b",
            r"\bsubmit\b",
            r"\bcompetition\b",
            r"\bcontest\b",
            r"\bexhibition\b",
            r"\bexhibit\b",
            r"\bshow\b",
        ],
    ),
]


def _infer_call_type(title: str, description: str) -> str:
    """
    Infer call_type from combined title + description text.
    Defaults to "submission" — the most common type on EntryThingy.
    """
    combined = (title + " " + (description or "")).lower()
    for call_type, patterns in _TYPE_PATTERNS:
        if any(re.search(pat, combined) for pat in patterns):
            return call_type
    return "submission"


# ---------------------------------------------------------------------------
# Scope inference
# ---------------------------------------------------------------------------

_INTL_KEYWORDS = [
    r"\binternational\b",
    r"\bworldwide\b",
    r"\bglobal\b",
    r"\bopen\s+to\s+all\s+(?:artists|countries)\b",
]


def _infer_scope(country: str, title: str, description: str) -> str:
    """
    Determine metadata.scope: "international" or "national".

    Rules:
    - Non-US/non-blank country code → international
    - US + international keywords in title/desc → international
    - Default → national (EntryThingy is predominantly US-based)
    """
    country_upper = (country or "").strip().upper()

    # Non-blank, non-US country → international
    if country_upper and country_upper not in _US_COUNTRY_CODES:
        return "international"

    # US call but explicitly international scope
    combined = (title + " " + (description or "")).lower()
    if any(re.search(pat, combined) for pat in _INTL_KEYWORDS):
        return "international"

    return "national"


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline(iso_string: Optional[str]) -> Optional[str]:
    """
    Convert an ISO 8601 deadline string with timezone offset to 'YYYY-MM-DD'.

    EntryThingy deadlines look like: "2026-03-31T23:59:00-07:00"
    We convert to UTC then take the date, which is safe since deadlines are
    usually midnight in a US timezone — the UTC date is accurate enough.

    Returns None if absent or malformed.
    """
    if not iso_string:
        return None

    # Fast path: extract date part directly (close enough for deadline purposes)
    m = re.match(r"(\d{4}-\d{2}-\d{2})", iso_string)
    if m:
        return m.group(1)

    return None


def _is_past_deadline(deadline_iso: Optional[str]) -> bool:
    """Return True if the deadline date has already passed (strictly before today)."""
    if not deadline_iso:
        return False
    try:
        dl = date.fromisoformat(deadline_iso)
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Fee extraction
# ---------------------------------------------------------------------------


def _extract_fee(is_free: bool, offer_price) -> Optional[float]:
    """
    Determine application fee from JSON-LD offer fields.

    Logic:
      isAccessibleForFree=True  → fee=0.0 (free, unambiguous)
      isAccessibleForFree=False, offers.price > 0 → that price (USD assumed)
      isAccessibleForFree=False, offers.price = 0 → fee=None (fee exists, amount unknown)
    """
    if is_free:
        return 0.0

    if offer_price is not None:
        try:
            price = float(offer_price)
            if price > 0:
                return price
        except (TypeError, ValueError):
            pass

    # False + price=0: fee structure exists but amount not specified in JSON-LD
    return None


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://app.entrythingy.com/calls_list/",
        }
    )
    return session


def _fetch_page(session: requests.Session, page_num: int) -> Optional[str]:
    """Fetch one paginated listing page. Returns raw HTML or None on failure."""
    url = BASE_LIST_URL if page_num == 1 else f"{BASE_LIST_URL}?page={page_num}"
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("EntryThingy: failed to fetch page %d: %s", page_num, exc)
        return None


# ---------------------------------------------------------------------------
# JSON-LD extraction
# ---------------------------------------------------------------------------

_JSON_LD_RE = re.compile(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.DOTALL,
)


def _parse_json_ld_page(html: str) -> tuple[list[dict], bool]:
    """
    Extract ItemList entries from the page's JSON-LD block.

    Returns:
      (items_list, has_next_page)
      items_list: list of raw Event dicts from itemListElement[].item
      has_next_page: True if a rel="next" link was found in the HTML head
    """
    import json

    has_next = 'rel="next"' in html or "rel='next'" in html

    match = _JSON_LD_RE.search(html)
    if not match:
        logger.debug("EntryThingy: no JSON-LD script tag found on page")
        return [], has_next

    try:
        data = json.loads(match.group(1))
    except ValueError as exc:
        logger.warning("EntryThingy: failed to parse JSON-LD: %s", exc)
        return [], has_next

    try:
        items_raw = data["mainEntity"]["itemListElement"]
        # Each element is {"@type": "ListItem", "position": N, "item": {...Event...}}
        items = [
            entry["item"]
            for entry in items_raw
            if isinstance(entry, dict) and "item" in entry
        ]
        return items, has_next
    except (KeyError, TypeError) as exc:
        logger.warning("EntryThingy: unexpected JSON-LD structure: %s", exc)
        return [], has_next


# ---------------------------------------------------------------------------
# Single call builder
# ---------------------------------------------------------------------------


def _build_call_data(ev: dict, source_id: int) -> Optional[dict]:
    """
    Convert one EntryThingy JSON-LD Event object into a call_data dict ready
    for insert_open_call(), or return None if the call should be skipped.
    """
    title = (ev.get("name") or "").strip()
    if not title:
        logger.debug("EntryThingy: skipping entry with no title")
        return None

    # source_url is the EntryThingy detail page; also use as application_url
    # since EntryThingy redirects to the actual application from its detail page
    source_url = (ev.get("url") or "").strip()
    if not source_url:
        logger.debug("EntryThingy: skipping %r — no URL", title[:60])
        return None

    # application_url = same as source_url for EntryThingy (it's the submission gateway)
    application_url = source_url

    # Deadline
    deadline = _parse_deadline(ev.get("registrationDeadline") or ev.get("validThrough"))
    if _is_past_deadline(deadline):
        logger.debug(
            "EntryThingy: skipping %r — deadline %s already passed",
            title[:60],
            deadline,
        )
        return None

    # Description (truncated in JSON-LD to ~200 chars — that's all we get)
    description = (ev.get("description") or "").strip() or None
    if description:
        description = description[:2000]

    # Fee
    is_free = bool(ev.get("isAccessibleForFree", False))
    offers = ev.get("offers") or {}
    offer_price = offers.get("price")
    fee = _extract_fee(is_free, offer_price)

    # Location
    location = ev.get("location") or {}
    address = location.get("address") or {}
    loc_city = (address.get("addressLocality") or "").strip()
    loc_region = (address.get("addressRegion") or "").strip()
    loc_country = (address.get("addressCountry") or "").strip()
    loc_display = location.get("name") or ""

    # Clean up "None" string that appears when city is missing
    if loc_city.lower() == "none":
        loc_city = ""

    # Organizer
    organizer = ev.get("organizer") or {}
    org_name = (organizer.get("name") or "").strip() or "entrythingy"
    # Unescape HTML entities in org names (e.g. "Arts &amp; Crafts" → "Arts & Crafts")
    org_name = (
        org_name.replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", '"')
    )

    # Call type (inferred — no explicit type field in JSON-LD)
    call_type = _infer_call_type(title, description or "")

    # Geographic scope
    scope = _infer_scope(loc_country, title, description or "")

    # Eligibility — EntryThingy is predominantly US-based open calls
    eligibility = "International" if scope == "international" else "National"

    return {
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
        "_org_name": org_name,
        "metadata": {
            "source": "entrythingy",
            "organization": org_name,
            "location_city": loc_city,
            "location_region": loc_region,
            "location_country": loc_country,
            "location_display": loc_display,
            "is_free": is_free,
            "scope": scope,
        },
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl EntryThingy open calls board.

    Strategy:
      1. Fetch pages sequentially starting at page 1.
      2. Each page embeds 50 calls in a JSON-LD ItemList block.
      3. Continue until a page returns 0 items OR no rel="next" link is found.
      4. Skip calls with past deadlines.
      5. Insert or update each call via insert_open_call().

    Returns (found, new, updated).

      found   = calls that passed deadline filter (eligible to insert)
      new     = successfully inserted (new rows)
      updated = 0 (insert_open_call handles updates transparently via hash dedup)
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()
    seen_urls: set[str] = set()

    for page_num in range(1, MAX_PAGES + 1):
        if page_num > 1:
            time.sleep(PAGE_DELAY)

        html = _fetch_page(session, page_num)
        if not html:
            logger.warning("EntryThingy: failed to fetch page %d — stopping", page_num)
            break

        items, has_next = _parse_json_ld_page(html)

        if not items:
            logger.info(
                "EntryThingy: page %d returned 0 items — crawl complete", page_num
            )
            break

        logger.info(
            "EntryThingy: page %d — %d items (has_next=%s)",
            page_num,
            len(items),
            has_next,
        )

        for ev in items:
            url = (ev.get("url") or "").strip()

            # Deduplicate within run (shouldn't happen but be safe)
            if url and url in seen_urls:
                continue
            if url:
                seen_urls.add(url)

            call_data = _build_call_data(ev, source_id)
            if call_data is None:
                continue

            found += 1
            result = insert_open_call(call_data)
            if result:
                new += 1

        # Stop if no next page signal and we've seen a full page
        # (allows for the last page having fewer than 50 items)
        if not has_next:
            logger.info(
                "EntryThingy: no next-page link on page %d — stopping", page_num
            )
            break

    logger.info(
        "EntryThingy: crawl complete — %d found (eligible), %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
