"""
Crawler for Poets & Writers Literary Magazines — open reading periods.

Source pages:
  https://www.pw.org/open-reading-periods          (priority — curated open list)
  https://www.pw.org/literary_magazines?reading_period_status=1  (full DB, open now)

Poets & Writers maintains a database of ~1,000 literary journals and magazines.
The Open Reading Periods page is a curated, continually updated list of all
magazines and small presses currently accepting submissions. It's divided into
two sections:

  1. Magazines/presses with a specific reading window (50–150 entries)
  2. Magazines open year-round, i.e. no reading period cutoff (~459 entries)

The literary magazines database at /literary_magazines supports a
`reading_period_status=1` filter ("Open now") that returns a paginated view
of only currently-open magazines, each with a description excerpt.

Strategy:
  - Crawl the Open Reading Periods page first for the most targeted signal.
  - Then crawl /literary_magazines?reading_period_status=1 for additional
    metadata (description, image).
  - Merge by P&W slug so we don't create duplicates.
  - call_type = "submission" for all entries (these are manuscript submissions).
  - confidence_tier = "aggregated" (P&W aggregates, doesn't issue).
  - eligibility = "International" (most literary magazines accept internationally).

HTML structure — Open Reading Periods page (verified 2026-03-24):
  Drupal View: div.view-id-reading_period

  Section 1 — specific reading windows:
    div.view-display-id-page > div.view-content > div.views-row-*
      span.views-field-title > span.field-content > a           — name + /literary_magazines/{slug}
      span.views-field-type > span.field-content.reading-period-literary_magazine  — type indicator
      span.views-field-field-genres > span.field-content        — genres (text)
      div.views-field-field-reading-period > div.field-content  — date ranges
        span.date-display-range
          span.date-display-start[content="ISO-datetime"]
          span.date-display-end[content="ISO-datetime"]

  Section 2 — open year-round (attachment_1):
    div.view-display-id-attachment_1 > div.view-content > div.views-row-*
      Same structure as section 1, but no date range div (always open).

HTML structure — Literary Magazines database with open-now filter:
  Drupal View: div.view-id-literary_mag
    div.view-content > div.item-list > ul > li.views-row
      h2.field-content.title > a                                — name + /literary_magazines/{slug}
      div.views-field-field-editorial-focus > div.field-content — description excerpt
      div.views-field-field-reading-period
        span.field-content > span.date-display-range            — reading period dates
      span.views-field-field-genres > span.field-content        — genres (comma-separated links)

Date format: ISO 8601 datetime in the `content` attribute of date span elements.
  Example: content="2026-02-01T00:00:00-05:00"
  We take just the date portion (first 10 chars).

Type detection from CSS class on span.field-content inside views-field-type:
  .reading-period-literary_magazine → literary magazine
  .reading-period-small_press       → small press (book publisher)
  Both get call_type="submission" but the distinction is stored in metadata.
"""

import logging
import re
import time
from datetime import date
from typing import Optional

import requests
from bs4 import BeautifulSoup, Tag

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

BASE_URL = "https://www.pw.org"
OPEN_READING_URL = "https://www.pw.org/open-reading-periods"
LIT_MAG_OPEN_URL = "https://www.pw.org/literary_magazines?reading_period_status=1"
LIT_MAG_BASE_URL = "https://www.pw.org/literary_magazines"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Polite delay between page fetches (seconds)
PAGE_FETCH_DELAY_S = 0.5

# Safety cap for pagination (open-now filter returns ~6 pages at time of build)
MAX_PAGES = 30


# ---------------------------------------------------------------------------
# HTTP fetch
# ---------------------------------------------------------------------------


def _fetch(url: str, session: requests.Session) -> Optional[str]:
    """Fetch a URL and return HTML text, or None on failure."""
    try:
        resp = session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.text
    except requests.RequestException as exc:
        logger.warning("PW-Magazines: failed to fetch %s: %s", url, exc)
        return None


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------


def _parse_iso_date(content_attr: str) -> Optional[str]:
    """
    Extract YYYY-MM-DD from a Drupal date content attribute.

    The content attribute contains an ISO 8601 datetime like:
      "2026-02-01T00:00:00-05:00"
    We only need the date portion.
    """
    if not content_attr:
        return None
    # Take the first 10 chars: "YYYY-MM-DD"
    candidate = content_attr.strip()[:10]
    if re.match(r"^\d{4}-\d{2}-\d{2}$", candidate):
        return candidate
    return None


