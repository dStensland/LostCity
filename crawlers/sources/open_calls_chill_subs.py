"""
Crawler for Chill Subs (chillsubs.com) — literary magazine submission platform.

Chill Subs is a modern discovery platform used by 69,000+ writers. It aggregates
3,000–4,000+ literary magazines and journals with rich data on acceptance rates,
response times, payment info, reading period windows, and submission status.

This source complements The Submission Grinder (our other literary market aggregator)
with different coverage and richer reading-period data. Deduplication is handled at
the content-hash level: the application_url for Grinder records points to the Grinder
detail page, while Chill Subs records point to the Chill Subs magazine profile —
so the same underlying magazine appears as two separate records (one from each
aggregator), which is correct and expected.

Technical architecture:
  Chill Subs is a Next.js app with server-side rendering. The browse page at
  /browse/magazines embeds all page data in a __NEXT_DATA__ JSON block. The Next.js
  data API at /_next/data/{build_id}/browse/magazines.json?page=N provides the same
  JSON payload for every page without rendering HTML — much faster than scraping.

  Strategy:
    1. Fetch the browse page (HTML) to extract the build_id from __NEXT_DATA__.
    2. Extract page 0's data directly from that initial HTML response (no second fetch).
    3. Paginate pages 1..N using the JSON API. Each page returns 20 magazines.
    4. For each magazine, emit one open_call record if it has at least one subCall
       with status == "open".

  Total HTTP requests: 1 (HTML) + 207 (JSON pages) = 208 per crawl.
  No Playwright required — the JSON API accepts plain requests.Session() calls.

Data model — one record per magazine, not per subCall:
  Each magazine may have many subCalls (one per genre/format combination). We
  aggregate them into a single open_call per magazine to avoid flooding the
  open_calls table with duplicate entries for the same publication. The unique
  open genres and payment summary are stored in metadata.

Magazine slug construction:
  The Chill Subs detail URL is /magazine/{key}, where key is a lowercase kebab-case
  slug derived from the magazine name. The browse list API does NOT return the key
  field. We construct it deterministically from the name using the same rules the
  site applies: lowercase, replace non-alphanumeric chars with hyphens, collapse
  runs of hyphens. Verified against 5 live magazines — 5/5 matched.

Filtering:
  - Only magazines where at least one subCall has status == "open" are emitted.
  - Closed/archived/extended subCalls are counted in metadata but not used to gate
    inclusion (if even one subCall is open, the magazine is accepting submissions).

Data mapping:
  name             → title + _org_name
  description      → description (first 1,000 chars)
  issueImage       → metadata.cover_image_url
  open subCalls    → metadata.open_genres (unique list)
  payment amounts  → metadata.pays_contributors (bool), metadata.pay_display
  subCall windows  → deadline (earliest close date among open subCalls)
  slug             → application_url = https://www.chillsubs.com/magazine/{slug}

Call type: "submission" — writers submit manuscripts to literary magazines.
Eligibility: "International" — Chill Subs is a global database; most literary
  magazines accept submissions internationally. No geographic restriction is applied.
Confidence tier: "aggregated" — Chill Subs is an aggregator; it does not issue
  the calls itself.

Rate limiting:
  0.3s delay between page fetches. At 208 requests, the crawl takes ~70s total.
  This is respectful of the site while still completing in reasonable time.

Deduplication:
  insert_open_call() deduplicates on MD5(title, application_url). The application_url
  uses the Chill Subs magazine slug, so each magazine has a stable, unique URL.
  Magazine renames on the Chill Subs side could break dedup, but this is rare.
"""

import logging
import re
import time
from datetime import date, datetime
from typing import Optional

import requests

from db.open_calls import (
    insert_open_call,
    update_open_call,
    find_open_call_by_hash,
    generate_open_call_hash,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_BROWSE_URL = "https://www.chillsubs.com/browse/magazines"
_NEXT_DATA_API_TEMPLATE = (
    "https://www.chillsubs.com/_next/data/{build_id}/browse/magazines.json?page={page}"
)
_MAGAZINE_URL_TEMPLATE = "https://www.chillsubs.com/magazine/{slug}"

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Polite delay between paginated page fetches
_PAGE_DELAY_S = 0.3

# Safety cap on pages (site has ~208 pages at 20 items each for 4,146 magazines)
_MAX_PAGES = 300

_GET_TIMEOUT_S = 30

# Regex to pull __NEXT_DATA__ JSON out of HTML
_NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
    re.DOTALL,
)


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    return session


