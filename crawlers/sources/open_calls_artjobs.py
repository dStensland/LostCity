"""
Crawler for ArtJobs.com open calls (artjobs.com/open-calls).

ArtJobs is the single largest open-calls aggregator we've found, with
6,500+ listings across 653 pages. Organizations post directly on the
platform; it is an aggregator, not a primary source. Confidence tier:
"aggregated".

Crawl strategy — index-only, static HTML (no Playwright, no detail fetches):

  ArtJobs runs on Drupal. The paginated index at /open-calls uses
  zero-based page numbering:
    page 0  → https://www.artjobs.com/open-calls           (or ?page=0)
    page 1  → https://www.artjobs.com/open-calls?page=1
    ...
    page 652 → https://www.artjobs.com/open-calls?page=652

  Each page renders up to 10 <div class="views-row"> elements. The index
  carries enough data for a high-quality open_call record:
    div.basicjobtitle > a   — title text + detail URL
    div.basicjobemployer    — organization name
    div.tablecity           — location string (city, country etc.)
    div.views-field-body    — short description snippet
    Text matching "Deadline DD/Month/YYYY" somewhere in the row

  Detail page URLs encode the call category in the path:
    /open-calls/call-artists/<location>/<id>/<slug>
    /open-calls/residency/<location>/<id>/<slug>
    /open-calls/grant/<location>/<id>/<slug>
    etc.
  This gives us the call_type for free without an extra fetch.

Early-stop logic:
  Because ArtJobs lists newest first (and the oldest pages are entirely
  expired), we stop pagination as soon as every listing on a page is
  past-deadline. This keeps the crawl fast even though the index has 653
  pages — in practice we only read the first 30-80 pages before hitting
  the expired band.

  An additional safety cap of MAX_PAGES = 200 prevents runaway crawls.

Type mapping from URL path segment:
  call-artists / call-entries     → submission
  residency / artist-residency    → residency
  grant / grants                  → grant
  fellowship                      → fellowship
  commission / public-art         → commission
  (anything else)                 → submission  (safe default)

Rate limiting:
  0.3s between page fetches — Drupal sites handle load well and our
  index-only approach keeps the request count low.
"""

import logging
import re
import time
from datetime import date, datetime
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.open_calls import insert_open_call

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BASE_URL = "https://www.artjobs.com"
INDEX_URL = "https://www.artjobs.com/open-calls"

# Safety cap on pages crawled (10 listings/page → up to 2 000 listings)
MAX_PAGES = 200

# Seconds between page requests
PAGE_DELAY = 0.3

REQUEST_TIMEOUT = 30

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Map URL path segment → call_type (checked with startswith after splitting)
_URL_TYPE_MAP: list[tuple[str, str]] = [
    ("call-artists", "submission"),
    ("call-entries", "submission"),
    ("artist-residency", "residency"),
    ("residency", "residency"),
    ("grants", "grant"),
    ("grant", "grant"),
    ("fellowship", "fellowship"),
    ("public-art", "commission"),
    ("commission", "commission"),
]

# ArtJobs deadline text: "Deadline 23/April/2026"
# Month is written as a full English month name (capitalised, but we match
# case-insensitively).
_DEADLINE_RE = re.compile(
    r"Deadline\s+"
    r"(\d{1,2})"
    r"/"
    r"(january|february|march|april|may|june|july|august|"
    r"september|october|november|december)"
    r"/"
    r"(\d{4})",
    re.I,
)