def _extract_reading_periods(
    period_div: Tag,
) -> list[tuple[Optional[str], Optional[str]]]:
    """
    Extract all (start_date, end_date) tuples from a reading period div.

    A magazine may have multiple reading windows in a single period field
    (e.g. "Feb 1 to Mar 31, Aug 1 to Sep 30"). Each window is a
    span.date-display-range containing date-display-start and date-display-end.

    Returns list of (start_iso, end_iso) tuples. Either element may be None
    if the corresponding date span is missing or unparseable.
    """
    if not period_div:
        return []

    ranges = period_div.find_all("span", class_="date-display-range")
    if not ranges:
        return []

    result: list[tuple[Optional[str], Optional[str]]] = []
    for r in ranges:
        start_el = r.find("span", class_="date-display-start")
        end_el = r.find("span", class_="date-display-end")
        start = _parse_iso_date(start_el.get("content", "")) if start_el else None
        end = _parse_iso_date(end_el.get("content", "")) if end_el else None
        result.append((start, end))

    return result


def _is_currently_open(
    periods: list[tuple[Optional[str], Optional[str]]], today: date
) -> bool:
    """
    Return True if any reading period window is currently open.

    A window is open if today >= start AND today <= end.
    A None start means "open from the beginning of time" (treat as open).
    A None end means "open indefinitely" (treat as open).

    An empty periods list means always open (year-round).
    """
    if not periods:
        return True  # no dates specified = always open

    for start_iso, end_iso in periods:
        start_ok = True
        end_ok = True
        if start_iso:
            try:
                start_ok = today >= date.fromisoformat(start_iso)
            except ValueError:
                pass
        if end_iso:
            try:
                end_ok = today <= date.fromisoformat(end_iso)
            except ValueError:
                pass
        if start_ok and end_ok:
            return True

    return False


def _deadline_from_periods(
    periods: list[tuple[Optional[str], Optional[str]]], today: date
) -> Optional[str]:
    """
    Find the soonest end_date among currently-open windows, or the next
    upcoming window's end_date. Used as the `deadline` field in open_calls.

    Returns None if no end dates are defined (always open = no deadline).
    """
    if not periods:
        return None

    # First look for the end date of the currently active window
    for start_iso, end_iso in periods:
        if not end_iso:
            continue
        try:
            end_d = date.fromisoformat(end_iso)
        except ValueError:
            continue

        start_ok = True
        if start_iso:
            try:
                start_ok = today >= date.fromisoformat(start_iso)
            except ValueError:
                pass

        if start_ok and end_d >= today:
            return end_iso

    # No currently-open window with an end date — return None (no deadline)
    return None


# ---------------------------------------------------------------------------
# Description cleaning
# ---------------------------------------------------------------------------


_READ_MORE_RE = re.compile(r"\s*read\s+more\s*$", re.I)


def _clean_description(raw: str) -> str:
    """Strip trailing 'read more' link text and normalize whitespace."""
    text = _READ_MORE_RE.sub("", raw).strip()
    return re.sub(r"\s+", " ", text)[:2000]


# ---------------------------------------------------------------------------
# Open Reading Periods page parser
# ---------------------------------------------------------------------------


def _parse_orp_row(row: Tag) -> Optional[dict]:
    """
    Parse one div.views-row-* from the Open Reading Periods page.

    Returns a dict or None if required fields are missing.
    """
    # Title + P&W slug
    title_span = row.find("span", class_="views-field-title")
    if not title_span:
        return None
    a_tag = title_span.find("a", href=True)
    if not a_tag:
        return None
    name = a_tag.get_text(strip=True)
    if not name:
        return None
    pw_relative = a_tag[
        "href"
    ]  # e.g. /literary_magazines/32_poems or /small_presses/42_miles_press

    # Determine entry type from CSS class on the type indicator span
    type_span = row.find("span", class_=lambda c: c and "reading-period-" in c)
    entity_type = "literary_magazine"  # default
    if type_span:
        classes = " ".join(type_span.get("class", []))
        if "small_press" in classes:
            entity_type = "small_press"

    # Genres
    genre_el = row.find("span", class_="views-field-field-genres")
    genres: list[str] = []
    if genre_el:
        content_el = genre_el.find("span", class_="field-content") or genre_el.find(
            "div", class_="textformatter-list"
        )
        if content_el:
            raw_genres = content_el.get_text(separator=", ", strip=True)
            genres = [g.strip() for g in raw_genres.split(",") if g.strip()]

    # Reading period dates
    period_div = row.find("div", class_="views-field-field-reading-period")
    periods: list[tuple[Optional[str], Optional[str]]] = []
    if period_div:
        content_div = period_div.find("div", class_="field-content")
        if content_div:
            periods = _extract_reading_periods(content_div)

    return {
        "name": name,
        "pw_relative": pw_relative,
        "entity_type": entity_type,
        "genres": genres,
        "periods": periods,
        "description": "",  # ORP page has no description; filled later from DB page
    }