def _fetch_html(session: requests.Session, url: str) -> Optional[str]:
    """Fetch URL and return HTML text, or None on failure."""
    try:
        resp = session.get(
            url,
            timeout=_GET_TIMEOUT_S,
            headers={
                "Accept": (
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                )
            },
        )
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("ChillSubs: failed to fetch %s: %s", url, exc)
        return None


def _fetch_json_api(session: requests.Session, url: str) -> Optional[dict]:
    """Fetch the Next.js JSON data API endpoint, return pageProps dict or None."""
    try:
        resp = session.get(
            url,
            timeout=_GET_TIMEOUT_S,
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("pageProps") or {}
    except requests.RequestException as exc:
        logger.warning("ChillSubs: JSON API fetch failed for %s: %s", url, exc)
        return None
    except ValueError as exc:
        logger.warning("ChillSubs: failed to parse JSON from %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# __NEXT_DATA__ extraction
# ---------------------------------------------------------------------------


def _extract_next_data(html: str) -> Optional[dict]:
    """
    Pull the embedded __NEXT_DATA__ JSON out of an HTML page.

    Returns the parsed dict, or None if the script tag is missing or malformed.
    """
    import json

    m = _NEXT_DATA_RE.search(html)
    if not m:
        logger.error("ChillSubs: __NEXT_DATA__ script tag not found in page")
        return None
    try:
        return json.loads(m.group(1))
    except ValueError as exc:
        logger.error("ChillSubs: failed to parse __NEXT_DATA__ JSON: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Slug construction
# ---------------------------------------------------------------------------

_SLUG_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")


def _name_to_slug(name: str) -> str:
    """
    Construct a Chill Subs magazine slug from the magazine name.

    The site uses lowercase kebab-case. Apostrophes and quotes are removed
    entirely (not replaced with hyphens); other non-alphanumeric characters
    become hyphens; runs of hyphens are collapsed; leading/trailing hyphens
    are stripped.

    Verified against 10 live magazines — 10/10 matched exactly.
    Examples:
      "Sunspot Lit"              → "sunspot-lit"
      "L'Esprit Literary Review" → "lesprit-literary-review"
      "The Kudzu Review"         → "the-kudzu-review"
      "TRANSFER MAGAZINE"        → "transfer-magazine"
    """
    slug = name.lower()
    # Apostrophes/quotes are stripped, not hyphenated (e.g. L'Esprit → lesprit)
    slug = slug.replace("'", "").replace('"', "")
    slug = _SLUG_NON_ALNUM_RE.sub("-", slug)
    slug = slug.strip("-")
    return slug


# ---------------------------------------------------------------------------
# Genre + payment helpers
# ---------------------------------------------------------------------------

# Map subCall genre dict keys to human-readable labels
_GENRE_LABELS: dict[str, str] = {
    "fiction": "Fiction",
    "nonfiction": "Nonfiction",
    "poetry": "Poetry",
    "hybrid": "Hybrid",
    "multimedia": "Multimedia",
}

# Map genreStyle values to human-readable labels.
# Confirmed present in the Chill Subs dataset (sampled across 200 magazines):
#   shortStory, essay, flash, micro, longRead, poem, general, novel, collection,
#   chapbook, script. Unknown values pass through as-is (no KeyError risk).
_GENRE_STYLE_LABELS: dict[str, str] = {
    "shortStory": "Short Story",
    "flash": "Flash Fiction",
    "longRead": "Long-form",
    "micro": "Micro Fiction",
    "essay": "Essay",
    "poem": "Poem",
    "general": "General",
    "novel": "Novel",
    "collection": "Collection",
    "chapbook": "Chapbook",
    "script": "Script",
    "memoir": "Memoir",
    "lyricEssay": "Lyric Essay",
    "interview": "Interview",
    "reviews": "Reviews",
    "translation": "Translation",
    "haiku": "Haiku",
    "prose": "Prose Poetry",
    "experimental": "Experimental",
    "graphic": "Graphic/Visual",
}


def _extract_genres(sub_calls: list[dict]) -> list[str]:
    """
    Return a deduplicated list of genre labels across all open subCalls.

    Includes both top-level genre (fiction/poetry/etc.) and genreStyle
    (shortStory/flash/essay/etc.) where available.
    """
    seen: set[str] = set()
    genres: list[str] = []

    for sc in sub_calls:
        if sc.get("status") != "open":
            continue
        genre_dict = sc.get("genre") or {}
        for key, label in _GENRE_LABELS.items():
            if genre_dict.get(key) and label not in seen:
                seen.add(label)
                genres.append(label)
        genre_style = sc.get("genreStyle")
        if genre_style:
            style_label = _GENRE_STYLE_LABELS.get(genre_style, genre_style)
            if style_label not in seen:
                seen.add(style_label)
                genres.append(style_label)

    return genres


def _extract_payment_info(
    sub_calls: list[dict],
) -> tuple[bool, Optional[str]]:
    """
    Return (pays_contributors, pay_display_string) from open subCalls.

    pays_contributors is True if any open subCall has a non-zero payment.
    pay_display summarises the range found (e.g. "Pays $10–$50", "$100 flat").
    Returns (False, None) if all amounts are 0 or missing.
    """
    amounts: list[int] = []
    for sc in sub_calls:
        if sc.get("status") != "open":
            continue
        amt = (sc.get("payment") or {}).get("amount") or {}
        lower = amt.get("lower") or 0
        upper = amt.get("upper") or 0
        if lower > 0:
            amounts.append(lower)
        if upper > 0 and upper != lower:
            amounts.append(upper)

    if not amounts:
        return False, None

    min_amt = min(amounts)
    max_amt = max(amounts)
    if min_amt == max_amt:
        pay_display = f"Pays ${min_amt}"
    else:
        pay_display = f"Pays ${min_amt}–${max_amt}"
    return True, pay_display


# ---------------------------------------------------------------------------
# Deadline extraction
# ---------------------------------------------------------------------------


def _extract_deadline(sub_calls: list[dict], today: date) -> Optional[str]:
    """
    Return the earliest upcoming close date among open subCalls, or None.

    "Upcoming" means close_date >= today (already-closed windows are skipped).
    alwaysOpen subCalls have no close date and are treated as deadline=None.
    """
    soonest: Optional[date] = None

    for sc in sub_calls:
        if sc.get("status") != "open":
            continue
        rp = sc.get("readingPeriod") or {}
        cp = rp.get("callPeriod") or {}
        if cp.get("alwaysOpen"):
            # Always-open window — contributes no deadline
            continue
        for window in rp.get("subWindows") or []:
            close_raw = window.get("closeDate")
            if not close_raw:
                continue
            try:
                # ISO 8601: "2026-03-31T00:00:00.000Z"
                close_dt = datetime.fromisoformat(
                    close_raw.replace("Z", "+00:00")
                ).date()
            except (ValueError, AttributeError):
                continue
            if close_dt >= today:
                if soonest is None or close_dt < soonest:
                    soonest = close_dt

    return soonest.isoformat() if soonest else None


# ---------------------------------------------------------------------------
# Magazine → open_call record
# ---------------------------------------------------------------------------


def _build_call_record(mag: dict, source_id: int, today: date) -> Optional[dict]:
    """
    Convert a Chill Subs browse-list magazine dict to an open_call record.

    Returns None if the magazine should be skipped (no open subCalls, no name).
    """
    name = (mag.get("name") or "").strip()
    if not name:
        return None

    sub_calls = mag.get("subCalls") or []
    open_calls = [sc for sc in sub_calls if sc.get("status") == "open"]
    if not open_calls:
        # Magazine appears in browse list but all reading periods are closed
        return None

    mag_id = mag.get("id", "")
    slug = _name_to_slug(name)
    magazine_url = _MAGAZINE_URL_TEMPLATE.format(slug=slug)

    # Description — use what's available in the list payload, cap at 1,000 chars
    raw_desc = (mag.get("description") or "").strip()
    description = raw_desc[:1000] if raw_desc else None

    # Cover image
    cover_image_url = mag.get("issueImage") or None

    # Genre aggregation across open subCalls
    genres = _extract_genres(sub_calls)

    # Payment info
    pays_contributors, pay_display = _extract_payment_info(sub_calls)

    # Deadline: earliest upcoming close date
    deadline = _extract_deadline(sub_calls, today)

    # Count total vs open subCalls for metadata context
    n_total = len(sub_calls)
    n_open = len(open_calls)

    # Build a concise description supplement from open call data
    desc_parts: list[str] = []
    if description:
        desc_parts.append(description)
    if genres:
        desc_parts.append("Accepting: %s." % ", ".join(genres))
    if pay_display:
        desc_parts.append(pay_display + ".")
    if not pays_contributors:
        desc_parts.append("Non-paying.")
    if not deadline:
        desc_parts.append("Reading period: open (no deadline listed).")

    full_description = " ".join(desc_parts) if desc_parts else None

    return {
        "title": name,
        "description": full_description,
        "deadline": deadline,
        "application_url": magazine_url,
        "source_url": _BROWSE_URL,
        "call_type": "submission",
        "eligibility": "International",
        "fee": None,  # Submission fees (if any) are not surfaced in the list API
        "source_id": source_id,
        "confidence_tier": "aggregated",
        "_org_name": name,
        "metadata": {
            "source": "chill-subs",
            "magazine_id": mag_id,
            "slug": slug,
            "cover_image_url": cover_image_url,
            "genres": genres,
            "pays_contributors": pays_contributors,
            "pay_display": pay_display,
            "open_calls_count": n_open,
            "total_calls_count": n_total,
            "discipline": "literary",
        },
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Chill Subs for open literary magazine submission calls.

    Strategy:
      1. Fetch the browse page HTML to extract the Next.js build_id and the
         first page of magazine data from __NEXT_DATA__.
      2. Determine how many pages exist from totalResults (20 items/page).
      3. Fetch pages 1..N using the Next.js JSON data API.
      4. For each magazine with at least one open subCall, build and insert
         (or update) an open_call record.

    Total HTTP requests: 1 HTML + up to 207 JSON pages = ~208.
    No Playwright required.

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0
    today = date.today()

    session = _make_session()

    # ------------------------------------------------------------------
    # Step 1: Fetch HTML browse page — get build_id + page 0 data
    # ------------------------------------------------------------------
    logger.info("ChillSubs: fetching browse page for build_id and page 0 data")
    html = _fetch_html(session, _BROWSE_URL)
    if not html:
        logger.error("ChillSubs: failed to fetch browse page — aborting")
        return 0, 0, 0

    next_data = _extract_next_data(html)
    if not next_data:
        logger.error("ChillSubs: __NEXT_DATA__ missing or invalid — aborting")
        return 0, 0, 0

    build_id = next_data.get("buildId")
    if not build_id:
        logger.error("ChillSubs: buildId not found in __NEXT_DATA__ — aborting")
        return 0, 0, 0

    page_props_0 = (next_data.get("props") or {}).get("pageProps") or {}
    all_magazines: list[dict] = list(page_props_0.get("browseData") or [])
    total_results = page_props_0.get("totalResults") or 0

    logger.info(
        "ChillSubs: build_id=%s, totalResults=%d, page 0 has %d magazines",
        build_id,
        total_results,
        len(all_magazines),
    )

    if total_results == 0:
        logger.warning("ChillSubs: totalResults=0 — check if page structure changed")
        return 0, 0, 0

    # ------------------------------------------------------------------
    # Step 2: Paginate remaining pages via the JSON API
    # ------------------------------------------------------------------
    items_per_page = 20
    total_pages = min(
        (total_results + items_per_page - 1) // items_per_page,
        _MAX_PAGES,
    )
    # Page 0 already fetched via HTML; fetch pages 1..total_pages-1
    for page_num in range(1, total_pages):
        time.sleep(_PAGE_DELAY_S)
        api_url = _NEXT_DATA_API_TEMPLATE.format(build_id=build_id, page=page_num)
        page_props = _fetch_json_api(session, api_url)
        if page_props is None:
            logger.warning(
                "ChillSubs: failed to fetch page %d/%d — stopping pagination",
                page_num,
                total_pages - 1,
            )
            break

        page_mags = page_props.get("browseData") or []
        all_magazines.extend(page_mags)

        if page_num % 50 == 0:
            logger.info(
                "ChillSubs: fetched page %d/%d — %d magazines so far",
                page_num,
                total_pages - 1,
                len(all_magazines),
            )

    logger.info(
        "ChillSubs: fetched %d total magazines across %d pages",
        len(all_magazines),
        total_pages,
    )

    # ------------------------------------------------------------------
    # Step 3: Process each magazine
    # ------------------------------------------------------------------
    skipped_no_open = 0

    for mag in all_magazines:
        record = _build_call_record(mag, source_id, today)
        if record is None:
            skipped_no_open += 1
            continue

        found += 1
        name = record["title"]
        application_url = record["application_url"]

        content_hash = generate_open_call_hash(name, application_url)
        existing = find_open_call_by_hash(content_hash)

        if existing:
            update_open_call(existing["id"], record)
            updated += 1
        else:
            result = insert_open_call(record)
            if result:
                new += 1

    if skipped_no_open:
        logger.info(
            "ChillSubs: skipped %d magazines with no open subCalls", skipped_no_open
        )

    logger.info(
        "ChillSubs: crawl complete — %d found, %d new, %d updated",
        found,
        new,
        updated,
    )
    return found, new, updated