_MONTH_MAP: dict[str, int] = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
}


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": _USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": BASE_URL + "/",
        }
    )
    return session


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return HTML, or None on failure."""
    try:
        resp = session.get(url, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("ArtJobs: failed to fetch %s: %s", url, exc)
        return None


def _page_url(page_num: int) -> str:
    """Return the URL for zero-based page_num."""
    if page_num == 0:
        return INDEX_URL
    return f"{INDEX_URL}?page={page_num}"


# ---------------------------------------------------------------------------
# Deadline parsing
# ---------------------------------------------------------------------------


def _parse_deadline(text: str) -> Optional[str]:
    """
    Parse 'Deadline DD/Month/YYYY' from a block of text.

    Returns 'YYYY-MM-DD', or None if no valid deadline is found.
    """
    m = _DEADLINE_RE.search(text)
    if not m:
        return None
    try:
        day = int(m.group(1))
        month = _MONTH_MAP.get(m.group(2).lower(), 0)
        year = int(m.group(3))
        if not month:
            return None
        # Validate the date is real (e.g. not 31 February)
        datetime(year, month, day)
        return f"{year}-{month:02d}-{day:02d}"
    except (ValueError, TypeError):
        return None


def _is_past_deadline(deadline: Optional[str]) -> bool:
    """Return True if deadline has already passed."""
    if not deadline:
        return False
    try:
        dl = datetime.strptime(deadline, "%Y-%m-%d").date()
        return dl < date.today()
    except ValueError:
        return False


# ---------------------------------------------------------------------------
# Call type inference from detail URL
# ---------------------------------------------------------------------------


def _call_type_from_url(url: str) -> str:
    """
    Infer call_type from the category segment of the ArtJobs detail URL.

    URL pattern: /open-calls/<category>/<location>/<id>/<slug>

    Checks each known category string (longest-match order) against the
    path segments. Falls back to "submission" (the dominant type on ArtJobs).
    """
    # Normalise and strip the base prefix
    path = url.lower()
    prefix = "/open-calls/"
    idx = path.find(prefix)
    if idx == -1:
        return "submission"
    remainder = path[idx + len(prefix):]
    # First segment is the category
    first_segment = remainder.split("/")[0].strip()

    for url_segment, call_type in _URL_TYPE_MAP:
        if first_segment == url_segment:
            return call_type

    return "submission"


# ---------------------------------------------------------------------------
# Index page parser
# ---------------------------------------------------------------------------


def _parse_index_page(html: str) -> list[dict]:
    """
    Parse one ArtJobs /open-calls index page.

    ArtJobs uses a Drupal table layout:
      <tr class="odd|even">
        <td class="views-field-field-image">        — thumbnail + link
        <td class="views-field-field-category-addapost"> — category, org, location
        <td class="opencalltitle">                   — title link + deadline span
      </tr>

    Returns a list of raw listing dicts with keys:
      title, detail_url, call_type, deadline, org_name, location, description
    """
    soup = BeautifulSoup(html, "html.parser")
    # Listings are <tr> elements with "odd" or "even" class
    rows = soup.find_all("tr", class_=lambda c: c and ("odd" in c or "even" in c))
    listings: list[dict] = []

    for row in rows:
        # --- Title + detail URL ---
        title_td = row.find("td", class_="opencalltitle")
        if not title_td:
            continue
        link = title_td.find("a", href=True)
        if not link:
            continue

        title = link.get_text(strip=True)
        if not title:
            continue

        href = link["href"]
        detail_url = href if href.startswith("http") else BASE_URL + href

        # --- Call type (from URL path) ---
        call_type = _call_type_from_url(detail_url)

        # --- Organization + Location from category TD ---
        # The category TD contains text nodes: category, org name, city (separated by <p>)
        cat_td = row.find("td", class_="views-field-field-category-addapost")
        org_name = ""
        location = ""
        if cat_td:
            # Text parts are separated by <p> tags: [category, org, city, Views:...]
            parts = [p.strip() for p in cat_td.get_text(separator="|").split("|") if p.strip()]
            # parts[0] = category (e.g. "Call for Artists"), parts[1] = org, parts[2] = city
            if len(parts) >= 2:
                org_name = parts[1]
            if len(parts) >= 3:
                location = parts[2]

        # --- Deadline: prefer structured date span, fall back to regex ---
        deadline = None
        date_span = title_td.find("span", class_="date-display-single")
        if date_span and date_span.get("content"):
            # ISO 8601: "2026-04-23T00:00:00+01:00"
            iso_str = date_span["content"][:10]  # "YYYY-MM-DD"
            try:
                datetime.strptime(iso_str, "%Y-%m-%d")
                deadline = iso_str
            except ValueError:
                pass
        if not deadline:
            # Fallback to regex on row text
            row_text = row.get_text(separator=" ")
            deadline = _parse_deadline(row_text)

        listings.append(
            {
                "title": title,
                "detail_url": detail_url,
                "call_type": call_type,
                "deadline": deadline,
                "org_name": org_name,
                "location": location,
                "description": "",  # No description on index; title is sufficient
            }
        )

    return listings


def _has_more_pages(soup: BeautifulSoup) -> bool:
    """
    Return True when ArtJobs pagination shows a 'next page' link.

    Drupal renders a pager with class 'pager'. The 'next' item has class
    'pager-next'. When absent or disabled (last page), we stop.
    """
    pager = soup.find(class_=re.compile(r"\bpager\b"))
    if not pager:
        return False
    next_item = pager.find(class_=re.compile(r"\bpager-next\b"))
    return next_item is not None


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl ArtJobs open calls index.

    Strategy:
      1. Fetch pages 0..MAX_PAGES-1 of /open-calls.
      2. Parse each <div class="views-row"> for title, org, location, deadline,
         description snippet, and call type (from detail URL path).
      3. Skip listings whose deadline has already passed.
      4. Stop pagination as soon as an entire page is past-deadline — the
         index shows newest first, so this signals we've reached the stale band.
      5. Insert eligible listings via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0

    session = _make_session()

    page_num = 0
    pages_crawled = 0
    consecutive_all_expired = 0

    while page_num < MAX_PAGES:
        url = _page_url(page_num)
        logger.debug("ArtJobs: fetching page %d — %s", page_num, url)

        if page_num > 0:
            time.sleep(PAGE_DELAY)

        html = _fetch(url, session)
        if not html:
            logger.error(
                "ArtJobs: failed to fetch page %d — stopping pagination", page_num
            )
            break

        soup = BeautifulSoup(html, "html.parser")
        listings = _parse_index_page(html)
        pages_crawled += 1

        if not listings:
            logger.info(
                "ArtJobs: page %d returned 0 listings — stopping", page_num
            )
            break

        logger.debug(
            "ArtJobs: page %d — %d listings found", page_num, len(listings)
        )

        # Check if the entire page is expired
        active_on_page = [r for r in listings if not _is_past_deadline(r["deadline"])]
        expired_on_page = len(listings) - len(active_on_page)

        if expired_on_page == len(listings):
            # Every listing on this page is expired — we've hit the stale band.
            # ArtJobs lists by recency so everything deeper will also be expired.
            consecutive_all_expired += 1
            logger.info(
                "ArtJobs: page %d — all %d listings expired; "
                "stopping pagination (hit stale band)",
                page_num,
                len(listings),
            )
            break
        else:
            consecutive_all_expired = 0

        for listing in listings:
            title = listing["title"]
            deadline = listing["deadline"]
            detail_url = listing["detail_url"]

            # Skip expired
            if _is_past_deadline(deadline):
                logger.debug(
                    "ArtJobs: skipping %r — deadline %s passed",
                    title[:60],
                    deadline,
                )
                continue

            # Skip if we somehow have no application URL or no call type
            if not detail_url:
                logger.debug("ArtJobs: skipping %r — no detail URL", title[:60])
                continue

            call_type = listing["call_type"]
            org_name = listing["org_name"] or "artjobs"
            location = listing["location"]
            description = listing["description"] or None

            # Build org slug for slug generation
            org_slug = re.sub(r"[^a-z0-9]+", "-", org_name.lower()).strip("-")[:40]

            call_data: dict = {
                "title": title,
                "description": description,
                "deadline": deadline,
                # ArtJobs is an index aggregator; the detail page IS the
                # application destination (artists register/apply there).
                "application_url": detail_url,
                "source_url": detail_url,
                "call_type": call_type,
                # ArtJobs is global — we record eligibility as international
                # unless the location string suggests otherwise (future work).
                "eligibility": "International",
                "fee": None,  # Not available on the index page
                "source_id": source_id,
                "confidence_tier": "aggregated",
                "_org_name": org_slug,
                "metadata": {
                    "source": "artjobs",
                    "organization": org_name,
                    "location": location,
                    "scope": "international",
                },
            }

            found += 1
            result = insert_open_call(call_data)
            if result:
                new += 1
                logger.debug(
                    "ArtJobs: inserted %r (deadline=%s, type=%s, org=%s)",
                    title[:60],
                    deadline,
                    call_type,
                    org_name[:40],
                )

        # Advance to next page only if pagination link exists
        if not _has_more_pages(soup):
            logger.info(
                "ArtJobs: no next-page link on page %d — pagination complete",
                page_num,
            )
            break

        page_num += 1

    logger.info(
        "ArtJobs: crawl complete — %d pages read, %d found (eligible), "
        "%d new, %d updated",
        pages_crawled,
        found,
        new,
        updated,
    )
    return found, new, updated