def _parse_orp_page(html: str) -> list[dict]:
    """
    Parse the Open Reading Periods page.

    Returns a combined list of entries from both sections:
    - Section 1 (specific reading windows): div.view-display-id-page
    - Section 2 (open year-round): div.view-display-id-attachment_1
    """
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict] = []

    def _extract_section(view_el: Optional[Tag]) -> list[dict]:
        if not view_el:
            return []
        vc = view_el.find("div", class_="view-content")
        if not vc:
            return []
        entries = []
        for child in vc.children:
            if not isinstance(child, Tag):
                continue
            classes = child.get("class", [])
            if not any("views-row" in c for c in classes):
                continue
            parsed = _parse_orp_row(child)
            if parsed:
                entries.append(parsed)
        return entries

    # Section 1: specific reading period windows
    page_view = soup.find("div", class_="view-display-id-page")
    results.extend(_extract_section(page_view))
    logger.debug(
        "PW-Magazines: ORP section 1 (specific windows): %d entries", len(results)
    )

    # Section 2: open year-round
    attachment_view = soup.find("div", class_="view-display-id-attachment_1")
    year_round = _extract_section(attachment_view)
    logger.debug(
        "PW-Magazines: ORP section 2 (year-round): %d entries", len(year_round)
    )
    results.extend(year_round)

    return results


# ---------------------------------------------------------------------------
# Literary Magazines database parser (open-now filter)
# ---------------------------------------------------------------------------


def _parse_litmag_li(li: Tag) -> Optional[dict]:
    """
    Parse one li.views-row from the /literary_magazines?reading_period_status=1 listing.

    These entries have richer data than ORP rows: description excerpt, image.
    """
    # Title + P&W relative URL
    title_div = li.find("div", class_="views-field-title")
    if not title_div:
        return None
    a_tag = title_div.find("a", href=True)
    if not a_tag:
        return None
    name = a_tag.get_text(strip=True)
    if not name:
        return None
    pw_relative = a_tag["href"]

    # Description excerpt
    desc_div = li.find("div", class_="views-field-field-editorial-focus")
    description = ""
    if desc_div:
        content_div = desc_div.find("div", class_="field-content")
        if content_div:
            description = _clean_description(
                content_div.get_text(separator=" ", strip=True)
            )

    # Reading period
    period_div = li.find("div", class_="views-field-field-reading-period")
    periods: list[tuple[Optional[str], Optional[str]]] = []
    if period_div:
        content_span = period_div.find("span", class_="field-content")
        if content_span:
            periods = _extract_reading_periods(content_span)

    # Genres
    genre_div = li.find("div", class_="views-field-field-genres")
    genres: list[str] = []
    if genre_div:
        content_span = genre_div.find("span", class_="field-content")
        if content_span:
            for a in content_span.find_all("a"):
                g = a.get_text(strip=True)
                if g:
                    genres.append(g)

    # Image (lazy-loaded — data-src attribute)
    img_div = li.find("div", class_="views-field-field-add-image")
    image_url = None
    if img_div:
        img = img_div.find("img", attrs={"data-src": True})
        if img:
            image_url = img["data-src"]

    return {
        "name": name,
        "pw_relative": pw_relative,
        "entity_type": "literary_magazine",
        "genres": genres,
        "periods": periods,
        "description": description,
        "image_url": image_url,
    }


def _parse_litmag_page(html: str) -> tuple[list[dict], Optional[int]]:
    """
    Parse one page of /literary_magazines?reading_period_status=1.

    Returns (entries, last_page_index) where last_page_index is the 0-based
    index of the last paginator page, or None if no pager.
    """
    soup = BeautifulSoup(html, "html.parser")

    view = soup.find("div", class_="view-id-literary_mag")
    if not view:
        logger.warning("PW-Magazines: literary_mag view container not found")
        return [], None

    vc = view.find("div", class_="view-content")
    if not vc:
        return [], None

    item_list = vc.find("div", class_="item-list")
    if not item_list:
        return [], None

    ul = item_list.find("ul")
    if not ul:
        return [], None

    li_items = ul.find_all("li", class_="views-row")
    entries: list[dict] = []
    for li in li_items:
        parsed = _parse_litmag_li(li)
        if parsed:
            entries.append(parsed)

    # Pagination
    last_page: Optional[int] = None
    pager = view.find("ul", class_="pager")
    if pager:
        last_li = pager.find("li", class_="pager-last")
        if last_li:
            last_a = last_li.find("a", href=True)
            if last_a:
                m = re.search(r"page=(\d+)", last_a["href"])
                if m:
                    last_page = int(m.group(1))

    return entries, last_page


# ---------------------------------------------------------------------------
# Merge strategy
# ---------------------------------------------------------------------------


def _merge_entries(orp_entries: list[dict], litmag_entries: list[dict]) -> list[dict]:
    """
    Merge ORP entries with litmag DB entries, using pw_relative as the key.

    ORP entries are the authoritative "currently open" signal. Litmag entries
    provide richer descriptions and images. When a magazine appears in both,
    we use the ORP entry as the base and fill in description/image from litmag.
    """
    litmag_by_slug: dict[str, dict] = {}
    for entry in litmag_entries:
        slug = entry.get("pw_relative", "")
        if slug:
            litmag_by_slug[slug] = entry

    merged: list[dict] = []
    seen_slugs: set[str] = set()

    # Start with ORP entries (authoritative)
    for orp in orp_entries:
        slug = orp.get("pw_relative", "")
        seen_slugs.add(slug)
        entry = dict(orp)
        if slug in litmag_by_slug:
            litmag = litmag_by_slug[slug]
            if not entry.get("description") and litmag.get("description"):
                entry["description"] = litmag["description"]
            if not entry.get("image_url") and litmag.get("image_url"):
                entry["image_url"] = litmag["image_url"]
            # Prefer litmag periods if ORP had none (year-round section)
            if not entry.get("periods") and litmag.get("periods"):
                entry["periods"] = litmag["periods"]
        merged.append(entry)

    # Add any litmag-only entries (should be rare since ORP is comprehensive)
    for slug, litmag in litmag_by_slug.items():
        if slug not in seen_slugs:
            merged.append(litmag)

    return merged


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def crawl(source: dict) -> tuple[int, int, int]:
    """
    Crawl Poets & Writers literary magazine open reading periods.

    Strategy:
      1. Fetch /open-reading-periods — the authoritative curated list of all
         currently-accepting magazines (both timed windows and year-round).
      2. Fetch /literary_magazines?reading_period_status=1 across all pages
         for richer descriptions and images.
      3. Merge by P&W slug, de-duplicate, validate dates.
      4. For each currently-open magazine: insert or update via insert_open_call().

    Returns (found, new, updated).
    """
    source_id = source["id"]
    found = new = updated = 0
    today = date.today()

    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    # ------------------------------------------------------------------
    # Step 1: Open Reading Periods page (primary source)
    # ------------------------------------------------------------------
    logger.info("PW-Magazines: fetching Open Reading Periods page")
    orp_html = _fetch(OPEN_READING_URL, session)
    orp_entries: list[dict] = []
    if orp_html:
        orp_entries = _parse_orp_page(orp_html)
        logger.info("PW-Magazines: ORP page — %d total entries", len(orp_entries))
    else:
        logger.error("PW-Magazines: failed to fetch Open Reading Periods page")

    # ------------------------------------------------------------------
    # Step 2: Literary Magazines DB with open-now filter (all pages)
    # ------------------------------------------------------------------
    litmag_entries: list[dict] = []

    time.sleep(PAGE_FETCH_DELAY_S)
    logger.info("PW-Magazines: fetching literary magazines (open-now filter), page 0")
    litmag_html = _fetch(LIT_MAG_OPEN_URL, session)

    if litmag_html:
        page_entries, last_page = _parse_litmag_page(litmag_html)
        litmag_entries.extend(page_entries)
        logger.debug("PW-Magazines: litmag page 0 — %d entries", len(page_entries))

        if last_page is not None and last_page > 0:
            for page_num in range(1, min(last_page + 1, MAX_PAGES)):
                time.sleep(PAGE_FETCH_DELAY_S)
                page_url = f"{LIT_MAG_OPEN_URL}&page={page_num}"
                page_html = _fetch(page_url, session)
                if not page_html:
                    logger.warning(
                        "PW-Magazines: failed to fetch litmag page %d — stopping pagination",
                        page_num,
                    )
                    break
                page_entries, _ = _parse_litmag_page(page_html)
                litmag_entries.extend(page_entries)
                logger.debug(
                    "PW-Magazines: litmag page %d — %d entries",
                    page_num,
                    len(page_entries),
                )
    else:
        logger.warning("PW-Magazines: failed to fetch literary magazines open-now page")

    logger.info(
        "PW-Magazines: %d ORP entries, %d litmag-DB entries before merge",
        len(orp_entries),
        len(litmag_entries),
    )

    # ------------------------------------------------------------------
    # Step 3: Merge
    # ------------------------------------------------------------------
    all_entries = _merge_entries(orp_entries, litmag_entries)
    logger.info(
        "PW-Magazines: %d merged entries before date filtering", len(all_entries)
    )

    if not all_entries:
        logger.warning(
            "PW-Magazines: no entries found — check if page structure changed"
        )
        return 0, 0, 0

    # ------------------------------------------------------------------
    # Step 4: Process each entry
    # ------------------------------------------------------------------
    skipped_closed = 0
    skipped_no_url = 0
    skipped_small_press = 0

    for entry in all_entries:
        name = entry.get("name", "").strip()
        if not name:
            continue

        pw_relative = entry.get("pw_relative", "")
        if not pw_relative:
            skipped_no_url += 1
            logger.debug("PW-Magazines: skipping %r — no P&W relative URL", name[:60])
            continue

        # Skip small press entries — they're book publishers, not literary magazines.
        # They belong in a separate open_calls crawl focused on book submissions.
        entity_type = entry.get("entity_type", "literary_magazine")
        if entity_type == "small_press":
            skipped_small_press += 1
            logger.debug("PW-Magazines: skipping small press %r", name[:60])
            continue

        pw_full_url = (
            f"{BASE_URL}{pw_relative}" if pw_relative.startswith("/") else pw_relative
        )
        periods = entry.get("periods", [])

        # Date filter: skip entries whose reading period is not currently open.
        # Year-round entries (empty periods) always pass.
        if not _is_currently_open(periods, today):
            skipped_closed += 1
            logger.debug(
                "PW-Magazines: skipping %r — reading period not currently open",
                name[:60],
            )
            continue

        found += 1

        genres = entry.get("genres", [])
        description = entry.get("description", "")
        image_url = entry.get("image_url")
        deadline = _deadline_from_periods(periods, today)

        # Build application_url: the P&W magazine profile page is the canonical
        # submission resource. Writers need to visit it to get submission info.
        # The P&W profile links to the magazine's own submission guidelines.
        application_url = pw_full_url

        call_data: dict = {
            "title": name,
            "description": description or None,
            "deadline": deadline,
            "application_url": application_url,
            "source_url": OPEN_READING_URL,
            "call_type": "submission",
            "eligibility": "International",
            "fee": None,  # P&W ORP/litmag listings don't surface the fee on list views
            "source_id": source_id,
            "confidence_tier": "aggregated",
            "_org_name": name,
            "metadata": {
                "organization": name,
                "genres": genres,
                "entity_type": entity_type,
                "pw_url": pw_full_url,
                "image_url": image_url,
                "reading_periods": (
                    [{"start": s, "end": e} for s, e in periods] if periods else []
                ),
                "year_round": len(periods) == 0,
            },
        }

        content_hash = generate_open_call_hash(name, application_url)
        existing = find_open_call_by_hash(content_hash)

        if existing:
            # Update to refresh deadline and description if they changed
            update_open_call(existing["id"], call_data)
            updated += 1
        else:
            result = insert_open_call(call_data)
            if result:
                new += 1

    if skipped_closed:
        logger.info(
            "PW-Magazines: skipped %d entries — reading period not currently open",
            skipped_closed,
        )
    if skipped_small_press:
        logger.info(
            "PW-Magazines: skipped %d small press entries (different entity type)",
            skipped_small_press,
        )
    if skipped_no_url:
        logger.info("PW-Magazines: skipped %d entries with no URL", skipped_no_url)

    logger.info("PW-Magazines: %d found, %d new, %d updated", found, new, updated)
    return found, new, updated
